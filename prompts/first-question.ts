import type { Candidate, CurriculumDay } from "@/server/types";

export interface FirstQuestionPromptInput {
  candidate: Candidate;
  day: CurriculumDay;
}

/**
 * Template for generating the first interview question.
 *
 * Phase 1 builds a deterministic question from this template. In Phase 2 the
 * same builder can feed these strings to an LLM and the engine returns the
 * model's output instead of the mocked text.
 */
export const SYSTEM_PROMPT =
  "You are an adaptive technical interviewer for the ABTalks AI Cohort. " +
  "You ask questions based strictly on the curriculum the candidate has completed.";

export function buildFirstQuestionPrompt({
  candidate,
  day,
}: FirstQuestionPromptInput): { system: string; user: string } {
  const objectives = day.learningObjectives
    .map((objective, index) => `${index + 1}. ${objective}`)
    .join("\n");

  const user = [
    `Candidate: ${candidate.name}`,
    `Most recent completed day: Day ${day.day} — ${day.module}: ${day.topic}`,
    `Learning objectives covered:`,
    objectives,
    `Generate a single open-ended interview question that checks the candidate's understanding of this material.`,
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}
