import { aiLogger } from "@/lib/ai/logger";
import { requestStructuredJSON } from "@/server/ai/structured";
import { buildEvaluationPrompt } from "@/prompts/evaluation.prompt";
import { evaluationResultSchema, type EvaluationResult } from "@/server/ai/schemas";
import { evaluateFallbackAnswer } from "@/server/ai/fallback";
import type {
  Candidate,
  CurriculumDay,
  Evaluation,
  InterviewMemory,
  InterviewMode,
  InterviewQuestion,
  InterviewerPersonality,
  QuestionSource,
} from "@/server/types";

export interface EvaluateAnswerInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  question: InterviewQuestion;
  answer: string;
  memory: InterviewMemory;
  personality: InterviewerPersonality;
  mode?: InterviewMode;
}

export interface EvaluationOutput {
  evaluation: Evaluation;
  source: QuestionSource;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toEvaluation(questionId: string, result: EvaluationResult): Evaluation {
  return {
    questionId,
    score: Math.round(clamp(result.score, 1, 5)),
    understanding: result.understanding,
    strengths: result.strengths ?? [],
    weaknesses: result.weaknesses ?? [],
    needsFollowUp: result.needsFollowUp,
    followUpReason: result.followUpReason ?? "",
    memoryUpdate: result.memoryUpdate ?? "",
    confidence: clamp(result.confidence, 0, 1),
    difficultyRecommendation: result.difficultyRecommendation,
  };
}

/**
 * Scores a candidate's answer. The evaluation is INTERNAL: it is persisted in
 * server-side session state and never returned to the client. Falls back to a
 * deterministic heuristic when Gemini is unavailable.
 */
export class AnswerEvaluator {
  async evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluationOutput> {
    try {
      const { system, user } = buildEvaluationPrompt(input);
      const result = await requestStructuredJSON({
        system,
        user,
        schema: evaluationResultSchema,
        fallback: () => evaluateFallbackAnswer(input),
      });
      return { evaluation: toEvaluation(input.question.id, result), source: "ai" };
    } catch (error) {
      aiLogger.warn("AnswerEvaluator fell back to heuristic evaluation.", error);
      return { evaluation: toEvaluation(input.question.id, evaluateFallbackAnswer(input)), source: "fallback" };
    }
  }
}
