/**
 * Thin fetch wrapper for the client. Parses JSON, throws a typed ApiError on
 * non-2xx responses or network failures, and mirrors the server's error
 * envelope shape.
 */

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    issues?: unknown;
  };
}

export const ErrorCodes = {
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_SESSION: "INVALID_SESSION",
  INVALID_CANDIDATE: "INVALID_CANDIDATE",
  MISSING_ANSWER: "MISSING_ANSWER",
  QUESTION_ALREADY_ANSWERED: "QUESTION_ALREADY_ANSWERED",
  EVALUATION_NOT_AVAILABLE: "EVALUATION_NOT_AVAILABLE",
} as const;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues?: unknown;

  constructor(message: string, code: string, status: number, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "We couldn't reach the server. Check your connection and try again.",
      ErrorCodes.NETWORK_ERROR,
      0
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ErrorEnvelope | null)?.error;
    throw new ApiError(
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.code ?? "UNKNOWN_ERROR",
      response.status,
      error?.issues
    );
  }

  return body as T;
}

/** Maps thrown errors (including ApiError) to a friendly user-facing message. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.NETWORK_ERROR:
        return "Network issue. Check your connection and try again.";
      case ErrorCodes.INVALID_SESSION:
        return "This session has expired or is no longer available.";
      case ErrorCodes.INVALID_CANDIDATE:
        return "We couldn't load that candidate profile.";
      case ErrorCodes.MISSING_ANSWER:
        return "Please write an answer before submitting.";
      case ErrorCodes.QUESTION_ALREADY_ANSWERED:
        return "This question was already answered.";
      case ErrorCodes.EVALUATION_NOT_AVAILABLE:
        return "Your report will be available once the interview is complete.";
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
