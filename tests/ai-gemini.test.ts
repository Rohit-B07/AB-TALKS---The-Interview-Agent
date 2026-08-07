import { afterEach, describe, expect, it } from "vitest";
import {
  createGeminiClient,
  getGeminiClient,
  isAiReady,
  resetGeminiClient,
  withGeminiRetry,
} from "@/lib/ai/gemini";
import { isRetryableAiError, normalizeAiError } from "@/lib/ai/errors";
import { AppError } from "@/server/errors/app-error";

const TEST_KEY = "AIzaSy-fake-key-for-tests";

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function rateLimitError(): Error {
  return Object.assign(new Error("RESOURCE_EXHAUSTED: rate limit"), { status: 429 });
}

describe("lib/ai/gemini", () => {
  afterEach(() => {
    resetGeminiClient();
  });

  it("isAiReady reflects whether a key is configured", () => {
    withEnv({ GEMINI_API_KEY: undefined }, () => expect(isAiReady()).toBe(false));
    withEnv({ GEMINI_API_KEY: TEST_KEY }, () => expect(isAiReady()).toBe(true));
  });

  it("createGeminiClient initializes the official SDK client", () => {
    withEnv({ GEMINI_API_KEY: TEST_KEY }, () => {
      const client = createGeminiClient();
      expect(typeof client.models.generateContent).toBe("function");
    });
  });

  it("getGeminiClient caches a single instance", () => {
    withEnv({ GEMINI_API_KEY: TEST_KEY }, () => {
      const first = getGeminiClient();
      expect(getGeminiClient()).toBe(first);
      resetGeminiClient();
      const second = getGeminiClient();
      expect(second).not.toBe(first);
    });
  });

  it("createGeminiClient throws a friendly error when the key is missing", () => {
    withEnv({ GEMINI_API_KEY: undefined }, () => {
      expect(() => createGeminiClient()).toThrowError(
        expect.objectContaining({ code: "AI_CONFIG_MISSING_KEY" })
      );
    });
  });

  it("withGeminiRetry retries a transient failure and succeeds", async () => {
    let calls = 0;
    const result = await withGeminiRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw rateLimitError();
        return "ok";
      },
      { maxRetries: 2, baseDelayMs: 0, timeoutMs: 2000 }
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("withGeminiRetry normalizes an exhausted rate limit into AI_RATE_LIMITED", async () => {
    await expect(
      withGeminiRetry(
        async () => {
          throw rateLimitError();
        },
        { maxRetries: 1, baseDelayMs: 0, timeoutMs: 2000 }
      )
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED", status: 429 });
  });

  it("withGeminiRetry maps timeouts to AI_TIMEOUT", async () => {
    const timeoutError = Object.assign(new Error("request timed out after 10s"), { name: "TimeoutError" });
    await expect(
      withGeminiRetry(
        async () => {
          throw timeoutError;
        },
        { maxRetries: 0, baseDelayMs: 0, timeoutMs: 2000 }
      )
    ).rejects.toMatchObject({ code: "AI_TIMEOUT", status: 504 });
  });

  it("withGeminiRetry does not retry permanent errors", async () => {
    let calls = 0;
    await expect(
      withGeminiRetry(
        async () => {
          calls += 1;
          throw Object.assign(new Error("invalid argument"), { status: 400 });
        },
        { maxRetries: 3, baseDelayMs: 0, timeoutMs: 2000 }
      )
    ).rejects.toMatchObject({ code: "AI_ERROR" });
    expect(calls).toBe(1);
  });

  it("error classification treats 429/5xx/timeouts as retryable", () => {
    expect(isRetryableAiError(rateLimitError())).toBe(true);
    expect(isRetryableAiError(Object.assign(new Error("boom"), { status: 503 }))).toBe(true);
    expect(isRetryableAiError(new Error("operation timed out"))).toBe(true);
    expect(isRetryableAiError(Object.assign(new Error("nope"), { status: 400 }))).toBe(false);
  });

  it("normalizeAiError passes through AppError instances", () => {
    const appError = new AppError("AI_RATE_LIMITED", "rate limited");
    expect(normalizeAiError(appError)).toBe(appError);
  });
});
