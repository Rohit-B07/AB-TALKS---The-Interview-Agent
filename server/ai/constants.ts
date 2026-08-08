import type { InterviewerPersonality } from "@/server/types";

/** Minimum questions before the interview is eligible to finish. */
export const MIN_QUESTIONS = 8;

/** Minimum distinct curriculum days that must be covered. */
export const MIN_UNIQUE_DAYS = 4;

/** Default interviewer personality when none is chosen. */
export const DEFAULT_PERSONALITY: InterviewerPersonality = "hiring_manager";

/** Temperature used for structured JSON generation (planner, evaluator). */
export const AI_JSON_TEMPERATURE = 0.3;

/** Temperature used for free-form question generation. */
export const AI_QUESTION_TEMPERATURE = 0.7;

/**
 * Extra attempts at generating a non-duplicate question before the generator
 * falls back to the deterministic question bank. Bounded so a misbehaving
 * model can never cause an infinite retry loop.
 */
export const MAX_DUPLICATE_RETRIES = 2;
