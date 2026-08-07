/**
 * Lightweight logging for the AI layer.
 *
 * No external services: everything goes to the console with a stable prefix.
 * `debug` is only emitted during development or when AI_DEBUG=true.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function debugEnabled(): boolean {
  if (process.env.AI_DEBUG === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function write(level: LogLevel, message: string, details?: unknown): void {
  const payload = details === undefined ? "" : ` ${formatDetails(details)}`;
  const line = `[ai:${level}] ${message}${payload}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

function formatDetails(details: unknown): string {
  if (details instanceof Error) {
    return details.stack ?? details.message;
  }
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export const aiLogger = {
  debug(message: string, details?: unknown): void {
    if (debugEnabled()) write("debug", message, details);
  },
  info(message: string, details?: unknown): void {
    write("info", message, details);
  },
  warn(message: string, details?: unknown): void {
    write("warn", message, details);
  },
  error(message: string, details?: unknown): void {
    write("error", message, details);
  },
};
