import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { DEMO_MODEL_ID, demoResponseFor } from "./demo-fallback";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 45_000;
const RETRYABLE_STATUS = new Set([429, 500, 503]);

export const NARRATIVE_SCHEMA = z.object({
  narrative: z.string(),
  confidence: z.enum(["limited", "moderate", "high"]),
});

export type NarrativeOutput = z.infer<typeof NARRATIVE_SCHEMA>;

export interface StructuredCallResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  modelId: string;
  responseId?: string;
  latencyMs: number;
  tokenUsage?: { prompt: number; completion: number };
}

/** A file the model reads directly, e.g. a scanned page or a phone photo. */
export interface InlineMedia {
  mimeType: string;
  data: Buffer;
}

interface GeminiResponse {
  responseId?: string;
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

export function isAiConfigured(): boolean {
  return Boolean(env.geminiApiKey);
}

async function postWithRetry(url: string, body: string): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiApiKey },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!RETRYABLE_STATUS.has(response.status)) return response;
    // The free tier rate-limits per minute; one short pause clears most bursts.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return response as Response;
}

/**
 * Calls Gemini for a strictly-scoped task and validates the JSON response
 * against the given Zod schema. Never called from the browser; the backend is
 * the only caller. On any failure the caller must fall back to a deterministic
 * "AI unavailable" state rather than fabricate an answer.
 */
async function callGeminiLive<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  temperature?: number;
  media?: InlineMedia[];
}): Promise<StructuredCallResult<T>> {
  const start = Date.now();
  const modelId = env.geminiModel;

  if (!env.geminiApiKey) {
    return {
      ok: false,
      error: "AI_UNAVAILABLE: GEMINI_API_KEY not configured",
      modelId,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const parts: Array<Record<string, unknown>> = [{ text: params.userPrompt }];
    for (const item of params.media ?? []) {
      parts.push({ inlineData: { mimeType: item.mimeType, data: item.data.toString("base64") } });
    }

    const response = await postWithRetry(
      `${GEMINI_ENDPOINT}/${encodeURIComponent(modelId)}:generateContent`,
      JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: params.temperature ?? 0.1,
          responseMimeType: "application/json",
          // Extraction and explanation are bounded tasks; reasoning tokens
          // only add latency against the free-tier quota.
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    );

    const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      throw new Error(`Gemini ${response.status}: ${payload.error?.message ?? response.statusText}`);
    }
    if (payload.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request: ${payload.promptFeedback.blockReason}`);
    }

    const candidate = payload.candidates?.[0];
    const raw = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!raw) throw new Error(`Gemini returned no content (${candidate?.finishReason ?? "unknown"})`);

    const validated = params.schema.parse(JSON.parse(raw));

    return {
      ok: true,
      data: validated,
      modelId,
      responseId: payload.responseId,
      latencyMs: Date.now() - start,
      tokenUsage: {
        prompt: payload.usageMetadata?.promptTokenCount ?? 0,
        completion: payload.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  } catch (err) {
    logger.error({ err, promptVersion: params.promptVersion }, "Gemini structured call failed");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown AI error",
      modelId,
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Free-tier quota is per key, not per clinic, so one busy clinic could starve
 * the rest. Each clinic gets its own per-minute allowance and the key gets a
 * global one just under the provider's limit.
 */
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function withinLimit(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Returns false, without recording a hit, when either allowance is spent. */
function reserveQuota(tenantId?: string): boolean {
  const now = Date.now();
  const count = (key: string) => (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS).length;
  if (count("global") >= env.aiGlobalPerMinute) return false;
  if (tenantId && count("tenant:" + tenantId) >= env.aiTenantPerMinute) return false;
  withinLimit("global", env.aiGlobalPerMinute);
  if (tenantId) withinLimit("tenant:" + tenantId, env.aiTenantPerMinute);
  return true;
}

/**
 * The one entry point for every model call. Order: quota check, live Gemini,
 * then — only when DEMO_AI_FALLBACK is on — a labelled pre-recorded answer.
 * With the fallback off, a failure stays a failure and callers fall back to
 * deterministic output.
 */
export async function callGeminiStructured<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  temperature?: number;
  media?: InlineMedia[];
  /** The clinic making the request, for its per-minute allowance. */
  tenantId?: string;
}): Promise<StructuredCallResult<T>> {
  const start = Date.now();
  const live: StructuredCallResult<T> = reserveQuota(params.tenantId)
    ? await callGeminiLive(params)
    : {
        ok: false,
        error: "AI_RATE_LIMITED: too many AI requests this minute. Wait a moment and try again.",
        modelId: env.geminiModel,
        latencyMs: Date.now() - start,
      };
  if (live.ok || !env.demoAiFallback) return live;

  const canned = demoResponseFor(params.promptVersion);
  const parsed = canned === undefined ? undefined : params.schema.safeParse(canned);
  if (!parsed?.success) return live;

  logger.warn({ promptVersion: params.promptVersion, error: live.error }, "Serving demo fallback answer");
  return { ok: true, data: parsed.data, modelId: DEMO_MODEL_ID, latencyMs: Date.now() - start };
}
