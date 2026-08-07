import { readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { AppError, type ErrorCode } from "@/server/errors/app-error";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Reads a JSON file from /data and validates it against a Zod schema.
 * Any read or validation failure surfaces as an AppError so the API layer
 * can respond with a consistent error envelope.
 */
export async function readJsonFile<T>(
  filename: string,
  schema: z.ZodType<T>,
  errorCode: ErrorCode
): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path.join(DATA_DIR, filename), "utf-8");
  } catch {
    throw new AppError(errorCode, `Failed to read mock data file "${filename}".`);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AppError(errorCode, `Mock data file "${filename}" is not valid JSON.`);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(errorCode, `Mock data file "${filename}" failed validation.`, {
      issues: result.error.issues,
    });
  }

  return result.data;
}
