import { describe, expect, it } from "vitest";
import { getAppConfig, isAiConfigured, requireGeminiApiKey } from "@/lib/config";

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

describe("lib/config", () => {
  it("reads GEMINI_API_KEY and supported settings from the environment", () => {
    withEnv(
      {
        GEMINI_API_KEY: TEST_KEY,
        GEMINI_MODEL: "gemini-2.5-flash",
        AI_TIMEOUT_MS: "5000",
        AI_MAX_RETRIES: "4",
      },
      () => {
        const cfg = getAppConfig();
        expect(cfg.ai.geminiApiKey).toBe(TEST_KEY);
        expect(cfg.ai.geminiModel).toBe("gemini-2.5-flash");
        expect(cfg.ai.timeoutMs).toBe(5000);
        expect(cfg.ai.maxRetries).toBe(4);
      }
    );
  });

  it("applies defaults when variables are unset or malformed", () => {
    withEnv(
      { GEMINI_API_KEY: undefined, GEMINI_MODEL: undefined, AI_TIMEOUT_MS: "abc", AI_MAX_RETRIES: "-3" },
      () => {
        const cfg = getAppConfig();
        expect(cfg.ai.geminiModel).toBe("gemini-2.5-flash");
        expect(cfg.ai.timeoutMs).toBe(30_000);
        expect(cfg.ai.maxRetries).toBe(2);
      }
    );
  });

  it("trims whitespace around the API key", () => {
    withEnv({ GEMINI_API_KEY: "  AIzaSy-fake-key-for-tests  " }, () => {
      expect(getAppConfig().ai.geminiApiKey).toBe(TEST_KEY);
    });
  });

  it("requireGeminiApiKey throws a friendly error when the key is missing", () => {
    withEnv({ GEMINI_API_KEY: undefined }, () => {
      expect(() => requireGeminiApiKey()).toThrowError(
        expect.objectContaining({ code: "AI_CONFIG_MISSING_KEY", status: 503 })
      );
    });
  });

  it("requireGeminiApiKey throws a friendly error for a malformed key", () => {
    withEnv({ GEMINI_API_KEY: "abc" }, () => {
      expect(() => requireGeminiApiKey()).toThrowError(
        expect.objectContaining({ code: "AI_CONFIG_INVALID" })
      );
    });
  });

  it("requireGeminiApiKey returns the key when present", () => {
    withEnv({ GEMINI_API_KEY: TEST_KEY }, () => {
      expect(requireGeminiApiKey()).toBe(TEST_KEY);
    });
  });

  it("isAiConfigured reflects whether a usable key exists", () => {
    withEnv({ GEMINI_API_KEY: undefined }, () => expect(isAiConfigured()).toBe(false));
    withEnv({ GEMINI_API_KEY: "   " }, () => expect(isAiConfigured()).toBe(false));
    withEnv({ GEMINI_API_KEY: TEST_KEY }, () => expect(isAiConfigured()).toBe(true));
  });
});
