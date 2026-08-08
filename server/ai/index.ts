import { InterviewPlanner } from "./InterviewPlanner";
import { QuestionGenerator } from "./QuestionGenerator";
import { AnswerEvaluator } from "./AnswerEvaluator";
import { MemoryManager } from "./MemoryManager";
import type {
  EvaluateAnswerInput,
  EvaluationOutput,
  GenerateQuestionInput,
  GeneratedQuestionOutput,
  PlanNextInput,
  PlanNextOutput,
} from "./types";

export { InterviewPlanner } from "./InterviewPlanner";
export { QuestionGenerator } from "./QuestionGenerator";
export { AnswerEvaluator } from "./AnswerEvaluator";
export { MemoryManager } from "./MemoryManager";
export { FinalEvaluationService } from "./FinalEvaluationService";
export type * from "./types";

/**
 * The set of AI services the interview flow uses, described structurally so
 * tests (and future providers) can swap in deterministic substitutes without
 * needing the concrete classes.
 */
export interface AiServiceContainer {
  planner: { planNext(input: PlanNextInput): Promise<PlanNextOutput> };
  questionGenerator: {
    generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestionOutput>;
  };
  answerEvaluator: {
    evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluationOutput>;
  };
  memoryManager: MemoryManager;
}

/** Builds the default AI service container. */
export function createDefaultAiServices(): AiServiceContainer {
  return {
    planner: new InterviewPlanner(),
    questionGenerator: new QuestionGenerator(),
    answerEvaluator: new AnswerEvaluator(),
    memoryManager: new MemoryManager(),
  };
}
