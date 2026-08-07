import { AppError } from "@/server/errors/app-error";

/**
 * Maps raw errors from the Gemini SDK / network stack into friendly AppErrors
 * and decides whether a failed call is worth retrying. Kept free of the SDK
 * import so it can be unit tested in isolation.
 */

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const TIMEOUT_NAME_RE = /^(TimeoutError|AbortError)$/i;
const TIMEOUT_MESSAGE_RE = /timeout|timed ?out|deadline exceeded|etimedout|aborted/i;

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.code === "number") return candidate.code;
  return undefined;
}

export function isTimeoutLike(error: unknown): boolean {
  if (error instanceof Error) {
    if (TIMEOUT_NAME_RE.test(error.name)) return true;
    return TIMEOUT_MESSAGE_RE.test(error.message);
  }
  return false;
}

/** True when the failure is transient and a retry may succeed. */
export function isRetryableAiError(error: unknown): boolean {
  if (isTimeoutLike(error)) return true;
  const status = readStatus(error);
  return status !== undefined && RETRYABLE_STATUSES.has(status);
}

/** Human-readable one-line description for logs. */
export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Converts any thrown value into a stable, friendly AppError. */
export function normalizeAiError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const status = readStatus(error);

  if (isTimeoutLike(error)) {
    return new AppError(
      "AI_TIMEOUT",
      "The AI service took too long to respond. Please try again."
    );
  }
  if (status === 429) {
    return new AppError(
      "AI_RATE_LIMITED",
      "The AI service is receiving too many requests. Please wait a moment and try again."
    );
  }
  if (status === 401 || status === 403) {
    return new AppError(
      "AI_AUTH_FAILED",
      "The Gemini API rejected the request. Check that GEMINI_API_KEY in .env.local is valid."
    );
  }
  if (error instanceof Error) {
    return new AppError("AI_ERROR", `The AI service failed: ${error.message}`);
  }
  return new AppError("AI_ERROR", "The AI service failed with an unexpected error.");
}
