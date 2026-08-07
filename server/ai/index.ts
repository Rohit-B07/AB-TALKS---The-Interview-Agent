import { InterviewPlanner } from "./InterviewPlanner";
import { QuestionGenerator } from "./QuestionGenerator";
import { AnswerEvaluator } from "./AnswerEvaluator";
import { MemoryManager } from "./MemoryManager";

export { InterviewPlanner } from "./InterviewPlanner";
export { QuestionGenerator } from "./QuestionGenerator";
export { AnswerEvaluator } from "./AnswerEvaluator";
export { MemoryManager } from "./MemoryManager";
export type * from "./types";

/**
 * The set of AI services the interview flow will use in Phase 2.
 * Injected via the engine factory so the mock path stays untouched today.
 */
export interface AiServiceContainer {
  planner: InterviewPlanner;
  questionGenerator: QuestionGenerator;
  answerEvaluator: AnswerEvaluator;
  memoryManager: MemoryManager;
}

/** Builds placeholder AI services (Phase 2 implementations replace these). */
export function createDefaultAiServices(): AiServiceContainer {
  return {
    planner: new InterviewPlanner(),
    questionGenerator: new QuestionGenerator(),
    answerEvaluator: new AnswerEvaluator(),
    memoryManager: new MemoryManager(),
  };
}
