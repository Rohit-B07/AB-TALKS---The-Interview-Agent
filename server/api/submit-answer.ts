import { AppError, ErrorCodes } from "@/server/errors/app-error";
import { handleApiError, ok, parseJsonBody } from "@/server/api/helpers";
import { submitAnswerRequestSchema, submitAnswerResponseSchema } from "@/server/schemas";
import { interviewService } from "@/server/services/interview.service";

export async function handleSubmitAnswer(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    const parsed = submitAnswerRequestSchema.safeParse(body);
    if (!parsed.success) {
      const missingAnswer = parsed.error.issues.some((issue) => issue.path[0] === "answer");
      throw new AppError(
        missingAnswer ? ErrorCodes.MISSING_ANSWER : ErrorCodes.INVALID_REQUEST,
        missingAnswer
          ? "An answer is required."
          : "Invalid answer submission request.",
        { issues: parsed.error.issues }
      );
    }

    const state = await interviewService.submitAnswer(
      parsed.data.sessionId,
      parsed.data.answer
    );

    return ok({ state }, submitAnswerResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
