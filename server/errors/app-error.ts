/**
 * Domain error used across the service layer and API handlers.
 *
 * Every error carries a stable machine-readable `code` and an HTTP status.
 * API handlers map `AppError` instances to a JSON error envelope while any
 * other thrown value becomes a generic 500.
 */

export const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  MALFORMED_REQUEST: "MALFORMED_REQUEST",
  INVALID_SESSION: "INVALID_SESSION",
  INVALID_CANDIDATE: "INVALID_CANDIDATE",
  INVALID_CURRICULUM: "INVALID_CURRICULUM",
  MISSING_ANSWER: "MISSING_ANSWER",
  QUESTION_ALREADY_ANSWERED: "QUESTION_ALREADY_ANSWERED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  MALFORMED_REQUEST: 400,
  INVALID_SESSION: 404,
  INVALID_CANDIDATE: 404,
  INVALID_CURRICULUM: 500,
  MISSING_ANSWER: 400,
  QUESTION_ALREADY_ANSWERED: 400,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly issues?: unknown;

  constructor(code: ErrorCode, message: string, options?: { issues?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = HTTP_STATUS_BY_CODE[code];
    this.issues = options?.issues;
  }
}
