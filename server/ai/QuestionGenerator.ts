import type { GeneratedQuestion, GenerateQuestionInput } from "./types";

/**
 * Phase 2 placeholder service for generating interview questions, including
 * adaptive follow-ups.
 *
 * Public interface: `generateQuestion(input) -> GeneratedQuestion`.
 *
 * TODO(phase-2): implement with the Gemini client (lib/ai/gemini.ts) and the
 * question prompt template (prompts/question.prompt.ts).
 */
export class QuestionGenerator {
  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion> {
    void input;
    throw new Error("QuestionGenerator.generateQuestion is not implemented in Phase 1.");
  }
}
