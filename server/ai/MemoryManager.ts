import type { InterviewMemory, MemoryUpdateInput } from "./types";

/**
 * Phase 2 placeholder service for session-long memory of a candidate's
 * performance.
 *
 * Public interface:
 * - `buildMemory(input) -> InterviewMemory`
 * - `mergeMemory(current, update) -> InterviewMemory`
 *
 * TODO(phase-2): implement with the Gemini client (lib/ai/gemini.ts) so the
 * interviewer can adapt follow-ups to how the candidate is performing.
 */
export class MemoryManager {
  async buildMemory(input: MemoryUpdateInput): Promise<InterviewMemory> {
    void input;
    throw new Error("MemoryManager.buildMemory is not implemented in Phase 1.");
  }

  async mergeMemory(current: InterviewMemory, update: MemoryUpdateInput): Promise<InterviewMemory> {
    void current;
    void update;
    throw new Error("MemoryManager.mergeMemory is not implemented in Phase 1.");
  }
}
