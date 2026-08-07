import type { Candidate, CurriculumDay, InterviewQuestion } from "@/server/types";

/**
 * Placeholder for the Phase 2 question generation prompt.
 *
 * TODO(phase-2): author the question prompt template here and render it in
 * server/ai/QuestionGenerator.ts. No prompt content is written yet.
 */

export interface QuestionPromptInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  lastQuestion: InterviewQuestion | null;
}

export function buildQuestionPrompt(input: QuestionPromptInput): {
  system: string;
  user: string;
} {
  void input;
  return { system: "", user: "" };
}
