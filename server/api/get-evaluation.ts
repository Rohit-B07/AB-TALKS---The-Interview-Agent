import { handleApiError, ok } from "@/server/api/helpers";
import { getFinalEvaluationResponseSchema } from "@/server/schemas";
import { interviewService } from "@/server/services/interview.service";

/**
 * Returns the candidate-facing final evaluation for a completed interview.
 *
 * The evaluation is generated once and persisted with the session; subsequent
 * requests return the stored copy without regenerating it. An incomplete
 * interview returns EVALUATION_NOT_AVAILABLE. The response only ever contains
 * the FinalEvaluation model — never raw evaluations, confidence, or memory.
 */
export async function handleGetFinalEvaluation(_request: Request, sessionId: string): Promise<Response> {
  try {
    const evaluation = await interviewService.getFinalEvaluation(sessionId);
    return ok({ evaluation }, getFinalEvaluationResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
