import { curriculumService } from "@/server/services/curriculum.service";
import type { Candidate, CurriculumDay, Difficulty } from "@/server/types";

/**
 * Presentation-friendly summary of a candidate's interview readiness,
 * derived deterministically from the mock data. Used by the landing page
 * and the interview welcome screen.
 */
export interface CandidateInsights {
  totalDays: number;
  completedDays: number;
  completionPercent: number;
  attempts: number;
  strengths: string[];
  focusAreas: string[];
  difficulty: Difficulty;
  readinessScore: number;
  readinessLabel: "High" | "Moderate" | "Early";
  estimatedMinutes: { min: number; max: number };
  estimatedQuestions: number;
  /** Topics of the most recently completed curriculum days. */
  focusTopics: string[];
  lastCompletedDay: CurriculumDay | null;
}

const READINESS_BONUS_FOR_NO_SKIPS = 12;

/** Data the interview welcome screen needs, derived from candidate insights. */
export interface WelcomeInfo {
  firstName: string;
  focusTopics: string[];
  estimatedMinutes: string;
  estimatedQuestions: number;
  completion: string;
}

function readinessLabel(score: number): CandidateInsights["readinessLabel"] {
  if (score >= 65) return "High";
  if (score >= 40) return "Moderate";
  return "Early";
}

export class InsightsService {
  async getInsights(candidate: Candidate): Promise<CandidateInsights> {
    const curriculum = await curriculumService.getCurriculum();
    const completed = curriculum
      .filter((day) => candidate.completedDays.includes(day.id))
      .sort((a, b) => a.day - b.day);

    const totalDays = curriculum.length;
    const completedDays = completed.length;
    const completionPercent = Math.round((completedDays / totalDays) * 100);
    const skippedCount = candidate.skippedDays.length;

    const skipBonus =
      skippedCount === 0
        ? READINESS_BONUS_FOR_NO_SKIPS
        : Math.max(0, READINESS_BONUS_FOR_NO_SKIPS - skippedCount * 4);
    const readinessScore = Math.min(100, Math.round(completedDays * 4 + skipBonus));

    const lastCompletedDay = completed.length > 0 ? completed[completed.length - 1] : null;
    const focusTopics = completed.slice(-3).map((day) => day.topic);

    const minMinutes = 8 + Math.floor(completedDays / 7);
    const estimatedQuestions = Math.min(10, 5 + Math.round(completionPercent / 15));

    return {
      totalDays,
      completedDays,
      completionPercent,
      attempts: candidate.attempts,
      strengths: candidate.strengths,
      focusAreas: candidate.weaknesses,
      difficulty: lastCompletedDay?.difficulty ?? "beginner",
      readinessScore,
      readinessLabel: readinessLabel(readinessScore),
      estimatedMinutes: { min: minMinutes, max: minMinutes + 2 },
      estimatedQuestions,
      focusTopics,
      lastCompletedDay,
    };
  }

  async getInsightsForAll(): Promise<Record<string, CandidateInsights>> {
    const { candidateService } = await import("@/server/services/candidate.service");
    const candidates = await candidateService.getCandidates();
    const entries = await Promise.all(
      candidates.map(async (candidate) => [candidate.id, await this.getInsights(candidate)] as const)
    );
    return Object.fromEntries(entries);
  }
}

export const insightsService = new InsightsService();
