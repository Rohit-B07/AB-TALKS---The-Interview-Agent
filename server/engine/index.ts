import { MockInterviewEngine, type InterviewEngine } from "./interview-engine";

export type { InterviewEngine, GenerateFirstQuestionInput } from "./interview-engine";

/**
 * Phase 2 hook point: swap the mock engine for an LLM-backed implementation
 * here without changing anything else.
 */
export function createInterviewEngine(): InterviewEngine {
  return new MockInterviewEngine();
}
