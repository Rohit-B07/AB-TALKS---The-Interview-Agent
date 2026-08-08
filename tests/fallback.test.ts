import { describe, expect, it } from "vitest";
import { createFallbackPlan, createFallbackQuestion, evaluateFallbackAnswer } from "@/server/ai/fallback";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import { MemoryManager } from "@/server/ai/MemoryManager";
import type {
  Candidate,
  Evaluation,
  InterviewMemory,
  InterviewQuestion,
} from "@/server/types";
import type { PlannerDecision } from "@/server/ai/schemas";

function memoryFor(candidate: Candidate, sessionId = "sess"): InterviewMemory {
  return new MemoryManager().buildInitialMemory({
    candidate,
    sessionId,
    personality: "hiring_manager",
  });
}

function questionFor(dayId: string): InterviewQuestion {
  return {
    id: `q-${dayId}`,
    type: "conceptual",
    prompt: `Question about ${dayId}`,
    context: "context",
    difficulty: "intermediate",
    relatedDayIds: [dayId],
    createdAt: new Date().toISOString(),
  };
}

const plan: PlannerDecision = {
  action: "new_topic",
  curriculumDay: "day-7",
  topic: "Deep Learning with PyTorch",
  difficulty: "intermediate",
  reason: "test",
  questionType: "conceptual",
  referencePreviousAnswer: false,
};

describe("fallback planner", () => {
  it("moves to an uncovered curriculum day as a new topic", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const decision = createFallbackPlan({
      candidate: sara,
      curriculum,
      memory: { ...memoryFor(sara), questionNumber: 0 },
      previousQuestion: questionFor("day-14"),
      previousAnswer: "ok",
      lastEvaluation: null,
      personality: "hiring_manager",
      transcript: [],
    });
    expect(decision.action).toBe("new_topic");
    expect(sara.completedDays).toContain(decision.curriculumDay);
    expect(sara.skippedDays).not.toContain(decision.curriculumDay);
  });

  it("clarifies on the same day after a weak answer", async () => {
    const lina = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();
    const lastEvaluation: Evaluation = {
      questionId: "q-day-4",
      score: 1,
      understanding: "weak",
      strengths: [],
      weaknesses: ["No depth"],
      needsFollowUp: true,
      followUpReason: "Probe basics.",
      memoryUpdate: "",
      confidence: 0.4,
      difficultyRecommendation: "easier",
    };
    const decision = createFallbackPlan({
      candidate: lina,
      curriculum,
      memory: { ...memoryFor(lina), questionNumber: 1, lastEvaluation },
      previousQuestion: questionFor("day-4"),
      previousAnswer: "i don't know",
      lastEvaluation,
      personality: "mentor",
      transcript: [],
    });
    expect(decision.action).toBe("clarify");
    expect(decision.curriculumDay).toBe("day-4");
    expect(decision.referencePreviousAnswer).toBe(true);
  });

  it("increases difficulty on the same day after a strong answer", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const lastEvaluation: Evaluation = {
      questionId: "q-day-14",
      score: 5,
      understanding: "excellent",
      strengths: ["Deep reasoning"],
      weaknesses: [],
      needsFollowUp: true,
      followUpReason: "Push on trade-offs.",
      memoryUpdate: "",
      confidence: 0.9,
      difficultyRecommendation: "harder",
    };
    const decision = createFallbackPlan({
      candidate: sara,
      curriculum,
      memory: { ...memoryFor(sara), questionNumber: 1, lastEvaluation },
      previousQuestion: questionFor("day-14"),
      previousAnswer: "A very strong and detailed answer about evaluation methodology.",
      lastEvaluation,
      personality: "senior_engineer",
      transcript: [],
    });
    expect(decision.action).toBe("increase_difficulty");
    expect(decision.curriculumDay).toBe("day-14");
    // Difficulty rises by at most one level: beginner -> intermediate.
    expect(decision.difficulty).toBe("intermediate");
  });

  it("builds coverage across at least 4 distinct days over a full interview", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const memoryManager = new MemoryManager();
    let memory = memoryFor(sara);
    const days = new Set<string>();
    let previousQuestion: InterviewQuestion | null = null;
    let lastEvaluation: Evaluation | null = null;

    for (let i = 0; i < 8; i += 1) {
      const decision = createFallbackPlan({
        candidate: sara,
        curriculum,
        memory,
        previousQuestion,
        previousAnswer: "answer",
        lastEvaluation,
        personality: "hiring_manager",
        transcript: [],
      });
      days.add(decision.curriculumDay);
      previousQuestion = questionFor(decision.curriculumDay);
      lastEvaluation = {
        questionId: previousQuestion.id,
        score: i % 3 === 0 ? 5 : 3,
        understanding: "ok",
        strengths: [],
        weaknesses: [],
        needsFollowUp: false,
        followUpReason: "",
        memoryUpdate: "",
        confidence: 0.5,
        difficultyRecommendation: i % 3 === 0 ? "harder" : "same",
      };
      memory = await memoryManager.updateMemory({
        memory,
        candidate: sara,
        curriculum,
        question: previousQuestion,
        answer: "answer",
        evaluation: lastEvaluation,
        personality: "hiring_manager",
      });
    }

    expect(days.size).toBeGreaterThanOrEqual(4);
  });
});

describe("fallback question", () => {
  it("is curriculum-aware and tied to the planned day", async () => {
    const omar = await candidateService.getCandidateById("candidate-varun");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-7")!;
    const question = createFallbackQuestion({
      candidate: omar,
      day,
      plan,
      memory: memoryFor(omar),
      previousAnswer: null,
      personality: "hiring_manager",
    });
    expect(question.relatedDayIds).toEqual(["day-7"]);
    expect(question.prompt.toLowerCase()).toContain("pytorch");
    expect(question.difficulty).toBe("intermediate");
  });

  it("references the previous answer for follow-ups", async () => {
    const omar = await candidateService.getCandidateById("candidate-varun");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-7")!;
    const followUp: PlannerDecision = { ...plan, referencePreviousAnswer: true };
    const question = createFallbackQuestion({
      candidate: omar,
      day,
      plan: followUp,
      memory: memoryFor(omar),
      previousAnswer: "I would tune the learning rate with a scheduler.",
      personality: "hiring_manager",
    });
    expect(question.prompt).toContain("learning rate");
  });

  it("cycles objectives so it does not repeat the same question", async () => {
    const omar = await candidateService.getCandidateById("candidate-varun");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-7")!;
    const first = createFallbackQuestion({
      candidate: omar,
      day,
      plan,
      memory: { ...memoryFor(omar), questionNumber: 0 },
      previousAnswer: null,
      personality: "hiring_manager",
    });
    const second = createFallbackQuestion({
      candidate: omar,
      day,
      plan,
      memory: { ...memoryFor(omar), questionNumber: 1 },
      previousAnswer: null,
      personality: "hiring_manager",
    });
    expect(first.prompt).not.toBe(second.prompt);
  });
});

describe("fallback evaluation", () => {
  it("scores within 1..5 and rewards substantive keyword-rich answers", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const curriculum = await curriculumService.getCurriculum();
    const question = questionFor("day-12");

    const weak = evaluateFallbackAnswer({
      candidate: sara,
      curriculum,
      question,
      answer: "no",
      memory: memoryFor(sara),
      personality: "hiring_manager",
    });
    const strong = evaluateFallbackAnswer({
      candidate: sara,
      curriculum,
      question,
      answer:
        "RAG retrieves relevant document chunks from a vector store and passes them to the " +
        "LLM as grounding context. I would chunk documents carefully, embed them, and then " +
        "rank the top-k passages with a reranker before generation.",
      memory: memoryFor(sara),
      personality: "hiring_manager",
    });

    expect(weak.score).toBeLessThanOrEqual(5);
    expect(weak.score).toBeGreaterThanOrEqual(1);
    expect(strong.score).toBeGreaterThanOrEqual(weak.score);
    expect(strong.difficultyRecommendation).toBe("harder");
  });
});
