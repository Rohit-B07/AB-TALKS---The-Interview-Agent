import { randomUUID } from "node:crypto";
import { AppError } from "@/server/errors/app-error";
import { aiLogger } from "@/lib/ai/logger";
import { generateContent } from "@/lib/ai/gemini";
import { buildQuestionPrompt } from "@/prompts/question.prompt";
import type { PlannerDecision } from "@/server/ai/schemas";
import { AI_QUESTION_TEMPERATURE, MAX_DUPLICATE_RETRIES } from "@/server/ai/constants";
import { createFallbackQuestion } from "@/server/ai/fallback";
import { capDsaDifficulty, difficultyFromPlanner, isDuplicateQuestion } from "@/server/ai/utils";
import type {
  Candidate,
  CurriculumDay,
  InterviewMemory,
  InterviewMode,
  InterviewQuestion,
  InterviewerPersonality,
  QuestionSource,
} from "@/server/types";

export interface GenerateQuestionInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  day: CurriculumDay;
  plan: PlannerDecision;
  memory: InterviewMemory;
  previousAnswer: string | null;
  personality: InterviewerPersonality;
  questionHistory: string[];
  mode?: InterviewMode;
}

export interface GeneratedQuestionOutput {
  question: InterviewQuestion;
  source: QuestionSource;
}

/**
 * Converts a planner decision into EXACTLY ONE natural interview question.
 *
 * Duplicate prevention: generated text is compared against the session's
 * question history (exact + near-duplicate detection). A duplicate is retried
 * with a bounded number of attempts; if the model keeps repeating itself the
 * generator falls back to the deterministic question bank, which itself skips
 * prompts that duplicate history.
 */
export class QuestionGenerator {
  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestionOutput> {
    try {
      for (let attempt = 0; attempt <= MAX_DUPLICATE_RETRIES; attempt += 1) {
        const { system, user } = buildQuestionPrompt(input);
        const text = await generateContent({
          systemInstruction: system,
          contents: user,
          config: { temperature: AI_QUESTION_TEMPERATURE },
        });

        const questionText = this.cleanQuestionText(text);
        if (!questionText) {
          throw new AppError("AI_ERROR", "QuestionGenerator received an empty response.");
        }
        if (this.isDuplicate(questionText, input.questionHistory)) {
          aiLogger.warn(
            `QuestionGenerator produced a duplicate on attempt ${attempt + 1}; retrying or falling back.`
          );
          continue;
        }

        return { question: this.toQuestion(questionText, input), source: "ai" };
      }

      aiLogger.warn("QuestionGenerator exhausted duplicate retries; using fallback question.");
      return { question: createFallbackQuestion(input), source: "fallback" };
    } catch (error) {
      aiLogger.warn("QuestionGenerator fell back to a deterministic question.", error);
      return { question: createFallbackQuestion(input), source: "fallback" };
    }
  }

  private cleanQuestionText(text: string): string {
    return text
      .trim()
      .replace(/^```(?:text|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isDuplicate(text: string, history: string[]): boolean {
    return isDuplicateQuestion(text, history);
  }

  private toQuestion(text: string, input: GenerateQuestionInput): InterviewQuestion {
    return {
      id: randomUUID(),
      type: input.plan.questionType,
      prompt: text,
      context:
        input.mode === "dsa_friendly"
          ? `DSA Friendly · ${input.plan.topic}`
          : `${input.day.module} · ${input.day.topic}`,
      difficulty:
        input.mode === "dsa_friendly"
          ? difficultyFromPlanner(capDsaDifficulty(input.plan.difficulty))
          : difficultyFromPlanner(input.plan.difficulty),
      relatedDayIds: [input.day.id],
      createdAt: new Date().toISOString(),
    };
  }
}
