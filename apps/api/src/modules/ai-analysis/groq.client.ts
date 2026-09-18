import Groq from "groq-sdk";
import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

const groqClient = env.groqApiKey ? new Groq({ apiKey: env.groqApiKey }) : null;

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

/**
 * Calls Groq for a strictly-scoped explanation task and validates the JSON
 * response against the given Zod schema. Never called directly from the
 * browser; the backend is the only caller. On any failure, the caller must
 * fall back to a deterministic "AI unavailable" state rather than fabricate.
 */
export async function callGroqStructured<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  temperature?: number;
}): Promise<StructuredCallResult<T>> {
  const start = Date.now();
  if (!groqClient) {
    return {
      ok: false,
      error: "AI_UNAVAILABLE: GROQ_API_KEY not configured",
      modelId: env.groqModel,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const completion = await groqClient.chat.completions.create({
      model: env.groqModel,
      temperature: params.temperature ?? 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsedJson = JSON.parse(raw);
    const validated = params.schema.parse(parsedJson);

    return {
      ok: true,
      data: validated,
      modelId: env.groqModel,
      responseId: completion.id,
      latencyMs: Date.now() - start,
      tokenUsage: {
        prompt: completion.usage?.prompt_tokens ?? 0,
        completion: completion.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    logger.error({ err, promptVersion: params.promptVersion }, "Groq structured call failed");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown AI error",
      modelId: env.groqModel,
      latencyMs: Date.now() - start,
    };
  }
}
