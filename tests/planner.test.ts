import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/lib/ai/gemini";
import { InterviewPlanner } from "@/server/ai/InterviewPlanner";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import { MemoryManager } from "@/server/ai/MemoryManager";
import type { Candidate, InterviewMemory } from "@/server/types";

const mockedGenerate = vi.mocked(generateContent);

function memoryFor(candidate: Candidate, sessionId = "sess"): InterviewMemory {
  return new MemoryManager().buildInitialMemory({
    candidate,
    sessionId,
    personality: "hiring_manager",
  });
}

const planner = new InterviewPlanner();

describe("InterviewPlanner", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("returns a valid planner decision from Gemini (source ai)", async () => {
    mockedGenerate.mockResolvedValueOnce(
      JSON.stringify({
        action: "new_topic",
        curriculumDay: "day-12",
        topic: "Retrieval-Augmented Generation",
        difficulty: "advanced",
        reason: "Cover an uncovered advanced topic.",
        questionType: "scenario",
        referencePreviousAnswer: false,
      })
    );

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const result = await planner.planNext({
      candidate: sara,
      curriculum,
      memory: memoryFor(sara),
      previousQuestion: null,
      previousAnswer: null,
      lastEvaluation: null,
      personality: "hiring_manager",
      transcript: [],
    });

    expect(result.source).toBe("ai");
    expect(result.decision.curriculumDay).toBe("day-12");
    expect(result.decision.questionType).toBe("scenario");
  });

  it("coerces a hallucinated curriculum day to an eligible completed day", async () => {
    mockedGenerate.mockResolvedValueOnce(
      JSON.stringify({
        action: "new_topic",
        curriculumDay: "day-999",
        topic: "Not real",
        difficulty: "intermediate",
        reason: "Should be coerced.",
        questionType: "conceptual",
        referencePreviousAnswer: false,
      })
    );

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const result = await planner.planNext({
      candidate: sara,
      curriculum,
      memory: memoryFor(sara),
      previousQuestion: null,
      previousAnswer: null,
      lastEvaluation: null,
      personality: "hiring_manager",
      transcript: [],
    });

    expect(result.decision.curriculumDay).toBe("day-14");
    expect(sara.completedDays).toContain(result.decision.curriculumDay);
  });

  it("never returns a skipped curriculum day", async () => {
    mockedGenerate.mockResolvedValueOnce(
      JSON.stringify({
        action: "new_topic",
        curriculumDay: "day-4",
        topic: "Visualization & Statistics",
        difficulty: "intermediate",
        reason: "Should be rejected because day-4 is skipped.",
        questionType: "conceptual",
        referencePreviousAnswer: false,
      })
    );

    const omar = await candidateService.getCandidateById("candidate-varun");
    const curriculum = await curriculumService.getCurriculum();
    const result = await planner.planNext({
      candidate: omar,
      curriculum,
      memory: memoryFor(omar),
      previousQuestion: null,
      previousAnswer: null,
      lastEvaluation: null,
      personality: "hiring_manager",
      transcript: [],
    });

    expect(result.decision.curriculumDay).not.toBe("day-4");
    expect(omar.skippedDays).not.toContain(result.decision.curriculumDay);
    expect(omar.completedDays).toContain(result.decision.curriculumDay);
  });

  it("falls back to a deterministic plan when Gemini is unavailable", async () => {
    mockedGenerate.mockRejectedValue(new Error("Gemini outage"));

    const lina = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();
    const result = await planner.planNext({
      candidate: lina,
      curriculum,
      memory: memoryFor(lina),
      previousQuestion: null,
      previousAnswer: null,
      lastEvaluation: null,
      personality: "mentor",
      transcript: [],
    });

    expect(result.source).toBe("fallback");
    expect(lina.completedDays).toContain(result.decision.curriculumDay);
    expect(lina.skippedDays).not.toContain(result.decision.curriculumDay);
  });

  it("plan output satisfies the Zod schema", async () => {
    mockedGenerate.mockResolvedValueOnce(
      JSON.stringify({
        action: "increase_difficulty",
        curriculumDay: "day-7",
        topic: "Deep Learning with PyTorch",
        difficulty: "advanced",
        reason: "Strong previous answer.",
        questionType: "tradeoff",
        referencePreviousAnswer: true,
      })
    );

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const result = await planner.planNext({
      candidate: sara,
      curriculum,
      memory: memoryFor(sara),
      previousQuestion: null,
      previousAnswer: null,
      lastEvaluation: null,
      personality: "senior_engineer",
      transcript: [],
    });

    expect(result.decision).toEqual(
      expect.objectContaining({
        action: expect.any(String),
        curriculumDay: expect.any(String),
        topic: expect.any(String),
        difficulty: expect.any(String),
        reason: expect.any(String),
        questionType: expect.any(String),
        referencePreviousAnswer: expect.any(Boolean),
      })
    );
  });
});
