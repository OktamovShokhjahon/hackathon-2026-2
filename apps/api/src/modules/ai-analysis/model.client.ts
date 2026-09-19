import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { callGroqStructured, type StructuredCallResult } from "./groq.client";
import { callGeminiStructured } from "./gemini.client";

export { NARRATIVE_SCHEMA, type NarrativeOutput, type StructuredCallResult } from "./groq.client";

/**
 * The one entry point the clinical services call. Gemini is the primary model;
 * Groq stays configured as the fallback so a quota or an outage on one free
 * tier does not take the explanations down with it.
 *
 * Whichever provider answers, the contract is the same: strict JSON validated
 * against the caller's schema, and `ok: false` rather than an approximation
 * when neither can be reached. Every caller already handles that case by
 * falling back to the deterministic rule output.
 */
export async function callModelStructured<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  temperature?: number;
}): Promise<StructuredCallResult<T>> {
  if (env.geminiApiKey) {
    const primary = await callGeminiStructured(params);
    if (primary.ok || !env.groqApiKey) return primary;
    logger.warn(
      { error: primary.error, promptVersion: params.promptVersion },
      "Gemini failed; falling back to Groq"
    );
  }

  return callGroqStructured(params);
}
