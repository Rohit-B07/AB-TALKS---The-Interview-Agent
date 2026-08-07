import { describe, expect, it } from "vitest";
import { interviewService } from "@/server/services/interview.service";

describe("InterviewService", () => {
  it("starts an interview and generates a first question from the candidate's journey", async () => {
    const result = await interviewService.startInterview("candidate-sara");

    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.question.relatedDayIds).toContain("day-14");
    expect(result.question.prompt).toContain("Evaluation & Guardrails");
    expect(result.state.status).toBe("active");
    expect(result.state.currentQuestion?.id).toBe(result.question.id);
    expect(result.state.currentQuestionAnswered).toBe(false);
    expect(result.state.transcript.length).toBe(1);
    expect(result.state.transcript[0].role).toBe("assistant");
  });

  it("falls back to the earliest curriculum day when the candidate has no completed days", async () => {
    const result = await interviewService.startInterview("candidate-lina");
    // Lina's most advanced completed day is day-4.
    expect(result.question.relatedDayIds).toContain("day-4");
  });

  it("rejects starting an interview for an unknown candidate", async () => {
    await expect(interviewService.startInterview("ghost")).rejects.toMatchObject({
      code: "INVALID_CANDIDATE",
      status: 404,
    });
  });

  it("records an answer and flags the question as answered", async () => {
    const { sessionId } = await interviewService.startInterview("candidate-omar");
    const state = await interviewService.submitAnswer(
      sessionId,
      "I would start by splitting the data into train and test sets."
    );

    expect(state.currentQuestionAnswered).toBe(true);
    expect(state.transcript.length).toBe(2);
    expect(state.transcript[1].role).toBe("candidate");
    expect(state.transcript[1].content).toContain("train and test");
  });

  it("rejects a second answer to the same question", async () => {
    const { sessionId } = await interviewService.startInterview("candidate-sara");
    await interviewService.submitAnswer(sessionId, "First attempt.");

    await expect(interviewService.submitAnswer(sessionId, "Second attempt.")).rejects.toMatchObject(
      {
        code: "QUESTION_ALREADY_ANSWERED",
        status: 400,
      }
    );
  });

  it("throws INVALID_SESSION when submitting to an unknown session", async () => {
    await expect(interviewService.submitAnswer("ghost", "anything")).rejects.toMatchObject({
      code: "INVALID_SESSION",
      status: 404,
    });
  });
});
