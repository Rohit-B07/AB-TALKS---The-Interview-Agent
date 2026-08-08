import { describe, expect, it } from "vitest";
import { InMemorySessionStore } from "@/server/store/session-store";
import { SessionService } from "@/server/services/session.service";
import { MemoryManager } from "@/server/ai/MemoryManager";
import type { InterviewSession } from "@/server/types";

function baseSession(store: InMemorySessionStore): InterviewSession {
  const memoryManager = new MemoryManager();
  const candidate = {
    id: "candidate-sara",
    name: "Sara Al-Rashid",
    defaultMode: "ai_engineering" as const,
    completedDays: ["day-7"],
    skippedDays: [] as string[],
    attempts: 1,
    strengths: [] as string[],
    weaknesses: [] as string[],
    learningSignals: [] as string[],
  };
  const curriculum = [
    {
      id: "day-7",
      day: 7,
      module: "Deep Learning",
      topic: "Deep Learning with PyTorch",
      learningObjectives: ["Run a full training loop"],
      tools: ["PyTorch"],
      difficulty: "intermediate" as const,
    },
  ];
  const firstQuestion = {
    id: "q-1",
    type: "conceptual" as const,
    prompt: "What is a training loop?",
    context: "Deep Learning · PyTorch",
    difficulty: "intermediate" as const,
    relatedDayIds: ["day-7"],
    createdAt: new Date().toISOString(),
  };
  return {
    id: "sess-dupe",
    candidate,
    curriculum,
    transcript: [],
    currentQuestion: firstQuestion,
    personality: "hiring_manager",
    mode: "ai_engineering",
    currentQuestionNumber: 1,
    questionsAsked: 1,
    coveredDays: ["day-7"],
    coveredTopics: ["Deep Learning with PyTorch"],
    evaluations: [],
    memory: memoryManager.buildInitialMemory({
      candidate,
      sessionId: "sess-dupe",
      personality: "hiring_manager",
    }),
    currentQuestionSource: null,
    status: "active",
    finalEvaluation: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("SessionService (adaptive lifecycle)", () => {
  it("rejects a duplicate answer to the current question", async () => {
    const store = new InMemorySessionStore();
    const service = new SessionService(store);
    await store.create(baseSession(store));

    const memory = { ...baseSession(store).memory };
    const evaluation = {
      questionId: "q-1",
      score: 3,
      understanding: "ok",
      strengths: ["x"],
      weaknesses: [],
      needsFollowUp: false,
      followUpReason: "",
      memoryUpdate: "",
      confidence: 0.5,
      difficultyRecommendation: "same" as const,
    };

    await service.recordAnswer("sess-dupe", "First attempt.", evaluation, memory);
    await expect(
      service.recordAnswer("sess-dupe", "Second attempt.", evaluation, memory)
    ).rejects.toMatchObject({ code: "QUESTION_ALREADY_ANSWERED", status: 400 });
  });

  it("advances the interview and tracks curriculum coverage", async () => {
    const store = new InMemorySessionStore();
    const service = new SessionService(store);
    await store.create(baseSession(store));

    const next = {
      id: "q-2",
      type: "tradeoff" as const,
      prompt: "What trade-off does that introduce?",
      context: "Deep Learning · PyTorch",
      difficulty: "advanced" as const,
      relatedDayIds: ["day-7"],
      createdAt: new Date().toISOString(),
    };

    const advanced = await service.advance("sess-dupe", next, "ai");
    expect(advanced.questionsAsked).toBe(2);
    expect(advanced.currentQuestionNumber).toBe(2);
    expect(advanced.currentQuestion?.id).toBe("q-2");
    expect(advanced.currentQuestionSource).toBe("ai");
    expect(advanced.coveredDays).toContain("day-7");
    expect(advanced.transcript[advanced.transcript.length - 1].role).toBe("assistant");
  });

  it("marks a session complete and clears the active question", async () => {
    const store = new InMemorySessionStore();
    const service = new SessionService(store);
    const session = await store.create(baseSession(store));
    const completed = await service.complete(session);
    expect(completed.status).toBe("completed");
    expect(completed.currentQuestion).toBeNull();
    expect(completed.currentQuestionSource).toBeNull();
  });
});
