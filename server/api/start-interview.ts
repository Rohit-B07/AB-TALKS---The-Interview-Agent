import { AppError } from "@/server/errors/app-error";
import { handleApiError, ok, parseJsonBody } from "@/server/api/helpers";
import {
  startInterviewRequestSchema,
  startInterviewResponseSchema,
} from "@/server/schemas";
import { interviewService } from "@/server/services/interview.service";

export async function handleStartInterview(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    const parsed = startInterviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("INVALID_REQUEST", "Invalid start interview request.", {
        issues: parsed.error.issues,
      });
    }

    const result = await interviewService.startInterview(parsed.data.candidateId);
    return ok(result, startInterviewResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
