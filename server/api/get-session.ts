import { handleApiError, ok } from "@/server/api/helpers";
import { getSessionResponseSchema } from "@/server/schemas";
import { interviewService } from "@/server/services/interview.service";

export async function handleGetSession(_request: Request, sessionId: string): Promise<Response> {
  try {
    const session = await interviewService.getSession(sessionId);
    console.log(`[api] GET /api/interview/[sessionId] found session=${sessionId}`);
    const state = interviewService.toState(session);

    const response = {
      sessionId: session.id,
      candidate: session.candidate,
      metadata: {
        status: session.status,
        mode: session.mode,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        currentQuestionAnswered: state.currentQuestionAnswered,
        currentQuestionNumber: state.currentQuestionNumber,
        questionsAsked: state.questionsAsked,
        questionsTarget: state.questionsTarget,
        uniqueCurriculumDays: state.uniqueCurriculumDays,
        progress: state.progress,
        interviewComplete: state.interviewComplete,
      },
      currentQuestion: session.currentQuestion,
      conversation: session.transcript,
    };

    return ok(response, getSessionResponseSchema);
  } catch (error) {
    console.log(`[api] GET /api/interview/[sessionId] MISSING session=${sessionId}`);
    return handleApiError(error);
  }
}
