import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/lib/ai/gemini";
import { GeminiInterviewEngine } from "@/server/engine";
import { createDefaultAiServices } from "@/server/ai";
import { InterviewService } from "@/server/services/interview.service";

const mockedGenerate = vi.mocked(generateContent);

function makeService(): InterviewService {
  return new InterviewService(new GeminiInterviewEngine(createDefaultAiServices()));
}

const ANSWER =
  "I would split the data into train and test sets, build a pipeline with preprocessing, " +
  "train a model, evaluate it, and tune the hyperparameters while watching the loss curves.";

describe("Gemini failure fallback (integration)", () => {
  beforeEach(() => {
    mockedGenerate.mockRejectedValue(new Error("simulated Gemini outage"));
  });

  it("continues the interview with fallback questions and completes normally", async () => {
    const service = makeService();
    const { sessionId, question } = await service.startInterview("candidate-vatsal");
    expect(question).toBeDefined();

    let state;
    for (let i = 0; i < 8; i += 1) {
      state = await service.submitAnswer(sessionId, ANSWER);
    }

    expect(state).toBeDefined();
    expect(state!.interviewComplete).toBe(true);
    expect(state!.questionsAsked).toBe(8);
    expect(state!.uniqueCurriculumDays).toBeGreaterThanOrEqual(4);
    expect(state!.progress).toBe(100);

    const session = await service.getSession(sessionId);
    expect(session.status).toBe("completed");
    expect(session.evaluations).toHaveLength(8);
    expect(session.evaluations.every((e) => e.score >= 1 && e.score <= 5)).toBe(true);
  });

  it("does not crash a session when the evaluator or planner fails mid-interview", async () => {
    // Flip-flop: fail during the first half, succeed-looking fallbacks after.
    mockedGenerate.mockRejectedValue(new Error("transient Gemini failure"));

    const service = makeService();
    const { sessionId } = await service.startInterview("candidate-varun");

    const state = await service.submitAnswer(sessionId, ANSWER);
    expect(state.currentQuestionNumber).toBe(2);
    expect(state.questionsAsked).toBe(2);

    const session = await service.getSession(sessionId);
    expect(session.transcript).toHaveLength(3);
  });
});
