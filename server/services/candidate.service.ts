import { z } from "zod";
import { AppError } from "@/server/errors/app-error";
import { readJsonFile } from "@/server/lib/read-json";
import { candidateSchema } from "@/server/schemas";
import type { Candidate } from "@/server/types";

const candidatesSchema = z.array(candidateSchema);

/**
 * Loads candidate profiles from mock data.
 */
export class CandidateService {
  async getCandidates(): Promise<Candidate[]> {
    return readJsonFile("candidates.json", candidatesSchema, "INVALID_CANDIDATE");
  }

  async getCandidateById(id: string): Promise<Candidate> {
    const candidates = await this.getCandidates();
    const candidate = candidates.find((candidate) => candidate.id === id);
    if (!candidate) {
      throw new AppError("INVALID_CANDIDATE", `Candidate "${id}" was not found.`);
    }
    return candidate;
  }
}

export const candidateService = new CandidateService();
