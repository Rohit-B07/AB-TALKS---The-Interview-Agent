import type { Candidate, CurriculumDay, InterviewQuestion, QuestionType } from "@/server/types";

/**
 * Shared types for the Phase 2 AI services.
 *
 * These describe the contracts the AI layer will fulfill. None of them are
 * implemented yet — Phase 2 will fill in the behavior.
 */

/** A phase of the interview derived from the candidate's journey. */
export interface InterviewPhase {
  /** Days covered by this phase (ids from the curriculum). */
  dayIds: string[];
  /** Narrative focus the interviewer should emphasize. */
  focus: string;
  /** Suggested target difficulty. */
  difficulty: CurriculumDay["difficulty"];
}

/** Output of InterviewPlanner: the structure of the whole interview. */
export interface InterviewPlan {
  candidateId: string;
  /** Ordered phases to walk the candidate through. */
  phases: InterviewPhase[];
  /** How many questions to ask in total. */
  questionCount: number;
  /** Estimated duration in minutes. */
  estimatedMinutes: number;
}

/** Input for planning an interview. */
export interface PlanInterviewInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
}

/** Output of QuestionGenerator. */
export interface GeneratedQuestion {
  type: QuestionType;
  prompt: string;
  context: string;
  difficulty: CurriculumDay["difficulty"];
  relatedDayIds: string[];
}

/** Input for generating the next question. */
export interface GenerateQuestionInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  plan: InterviewPlan;
  transcript: { role: "assistant" | "candidate"; content: string }[];
  lastQuestion: InterviewQuestion | null;
}

/** A scored evaluation of a single candidate answer. */
export interface AnswerEvaluation {
  score: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
  suggestedFollowUp: string;
}

/** Input for evaluating an answer. */
export interface EvaluateAnswerInput {
  candidate: Candidate;
  question: InterviewQuestion;
  answer: string;
  priorEvaluation: AnswerEvaluation | null;
}

/** Long-lived signal the interviewer carries across the whole session. */
export interface InterviewMemory {
  candidateId: string;
  completedTopics: string[];
  weakTopics: string[];
  /** Last known comprehension band, e.g. "low" | "medium" | "high". */
  comprehension: "low" | "medium" | "high";
  answeredQuestions: number;
}

/** Input for producing/updating interview memory. */
export interface MemoryUpdateInput {
  candidate: Candidate;
  transcript: { role: "assistant" | "candidate"; content: string }[];
  evaluation: AnswerEvaluation;
}
