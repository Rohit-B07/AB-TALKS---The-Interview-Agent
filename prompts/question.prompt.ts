import type {
  Candidate,
  CurriculumDay,
  InterviewMode,
  InterviewerPersonality,
  InterviewMemory,
} from "@/server/types";
import type { PlannerDecision } from "@/server/ai/schemas";
import { PERSONALITY_INSTRUCTIONS } from "@/prompts/personality";
import { MODE_INSTRUCTIONS } from "@/prompts/mode";
import { compactCandidate, truncate } from "@/server/ai/utils";
import { isDontKnowAnswer } from "@/server/ai/dsa";

/**
 * ROLE / INPUT / TASK / CONSTRAINTS / OUTPUT FORMAT prompt for the
 * QuestionGenerator. Converts a planner decision into EXACTLY ONE question.
 */

export interface QuestionPromptInput {
  candidate: Candidate;
  day: CurriculumDay;
  plan: PlannerDecision;
  memory: InterviewMemory;
  previousAnswer: string | null;
  personality: InterviewerPersonality;
  questionHistory: string[];
  mode?: InterviewMode;
}

const SYSTEM_PROMPT = [
  "ROLE",
  "You are an adaptive technical interviewer for the ABTalks AI Cohort.",
  "{personality}",
  "{mode}",
  "TASK",
  "Ask EXACTLY ONE interview question, phrased the way a real, supportive senior engineer would ask it.",
  "CONSTRAINTS",
  "- Exactly one question. No lists, no sub-questions, no numbering.",
  "- Natural, concise, technical, and human-sounding.",
  "- No praise, no evaluation, no score, and NEVER mention scores, percentages, or grades.",
  "- Never open with phrases like 'Great answer!' or 'Here is your next question:'.",
  "- If referencePreviousAnswer is true, naturally reference the candidate's previous answer.",
  "- SUPPORTIVE TONE: sound like a supportive senior engineer, not a university examiner. When the candidate has struggled, use phrasing like 'Let's make that simpler.', 'Good starting point.', 'Think about what information we need to keep track of.', 'Here's a small hint.', or 'Let's try a simpler version.'. Avoid 'Let's go one level deeper' when the candidate has shown weak understanding.",
  "- If the candidate said 'I don't know' or was unsure: do NOT punish them. Briefly reframe or teach the concept in 1-2 sentences, then ask a simpler verification question.",
  "- A weak answer should lead to a simpler question about the same concept (with a small hint if helpful).",
  "- Difficulty must match the requested difficulty and move gradually — at most one level up for a strong answer.",
  "- Ask why, trade-off, debugging, scenario, or architecture questions only where appropriate (and only for AI Engineering mode).",
  "- Never repeat a question that has already been asked.",
  "- Do not ask about any curriculum day other than the one specified.",
].join("\n");

export function buildQuestionPrompt(input: QuestionPromptInput): { system: string; user: string } {
  const { day, plan, candidate } = input;
  const isDsa = (input.mode ?? "ai_engineering") === "dsa_friendly";

  const user = [
    compactCandidate(candidate),
    "",
    isDsa
      ? `TARGET DSA TOPIC: ${plan.topic} (difficulty ${plan.difficulty})`
      : [
          "TARGET CURRICULUM DAY",
          `Day ${day.day} — ${day.module}: ${day.topic}`,
          `Learning objectives: ${day.learningObjectives.join("; ")}`,
          `Tools: ${day.tools.join(", ")}`,
        ].join("\n"),
    "",
    "PLANNER DECISION",
    `Action: ${plan.action}`,
    `Topic: ${plan.topic}`,
    `Difficulty: ${plan.difficulty}`,
    `Question type: ${plan.questionType}`,
    `Interviewer intent: ${plan.reason}`,
    plan.referencePreviousAnswer && input.previousAnswer
      ? `Candidate's previous answer: "${truncate(input.previousAnswer, 900)}"`
      : "",
    input.previousAnswer && isDontKnowAnswer(input.previousAnswer)
      ? "NOTE: the candidate said they don't know. Briefly teach the concept in 1-2 sentences, then ask a simpler verification question."
      : "",
    "",
    "ASK THE ONE QUESTION.",
  ].join("\n");

  return {
    system: SYSTEM_PROMPT.replace("{personality}", PERSONALITY_INSTRUCTIONS[input.personality]).replace(
      "{mode}",
      MODE_INSTRUCTIONS[input.mode ?? "ai_engineering"]
    ),
    user,
  };
}
