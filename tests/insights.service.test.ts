import { describe, expect, it } from "vitest";
import { insightsService } from "@/server/services/insights.service";
import { candidateService } from "@/server/services/candidate.service";

describe("InsightsService", () => {
  it("sara has high readiness with topics from her last completed days", async () => {
    const sara = await candidateService.getCandidateById("candidate-vatsal");
    const insights = await insightsService.getInsights(sara);

    expect(insights.completedDays).toBe(14);
    expect(insights.completionPercent).toBe(45);
    expect(insights.readinessLabel).toBe("High");
    expect(insights.readinessScore).toBe(68);
    expect(insights.estimatedMinutes).toEqual({ min: 10, max: 12 });
    expect(insights.estimatedQuestions).toBe(8);
    expect(insights.focusTopics).toContain("Evaluation & Guardrails");
  });

  it("omar receives the no-skip bonus removed for his skipped day", async () => {
    const omar = await candidateService.getCandidateById("candidate-varun");
    const insights = await insightsService.getInsights(omar);

    expect(insights.completedDays).toBe(6);
    expect(insights.readinessScore).toBe(32);
    expect(insights.readinessLabel).toBe("Early");
    expect(insights.estimatedMinutes.min).toBe(8);
  });

  it("lina gets the earliest curriculum as her focus area", async () => {
    const lina = await candidateService.getCandidateById("candidate-rohit");
    const insights = await insightsService.getInsights(lina);

    expect(insights.completedDays).toBe(3);
    expect(insights.completionPercent).toBe(10);
    expect(insights.estimatedQuestions).toBe(6);
    expect(insights.focusTopics[0]).toContain("AI Fundamentals");
  });
});
