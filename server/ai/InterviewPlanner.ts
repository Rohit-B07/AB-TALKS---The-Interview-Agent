import type { InterviewPlan, PlanInterviewInput } from "./types";

/**
 * Phase 2 placeholder service for planning an interview session.
 *
 * Public interface: `createPlan(input) -> InterviewPlan`.
 *
 * TODO(phase-2): implement with the Gemini client (lib/ai/gemini.ts) and the
 * planner prompt template (prompts/planner.prompt.ts).
 */
export class InterviewPlanner {
  async createPlan(input: PlanInterviewInput): Promise<InterviewPlan> {
    void input;
    throw new Error("InterviewPlanner.createPlan is not implemented in Phase 1.");
  }
}
