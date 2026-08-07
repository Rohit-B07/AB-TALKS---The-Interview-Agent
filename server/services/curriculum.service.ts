import { z } from "zod";
import { readJsonFile } from "@/server/lib/read-json";
import { curriculumDaySchema } from "@/server/schemas";
import type { Candidate, CurriculumDay } from "@/server/types";

const curriculumSchema = z.array(curriculumDaySchema);

const byDayAscending = (a: CurriculumDay, b: CurriculumDay) => a.day - b.day;

/**
 * Loads curriculum data and answers questions about a candidate's progress
 * through it.
 */
export class CurriculumService {
  async getCurriculum(): Promise<CurriculumDay[]> {
    return readJsonFile("curriculum.json", curriculumSchema, "INVALID_CURRICULUM");
  }

  async getDayById(id: string): Promise<CurriculumDay | null> {
    const curriculum = await this.getCurriculum();
    return curriculum.find((day) => day.id === id) ?? null;
  }

  /** Days the candidate completed, sorted from first to most recent. */
  async getCompletedDays(candidate: Candidate): Promise<CurriculumDay[]> {
    const curriculum = await this.getCurriculum();
    const completed = curriculum.filter((day) => candidate.completedDays.includes(day.id));
    return completed.sort(byDayAscending);
  }

  /** The most advanced curriculum day the candidate has completed, if any. */
  async getLastCompletedDay(candidate: Candidate): Promise<CurriculumDay | null> {
    const completed = await this.getCompletedDays(candidate);
    return completed.length > 0 ? completed[completed.length - 1] : null;
  }
}

export const curriculumService = new CurriculumService();
