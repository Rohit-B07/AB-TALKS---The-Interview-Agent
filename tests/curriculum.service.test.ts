import { describe, expect, it } from "vitest";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";

describe("CurriculumService", () => {
  it("loads at least 10 curriculum days from mock data", async () => {
    const curriculum = await curriculumService.getCurriculum();
    expect(curriculum.length).toBeGreaterThanOrEqual(10);
    expect(curriculum.every((day) => day.day > 0)).toBe(true);
  });

  it("returns completed days sorted by curriculum order", async () => {
    const lina = await candidateService.getCandidateById("candidate-rohit");
    const completed = await curriculumService.getCompletedDays(lina);
    expect(completed.map((day) => day.day)).toEqual([1, 3, 4]);
  });

  it("returns the most advanced completed day for a candidate", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const last = await curriculumService.getLastCompletedDay(sara);
    expect(last).not.toBeNull();
    expect(last!.id).toBe("day-14");
  });

  it("returns null when a candidate has no completed days", async () => {
    const last = await curriculumService.getLastCompletedDay({
      id: "candidate-empty",
      name: "Empty",
      defaultMode: "ai_engineering",
      completedDays: [],
      skippedDays: [],
      attempts: 0,
      strengths: [],
      weaknesses: [],
      learningSignals: [],
    });
    expect(last).toBeNull();
  });
});
