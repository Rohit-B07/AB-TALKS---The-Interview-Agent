import { MockInterviewEngine, type InterviewEngine } from "./interview-engine";
import type { AiServiceContainer } from "@/server/ai";

export type { InterviewEngine, GenerateFirstQuestionInput } from "./interview-engine";

export interface CreateInterviewEngineOptions {
  /** Phase 2 AI services, injected when the LLM-backed engine ships. */
  ai?: AiServiceContainer;
}

/**
 * Phase 2 hook point: swap the mock engine for an LLM-backed implementation
 * here without changing anything else. Pass the AI service container through
 * `options.ai` once the Gemini engine is implemented.
 */
export function createInterviewEngine(options: CreateInterviewEngineOptions = {}): InterviewEngine {
  // The mock engine keeps Phase 1 behavior intact; `options.ai` is reserved
  // for the Phase 2 GeminiInterviewEngine.
  void options.ai;
  return new MockInterviewEngine();
}
