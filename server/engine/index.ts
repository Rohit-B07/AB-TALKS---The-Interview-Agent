import {
  GeminiInterviewEngine,
  MockInterviewEngine,
  type InterviewEngine,
} from "./interview-engine";
import { createDefaultAiServices, type AiServiceContainer } from "@/server/ai";

export type {
  InterviewEngine,
  GeneratedQuestion,
  GenerateFirstQuestionInput,
  GenerateNextQuestionInput,
  EvaluateAnswerInput,
} from "./interview-engine";

export interface CreateInterviewEngineOptions {
  /** Phase 2 AI services; defaults to the Gemini-backed container. */
  ai?: AiServiceContainer;
}

/**
 * Builds the interview engine. By default this is the Gemini-backed engine
 * (each AI service degrades to a deterministic fallback when the model is
 * unavailable). Pass a MockInterviewEngine for deterministic tests.
 */
export function createInterviewEngine(options: CreateInterviewEngineOptions = {}): InterviewEngine {
  const ai = options.ai ?? createDefaultAiServices();
  return new GeminiInterviewEngine(ai);
}

export { GeminiInterviewEngine, MockInterviewEngine };
