import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/lib/ai/gemini";
import { QuestionGenerator } from "@/server/ai/QuestionGenerator";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import { MemoryManager } from "@/server/ai/MemoryManager";
import type { Candidate, InterviewMemory } from "@/server/types";
import type { PlannerDecision } from "@/server/ai/schemas";

const mockedGenerate = vi.mocked(generateContent);

function memoryFor(candidate: Candidate, sessionId = "sess"): InterviewMemory {
  return new MemoryManager().buildInitialMemory({
    candidate,
    sessionId,
    personality: "hiring_manager",
  });
}

const plan: PlannerDecision = {
  action: "new_topic",
  curriculumDay: "day-12",
  topic: "Retrieval-Augmented Generation",
  difficulty: "advanced",
  reason: "Cover an uncovered advanced topic.",
  questionType: "tradeoff",
  referencePreviousAnswer: false,
};

const generator = new QuestionGenerator();

describe("QuestionGenerator", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("returns exactly one question with the requested difficulty, topic, and type", async () => {
    mockedGenerate.mockResolvedValueOnce(
      "Why did you choose cosine similarity for this retrieval pipeline, and what would change if your embedding space became very large?"
    );

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-12")!;

    const result = await generator.generateQuestion({
      candidate: sara,
      curriculum,
      day,
      plan,
      memory: memoryFor(sara),
      previousAnswer: null,
      personality: "hiring_manager",
      questionHistory: [],
    });

    expect(result.source).toBe("ai");
    expect(result.question.relatedDayIds).toEqual(["day-12"]);
    expect(result.question.difficulty).toBe("advanced");
    expect(result.question.type).toBe("tradeoff");
    expect(result.question.prompt).not.toMatch(/\n/);
    expect(result.question.prompt).not.toMatch(/Great answer|Here is your next question/i);
  });

  it("strips quotes and markdown fences from the model response", async () => {
    mockedGenerate.mockResolvedValueOnce('```text\n"Suppose retrieval returns stale documents. How would you handle freshness?"\n```');
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-12")!;

    const result = await generator.generateQuestion({
      candidate: sara,
      curriculum,
      day,
      plan,
      memory: memoryFor(sara),
      previousAnswer: null,
      personality: "hiring_manager",
      questionHistory: [],
    });

    expect(result.question.prompt).toContain("freshness");
    expect(result.question.prompt).not.toMatch(/^```/);
    expect(result.question.prompt).not.toMatch(/^["']/);
  });

  it("never repeats a question already asked (falls back)", async () => {
    const questionText = "What would change if your embedding space became very large?";
    mockedGenerate.mockResolvedValueOnce(questionText);

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-12")!;

    const result = await generator.generateQuestion({
      candidate: sara,
      curriculum,
      day,
      plan,
      memory: memoryFor(sara),
      previousAnswer: null,
      personality: "hiring_manager",
      questionHistory: [questionText],
    });

    expect(result.source).toBe("fallback");
    expect(result.question.prompt).not.toBe(questionText);
  });

  it("falls back to a deterministic curriculum-aware question when Gemini fails", async () => {
    mockedGenerate.mockRejectedValue(new Error("Gemini outage"));

    const omar = await candidateService.getCandidateById("candidate-varun");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-7")!;

    const result = await generator.generateQuestion({
      candidate: omar,
      curriculum,
      day,
      plan,
      memory: memoryFor(omar),
      previousAnswer: null,
      personality: "hiring_manager",
      questionHistory: [],
    });

    expect(result.source).toBe("fallback");
    expect(result.question.relatedDayIds).toEqual(["day-7"]);
    expect(result.question.prompt).toContain("PyTorch");
    expect(result.question.difficulty).toBeDefined();
  });

  it("produces a follow-up that references the previous answer when requested", async () => {
    mockedGenerate.mockResolvedValueOnce(
      "You mentioned choosing ChromaDB for prototyping. If your system grew to millions of vectors, would you keep that choice? Why?"
    );
    const followUpPlan: PlannerDecision = { ...plan, referencePreviousAnswer: true };

    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-12")!;

    const result = await generator.generateQuestion({
      candidate: sara,
      curriculum,
      day,
      plan: followUpPlan,
      memory: memoryFor(sara),
      previousAnswer: "I chose ChromaDB because it was easy to prototype.",
      personality: "hiring_manager",
      questionHistory: ["What is RAG?"],
    });

    expect(result.source).toBe("ai");
    expect(result.question.prompt.toLowerCase()).toContain("chromadb");
  });
});
