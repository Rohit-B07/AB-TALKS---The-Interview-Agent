import { describe, expect, it } from "vitest";
import { candidateService } from "@/server/services/candidate.service";

describe("CandidateService", () => {
  it("loads all candidate profiles from mock data", async () => {
    const candidates = await candidateService.getCandidates();
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    expect(candidates.every((candidate) => candidate.name.length > 0)).toBe(true);
  });

  it("returns the requested candidate by id", async () => {
    const candidate = await candidateService.getCandidateById("candidate-sara");
    expect(candidate.name).toBe("Sara Al-Rashid");
    expect(candidate.completedDays.length).toBeGreaterThan(0);
  });

  it("throws INVALID_CANDIDATE for an unknown id", async () => {
    await expect(candidateService.getCandidateById("does-not-exist")).rejects.toMatchObject({
      code: "INVALID_CANDIDATE",
      status: 404,
    });
  });
});
