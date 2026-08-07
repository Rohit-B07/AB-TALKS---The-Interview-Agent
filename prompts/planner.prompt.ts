import type { Candidate, CurriculumDay } from "@/server/types";

/**
 * Placeholder for the Phase 2 interview planner prompt.
 *
 * TODO(phase-2): author the planning prompt template here and render it in
 * server/ai/InterviewPlanner.ts. No prompt content is written yet.
 */

export interface PlannerPromptInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
}

export function buildPlannerPrompt(input: PlannerPromptInput): {
  system: string;
  user: string;
} {
  void input;
  return { system: "", user: "" };
}
