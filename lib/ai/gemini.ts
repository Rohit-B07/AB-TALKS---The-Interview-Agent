import { GoogleGenAI } from "@google/genai";
import { aiLogger } from "@/lib/ai/logger";
import { isRetryableAiError, messageOf, normalizeAiError } from "@/lib/ai/errors";
import { getAppConfig, isAiConfigured, requireGeminiApiKey } from "@/lib/config";
import { AppError } from "@/server/errors/app-error";

/**
 * Reusable Gemini client for the AI layer.
 *
 * - Initializes the official `@google/genai` SDK from config.
 * - Exposes a lazy singleton plus a retrying wrapper for calls.
 * - No interview prompts live here; that is Phase 2's job.
 */

let cachedClient: GoogleGenAI | null = null;

/** Builds a fresh GoogleGenAI client. Throws a friendly AppError if unusable. */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = requireGeminiApiKey();
  const model = getAppConfig().ai.geminiModel;
  try {
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        // Our retry wrapper owns retries; disable the SDK's internal policy
        // so a single, testable backoff loop governs every call.
        retryOptions: { attempts: 1 },
      },
    });
    aiLogger.info("Gemini client initialized", { model });
    return client;
  } catch (error) {
    aiLogger.error("Failed to initialize Gemini client", error);
    throw new AppError("AI_INITIALIZATION_FAILED", "Failed to initialize the Gemini client.", {
      issues: { cause: messageOf(error) },
    });
  }
}

/** Returns a lazily-created, cached client. */
export function getGeminiClient(): GoogleGenAI {
  if (!cachedClient) cachedClient = createGeminiClient();
  return cachedClient;
}

/** Drops the cached client (used by tests and config reloads). */
export function resetGeminiClient(): void {
  cachedClient = null;
}

/** True when a usable API key is present (no exceptions thrown). */
export function isAiReady(): boolean {
  return isAiConfigured();
}

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  timeoutMs: number;
}

const DEFAULT_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`AI request timed out after ${ms}ms.`), { name: "TimeoutError" }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Runs `operation` with exponential-backoff retries for transient failures
 * (429, 5xx, timeouts). Exhausted failures are normalized to friendly AppErrors.
 */
export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const ai = getAppConfig().ai;
  const maxRetries = options?.maxRetries ?? ai.maxRetries;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const timeoutMs = options?.timeoutMs ?? ai.timeoutMs;

  let attempt = 0;
  for (;;) {
    try {
      return await withTimeout(operation(), timeoutMs);
    } catch (error) {
      if (!isRetryableAiError(error) || attempt >= maxRetries) {
        throw normalizeAiError(error);
      }
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * baseDelayMs);
      aiLogger.warn(
        `Gemini request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`,
        { error: messageOf(error) }
      );
      await sleep(delay);
      attempt += 1;
    }
  }
}

export interface GenerateContentInput {
  /** Model id; defaults to the configured Gemini model. */
  model?: string;
  /** Optional system instruction (string is accepted by the SDK). */
  systemInstruction?: string;
  /** User-facing content: a string, Part, or Content(s). */
  contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"];
  /** Extra generation config (temperature, responseMimeType, ...). */
  config?: Record<string, unknown>;
}

/**
 * Generic text generation with retries and error normalization.
 * Phase 2 prompt builders feed their output into this helper.
 */
export async function generateContent(input: GenerateContentInput): Promise<string> {
  const model = input.model ?? getAppConfig().ai.geminiModel;
  const response = await withGeminiRetry(() =>
    getGeminiClient().models.generateContent({
      model,
      contents: input.contents,
      config: {
        ...(input.systemInstruction ? { systemInstruction: input.systemInstruction } : {}),
        ...input.config,
      },
    })
  );
  const text = response.text ?? "";
  aiLogger.debug("Gemini response received", { model, length: text.length });
  return text;
}
