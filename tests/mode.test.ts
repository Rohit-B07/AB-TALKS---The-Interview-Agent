import { describe, expect, it } from "vitest";
import { MODE_INSTRUCTIONS, MODE_LABELS } from "@/prompts/mode";
import { createFallbackPlan, createFallbackQuestion, evaluateFallbackAnswer } from "@/server/ai/fallback";
import { DSA_TOPICS, dsaTopicByName } from "@/server/ai/dsa";
import { MockInterviewEngine } from "@/server/engine";
import { MemoryManager } from "@/server/ai/MemoryManager";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import { InterviewService } from "@/server/services/interview.service";
import type {
  Candidate,
  Evaluation,
  InterviewMemory,
  InterviewQuestion,
} from "@/server/types";

function makeService(): InterviewService {
  return new InterviewService(new MockInterviewEngine());
}

function memoryFor(candidate: Candidate, sessionId = "sess"): InterviewMemory {
  return new MemoryManager().buildInitialMemory({
    candidate,
    sessionId,
    personality: "hiring_manager",
  });
}

function evaluationFor(score: number): Evaluation {
  return {
    questionId: "q-1",
    score,
    understanding: "ok",
    strengths: [],
    weaknesses: [],
    needsFollowUp: score <= 3,
    followUpReason: score <= 3 ? "Probe deeper." : "",
    memoryUpdate: "",
    confidence: 0.5,
    difficultyRecommendation: score >= 4 ? "harder" : score <= 2 ? "easier" : "same",
  };
}

const REASONING_ANSWER =
  "I would first create a variable to track the best value, then loop through each element " +
  "comparing it, and store the largest one I have seen so far, returning it at the end.";

describe("interview modes (ai_engineering vs dsa_friendly)", () => {
  it("defines labels and instructions for every supported mode", () => {
    expect(MODE_LABELS.ai_engineering).toBe("AI Engineering");
    expect(MODE_LABELS.dsa_friendly).toBe("DSA Friendly");
    expect(MODE_INSTRUCTIONS.ai_engineering).toContain("AI Engineering cohort");
    expect(MODE_INSTRUCTIONS.dsa_friendly).toContain("DSA Friendly mode");
    expect(MODE_INSTRUCTIONS.dsa_friendly).toContain("NEVER ask hard LeetCode problems");
  });

  it("defaults to the candidate's preferred mode when none is requested", async () => {
    const service = makeService();
    const rohit = await candidateService.getCandidateById("candidate-rohit");
    const result = await service.startInterview("candidate-rohit");
    const session = await service.getSession(result.sessionId);

    expect(rohit.defaultMode).toBe("dsa_friendly");
    expect(session.mode).toBe("dsa_friendly");
    expect(result.state.mode).toBe("dsa_friendly");
  });

  it("respects an explicit mode and keeps it across answers", async () => {
    const service = makeService();
    const { sessionId } = await service.startInterview(
      "candidate-vatsal",
      "hiring_manager",
      "dsa_friendly"
    );

    const session = await service.getSession(sessionId);
    expect(session.mode).toBe("dsa_friendly");

    const state = await service.submitAnswer(sessionId, REASONING_ANSWER);
    expect(state.mode).toBe("dsa_friendly");
    expect(state.currentQuestion?.context).toContain("DSA Friendly · ");
  });

  it("routes DSA sessions through the DSA question bank, not the curriculum", async () => {
    const service = makeService();
    const { sessionId } = await service.startInterview(
      "candidate-vatsal",
      "hiring_manager",
      "dsa_friendly"
    );

    const state = await service.submitAnswer(sessionId, REASONING_ANSWER);
    const context = state.currentQuestion?.context ?? "";
    const topicName = context.replace("DSA Friendly · ", "");
    const topic = dsaTopicByName(topicName);

    expect(context).toMatch(/^DSA Friendly · /);
    expect(topic).not.toBeNull();
  });

  it("keeps the default AI Engineering mode for AI candidates", async () => {
    const service = makeService();
    const { sessionId } = await service.startInterview("candidate-vatsal");
    const session = await service.getSession(sessionId);
    expect(session.mode).toBe("ai_engineering");
  });
});

describe("DSA-friendly fallback behavior", () => {
  it("plans only unlocked fundamentals topics for a beginner", async () => {
    const rohit = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();

    const decision = createFallbackPlan({
      candidate: rohit,
      curriculum,
      memory: { ...memoryFor(rohit), questionNumber: 2 },
      previousQuestion: null,
      previousAnswer: null,
      lastEvaluation: null,
      personality: "mentor",
      transcript: [],
      mode: "dsa_friendly",
    });

    const topic = dsaTopicByName(decision.topic);
    expect(topic).not.toBeNull();
    expect(topic!.baseDifficulty).toBe("beginner");
  });

  it("builds DSA-tagged questions from the topic bank", async () => {
    const rohit = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();
    const day = curriculum.find((d) => d.id === "day-4")!;

    const question = createFallbackQuestion({
      candidate: rohit,
      day,
      plan: {
        action: "new_topic",
        curriculumDay: "day-4",
        topic: "Arrays & Loops",
        difficulty: "easy",
        reason: "test",
        questionType: "conceptual",
        referencePreviousAnswer: false,
      },
      memory: memoryFor(rohit),
      previousAnswer: null,
      personality: "mentor",
      mode: "dsa_friendly",
    });

    expect(question.context).toBe("DSA Friendly · Arrays & Loops");
    expect(question.prompt.toLowerCase()).toContain("array");
  });

  it("rewards reasoning and approach rather than syntax", async () => {
    const rohit = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();
    const question = {
      id: "q-1",
      type: "conceptual" as const,
      prompt: "Given an array of numbers, how would you find the largest number?",
      context: "DSA Friendly · Arrays & Loops",
      difficulty: "beginner" as const,
      relatedDayIds: ["day-4"],
      createdAt: new Date().toISOString(),
    };

    const result = evaluateFallbackAnswer({
      candidate: rohit,
      curriculum,
      question,
      answer: REASONING_ANSWER,
      memory: memoryFor(rohit),
      personality: "mentor",
      mode: "dsa_friendly",
    });

    expect(result.score).toBeGreaterThanOrEqual(4);
    expect(result.difficultyRecommendation).toBe("harder");
    expect(result.strengths).toContain("Explained a clear approach.");
  });

  it("never punishes a candidate who says they don't know", async () => {
    const rohit = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();

    const result = evaluateFallbackAnswer({
      candidate: rohit,
      curriculum,
      question: {
        id: "q-1",
        type: "conceptual",
        prompt: "How would you find the largest number?",
        context: "DSA Friendly · Arrays & Loops",
        difficulty: "beginner",
        relatedDayIds: ["day-4"],
        createdAt: new Date().toISOString(),
      },
      answer: "I don't know this yet",
      memory: memoryFor(rohit),
      personality: "mentor",
      mode: "dsa_friendly",
    });

    expect(result.score).toBe(1);
    expect(result.difficultyRecommendation).toBe("easier");
    expect(result.understanding).toContain("reteach");
  });

  it("covers at least four distinct DSA topics over a full interview", async () => {
    const rohit = await candidateService.getCandidateById("candidate-rohit");
    const curriculum = await curriculumService.getCurriculum();
    const manager = new MemoryManager();
    let memory = memoryFor(rohit);
    const topics = new Set<string>();
    let previousQuestion: InterviewQuestion | null = null;
    let lastEvaluation: Evaluation | null = null;

    for (let i = 0; i < 8; i += 1) {
      const decision = createFallbackPlan({
        candidate: rohit,
        curriculum,
        memory,
        previousQuestion,
        previousAnswer: REASONING_ANSWER,
        lastEvaluation,
        personality: "mentor",
        transcript: [],
        mode: "dsa_friendly",
      });
      topics.add(decision.topic);
      const day = curriculum.find((d) => d.id === decision.curriculumDay) ?? curriculum[0];
      const next = createFallbackQuestion({
        candidate: rohit,
        day,
        plan: decision,
        memory,
        previousAnswer: REASONING_ANSWER,
        personality: "mentor",
        mode: "dsa_friendly",
      });
      previousQuestion = next;
      lastEvaluation = evaluationFor(i % 3 === 0 ? 5 : 3);
      memory = await manager.updateMemory({
        memory,
        candidate: rohit,
        curriculum,
        question: next,
        answer: REASONING_ANSWER,
        evaluation: lastEvaluation,
        personality: "mentor",
      });
    }

    expect(topics.size).toBeGreaterThanOrEqual(4);
    for (const name of topics) {
      expect(DSA_TOPICS.some((topic) => topic.name === name)).toBe(true);
    }
  });
});
