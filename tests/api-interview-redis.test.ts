import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KvLike } from "@/server/store/redis-session-store";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

/**
 * Force the production-style session store: every service and API handler in
 * this file resolves through a RedisSessionStore backed by a shared fake KV
 * client, exactly like Vercel serverless functions sharing one Upstash Redis.
 */
vi.mock("@/server/store/session-store", async () => {
  const actual = await vi.importActual<typeof import("@/server/store/session-store")>(
    "@/server/store/session-store"
  );
  const redis = await vi.importActual<typeof import("@/server/store/redis-session-store")>(
    "@/server/store/redis-session-store"
  );

  class FakeKvClient implements KvLike {
    private readonly data = new Map<string, string>();

    async get<T = unknown>(key: string): Promise<T | null> {
      const raw = this.data.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    }

    async set<TData = unknown>(
      key: string,
      value: TData,
      opts?: { ex?: number; xx?: boolean }
    ): Promise<unknown> {
      if (opts?.xx && !this.data.has(key)) {
        return null;
      }
      this.data.set(key, JSON.stringify(value));
      return "OK";
    }
  }

  return {
    ...actual,
    sessionStore: new redis.RedisSessionStore(new FakeKvClient(), {
      keyPrefix: "abtalks:session",
      ttlSeconds: 604800,
    }),
  };
});

import { generateContent } from "@/lib/ai/gemini";
import { handleGetSession } from "@/server/api/get-session";
import { handleStartInterview } from "@/server/api/start-interview";
import { handleSubmitAnswer } from "@/server/api/submit-answer";

const mockedGenerate = vi.mocked(generateContent);

const ANSWER =
  "I would split the data into train and test sets, build a scikit-learn pipeline with " +
  "preprocessing steps, train a regression and a classification model, and evaluate them " +
  "with accuracy, precision, and recall before tuning hyperparameters with grid search.";

beforeEach(() => {
  mockedGenerate.mockReset();
  mockedGenerate.mockRejectedValue(new Error("Gemini outage"));
});

describe("POST /api/interview + GET /api/interview/[sessionId] over Redis", () => {
  it("runs a full start -> answers -> get interview without the session ever going missing", async () => {
    const startResponse = await handleStartInterview(
      new Request("http://localhost/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: "candidate-vatsal" }),
      })
    );
    expect(startResponse.status).toBe(200);
    const startBody = (await startResponse.json()) as { sessionId: string };
    expect(startBody.sessionId).toMatch(/^[0-9a-f-]{36}$/);

    const sessionId = startBody.sessionId;
    let lastState: { sessionId: string };
    for (let i = 0; i < 8; i += 1) {
      const answerResponse = await handleSubmitAnswer(
        new Request("http://localhost/api/interview/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, answer: ANSWER }),
        })
      );
      expect(answerResponse.status).toBe(200);
      lastState = (await answerResponse.json() as { state: { sessionId: string } }).state;
      expect(lastState.sessionId).toBe(sessionId);
    }

    // Browser refresh / another device: GET resolves the same session id.
    const getResponse = await handleGetSession(
      new Request(`http://localhost/api/interview/${sessionId}`),
      sessionId
    );
    expect(getResponse.status).toBe(200);
    const getBody = (await getResponse.json()) as {
      sessionId: string;
      metadata: { status: string; interviewComplete: boolean };
    };
    expect(getBody.sessionId).toBe(sessionId);
    expect(getBody.metadata.status).toBe("completed");
    expect(getBody.metadata.interviewComplete).toBe(true);
  });

  it("returns 404 INVALID_SESSION for an unknown session id", async () => {
    const response = await handleGetSession(
      new Request("http://localhost/api/interview/ghost"),
      "ghost"
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_SESSION");
  });
});
