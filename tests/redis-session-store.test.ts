import { afterEach, describe, expect, it } from "vitest";
import { handleGetSession } from "@/server/api/get-session";
import { MockInterviewEngine } from "@/server/engine";
import { InterviewService } from "@/server/services/interview.service";
import { SessionService, type CreateSessionInput } from "@/server/services/session.service";
import { createSessionStore, InMemorySessionStore } from "@/server/store/session-store";
import { RedisSessionStore, type KvLike } from "@/server/store/redis-session-store";
import type {
  Candidate,
  CurriculumDay,
  InterviewMemory,
  InterviewQuestion,
  InterviewSession,
} from "@/server/types";

/**
 * In-memory fake that mirrors @upstash/redis semantics: values are stored as
 * JSON strings, `set` with `xx: true` refuses to create a new key and returns
 * null, and `get` parses the stored JSON.
 */
class FakeKvClient implements KvLike {
  private readonly data = new Map<string, string>();
  readonly setCalls: { key: string; opts?: { ex?: number; xx?: boolean } }[] = [];

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = this.data.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async set<TData = unknown>(
    key: string,
    value: TData,
    opts?: { ex?: number; xx?: boolean }
  ): Promise<unknown> {
    this.setCalls.push({ key, opts });
    if (opts?.xx && !this.data.has(key)) {
      return null;
    }
    this.data.set(key, JSON.stringify(value));
    return "OK";
  }

  get raw(): ReadonlyMap<string, string> {
    return this.data;
  }
}

function makeSession(id: string): InterviewSession {
  const now = new Date().toISOString();
  return {
    id,
    candidate: {
      id: "candidate-x",
      name: "Test Candidate",
      defaultMode: "ai_engineering",
      completedDays: [],
      skippedDays: [],
      attempts: 1,
      strengths: [],
      weaknesses: [],
      learningSignals: [],
    },
    curriculum: [],
    transcript: [],
    currentQuestion: null,
    personality: "hiring_manager",
    mode: "ai_engineering",
    currentQuestionNumber: 0,
    questionsAsked: 0,
    coveredDays: [],
    coveredTopics: [],
    evaluations: [],
    memory: {
      candidateId: "candidate-x",
      sessionId: id,
      personality: "hiring_manager",
      questionNumber: 0,
      totalTargetQuestions: 8,
      coveredDays: [],
      coveredTopics: [],
      questionHistory: [],
      answerHistory: [],
      strengths: [],
      knowledgeGaps: [],
      difficulty: "beginner",
      currentStage: "opening",
      lastEvaluation: null,
      conversationSummary: "No conversation yet.",
    },
    currentQuestionSource: null,
    status: "active",
    finalEvaluation: null,
    createdAt: now,
    updatedAt: now,
  };
}

const OPTIONS = { keyPrefix: "abtalks:session", ttlSeconds: 3600 };

describe("RedisSessionStore", () => {
  it("persists and retrieves a created session under a namespaced key", async () => {
    const client = new FakeKvClient();
    const store = new RedisSessionStore(client, OPTIONS);

    await store.create(makeSession("s1"));
    const retrieved = await store.get("s1");

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe("s1");
    expect(client.setCalls[0].key).toBe("abtalks:session:s1");
    expect(client.setCalls[0].opts?.ex).toBe(3600);
  });

  it("returns null for a missing session", async () => {
    const store = new RedisSessionStore(new FakeKvClient(), OPTIONS);
    expect(await store.get("nope")).toBeNull();
  });

  it("persists updates to an existing session", async () => {
    const client = new FakeKvClient();
    const store = new RedisSessionStore(client, OPTIONS);
    const session = makeSession("s2");
    await store.create(session);

    session.transcript.push({
      id: "turn-1",
      role: "candidate",
      content: "hello",
      createdAt: new Date().toISOString(),
    });

    const updated = await store.update(session);
    expect(updated.transcript.length).toBe(1);
    expect((await store.get("s2"))!.transcript.length).toBe(1);
  });

  it("rejects updates to a session that does not exist", async () => {
    const store = new RedisSessionStore(new FakeKvClient(), OPTIONS);
    await expect(store.update(makeSession("ghost"))).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });

  it("refreshes the TTL on update via SET ... XX", async () => {
    const client = new FakeKvClient();
    const store = new RedisSessionStore(client, OPTIONS);
    const session = makeSession("s4");
    await store.create(session);

    await store.update(session);
    const updateCall = client.setCalls.find((c) => c.key === "abtalks:session:s4" && c.opts?.xx);
    expect(updateCall?.opts?.xx).toBe(true);
    expect(updateCall?.opts?.ex).toBe(3600);
  });

  it("stores JSON on the wire so state survives across processes", async () => {
    const client = new FakeKvClient();
    const store = new RedisSessionStore(client, OPTIONS);
    const session = makeSession("s5");
    await store.create(session);

    expect(client.raw.get("abtalks:session:s5")).toContain('"candidate"');
    expect(client.raw.get("abtalks:session:s5")).toContain('"conversationSummary"');
  });
});

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("createSessionStore factory", () => {
  it("returns the in-memory store by default", () => {
    delete process.env.SESSION_STORE;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
    expect(createSessionStore()).toBeInstanceOf(InMemorySessionStore);
  });

  it("returns the redis store when UPSTASH_REDIS_REST_URL and TOKEN are set", () => {
    delete process.env.SESSION_STORE;
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(createSessionStore()).toBeInstanceOf(RedisSessionStore);
  });

  it("falls back to redis when the Vercel KV vars are set", () => {
    delete process.env.SESSION_STORE;
    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "token";
    expect(createSessionStore()).toBeInstanceOf(RedisSessionStore);
  });

  it("honours SESSION_STORE=memory even when redis env vars are present", () => {
    process.env.SESSION_STORE = "memory";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(createSessionStore()).toBeInstanceOf(InMemorySessionStore);
  });

  it("throws when SESSION_STORE=redis is set without credentials", () => {
    process.env.SESSION_STORE = "redis";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    expect(() => createSessionStore()).toThrowError(
      expect.objectContaining({ code: "SESSION_STORE_MISCONFIGURED" })
    );
  });
});

function makeCreateInput(id: string): CreateSessionInput {
  const now = new Date().toISOString();
  const candidate: Candidate = {
    id: "candidate-x",
    name: "Test Candidate",
    defaultMode: "ai_engineering",
    completedDays: [],
    skippedDays: [],
    attempts: 1,
    strengths: [],
    weaknesses: [],
    learningSignals: [],
  };
  const curriculum: CurriculumDay[] = [];
  const firstQuestion: InterviewQuestion = {
    id: "q-1",
    type: "conceptual",
    prompt: "What is a training loop?",
    context: "Deep Learning · PyTorch",
    difficulty: "intermediate",
    relatedDayIds: [],
    createdAt: now,
  };
  const initialMemory: InterviewMemory = {
    candidateId: candidate.id,
    sessionId: id,
    personality: "hiring_manager",
    questionNumber: 0,
    totalTargetQuestions: 8,
    coveredDays: [],
    coveredTopics: [],
    questionHistory: [],
    answerHistory: [],
    strengths: [],
    knowledgeGaps: [],
    difficulty: "beginner",
    currentStage: "opening",
    lastEvaluation: null,
    conversationSummary: "No conversation yet.",
  };
  return {
    id,
    candidate,
    curriculum,
    firstQuestion,
    personality: "hiring_manager",
    mode: "ai_engineering",
    initialMemory,
  };
}

describe("RedisSessionStore across serverless instances (shared Redis backend)", () => {
  it("finds a session created on a different store instance", async () => {
    const backend = new FakeKvClient(); // one shared "Upstash Redis" server
    const instanceA = new RedisSessionStore(backend, OPTIONS);
    const instanceB = new RedisSessionStore(backend, OPTIONS);

    await instanceA.create(makeSession("sess-shared"));

    const retrieved = await instanceB.get("sess-shared");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe("sess-shared");
  });
});

describe("SessionService over RedisSessionStore (production-style separate requests)", () => {
  it("retrieves the exact session id created by another service/store instance", async () => {
    const backend = new FakeKvClient();
    const creator = new SessionService(new RedisSessionStore(backend, OPTIONS));
    const reader = new SessionService(new RedisSessionStore(backend, OPTIONS));

    await creator.createSession(makeCreateInput("sess-cross"));

    const restored = await reader.getSession("sess-cross");
    expect(restored.id).toBe("sess-cross");
  });

  it("returns INVALID_SESSION for an unknown session id", async () => {
    const service = new SessionService(new RedisSessionStore(new FakeKvClient(), OPTIONS));
    await expect(service.getSession("sess-unknown")).rejects.toMatchObject({
      code: "INVALID_SESSION",
      status: 404,
    });
  });
});

describe("InterviewService over RedisSessionStore (URL/session-id flow)", () => {
  it("keeps the same session id resolvable across fresh service instances", async () => {
    const backend = new FakeKvClient();
    const creator = new InterviewService(
      new MockInterviewEngine(),
      undefined,
      undefined,
      new SessionService(new RedisSessionStore(backend, OPTIONS))
    );

    const { sessionId } = await creator.startInterview("candidate-vatsal");

    const reader = new InterviewService(
      new MockInterviewEngine(),
      undefined,
      undefined,
      new SessionService(new RedisSessionStore(backend, OPTIONS))
    );
    const session = await reader.getSession(sessionId);
    expect(session.id).toBe(sessionId);
  });

  it("the GET /api/interview/[sessionId] route resolves the session id from the URL", async () => {
    const { interviewService } = await import("@/server/services/interview.service");
    const { sessionId } = await interviewService.startInterview("candidate-vatsal");

    const response = await handleGetSession(
      new Request(`http://localhost/api/interview/${sessionId}`),
      sessionId
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sessionId: string };
    expect(body.sessionId).toBe(sessionId);
  });

  it("the GET /api/interview/[sessionId] route returns 404 INVALID_SESSION for an unknown session id", async () => {
    const response = await handleGetSession(
      new Request("http://localhost/api/interview/ghost"),
      "ghost"
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_SESSION");
  });
});
