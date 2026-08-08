import { z } from "zod";
import { evaluationSchema } from "@/server/schemas";
import type { QuestionType } from "@/server/types";

/**
 * Zod schemas for structured Gemini responses (the planner decision and the
 * raw evaluation result). Every structured AI output is validated through
 * these before it is trusted. The raw evaluation result omits `questionId`,
 * which the AnswerEvaluator attaches after parsing.
 */

export const plannerActionSchema = z.enum([
  "follow_up",
  "new_topic",
  "increase_difficulty",
  "clarify",
]);

// "beginner" is accepted for robustness even though the prompt asks for
// "easy"; difficultyFromPlanner normalizes both.
export const plannerDifficultySchema = z.enum([
  "easy",
  "beginner",
  "intermediate",
  "advanced",
]);

export const plannerQuestionTypeSchema = z.enum([
  "conceptual",
  "practical",
  "debugging",
  "scenario",
  "tradeoff",
  "coding",
  "open-ended",
]);

export const plannerDecisionSchema = z.object({
  action: plannerActionSchema,
  curriculumDay: z.string().min(1),
  topic: z.string().min(1),
  difficulty: plannerDifficultySchema,
  reason: z.string().min(1),
  questionType: plannerQuestionTypeSchema,
  referencePreviousAnswer: z.boolean(),
});
export type PlannerDecision = z.infer<typeof plannerDecisionSchema>;
export type PlannerQuestionType = z.infer<typeof plannerQuestionTypeSchema>;

/** A QuestionType usable in planner output (a superset for robustness). */
export type PlannerQuestionTypeSet = QuestionType;

/** Raw evaluation result as returned by Gemini (no questionId yet). */
export const evaluationResultSchema = evaluationSchema.omit({ questionId: true });
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

/**
 * The narrative portion of the final evaluation that Gemini may write.
 *
 * Deliberately contains NO scores: the overall score, topic scores, readiness,
 * strengths, knowledge gaps, improvement questions, and difficulty progression
 * are all computed deterministically from evaluator results. Gemini only
 * summarizes that structured evidence into natural language. If Gemini fails
 * or returns invalid output, the FinalEvaluationService uses deterministic
 * fallback text instead, so the report is always available.
 */
export const finalEvaluationNarrativeSchema = z.object({
  summary: z.string().min(1).max(700),
  topicSummaries: z
    .array(z.object({ topic: z.string().min(1), summary: z.string().min(1).max(350) }))
    .max(16),
  adaptiveBehavior: z.string().min(1).max(600),
  recommendations: z.array(z.string().min(1).max(300)).min(1).max(6),
});
export type FinalEvaluationNarrative = z.infer<typeof finalEvaluationNarrativeSchema>;

/** The JSON shape the planner prompt asks Gemini to emit. */
export const PLANNER_OUTPUT_EXAMPLE: Record<string, unknown> = {
  action: "follow_up | new_topic | increase_difficulty | clarify",
  curriculumDay: "day-7",
  topic: "Deep Learning with PyTorch",
  difficulty: "easy | intermediate | advanced",
  reason: "short reason for this decision",
  questionType: "conceptual | practical | debugging | scenario | tradeoff",
  referencePreviousAnswer: true,
};

/** The JSON shape the evaluation prompt asks Gemini to emit. */
export const EVALUATION_OUTPUT_EXAMPLE: Record<string, unknown> = {
  score: 3,
  understanding: "one-sentence assessment of the answer",
  strengths: ["one or more short strengths"],
  weaknesses: ["one or more short weaknesses"],
  needsFollowUp: true,
  followUpReason: "why a follow-up would be valuable, or empty",
  memoryUpdate: "short note about the candidate for interview memory",
  confidence: 0.8,
  difficultyRecommendation: "same | harder | easier",
};
