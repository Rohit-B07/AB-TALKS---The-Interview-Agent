import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/lib/ai/gemini";
import { MockInterviewEngine } from "@/server/engine";
import { InterviewService } from "@/server/services/interview.service";
import { SessionService, type CreateSessionInput } from "@/server/services/session.service";
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
 * null, and `get` parses the stored JSON. One instance stands in for one
 * "Upstash Redis server"; each RedisSessionStore over it is a separate
 * serverless function / browser request.
 */
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

  get raw(): ReadonlyMap<string, string> {
    return this.data;
  }
}

/** A KV client that fails like an Upstash auth/network error would. */
class FailingKvClient implements KvLike {
  async get<T = unknown>(): Promise<T | null> {
    throw new Error('UpstashError: Request failed, command was: ["get","abtalks:session:secret-id"]');
  }

  async set(key: string, value: unknown): Promise<unknown> {
    void key;
    void value;
    throw new Error('UpstashError: Request failed, command was: ["set","abtalks:session:secret-id","{\\"candidate\\":{\\"name\\":\\"Vatsal\\"}}"]');
  }
}

const OPTIONS = { keyPrefix: "abtalks:session", ttlSeconds: 604800 };

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

/**
 * Builds an InterviewService wired to a Redis store over the shared `backend`.
 * Each call is a fresh service + fresh store instance, exactly like two
 * different Vercel serverless invocations sharing one Upstash Redis database.
 */
function makeRedisService(backend: FakeKvClient): InterviewService {
  return new InterviewService(
    new MockInterviewEngine(),
    undefined,
    undefined,
    new SessionService(new RedisSessionStore(backend, OPTIONS))
  );
}

const ANSWER =
  "I would split the data into train and test sets, build a scikit-learn pipeline with " +
  "preprocessing steps, train a regression and a classification model, and evaluate them " +
  "with accuracy, precision, and recall before tuning hyperparameters with grid search.";

const mockedGenerate = vi.mocked(generateContent);

beforeEach(() => {
  mockedGenerate.mockReset();
  mockedGenerate.mockRejectedValue(new Error("Gemini outage"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Redis session persistence — full production-style flow", () => {
  it("keeps the same sessionId for the whole interview and completes over Redis", async () => {
    const backend = new FakeKvClient();
    const service = makeRedisService(backend);

    const { sessionId } = await service.startInterview("candidate-vatsal");

    let lastState: Awaited<ReturnType<InterviewService["submitAnswer"]>> | null = null;
    for (let i = 0; i < 8; i += 1) {
      lastState = await service.submitAnswer(sessionId, ANSWER);
      // F: the id the API hands back never changes across turns.
      expect(lastState.sessionId).toBe(sessionId);
    }

    expect(lastState!.interviewComplete).toBe(true);
    expect(lastState!.questionsAsked).toBe(8);

    // E: a fresh store instance still resolves the same id and persisted state.
    const restarted = makeRedisService(backend);
    const restored = await restarted.getSession(sessionId);
    expect(restored.id).toBe(sessionId);
    expect(restored.status).toBe("completed");
    // Q1 + 8 candidate answers + 7 advancing assistant turns (the 8th answer
    // completes the interview, so no further question is appended).
    expect(restored.transcript.length).toBe(16);

    // Final report is generated and persisted once, keyed by the same id.
    const evaluation = await restarted.getFinalEvaluation(sessionId);
    expect(evaluation.sessionId).toBe(sessionId);
    const reloaded = await restarted.getSession(sessionId);
    expect(reloaded.finalEvaluation?.sessionId).toBe(sessionId);
  });

  it("resumes the exact session on a different instance mid-interview (refresh/other device)", async () => {
    const backend = new FakeKvClient();

    const author = makeRedisService(backend);
    const { sessionId } = await author.startInterview("candidate-varun");

    for (let i = 0; i < 3; i += 1) {
      await author.submitAnswer(sessionId, ANSWER);
    }

    // "Browser refresh" or a second device: a brand-new service/store pair with
    // no local state, only the sessionId from the URL.
    const reconnected = makeRedisService(backend);
    const resumed = await reconnected.getSession(sessionId);
    expect(resumed.id).toBe(sessionId);
    expect(resumed.transcript.length).toBe(7); // Q1 + A1 + Q2 + A2 + Q3 + A3 + Q4
    expect(resumed.currentQuestion).not.toBeNull();
    expect(resumed.questionsAsked).toBe(4);

    // The reconnected instance can continue and finish the same interview.
    let lastState: Awaited<ReturnType<InterviewService["submitAnswer"]>> | null = null;
    for (let i = 0; i < 5; i += 1) {
      lastState = await reconnected.submitAnswer(sessionId, ANSWER);
      expect(lastState.sessionId).toBe(sessionId);
    }
    expect(lastState!.interviewComplete).toBe(true);
  });

  it("lets an unrelated third instance read the same session after updates", async () => {
    const backend = new FakeKvClient();

    const creator = new SessionService(new RedisSessionStore(backend, OPTIONS));
    await creator.createSession(makeCreateInput("sess-third"));

    const writer = new SessionService(new RedisSessionStore(backend, OPTIONS));
    await writer.recordAnswer("sess-third", "hello", {
      questionId: "q-1",
      score: 4,
      understanding: "ok",
      strengths: [],
      weaknesses: [],
      needsFollowUp: false,
      followUpReason: "",
      memoryUpdate: "",
      confidence: 0.5,
      difficultyRecommendation: "same",
    }, {
      candidateId: "candidate-x",
      sessionId: "sess-third",
      personality: "hiring_manager",
      questionNumber: 1,
      totalTargetQuestions: 8,
      coveredDays: [],
      coveredTopics: [],
      questionHistory: ["q-1"],
      answerHistory: ["hello"],
      strengths: [],
      knowledgeGaps: [],
      difficulty: "intermediate",
      currentStage: "building",
      lastEvaluation: null,
      conversationSummary: "Started.",
    });

    const reader = new SessionService(new RedisSessionStore(backend, OPTIONS));
    const read = await reader.getSession("sess-third");
    expect(read.id).toBe("sess-third");
    expect(read.transcript.some((turn) => turn.role === "candidate")).toBe(true);
  });

  it("never leaks session contents or credentials when Redis fails", async () => {
    const store = new RedisSessionStore(new FailingKvClient(), OPTIONS);

    const createError = await store.create(makeSession("secret-id")).catch((error) => error);
    expect(createError.code).toBe("SESSION_STORE_ERROR");
    expect(String(createError.message)).not.toContain("secret-id");
    expect(String(createError.message)).not.toContain("Vatsal");
    expect(String(createError.message)).not.toContain("command was");

    const getError = await store.get("secret-id").catch((error) => error);
    expect(getError.code).toBe("SESSION_STORE_ERROR");
    expect(String(getError.message)).not.toContain("secret-id");

    const updateError = await store.update(makeSession("secret-id")).catch((error) => error);
    expect(updateError.code).toBe("SESSION_STORE_ERROR");
    expect(String(updateError.message)).not.toContain("secret-id");
    expect(String(updateError.message)).not.toContain("Vatsal");
  });

  it("stores a plain JSON document on the wire so any process can read it", async () => {
    const backend = new FakeKvClient();
    const store = new RedisSessionStore(backend, OPTIONS);
    const session = makeSession("sess-wire");

    await store.create(session);
    const raw = backend.raw.get("abtalks:session:sess-wire");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!) as Record<string, unknown>).toMatchObject({
      id: "sess-wire",
      status: "active",
    });
  });
});
