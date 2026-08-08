import type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  Evaluation,
  InterviewMemory,
  InterviewMode,
  InterviewQuestion,
  InterviewerPersonality,
} from "@/server/types";
import { PERSONALITY_INSTRUCTIONS } from "@/prompts/personality";
import { MODE_INSTRUCTIONS } from "@/prompts/mode";
import { compactCandidate, compactMemory, getEligibleDays, truncate } from "@/server/ai/utils";
import { PLANNER_OUTPUT_EXAMPLE } from "@/server/ai/schemas";

/**
 * ROLE / INPUT / TASK / CONSTRAINTS / OUTPUT FORMAT prompt for the
 * InterviewPlanner. The planner decides WHAT to assess next; it never writes
 * the final question text.
 */

export interface PlannerPromptInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  memory: InterviewMemory;
  previousQuestion: InterviewQuestion | null;
  previousAnswer: string | null;
  lastEvaluation: Evaluation | null;
  personality: InterviewerPersonality;
  transcript: ConversationTurn[];
  mode?: InterviewMode;
}

const SYSTEM_PROMPT = [
  "ROLE",
  "You are the planning module of an adaptive technical interviewer for the ABTalks AI Cohort.",
  "{personality}",
  "{mode}",
  "TASK",
  "Decide what the interviewer should assess NEXT. You do NOT write the final question.",
  "INPUT",
  "You receive the candidate profile, the curriculum, interview memory, the previous question and answer, the last evaluation, and interview progress.",
  "CONSTRAINTS",
  "- Only reference curriculum days the candidate has completed. Never pick a skipped day.",
  "- Prefer curriculum days that are not yet covered. Same-day follow-ups are allowed when the last answer deserves deeper investigation.",
  "- Do not ask the same question twice.",
  "- ADAPTIVE DIFFICULTY: difficulty must be GRADUAL. A strong answer raises the level by AT MOST one step (beginner -> intermediate -> advanced). Never jump straight to advanced.",
  "- A weak answer must LOWER or KEEP the difficulty and stay on the same concept; never escalate to advanced or production-level material for a weak candidate.",
  "- A partial answer is a clarification at the same or slightly easier level.",
  "- If the candidate said 'I don't know' (or gave a very short unsure answer), choose 'clarify' at the easiest level so the interviewer can reframe the concept and verify with a simpler question.",
  "- Repeated weak answers must remain at beginner/foundation level.",
  "- Target the candidate's known weaknesses when useful.",
  "- Set referencePreviousAnswer to true when the next question should reference what the candidate just said.",
  "- The evaluation score is INTERNAL. The question itself must NEVER mention scores, percentages, or grades.",
  "OUTPUT FORMAT",
  "Return ONLY a single JSON object matching exactly this shape:",
  JSON.stringify(PLANNER_OUTPUT_EXAMPLE),
  "Do not include prose or markdown fences.",
].join("\n");

export function buildPlannerPrompt(input: PlannerPromptInput): { system: string; user: string } {
  const eligible = getEligibleDays(input.candidate, input.curriculum);
  const fallbackDay = eligible.length > 0 ? eligible[eligible.length - 1] : input.curriculum[0];

  const eligibleLines = eligible.map(
    (day) => `${day.id} | Day ${day.day} | ${day.module} | ${day.topic} | ${day.difficulty}`
  );

  const user = [
    "CANDIDATE PROFILE",
    compactCandidate(input.candidate),
    "",
    "INTERVIEW MEMORY",
    compactMemory(input.memory),
    "",
    "ELIGIBLE CURRICULUM DAYS (id | day | module | topic | difficulty)",
    eligibleLines.length > 0 ? eligibleLines.join("\n") : `none; fall back to ${fallbackDay?.id ?? "day-1"}`,
    "",
    input.previousQuestion ? `LAST QUESTION: "${truncate(input.previousQuestion.prompt, 600)}"` : "No previous question.",
    input.previousAnswer
      ? `LAST ANSWER: "${truncate(input.previousAnswer, 600)}"`
      : "No previous answer.",
    input.lastEvaluation
      ? [
          "LAST EVALUATION (INTERNAL — never reveal to the candidate)",
          `score: ${input.lastEvaluation.score}/5`,
          `needsFollowUp: ${input.lastEvaluation.needsFollowUp}`,
          `followUpReason: "${input.lastEvaluation.followUpReason}"`,
          `difficultyRecommendation: ${input.lastEvaluation.difficultyRecommendation}`,
          `weaknesses: ${input.lastEvaluation.weaknesses.join(", ")}`,
        ].join("\n")
      : "No evaluation yet.",
    "",
    "DECIDE THE NEXT STEP AND RETURN THE JSON OBJECT.",
  ].join("\n");

  return {
    system: SYSTEM_PROMPT.replace("{personality}", PERSONALITY_INSTRUCTIONS[input.personality]).replace(
      "{mode}",
      MODE_INSTRUCTIONS[input.mode ?? "ai_engineering"]
    ),
    user,
  };
}
