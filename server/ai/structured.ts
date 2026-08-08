import type { z } from "zod";
import { generateContent } from "@/lib/ai/gemini";
import { aiLogger } from "@/lib/ai/logger";
import { AI_JSON_TEMPERATURE } from "@/server/ai/constants";

/**
 * Parses and validates structured (JSON) Gemini output.
 *
 * Gemini is treated as untrusted: if the model returns malformed JSON or a
 * schema-invalid object we retry once with a correction prompt and, if that
 * still fails, call the caller's safe fallback. The application never crashes
 * on bad LLM output.
 */

/** Pulls the outermost JSON object out of a model response (strips fences). */
export function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

/** Attempts a lenient JSON parse, throwing on failure. */
export function parseJsonLoose(text: string): unknown {
  const object = extractJsonObject(text);
  if (!object) throw new Error("No JSON object found in the model response.");
  return JSON.parse(object);
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Clamps numeric fields that fall outside their schema bounds (e.g. a score
 * of 9 into 1-5, confidence of 2 into 0-1) instead of failing validation.
 * Only out-of-range numbers are repaired; any other schema violation still
 * rejects so the retry + fallback path can kick in.
 */
export function clampOutOfRange<T>(data: unknown, schema: z.ZodType<T>): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return data;

  const record = { ...(data as Record<string, unknown>) };
  const attempt = schema.safeParse(record);
  if (attempt.success) return record;

  for (const issue of attempt.error.issues) {
    if (issue.path.length !== 1 || typeof record[String(issue.path[0])] !== "number") continue;
    const key = String(issue.path[0]);
    const value = record[key] as number;
    if (issue.code === "too_big") {
      const maximum = (issue as unknown as { maximum?: number }).maximum;
      if (maximum !== undefined) record[key] = Math.min(value, maximum);
    } else if (issue.code === "too_small") {
      const minimum = (issue as unknown as { minimum?: number }).minimum;
      if (minimum !== undefined) record[key] = Math.max(value, minimum);
    }
  }
  return record;
}

/** Safe parse + Zod validation of a model response (with numeric clamping). */
export function validateStructured<T>(text: string, schema: z.ZodType<T>): ValidationResult<T> {
  try {
    const data = parseJsonLoose(text);
    const normalized = clampOutOfRange(data, schema);
    const result = schema.safeParse(normalized);
    if (!result.success) {
      return { ok: false, error: `Schema validation failed: ${result.error.message}` };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function buildCorrectionPrompt(user: string, badOutput: string, error: string): string {
  return [
    "Your previous response was rejected because it was not valid, schema-valid JSON.",
    "Previous response:",
    JSON.stringify(badOutput.slice(0, 2000)),
    `Validation error: ${error}`,
    "Re-respond with ONLY a single valid JSON object matching the required schema.",
    "Do not include explanations, prose, or markdown fences.",
    "",
    "Original instructions:",
    user,
  ].join("\n\n");
}

export interface StructuredRequestOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  fallback: () => T;
}

/**
 * Requests structured JSON from Gemini with malformed-output recovery:
 * safe parse -> one corrected retry -> caller fallback.
 *
 * Network-level failures are intentionally NOT caught here; the AI services
 * catch those and use their deterministic fallback so a Gemini outage never
 * destroys an interview session.
 */
export async function requestStructuredJSON<T>(options: StructuredRequestOptions<T>): Promise<T> {
  const { system, user, schema, fallback } = options;
  const config = { responseMimeType: "application/json", temperature: AI_JSON_TEMPERATURE };

  const first = await generateContent({ systemInstruction: system, contents: user, config });
  const firstCheck = validateStructured(first, schema);
  if (firstCheck.ok) return firstCheck.data;

  aiLogger.warn("Structured AI output failed validation; retrying with a correction prompt.", {
    error: firstCheck.error,
  });

  const retry = await generateContent({
    systemInstruction: system,
    contents: buildCorrectionPrompt(user, first, firstCheck.error),
    config,
  });
  const secondCheck = validateStructured(retry, schema);
  if (secondCheck.ok) return secondCheck.data;

  aiLogger.warn("Structured AI output failed again; using safe fallback.", {
    error: secondCheck.error,
  });
  return fallback();
}
