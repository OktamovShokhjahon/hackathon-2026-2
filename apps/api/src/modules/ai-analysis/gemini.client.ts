import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { StructuredCallResult } from "./groq.client";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

/** How long a single generation may take before we fall back. */
const TIMEOUT_MS = 20_000;

/**
 * Gemini through its REST endpoint. No SDK: the free tier speaks plain HTTP
 * and one fetch is easier to reason about — and to time out — than a client
 * library whose retry behaviour we would have to configure anyway.
 *
 * Like the Groq client, this only ever restates results the deterministic
 * rules already produced. On any failure it returns `ok: false` and the caller
 * falls back to the rule summary rather than showing nothing or inventing.
 */
export async function callGeminiStructured<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  temperature?: number;
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

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_ROOT}/${encodeURIComponent(modelId)}:generateContent`,
      {
        method: "POST",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          // Header rather than a query string, so the key never lands in a
          // proxy or server access log.
          "x-goog-api-key": env.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
          generationConfig: {
            temperature: params.temperature ?? 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      responseId?: string;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!raw.trim()) throw new Error("Gemini returned an empty candidate");

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
  } finally {
    clearTimeout(timer);
  }
}
