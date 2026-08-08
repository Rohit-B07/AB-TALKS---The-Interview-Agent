import { describe, expect, it } from "vitest";
import { InMemorySessionStore } from "@/server/store/session-store";
import type { InterviewSession } from "@/server/types";

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

describe("InMemorySessionStore", () => {
  it("persists and retrieves a created session", async () => {
    const store = new InMemorySessionStore();
    const session = makeSession("s1");

    await store.create(session);
    const retrieved = await store.get("s1");

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe("s1");
  });

  it("returns null for a missing session", async () => {
    const store = new InMemorySessionStore();
    expect(await store.get("nope")).toBeNull();
  });

  it("persists updates to an existing session", async () => {
    const store = new InMemorySessionStore();
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
    const store = new InMemorySessionStore();
    await expect(store.update(makeSession("ghost"))).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });

  it("returns copies so callers cannot mutate stored state directly", async () => {
    const store = new InMemorySessionStore();
    await store.create(makeSession("s3"));

    const first = await store.get("s3");
    first!.transcript.push({
      id: "mutated",
      role: "candidate",
      content: "mutated",
      createdAt: new Date().toISOString(),
    });

    const second = await store.get("s3");
    expect(second!.transcript.length).toBe(0);
  });
});
