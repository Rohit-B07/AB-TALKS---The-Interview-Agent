import type { FinalEvaluation, InterviewSession } from "@/server/types";
import { aiLogger } from "@/lib/ai/logger";
import { requestStructuredJSON } from "@/server/ai/structured";
import { buildFinalEvaluationPrompt } from "@/prompts/final-evaluation.prompt";
import { finalEvaluationNarrativeSchema, type FinalEvaluationNarrative } from "@/server/ai/schemas";
import {
  buildEvidence,
  type EvaluationEvidence,
} from "@/server/ai/final-evaluation/aggregate";
import { assembleFinalEvaluation } from "@/server/ai/final-evaluation/narrative";

/**
 * Produces the candidate-facing final evaluation for a completed interview.
 *
 * Scoring is fully deterministic and explainable (see final-evaluation/aggregate):
 * answer scores are aggregated into topic scores, then into an overall score,
 * readiness, strengths, knowledge gaps, improvement questions, and difficulty
 * progression. Gemini is used ONLY to paraphrase that structured evidence into
 * narrative text. If Gemini is unavailable or returns malformed output, the
 * deterministic narrative (final-evaluation/narrative) is used instead, so the
 * report is always available and never fails a completed interview.
 */
export class FinalEvaluationService {
  async generate(session: InterviewSession): Promise<FinalEvaluation> {
    const evidence = buildEvidence(session);
    const narrative = await this.requestNarrative(evidence);
    return assembleFinalEvaluation(session, evidence, narrative);
  }

  private async requestNarrative(evidence: EvaluationEvidence): Promise<FinalEvaluationNarrative | null> {
    try {
      const { system, user } = buildFinalEvaluationPrompt(evidence);
      return await requestStructuredJSON({
        system,
        user,
        schema: finalEvaluationNarrativeSchema,
        fallback: () => null,
      });
    } catch (error) {
      aiLogger.warn("FinalEvaluationService fell back to deterministic narrative.", error);
      return null;
    }
  }
}

export const finalEvaluationService = new FinalEvaluationService();
