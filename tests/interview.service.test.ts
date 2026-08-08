import { describe, expect, it } from "vitest";
import { MockInterviewEngine } from "@/server/engine";
import { InterviewService } from "@/server/services/interview.service";

function makeService(): InterviewService {
  return new InterviewService(new MockInterviewEngine());
}

const STRONG_ANSWER =
  "I would split the data into train and test sets, build a scikit-learn pipeline with " +
  "preprocessing steps, train a regression and a classification model, and evaluate them " +
  "with accuracy, precision, and recall before tuning hyperparameters with grid search.";

describe("InterviewService (adaptive flow)", () => {
  it("starts an interview and generates a first question from the candidate's journey", async () => {
    const service = makeService();
    const result = await service.startInterview("candidate-vatsal");

    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.question.relatedDayIds).toContain("day-14");
    expect(result.question.prompt).toContain("Evaluation & Guardrails");
    expect(result.state.status).toBe("active");
    expect(result.state.currentQuestion?.id).toBe(result.question.id);
    expect(result.state.currentQuestionAnswered).toBe(false);
    expect(result.state.transcript.length).toBe(1);
    expect(result.state.transcript[0].role).toBe("assistant");
    expect(result.state.questionsTarget).toBe(8);
    expect(result.state.progress).toBeGreaterThan(0);
    expect(result.state.interviewComplete).toBe(false);
  });

  it("falls back to the most advanced completed day for a candidate with fewer days", async () => {
    const service = makeService();
    const result = await service.startInterview("candidate-rohit");
    expect(result.question.relatedDayIds).toContain("day-4");
  });

  it("respects the requested interviewer personality", async () => {
    const service = makeService();
    const result = await service.startInterview("candidate-vatsal", "senior_engineer");
    const session = await service.getSession(result.sessionId);
    expect(session.personality).toBe("senior_engineer");
  });

  it("rejects starting an interview for an unknown candidate", async () => {
    const service = makeService();
    await expect(service.startInterview("ghost")).rejects.toMatchObject({
      code: "INVALID_CANDIDATE",
      status: 404,
    });
  });

  it("records an answer, evaluates it, updates memory, and advances to the next question", async () => {
    const service = makeService();
    const { sessionId } = await service.startInterview("candidate-varun");
    const state = await service.submitAnswer(sessionId, STRONG_ANSWER);

    expect(state.currentQuestionAnswered).toBe(false);
    expect(state.transcript.length).toBe(3);
    expect(state.transcript[1].role).toBe("candidate");
    expect(state.transcript[1].content).toContain("train and test");
    expect(state.questionsAsked).toBe(2);
    expect(state.currentQuestionNumber).toBe(2);

    const session = await service.getSession(sessionId);
    expect(session.evaluations.length).toBe(1);
    expect(session.evaluations[0].questionId).toBe(session.transcript[0].questionId);
    expect(session.memory.questionNumber).toBe(1);
    expect(session.memory.coveredDays.length).toBeGreaterThanOrEqual(1);
    expect(session.memory.lastEvaluation).not.toBeNull();
  });

  it("throws INVALID_SESSION when submitting to an unknown session", async () => {
    const service = makeService();
    await expect(service.submitAnswer("ghost", "anything")).rejects.toMatchObject({
      code: "INVALID_SESSION",
      status: 404,
    });
  });

  it("keeps the session retrievable after answers (persistence)", async () => {
    const service = makeService();
    const { sessionId } = await service.startInterview("candidate-vatsal");
    await service.submitAnswer(sessionId, STRONG_ANSWER);
    const restored = await service.getSession(sessionId);
    expect(restored.transcript.length).toBeGreaterThanOrEqual(3);
  });
});
