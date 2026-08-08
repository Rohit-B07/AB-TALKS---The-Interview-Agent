import { aiLogger } from "@/lib/ai/logger";
import { requestStructuredJSON } from "@/server/ai/structured";
import { buildPlannerPrompt } from "@/prompts/planner.prompt";
import { plannerDecisionSchema, type PlannerDecision } from "@/server/ai/schemas";
import { createFallbackPlan } from "@/server/ai/fallback";
import { capDsaDifficulty, getEligibleDays, getLastCompletedDay } from "@/server/ai/utils";
import type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  Evaluation,
  InterviewMemory,
  InterviewMode,
  InterviewQuestion,
  InterviewerPersonality,
  QuestionSource,
} from "@/server/types";

export interface PlanNextInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  memory: InterviewMemory;
  previousQuestion: InterviewQuestion | null;
  previousAnswer: string | null;
  lastEvaluation: Evaluation | null;
  personality: InterviewerPersonality;
  transcript: ConversationTurn[];
  mode?: InterviewMode;
}

export interface PlanNextOutput {
  decision: PlannerDecision;
  source: QuestionSource;
}

/**
 * Decides WHAT the interviewer should assess next (action, curriculum day,
 * difficulty, question type). It never writes the final question text — that
 * is the QuestionGenerator's job.
 */
export class InterviewPlanner {
  async planNext(input: PlanNextInput): Promise<PlanNextOutput> {
    try {
      const { system, user } = buildPlannerPrompt(input);
      const decision = await requestStructuredJSON({
        system,
        user,
        schema: plannerDecisionSchema,
        fallback: () => createFallbackPlan(input),
      });
      return { decision: this.sanitize(decision, input), source: "ai" };
    } catch (error) {
      aiLogger.warn("InterviewPlanner fell back to deterministic planning.", error);
      return { decision: createFallbackPlan(input), source: "fallback" };
    }
  }

  /**
   * Guarantees the chosen curriculum day is one the candidate has actually
   * completed and not skipped. The model may occasionally hallucinate a day
   * id; we coerce it to a safe fallback instead of trusting it blindly.
   */
  private sanitize(decision: PlannerDecision, input: PlanNextInput): PlannerDecision {
    // DSA Friendly never exceeds intermediate, regardless of model intent.
    let sanitized = decision;
    if ((input.mode ?? "ai_engineering") === "dsa_friendly") {
      sanitized = { ...sanitized, difficulty: capDsaDifficulty(sanitized.difficulty) };
    }

    const eligibleIds = new Set(getEligibleDays(input.candidate, input.curriculum).map((day) => day.id));
    if (eligibleIds.has(sanitized.curriculumDay)) return sanitized;

    const fallback = getLastCompletedDay(input.candidate, input.curriculum);
    if (fallback) {
      return { ...sanitized, curriculumDay: fallback.id, topic: fallback.topic };
    }
    return { ...sanitized, curriculumDay: input.curriculum[0]?.id ?? "day-1" };
  }
}
