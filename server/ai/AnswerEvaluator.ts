import type { AnswerEvaluation, EvaluateAnswerInput } from "./types";

/**
 * Phase 2 placeholder service for scoring and giving feedback on answers.
 *
 * Public interface: `evaluateAnswer(input) -> AnswerEvaluation`.
 *
 * TODO(phase-2): implement with the Gemini client (lib/ai/gemini.ts) and the
 * evaluation prompt template (prompts/evaluation.prompt.ts).
 */
export class AnswerEvaluator {
  async evaluateAnswer(input: EvaluateAnswerInput): Promise<AnswerEvaluation> {
    void input;
    throw new Error("AnswerEvaluator.evaluateAnswer is not implemented in Phase 1.");
  }
}
