import { handleApiError, ok } from "@/server/api/helpers";
import { listCandidatesResponseSchema } from "@/server/schemas";
import { candidateService } from "@/server/services/candidate.service";

export async function handleListCandidates(): Promise<Response> {
  try {
    const candidates = await candidateService.getCandidates();
    return ok({ candidates }, listCandidatesResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
