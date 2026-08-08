import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/lib/ai/gemini";
import { AnswerEvaluator } from "@/server/ai/AnswerEvaluator";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import { MemoryManager } from "@/server/ai/MemoryManager";
import type { Candidate, InterviewMemory, InterviewQuestion } from "@/server/types";

const mockedGenerate = vi.mocked(generateContent);

function memoryFor(candidate: Candidate, sessionId = "sess"): InterviewMemory {
  return new MemoryManager().buildInitialMemory({
    candidate,
    sessionId,
    personality: "hiring_manager",
  });
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

const evaluator = new AnswerEvaluator();

describe("AnswerEvaluator", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("parses a valid evaluation, attaches the question id, and clamps the score", async () => {
    mockedGenerate.mockResolvedValueOnce(
      JSON.stringify({
        score: 4.7,
        understanding: "Solid grasp of retrieval.",
        strengths: ["Clear trade-off reasoning"],
        weaknesses: [],
        needsFollowUp: true,
        followUpReason: "Probe document freshness.",
        memoryUpdate: "Strong on RAG basics.",
        confidence: 0.9,
        difficultyRecommendation: "harder",
      })
    );

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const result = await evaluator.evaluateAnswer({
      candidate: sara,
      curriculum,
      question,
      answer: "RAG retrieves documents and passes them to an LLM.",
      memory: memoryFor(sara),
      personality: "hiring_manager",
    });

    expect(result.source).toBe("ai");
    expect(result.evaluation.questionId).toBe("q-1");
    expect(result.evaluation.score).toBe(5);
    expect(result.evaluation.difficultyRecommendation).toBe("harder");
    expect(result.evaluation.confidence).toBe(0.9);
  });

  it("clamps out-of-range scores to 1..5", async () => {
    mockedGenerate.mockResolvedValueOnce(
      JSON.stringify({
        score: 9,
        understanding: "ok",
        strengths: [],
        weaknesses: [],
        needsFollowUp: false,
        followUpReason: "",
        memoryUpdate: "",
        confidence: 2,
        difficultyRecommendation: "same",
      })
    );

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const result = await evaluator.evaluateAnswer({
      candidate: sara,
      curriculum,
      question,
      answer: "test",
      memory: memoryFor(sara),
      personality: "hiring_manager",
    });

    expect(result.evaluation.score).toBe(5);
    expect(result.evaluation.confidence).toBe(1);
  });

  it("recovers from malformed JSON via the correction retry", async () => {
    mockedGenerate
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(
        JSON.stringify({
          score: 2,
          understanding: "Weak.",
          strengths: [],
          weaknesses: ["Shallow"],
          needsFollowUp: true,
          followUpReason: "Needs basics.",
          memoryUpdate: "",
          confidence: 0.6,
          difficultyRecommendation: "easier",
        })
      );

    const omar = await candidateService.getCandidateById("candidate-varun");
    const curriculum = await curriculumService.getCurriculum();
    const result = await evaluator.evaluateAnswer({
      candidate: omar,
      curriculum,
      question,
      answer: "RAG is good.",
      memory: memoryFor(omar),
      personality: "mentor",
    });

    expect(result.source).toBe("ai");
    expect(result.evaluation.score).toBe(2);
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });

  it("falls back to a heuristic evaluation when Gemini is unavailable", async () => {
    mockedGenerate.mockRejectedValue(new Error("Gemini outage"));

    const lina = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();
    const result = await evaluator.evaluateAnswer({
      candidate: lina,
      curriculum,
      question,
      answer: "RAG retrieves documents.",
      memory: memoryFor(lina),
      personality: "hiring_manager",
    });

    expect(result.source).toBe("fallback");
    expect(result.evaluation.score).toBeGreaterThanOrEqual(1);
    expect(result.evaluation.score).toBeLessThanOrEqual(5);
    expect(result.evaluation.questionId).toBe("q-1");
  });
});
