import type { Candidate, InterviewQuestion } from "@/server/types";

/**
 * Placeholder for the Phase 2 answer evaluation prompt.
 *
 * TODO(phase-2): author the evaluation prompt template here and render it in
 * server/ai/AnswerEvaluator.ts. No prompt content is written yet.
 */

export interface EvaluationPromptInput {
  candidate: Candidate;
  question: InterviewQuestion;
  answer: string;
}

export function buildEvaluationPrompt(input: EvaluationPromptInput): {
  system: string;
  user: string;
} {
  void input;
  return { system: "", user: "" };
}
