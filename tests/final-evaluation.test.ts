import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/lib/ai/gemini";
import { FinalEvaluationService } from "@/server/ai/FinalEvaluationService";
import {
  aggregateOverallScore,
  aggregateTopicPerformance,
  buildAnswerRecords,
  buildEvidence,
  difficultyProgression,
  extractKnowledgeGaps,
  extractStrengths,
  readinessFor,
  selectImprovementQuestions,
} from "@/server/ai/final-evaluation/aggregate";
import { InterviewService } from "@/server/services/interview.service";
import { MockInterviewEngine } from "@/server/engine";
import { sessionStore } from "@/server/store/session-store";
import { handleGetFinalEvaluation } from "@/server/api/get-evaluation";
import type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  Difficulty,
  Evaluation,
  InterviewMode,
  InterviewSession,
} from "@/server/types";

const mockedGenerate = vi.mocked(generateContent);

const NOW = "2026-08-08T12:00:00.000Z";

const AI_CURRICULUM: CurriculumDay[] = [
  {
    id: "day-1",
    day: 1,
    module: "Foundations",
    topic: "AI Fundamentals & Python Setup",
    learningObjectives: ["Explain AI"],
    tools: ["Python"],
    difficulty: "beginner",
  },
  {
    id: "day-5",
    day: 5,
    module: "Machine Learning",
    topic: "ML Foundations with scikit-learn",
    learningObjectives: ["Split data"],
    tools: ["scikit-learn"],
    difficulty: "intermediate",
  },
  {
    id: "day-10",
    day: 10,
    module: "LLMs",
    topic: "Introduction to Large Language Models",
    learningObjectives: ["Explain transformers"],
    tools: ["Transformers"],
    difficulty: "advanced",
  },
];

const AI_DAY_BY_TOPIC: Record<string, string> = {
  "AI Fundamentals & Python Setup": "day-1",
  "ML Foundations with scikit-learn": "day-5",
  "Introduction to Large Language Models": "day-10",
};

const AI_MODULE_BY_DAY: Record<string, string> = {
  "day-1": "Foundations",
  "day-5": "Machine Learning",
  "day-10": "LLMs",
};

const DSA_CURRICULUM: CurriculumDay[] = [
  {
    id: "day-1",
    day: 1,
    module: "Foundations",
    topic: "AI Fundamentals & Python Setup",
    learningObjectives: ["Explain AI"],
    tools: ["Python"],
    difficulty: "beginner",
  },
];

function makeCandidate(mode: InterviewMode, id = "candidate-x"): Candidate {
  return {
    id,
    name: mode === "dsa_friendly" ? "Rohit" : "Vatsal",
    defaultMode: mode,
    completedDays: ["day-1"],
    skippedDays: [],
    attempts: 1,
    strengths:
      mode === "dsa_friendly" ? ["Arrays", "Logical reasoning"] : ["Python", "Practical implementation"],
    weaknesses:
      mode === "dsa_friendly" ? ["Advanced algorithms"] : ["System design"],
    learningSignals: [],
  };
}

interface RecordInput {
  topic: string;
  dayId?: string;
  difficulty: Difficulty;
  prompt: string;
  answer: string;
  score: number;
  strengths?: string[];
  weaknesses?: string[];
  needsFollowUp?: boolean;
}

/** Builds a completed interview session with N answered questions. */
function makeSession(opts: {
  id?: string;
  mode: InterviewMode;
  candidate?: Candidate;
  records: RecordInput[];
  status?: InterviewSession["status"];
}): InterviewSession {
  const mode = opts.mode;
  const candidate = opts.candidate ?? makeCandidate(mode);
  const curriculum = mode === "dsa_friendly" ? DSA_CURRICULUM : AI_CURRICULUM;
  const transcript: ConversationTurn[] = [];
  const evaluations: Evaluation[] = [];
  const questionHistory: string[] = [];
  const answerHistory: string[] = [];
  const coveredDays: string[] = [];
  const coveredTopics: string[] = [];

  for (const [index, record] of opts.records.entries()) {
    const questionId = `q-${index + 1}`;
    const dayId =
      record.dayId ??
      (mode === "dsa_friendly" ? "day-1" : AI_DAY_BY_TOPIC[record.topic] ?? "day-1");
    const context =
      mode === "dsa_friendly"
        ? `DSA Friendly · ${record.topic}`
        : `${AI_MODULE_BY_DAY[dayId] ?? "Foundations"} · ${record.topic}`;

    transcript.push({
      id: `turn-a-${index}`,
      role: "assistant",
      content: record.prompt,
      questionId,
      difficulty: record.difficulty,
      relatedDayIds: [dayId],
      context,
      createdAt: NOW,
    });
    transcript.push({
      id: `turn-c-${index}`,
      role: "candidate",
      content: record.answer,
      questionId,
      createdAt: NOW,
    });
    evaluations.push({
      questionId,
      score: record.score,
      understanding: "ok",
      strengths: record.strengths ?? [],
      weaknesses: record.weaknesses ?? [],
      needsFollowUp: record.needsFollowUp ?? false,
      followUpReason: "",
      memoryUpdate: "",
      confidence: 0.5,
      difficultyRecommendation: "same",
    });
    questionHistory.push(record.prompt);
    answerHistory.push(record.answer);
    if (!coveredDays.includes(dayId)) coveredDays.push(dayId);
    if (!coveredTopics.includes(record.topic)) coveredTopics.push(record.topic);
  }

  const memory: InterviewSession["memory"] = {
    candidateId: candidate.id,
    sessionId: opts.id ?? "sess-final",
    personality: "hiring_manager",
    questionNumber: opts.records.length,
    totalTargetQuestions: 8,
    coveredDays,
    coveredTopics,
    questionHistory,
    answerHistory,
    strengths: [],
    knowledgeGaps: [],
    difficulty: opts.records[opts.records.length - 1]?.difficulty ?? "beginner",
    currentStage: "wrapping up",
    lastEvaluation: evaluations[evaluations.length - 1] ?? null,
    conversationSummary: "Completed interview.",
  };

  return {
    id: opts.id ?? "sess-final",
    candidate,
    curriculum,
    transcript,
    currentQuestion: null,
    personality: "hiring_manager",
    mode,
    currentQuestionNumber: opts.records.length,
    questionsAsked: opts.records.length,
    coveredDays,
    coveredTopics,
    evaluations,
    memory,
    currentQuestionSource: null,
    status: opts.status ?? "completed",
    finalEvaluation: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const STRONG_ANSWER = "I would iterate over each element and keep track of the best value found so far.";
const WEAK_ANSWER = "not sure";

const VALID_NARRATIVE = {
  summary: "A well-reasoned interview overall, with clear explanations.",
  topicSummaries: [{ topic: "Arrays & Loops", summary: "Confident traversal and loop reasoning." }],
  adaptiveBehavior: "The candidate improved steadily after each hint.",
  recommendations: ["Practice two-pointer problems daily."],
};

describe("final evaluation aggregation", () => {
  it("zips questions, answers, and evaluations into per-question records", () => {
    const session = makeSession({
      mode: "dsa_friendly",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Find the max?", answer: "Loop", score: 5 },
      ],
    });
    const records = buildAnswerRecords(session);
    expect(records).toHaveLength(1);
    expect(records[0].prompt).toBe("Find the max?");
    expect(records[0].answer).toBe("Loop");
    expect(records[0].score).toBe(5);
    expect(records[0].topic).toBe("Arrays & Loops");
  });

  it("aggregates topic performance by averaging answer scores", () => {
    const session = makeSession({
      mode: "ai_engineering",
      records: [
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q1", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q2", answer: STRONG_ANSWER, score: 4 },
        { topic: "ML Foundations with scikit-learn", difficulty: "intermediate", prompt: "Q3", answer: STRONG_ANSWER, score: 3 },
        { topic: "ML Foundations with scikit-learn", difficulty: "intermediate", prompt: "Q4", answer: STRONG_ANSWER, score: 3 },
      ],
    });
    const topics = aggregateTopicPerformance(session);
    expect(topics).toHaveLength(2);
    const python = topics.find((topic) => topic.topic === "AI Fundamentals & Python Setup");
    const ml = topics.find((topic) => topic.topic === "ML Foundations with scikit-learn");
    expect(python?.score).toBe(88);
    expect(python?.questionsAsked).toBe(2);
    expect(ml?.score).toBe(50);
    expect(ml?.questionsAsked).toBe(2);
  });

  it("computes the overall score from topic scores", () => {
    expect(aggregateOverallScore([{ topic: "A", score: 90, questionsAsked: 2 }])).toBe(90);
    expect(
      aggregateOverallScore([
        { topic: "A", score: 90, questionsAsked: 2 },
        { topic: "B", score: 60, questionsAsked: 2 },
      ])
    ).toBe(75);
  });

  it("maps 1/5 answer scores to 0/100 and 5/5 to 100/100", () => {
    const session = makeSession({
      mode: "dsa_friendly",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Q1", answer: WEAK_ANSWER, score: 1 },
        { topic: "Strings", difficulty: "beginner", prompt: "Q2", answer: STRONG_ANSWER, score: 5 },
        { topic: "Strings", difficulty: "beginner", prompt: "Q3", answer: STRONG_ANSWER, score: 5 },
      ],
    });
    const topics = aggregateTopicPerformance(session);
    expect(topics.find((topic) => topic.topic === "Arrays & Loops")?.score).toBe(0);
    expect(topics.find((topic) => topic.topic === "Strings")?.score).toBe(100);
  });

  it("keeps a weak-but-relevant answer above zero", () => {
    const session = makeSession({
      mode: "dsa_friendly",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Q1", answer: "loop and compare", score: 3 },
      ],
    });
    const topics = aggregateTopicPerformance(session);
    expect(topics[0].score).toBe(50);
  });

  it("classifies readiness from the overall score", () => {
    expect(readinessFor(92)).toBe("strong");
    expect(readinessFor(78)).toBe("intermediate");
    expect(readinessFor(55)).toBe("developing");
    expect(readinessFor(30)).toBe("beginner");
  });

  it("reports difficulty progression with not-reached for untouched levels", () => {
    const session = makeSession({
      mode: "dsa_friendly",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Q1", answer: STRONG_ANSWER, score: 4 },
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Q2", answer: STRONG_ANSWER, score: 3 },
        { topic: "Strings", difficulty: "beginner", prompt: "Q3", answer: STRONG_ANSWER, score: 3 },
        { topic: "Strings", difficulty: "intermediate", prompt: "Q4", answer: STRONG_ANSWER, score: 3 },
      ],
    });
    const progression = difficultyProgression(session);
    expect(progression[0]).toEqual({ difficulty: "beginner", performance: "developing", questionsAsked: 3 });
    expect(progression[1]).toEqual({ difficulty: "intermediate", performance: "developing", questionsAsked: 1 });
    expect(progression[2]).toEqual({ difficulty: "advanced", performance: "not-reached", questionsAsked: 0 });
  });

  it("extracts strengths supported by evidence", () => {
    const session = makeSession({
      mode: "ai_engineering",
      records: [
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q1", answer: STRONG_ANSWER, score: 5, strengths: ["Clear step-by-step reasoning"] },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q2", answer: STRONG_ANSWER, score: 5, strengths: ["Clear step-by-step reasoning", "Good edge-case awareness"] },
        { topic: "ML Foundations with scikit-learn", difficulty: "intermediate", prompt: "Q3", answer: STRONG_ANSWER, score: 4, strengths: ["Good edge-case awareness"] },
      ],
    });
    const strengths = extractStrengths({
      mode: session.mode,
      candidate: session.candidate,
      records: buildAnswerRecords(session),
      topics: aggregateTopicPerformance(session),
    });
    expect(strengths).toContain("Clear step-by-step reasoning");
    expect(strengths.length).toBeGreaterThanOrEqual(3);
  });

  it("extracts knowledge gaps from weak topics and weak answers", () => {
    const session = makeSession({
      mode: "ai_engineering",
      records: [
        { topic: "Introduction to Large Language Models", difficulty: "advanced", prompt: "Q1", answer: WEAK_ANSWER, score: 1, weaknesses: ["Limited understanding of transformers"] },
        { topic: "Introduction to Large Language Models", difficulty: "advanced", prompt: "Q2", answer: WEAK_ANSWER, score: 2 },
        { topic: "ML Foundations with scikit-learn", difficulty: "intermediate", prompt: "Q3", answer: STRONG_ANSWER, score: 5 },
      ],
    });
    const gaps = extractKnowledgeGaps({
      mode: session.mode,
      candidate: session.candidate,
      records: buildAnswerRecords(session),
      topics: aggregateTopicPerformance(session),
      idkCount: 2,
    });
    expect(gaps).toContain("Limited understanding of transformers");
    expect(gaps.some((gap) => gap.toLowerCase().includes("large language models"))).toBe(true);
  });

  it("selects low-scoring improvement questions across distinct topics", () => {
    const session = makeSession({
      mode: "dsa_friendly",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Find the max?", answer: STRONG_ANSWER, score: 5 },
        { topic: "Strings", difficulty: "beginner", prompt: "Anagram?", answer: "maybe", score: 2, needsFollowUp: true },
        { topic: "Sorting", difficulty: "intermediate", prompt: "Bubble sort?", answer: WEAK_ANSWER, score: 1 },
        { topic: "Searching", difficulty: "beginner", prompt: "Linear search?", answer: "loop through", score: 3 },
      ],
    });
    const questions = selectImprovementQuestions({ records: buildAnswerRecords(session) });
    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(questions.length).toBeLessThanOrEqual(4);
    expect(new Set(questions.map((question) => question.topic)).size).toBe(questions.length);
    expect(questions[0].topic).toBe("Sorting");
    expect(questions[0].question).toContain("Bubble sort?");
  });

  it("detects idk and hint-heavy behavior in the evidence", () => {
    const session = makeSession({
      mode: "dsa_friendly",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Here's a small hint: track the best so far. Now: find the max?", answer: WEAK_ANSWER, score: 2 },
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "That's completely fine. Let's make that simpler: what is a loop?", answer: WEAK_ANSWER, score: 1 },
      ],
    });
    const evidence = buildEvidence(session);
    expect(evidence.idkCount).toBe(2);
    expect(evidence.hintCount).toBe(2);
    expect(evidence.briefAnswerCount).toBe(2);
  });
});

describe("FinalEvaluationService", () => {
  const service = new FinalEvaluationService();

  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("generates a complete deterministic report when Gemini fails", async () => {
    mockedGenerate.mockRejectedValue(new Error("Gemini outage"));
    const session = makeSession({
      id: "sess-service-fallback",
      mode: "dsa_friendly",
      records: Array.from({ length: 8 }, (_, index) => ({
        topic: index % 2 === 0 ? "Arrays & Loops" : "Strings",
        difficulty: index < 6 ? ("beginner" as const) : ("intermediate" as const),
        prompt: `Question ${index + 1}`,
        answer: index % 3 === 0 ? WEAK_ANSWER : STRONG_ANSWER,
        score: index % 3 === 0 ? 1 : index % 3 === 1 ? 3 : 5,
      })),
    });

    const evaluation = await service.generate(session);

    expect(evaluation.sessionId).toBe("sess-service-fallback");
    expect(evaluation.mode).toBe("dsa_friendly");
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(1);
    expect(evaluation.overallScore).toBeLessThanOrEqual(100);
    expect(["beginner", "developing", "intermediate", "strong"]).toContain(evaluation.readiness);
    expect(evaluation.summary.length).toBeGreaterThan(0);
    expect(evaluation.topicPerformance.length).toBeGreaterThan(0);
    expect(evaluation.strengths.length).toBeGreaterThanOrEqual(2);
    expect(evaluation.knowledgeGaps.length).toBeGreaterThan(0);
    expect(evaluation.difficultyProgression).toHaveLength(3);
    expect(evaluation.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(evaluation.adaptiveBehavior.length).toBeGreaterThan(0);
  });

  it("uses Gemini narrative while keeping scores deterministic", async () => {
    mockedGenerate.mockResolvedValue(JSON.stringify(VALID_NARRATIVE));
    const session = makeSession({
      mode: "dsa_friendly",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Find the max?", answer: STRONG_ANSWER, score: 5 },
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Sum them?", answer: STRONG_ANSWER, score: 5 },
        { topic: "Strings", difficulty: "beginner", prompt: "Reverse it?", answer: STRONG_ANSWER, score: 4 },
        { topic: "Strings", difficulty: "beginner", prompt: "Palindrome?", answer: STRONG_ANSWER, score: 4 },
        { topic: "Searching", difficulty: "beginner", prompt: "Find value?", answer: STRONG_ANSWER, score: 4 },
        { topic: "Searching", difficulty: "intermediate", prompt: "Binary search?", answer: STRONG_ANSWER, score: 4 },
        { topic: "Sorting", difficulty: "intermediate", prompt: "Sort list?", answer: STRONG_ANSWER, score: 4 },
        { topic: "Sorting", difficulty: "intermediate", prompt: "Merge?", answer: STRONG_ANSWER, score: 4 },
      ],
    });

    const evaluation = await service.generate(session);

    expect(evaluation.summary).toBe(VALID_NARRATIVE.summary);
    expect(evaluation.adaptiveBehavior).toBe(VALID_NARRATIVE.adaptiveBehavior);
    expect(evaluation.recommendations).toEqual(VALID_NARRATIVE.recommendations);
    expect(evaluation.topicPerformance.find((topic) => topic.topic === "Arrays & Loops")?.summary).toBe(
      VALID_NARRATIVE.topicSummaries[0].summary
    );
    // Scores are never taken from the LLM: mean of topic scores (100, 75, 75, 75) = 81.
    expect(evaluation.overallScore).toBe(81);
  });

  it("falls back to deterministic text on malformed Gemini output", async () => {
    mockedGenerate.mockResolvedValue("this is not json");
    const session = makeSession({
      mode: "ai_engineering",
      records: [
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q1", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q2", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q3", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q4", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q5", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q6", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q7", answer: STRONG_ANSWER, score: 5 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q8", answer: STRONG_ANSWER, score: 5 },
      ],
    });

    const evaluation = await service.generate(session);

    expect(evaluation.summary).toContain("Vatsal");
    expect(evaluation.summary).toContain("100/100");
    expect(evaluation.readiness).toBe("strong");
    // Corrected retry happened, then the deterministic path was used.
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });

  it("adapts language for DSA Friendly reports", async () => {
    mockedGenerate.mockRejectedValue(new Error("outage"));
    const session = makeSession({
      mode: "dsa_friendly",
      candidate: makeCandidate("dsa_friendly"),
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Find max?", answer: WEAK_ANSWER, score: 2 },
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Find max?", answer: STRONG_ANSWER, score: 3 },
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Find max?", answer: STRONG_ANSWER, score: 3 },
        { topic: "Strings", difficulty: "beginner", prompt: "Anagram?", answer: STRONG_ANSWER, score: 3 },
        { topic: "Strings", difficulty: "beginner", prompt: "Anagram?", answer: STRONG_ANSWER, score: 3 },
        { topic: "Strings", difficulty: "beginner", prompt: "Anagram?", answer: STRONG_ANSWER, score: 3 },
        { topic: "Searching", difficulty: "beginner", prompt: "Search?", answer: STRONG_ANSWER, score: 3 },
        { topic: "Searching", difficulty: "beginner", prompt: "Search?", answer: STRONG_ANSWER, score: 3 },
      ],
    });

    const evaluation = await service.generate(session);

    expect(evaluation.recommendations.join(" ").toLowerCase()).toContain("practice");
    expect(evaluation.adaptiveBehavior.toLowerCase()).toContain("re-explained");
  });

  it("handles more than 8 questions", async () => {
    mockedGenerate.mockRejectedValue(new Error("outage"));
    const records = Array.from({ length: 10 }, (_, index) => ({
      topic: index % 2 === 0 ? "Arrays & Loops" : "Strings",
      difficulty: "beginner" as const,
      prompt: `Question ${index + 1}`,
      answer: STRONG_ANSWER,
      score: 4,
    }));
    const session = makeSession({ mode: "dsa_friendly", records });

    const evaluation = await service.generate(session);

    const totalAsked = evaluation.topicPerformance.reduce((sum, topic) => sum + topic.questionsAsked, 0);
    expect(totalAsked).toBe(10);
  });

  it("produces a low-scoring beginner report for a weak candidate", async () => {
    mockedGenerate.mockRejectedValue(new Error("outage"));
    const session = makeSession({
      mode: "dsa_friendly",
      records: Array.from({ length: 8 }, (_, index) => ({
        topic: index % 2 === 0 ? "Arrays & Loops" : "Strings",
        difficulty: "beginner" as const,
        prompt: `Question ${index + 1}`,
        answer: WEAK_ANSWER,
        score: 1,
      })),
    });

    const evaluation = await service.generate(session);

    expect(evaluation.overallScore).toBeLessThan(40);
    expect(evaluation.readiness).toBe("beginner");
    expect(evaluation.knowledgeGaps.length).toBeGreaterThan(0);
    expect(evaluation.improvementQuestions.length).toBeGreaterThan(0);
  });

  it("does not claim positive performance when every answer is at the minimum", async () => {
    mockedGenerate.mockRejectedValue(new Error("outage"));
    const session = makeSession({
      mode: "dsa_friendly",
      records: Array.from({ length: 8 }, () => ({
        topic: "Arrays & Loops",
        difficulty: "beginner" as const,
        prompt: "Question",
        answer: WEAK_ANSWER,
        score: 1,
      })),
    });

    const evaluation = await service.generate(session);

    expect(evaluation.overallScore).toBe(0);
    expect(evaluation.readiness).toBe("beginner");
    // Minimum-level performance must not be dressed up as strengths.
    expect(evaluation.strengths).toHaveLength(0);
    expect(evaluation.summary).not.toContain("consistent understanding");
    expect(evaluation.summary).not.toContain("strongest");
    expect(evaluation.summary).toMatch(/improvement|below|minimum/i);
    expect(evaluation.topicPerformance.length).toBe(1);
    expect(evaluation.topicPerformance[0].summary).toMatch(/Struggled with/);
  });

  it("produces a strong report with no improvement questions for a strong candidate", async () => {
    mockedGenerate.mockRejectedValue(new Error("outage"));
    const session = makeSession({
      mode: "ai_engineering",
      candidate: makeCandidate("ai_engineering"),
      records: [
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q1", answer: STRONG_ANSWER, score: 5, strengths: ["Clear step-by-step reasoning"] },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q2", answer: STRONG_ANSWER, score: 5, strengths: ["Clear step-by-step reasoning"] },
        { topic: "ML Foundations with scikit-learn", difficulty: "intermediate", prompt: "Q3", answer: STRONG_ANSWER, score: 4, strengths: ["Practical implementation skills"] },
        { topic: "ML Foundations with scikit-learn", difficulty: "intermediate", prompt: "Q4", answer: STRONG_ANSWER, score: 5, strengths: ["Practical implementation skills"] },
        { topic: "Introduction to Large Language Models", difficulty: "advanced", prompt: "Q5", answer: STRONG_ANSWER, score: 4, strengths: ["Clear step-by-step reasoning"] },
        { topic: "Introduction to Large Language Models", difficulty: "advanced", prompt: "Q6", answer: STRONG_ANSWER, score: 4, strengths: ["Practical implementation skills"] },
        { topic: "ML Foundations with scikit-learn", difficulty: "intermediate", prompt: "Q7", answer: STRONG_ANSWER, score: 5, strengths: ["Good edge-case awareness"] },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q8", answer: STRONG_ANSWER, score: 5, strengths: ["Good edge-case awareness"] },
      ],
    });

    const evaluation = await service.generate(session);

    expect(evaluation.overallScore).toBeGreaterThanOrEqual(85);
    expect(evaluation.readiness).toBe("strong");
    expect(evaluation.improvementQuestions).toHaveLength(0);
    expect(evaluation.strengths.length).toBeGreaterThanOrEqual(3);
  });

  it("mentions hints in adaptive behavior for a hint-heavy interview", async () => {
    mockedGenerate.mockRejectedValue(new Error("outage"));
    const records = Array.from({ length: 8 }, (_, index) => ({
      topic: index % 2 === 0 ? "Arrays & Loops" : "Strings",
      difficulty: "beginner" as const,
      prompt: `Here's a small hint: track what you have seen. Now: Question ${index + 1}`,
      answer: index % 2 === 0 ? WEAK_ANSWER : STRONG_ANSWER,
      score: index % 2 === 0 ? 2 : 4,
    }));
    const session = makeSession({ mode: "dsa_friendly", records });

    const evaluation = await service.generate(session);

    expect(evaluation.adaptiveBehavior.toLowerCase()).toContain("hints");
    expect(evaluation.adaptiveBehavior.toLowerCase()).toContain("simpler");
  });
});

describe("InterviewService.getFinalEvaluation", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
    mockedGenerate.mockRejectedValue(new Error("Gemini outage"));
  });

  it("throws EVALUATION_NOT_AVAILABLE for an active interview", async () => {
    const service = new InterviewService(new MockInterviewEngine());
    const { sessionId } = await service.startInterview("candidate-rohit");

    await expect(service.getFinalEvaluation(sessionId)).rejects.toMatchObject({
      code: "EVALUATION_NOT_AVAILABLE",
      status: 409,
    });
  });

  it("generates once, persists, and does not regenerate on later calls", async () => {
    const session = makeSession({
      id: "sess-persist",
      mode: "ai_engineering",
      records: [
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q1", answer: STRONG_ANSWER, score: 4 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q2", answer: STRONG_ANSWER, score: 4 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q3", answer: STRONG_ANSWER, score: 4 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q4", answer: STRONG_ANSWER, score: 4 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q5", answer: STRONG_ANSWER, score: 4 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q6", answer: STRONG_ANSWER, score: 4 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q7", answer: STRONG_ANSWER, score: 4 },
        { topic: "AI Fundamentals & Python Setup", difficulty: "beginner", prompt: "Q8", answer: STRONG_ANSWER, score: 4 },
      ],
    });
    await sessionStore.create(session);

    const service = new InterviewService(new MockInterviewEngine());
    const first = await service.getFinalEvaluation("sess-persist");
    const second = await service.getFinalEvaluation("sess-persist");

    expect(first).toEqual(second);
    expect(mockedGenerate).toHaveBeenCalledTimes(1);

    const restored = await service.getSession("sess-persist");
    expect(restored.finalEvaluation).not.toBeNull();
    expect(restored.finalEvaluation!.overallScore).toBe(first.overallScore);
  });
});

describe("GET /api/interview/[sessionId]/evaluation", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
    mockedGenerate.mockRejectedValue(new Error("Gemini outage"));
  });

  it("returns the evaluation without exposing internal evaluator data", async () => {
    const session = makeSession({
      id: "sess-api",
      mode: "ai_engineering",
      records: Array.from({ length: 8 }, (_, index) => ({
        topic: "AI Fundamentals & Python Setup",
        difficulty: "beginner" as const,
        prompt: `Question ${index + 1}`,
        answer: STRONG_ANSWER,
        score: 4,
      })),
    });
    await sessionStore.create(session);

    const response = await handleGetFinalEvaluation(new Request("http://localhost/"), "sess-api");
    expect(response.status).toBe(200);

    const body = await response.json();
    const evaluation = body.evaluation;
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(1);
    expect(evaluation.sessionId).toBe("sess-api");
    // Internal details must never leak to the candidate.
    expect(body.evaluations).toBeUndefined();
    expect(body.memory).toBeUndefined();
    expect(body.conversation).toBeUndefined();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("confidence");
    expect(serialized).not.toContain("lastEvaluation");
    expect(serialized).not.toContain("difficultyRecommendation");
  });

  it("rejects with EVALUATION_NOT_AVAILABLE before the interview is complete", async () => {
    const session = makeSession({
      id: "sess-api-active",
      mode: "dsa_friendly",
      status: "active",
      records: [
        { topic: "Arrays & Loops", difficulty: "beginner", prompt: "Q1", answer: STRONG_ANSWER, score: 4 },
      ],
    });
    await sessionStore.create(session);

    const response = await handleGetFinalEvaluation(new Request("http://localhost/"), "sess-api-active");
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("EVALUATION_NOT_AVAILABLE");
  });
});

describe("final evaluation over a full interview", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
    mockedGenerate.mockRejectedValue(new Error("Gemini outage"));
  });

  it("generates a report after exactly 8 questions and keeps it on refresh", async () => {
    const service = new InterviewService(new MockInterviewEngine());
    const { sessionId } = await service.startInterview("candidate-rohit");

    let state;
    for (let i = 0; i < 8; i += 1) {
      state = await service.submitAnswer(
        sessionId,
        "I would loop through the elements one by one, compare each one, and keep track of the best answer found so far."
      );
    }

    expect(state!.interviewComplete).toBe(true);
    expect(state!.questionsAsked).toBe(8);

    const evaluation = await service.getFinalEvaluation(sessionId);
    expect(evaluation.mode).toBe("dsa_friendly");
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(1);
    expect(evaluation.sessionId).toBe(sessionId);

    const refreshed = await service.getSession(sessionId);
    expect(refreshed.finalEvaluation).not.toBeNull();
    expect(refreshed.finalEvaluation!.sessionId).toBe(sessionId);
  });

  it("does not regenerate the report when a completed interview is reloaded", async () => {
    const service = new InterviewService(new MockInterviewEngine());
    const { sessionId } = await service.startInterview("candidate-rohit");

    for (let i = 0; i < 8; i += 1) {
      await service.submitAnswer(
        sessionId,
        "I would loop through the elements one by one and keep track of the best value seen so far."
      );
    }

    await service.getFinalEvaluation(sessionId);
    await service.getFinalEvaluation(sessionId);

    expect(mockedGenerate).toHaveBeenCalledTimes(1);
  });
});
