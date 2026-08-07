import { AppError } from "@/server/errors/app-error";

/**
 * Central configuration for the app.
 *
 * Values are read from process.env at call time (never cached at module
 * scope) so tests and serverless environments can inject values freely.
 * Next.js loads .env.local natively; no extra dotenv wiring is required.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_AI_TIMEOUT_MS = 30_000;
export const DEFAULT_AI_MAX_RETRIES = 2;

export interface AiConfig {
  /** Raw Gemini API key, or null when unset/blank. */
  geminiApiKey: string | null;
  /** Model id passed to the Gemini client. */
  geminiModel: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /** Max retries for transient AI failures. */
  maxRetries: number;
}

export interface AppConfig {
  ai: AiConfig;
}

/** Reads a positive integer env var, falling back to a default. */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

/** Reads the current configuration from the environment. */
export function getAppConfig(): AppConfig {
  return {
    ai: {
      geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
      geminiModel: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      timeoutMs: parsePositiveInt(process.env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS),
      maxRetries: parsePositiveInt(process.env.AI_MAX_RETRIES, DEFAULT_AI_MAX_RETRIES),
    },
  };
}

/**
 * Returns the configured Gemini API key or throws a friendly error.
 * Guards against blank and obviously-malformed keys.
 */
export function requireGeminiApiKey(config: AppConfig = getAppConfig()): string {
  const key = config.ai.geminiApiKey;
  if (!key) {
    throw new AppError(
      "AI_CONFIG_MISSING_KEY",
      "GEMINI_API_KEY is not set. Copy .env.example to .env.local, add your Gemini API key, then restart the dev server."
    );
  }
  if (key.length < 5) {
    throw new AppError(
      "AI_CONFIG_INVALID",
      "GEMINI_API_KEY looks invalid. Double-check the key in your .env.local file."
    );
  }
  return key;
}

/** True when the AI layer is safe to use (a usable key is present). */
export function isAiConfigured(): boolean {
  try {
    requireGeminiApiKey();
    return true;
  } catch {
    return false;
  }
}
