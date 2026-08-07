import { NextResponse } from "next/server";
import type { z } from "zod";
import { AppError } from "@/server/errors/app-error";

/** Parses a JSON request body, surfacing a 400 on malformed JSON. */
export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("MALFORMED_REQUEST", "Request body must be valid JSON.");
  }
}

/**
 * Serializes a successful response and validates it against a Zod schema.
 * A schema mismatch means a server bug, so it surfaces as a 500.
 */
export function ok<T>(data: T, schema?: z.ZodType<T>): NextResponse {
  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new AppError("INTERNAL_ERROR", "API produced an invalid response payload.", {
        issues: result.error.issues,
      });
    }
  }
  return NextResponse.json(data);
}

/** Maps any thrown error to a consistent JSON error envelope. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
      { status: error.status }
    );
  }

  console.error("[api] unexpected error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
    { status: 500 }
  );
}
