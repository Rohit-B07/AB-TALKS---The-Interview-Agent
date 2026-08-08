import { randomUUID } from "node:crypto";
import { buildFirstQuestionPrompt } from "@/prompts/first-question";
import type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  Evaluation,
  InterviewMemory,
  InterviewMode,
  InterviewQuestion,
  InterviewerPersonality,
  QuestionSource,
} from "@/server/types";
import type { AiServiceContainer } from "@/server/ai";
import { createFallbackPlan, createFallbackQuestion, evaluateFallbackAnswer } from "@/server/ai/fallback";
import { getDayById, getEligibleDays, getLastCompletedDay } from "@/server/ai/utils";
import type { PlanNextOutput } from "@/server/ai";

export interface GenerateFirstQuestionInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  memory: InterviewMemory;
  personality: InterviewerPersonality;
  mode: InterviewMode;
}

export interface GenerateNextQuestionInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  memory: InterviewMemory;
  previousQuestion: InterviewQuestion | null;
  previousAnswer: string | null;
  lastEvaluation: Evaluation | null;
  personality: InterviewerPersonality;
  transcript: ConversationTurn[];
  mode: InterviewMode;
}

export interface EvaluateAnswerInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  question: InterviewQuestion;
  answer: string;
  memory: InterviewMemory;
  personality: InterviewerPersonality;
  mode: InterviewMode;
}

export interface GeneratedQuestion {
  question: InterviewQuestion;
  source: QuestionSource;
}

export interface EvaluationOutput {
  evaluation: Evaluation;
  source: QuestionSource;
}

/**
 * Boundary between the interview flow and the AI layer. Phase 2 provides an
 * LLM-backed implementation (GeminiInterviewEngine) with a deterministic
 * fallback; MockInterviewEngine remains for tests.
 */
export interface InterviewEngine {
  generateFirstQuestion(input: GenerateFirstQuestionInput): Promise<GeneratedQuestion>;
  generateNextQuestion(input: GenerateNextQuestionInput): Promise<GeneratedQuestion>;
  evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluationOutput>;
}

/**
 * Deterministic mock engine used by tests. First question is built from the
 * candidate's most recent completed curriculum day; follow-ups and
 * evaluations use the same fallback logic a real Gemini outage would.
 */
export class MockInterviewEngine implements InterviewEngine {
  async generateFirstQuestion({
    candidate,
    curriculum,
    memory,
    personality,
    mode,
  }: GenerateFirstQuestionInput): Promise<GeneratedQuestion> {
    const day =
      getLastCompletedDay(candidate, curriculum) ??
      [...curriculum].sort((a, b) => a.day - b.day)[0] ??
      this.fallbackDay();

    const { system } = buildFirstQuestionPrompt({ candidate, day });
    const prompt = this.buildQuestionText(candidate, day);

    const question: InterviewQuestion = {
      id: `q-${candidate.id}-${day.id}`,
      type: "open-ended",
      prompt,
      context: system,
      difficulty: day.difficulty,
      relatedDayIds: [day.id],
      createdAt: new Date().toISOString(),
    };

    return { question, source: "fallback" };
  }

  async generateNextQuestion(input: GenerateNextQuestionInput): Promise<GeneratedQuestion> {
    const decision = createFallbackPlan({
      candidate: input.candidate,
      curriculum: input.curriculum,
      memory: input.memory,
      previousQuestion: input.previousQuestion,
      previousAnswer: input.previousAnswer,
      lastEvaluation: input.lastEvaluation,
      personality: input.personality,
      transcript: input.transcript,
      mode: input.mode,
    });
    const day = getDayById(input.curriculum, decision.curriculumDay) ?? input.curriculum[0];
    if (!day) {
      return this.fallbackQuestion(input);
    }
    return {
      question: createFallbackQuestion({
        candidate: input.candidate,
        day,
        plan: decision,
        memory: input.memory,
        previousAnswer: input.previousAnswer,
        personality: input.personality,
        questionHistory: input.memory.questionHistory,
        mode: input.mode,
      }),
      source: "fallback",
    };
  }

  async evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluationOutput> {
    return {
      evaluation: {
        questionId: input.question.id,
        ...evaluateFallbackAnswer(input),
      },
      source: "fallback",
    };
  }

  private buildQuestionText(candidate: Candidate, day: CurriculumDay): string {
    const objective = day.learningObjectives[day.learningObjectives.length - 1];
    return [
      `Welcome, ${candidate.name}. I can see you've completed the ${day.module} module — ${day.topic} (Day ${day.day}).`,
      `Let's start there. Consider the learning objective "${objective}" and walk me through how you would approach it, step by step.`,
      `Mention the tools you used along the way: ${day.tools.join(", ")}.`,
    ].join(" ");
  }

  private fallbackDay(): CurriculumDay {
    return {
      id: "day-1",
      day: 1,
      module: "Foundations",
      topic: "AI Fundamentals & Python Setup",
      learningObjectives: ["Explain what artificial intelligence is"],
      tools: ["Python", "Jupyter Notebooks"],
      difficulty: "beginner",
    };
  }

  private fallbackQuestion(input: GenerateNextQuestionInput): GeneratedQuestion {
    return {
      question: {
        id: randomUUID(),
        type: "conceptual",
        prompt: "Let's start with the fundamentals. Explain, in your own words, what artificial intelligence is and how it differs from traditional programming.",
        context: "Foundations · AI Fundamentals & Python Setup",
        difficulty: "beginner",
        relatedDayIds: ["day-1"],
        createdAt: new Date().toISOString(),
      },
      source: "fallback",
    };
  }
}

/**
 * Gemini-backed engine. Orchestrates the planner and question generator for
 * every question (including the first), and the answer evaluator for every
 * answer. Each AI service degrades to a deterministic fallback on failure.
 */
export class GeminiInterviewEngine implements InterviewEngine {
  constructor(private readonly ai: AiServiceContainer) {}

  async generateFirstQuestion(input: GenerateFirstQuestionInput): Promise<GeneratedQuestion> {
    const planned = await this.ai.planner.planNext({
      candidate: input.candidate,
      curriculum: input.curriculum,
      memory: input.memory,
      previousQuestion: null,
      previousAnswer: null,
      lastEvaluation: null,
      personality: input.personality,
      transcript: [],
      mode: input.mode,
    });
    return this.questionFromPlan(planned, { ...input, previousAnswer: null });
  }

  async generateNextQuestion(input: GenerateNextQuestionInput): Promise<GeneratedQuestion> {
    const planned = await this.ai.planner.planNext({
      candidate: input.candidate,
      curriculum: input.curriculum,
      memory: input.memory,
      previousQuestion: input.previousQuestion,
      previousAnswer: input.previousAnswer,
      lastEvaluation: input.lastEvaluation,
      personality: input.personality,
      transcript: input.transcript,
      mode: input.mode,
    });
    return this.questionFromPlan(planned, {
      candidate: input.candidate,
      curriculum: input.curriculum,
      memory: input.memory,
      personality: input.personality,
      previousAnswer: input.previousAnswer,
      mode: input.mode,
    });
  }

  async evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluationOutput> {
    return this.ai.answerEvaluator.evaluateAnswer(input);
  }

  private async questionFromPlan(
    planned: PlanNextOutput,
    input: {
      candidate: Candidate;
      curriculum: CurriculumDay[];
      memory: InterviewMemory;
      personality: InterviewerPersonality;
      previousAnswer: string | null;
      mode: InterviewMode;
    }
  ): Promise<GeneratedQuestion> {
    const day =
      getDayById(input.curriculum, planned.decision.curriculumDay) ??
      getLastCompletedDay(input.candidate, input.curriculum) ??
      getEligibleDays(input.candidate, input.curriculum)[0];

    if (!day) {
      return {
        question: {
          id: randomUUID(),
          type: "conceptual",
          prompt: "Let's start with the fundamentals. Explain, in your own words, what artificial intelligence is and how it differs from traditional programming.",
          context: "Foundations · AI Fundamentals & Python Setup",
          difficulty: "beginner",
          relatedDayIds: ["day-1"],
          createdAt: new Date().toISOString(),
        },
        source: "fallback",
      };
    }

    return this.ai.questionGenerator.generateQuestion({
      candidate: input.candidate,
      curriculum: input.curriculum,
      day,
      plan: planned.decision,
      memory: input.memory,
      previousAnswer: input.previousAnswer,
      personality: input.personality,
      questionHistory: input.memory.questionHistory,
      mode: input.mode,
    });
  }
}
