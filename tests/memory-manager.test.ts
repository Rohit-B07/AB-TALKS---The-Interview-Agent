import { describe, expect, it } from "vitest";
import { MemoryManager } from "@/server/ai/MemoryManager";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import type { Candidate, Evaluation, InterviewMemory, InterviewQuestion } from "@/server/types";

function memoryFor(candidate: Candidate, sessionId = "sess"): InterviewMemory {
  return new MemoryManager().buildInitialMemory({
    candidate,
    sessionId,
    personality: "hiring_manager",
  });
}

function evaluationFor(questionId: string, overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    questionId,
    score: 3,
    understanding: "ok",
    strengths: ["Clear reasoning"],
    weaknesses: ["Missed trade-offs"],
    needsFollowUp: true,
    followUpReason: "Probe deeper.",
    memoryUpdate: "Candidate reasons well but lacks trade-off awareness.",
    confidence: 0.7,
    difficultyRecommendation: "same",
    ...overrides,
  };
}

const question: InterviewQuestion = {
  id: "q-1",
  type: "conceptual",
  prompt: "What is RAG?",
  context: "RAG · Retrieval-Augmented Generation",
  difficulty: "advanced",
  relatedDayIds: ["day-12"],
  createdAt: new Date().toISOString(),
};

describe("MemoryManager", () => {
  it("builds an initial memory snapshot for a candidate", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const memory = memoryFor(sara);
    expect(memory.candidateId).toBe("candidate-vatsal");
    expect(memory.personality).toBe("hiring_manager");
    expect(memory.questionNumber).toBe(0);
    expect(memory.totalTargetQuestions).toBe(8);
    expect(memory.coveredDays).toEqual([]);
    expect(memory.lastEvaluation).toBeNull();
    expect(memory.conversationSummary).toContain("Vatsal");
  });

  it("updates memory after an answer: coverage, strengths, gaps, difficulty, summary", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const manager = new MemoryManager();

    const first = await manager.updateMemory({
      memory: memoryFor(sara),
      candidate: sara,
      curriculum,
      question,
      answer: "RAG retrieves relevant chunks and grounds the model output.",
      evaluation: evaluationFor("q-1", { difficultyRecommendation: "harder", score: 4 }),
      personality: "hiring_manager",
    });

    expect(first.questionNumber).toBe(1);
    expect(first.coveredDays).toContain("day-12");
    expect(first.coveredTopics).toContain("Retrieval-Augmented Generation");
    expect(first.questionHistory).toContain("What is RAG?");
    expect(first.answerHistory[0]).toContain("chunks");
    expect(first.strengths).toContain("Clear reasoning");
    expect(first.knowledgeGaps).toContain("Missed trade-offs");
    expect(first.difficulty).toBe("intermediate");
    expect(first.lastEvaluation?.questionId).toBe("q-1");
    expect(first.currentStage).toBe("opening");

    const second = await manager.updateMemory({
      memory: first,
      candidate: sara,
      curriculum,
      question: { ...question, id: "q-2", relatedDayIds: ["day-14"] },
      answer: "I would build an eval set with LLM-as-judge.",
      evaluation: evaluationFor("q-2", { score: 5, difficultyRecommendation: "harder" }),
      personality: "hiring_manager",
    });

    expect(second.questionNumber).toBe(2);
    expect(second.coveredDays).toEqual(["day-12", "day-14"]);
    expect(second.difficulty).toBe("advanced");
    expect(second.answerHistory.length).toBe(2);
    expect(second.currentStage).toBe("building");
  });

  it("lowers difficulty when the recommendation is easier", async () => {
    const lina = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();
    const manager = new MemoryManager();
    const memory = { ...memoryFor(lina), difficulty: "intermediate" as const };

    const updated = await manager.updateMemory({
      memory,
      candidate: lina,
      curriculum,
      question,
      answer: "not sure",
      evaluation: evaluationFor("q-1", { score: 1, difficultyRecommendation: "easier" }),
      personality: "mentor",
    });

    expect(updated.difficulty).toBe("beginner");
    expect(updated.knowledgeGaps.length).toBeGreaterThan(0);
  });

  it("tracks covered topics without duplicates", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const manager = new MemoryManager();
    const memory = { ...memoryFor(sara), coveredTopics: ["Retrieval-Augmented Generation"] };

    const updated = await manager.updateMemory({
      memory,
      candidate: sara,
      curriculum,
      question,
      answer: "answer",
      evaluation: evaluationFor("q-1"),
      personality: "hiring_manager",
    });

    expect(updated.coveredTopics.filter((t) => t === "Retrieval-Augmented Generation")).toHaveLength(1);
  });
});
