import type {
  Candidate,
  CurriculumDay,
  InterviewMode,
  InterviewerPersonality,
  InterviewMemory,
  InterviewQuestion,
} from "@/server/types";
import { EVALUATION_OUTPUT_EXAMPLE } from "@/server/ai/schemas";
import { MODE_INSTRUCTIONS } from "@/prompts/mode";
import { compactCandidate, compactMemory, truncate } from "@/server/ai/utils";
import { isDontKnowAnswer } from "@/server/ai/dsa";

/**
 * ROLE / INPUT / TASK / CONSTRAINTS / OUTPUT FORMAT prompt for the
 * AnswerEvaluator. This output is INTERNAL and never shown to the candidate.
 */

export interface EvaluationPromptInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  question: InterviewQuestion;
  answer: string;
  memory: InterviewMemory;
  personality: InterviewerPersonality;
  mode?: InterviewMode;
}

const SYSTEM_PROMPT = [
  "ROLE",
  "You are the internal answer-evaluation module of an adaptive technical interviewer. Your output is never shown to the candidate.",
  "{mode}",
  "TASK",
  "Score the candidate's answer to the given question.",
  "SCORES",
  "1 = incorrect / little understanding",
  "2 = weak",
  "3 = adequate",
  "4 = strong",
  "5 = excellent",
  "RULES",
  "- difficultyRecommendation must be 'harder' ONLY for genuinely strong answers, and it raises the level by AT MOST one step. Use 'easier' when the candidate clearly struggled, otherwise 'same'. Never recommend a big jump.",
  "- If the candidate said 'I don't know' or gave a very short unsure answer, do NOT punish them harshly: score low (1-2), set needsFollowUp to true, and recommend 'easier' so the interviewer can reteach and verify.",
  "- Repeated weak answers must keep the candidate at beginner/foundation level.",
  "- Set needsFollowUp to true when a follow-up would meaningfully deepen the assessment (e.g. a generic or memorized answer, or a promising thread worth probing).",
  "OUTPUT FORMAT",
  "Return ONLY a single JSON object matching exactly this shape:",
  JSON.stringify(EVALUATION_OUTPUT_EXAMPLE),
  "Do not include prose or markdown fences.",
].join("\n");

export function buildEvaluationPrompt(input: EvaluationPromptInput): { system: string; user: string } {
  const isDsa = (input.mode ?? "ai_engineering") === "dsa_friendly";

  const scoring = isDsa
    ? [
        "DSA FRIENDLY SCORING — focus on REASONING, not syntax.",
        "- Accept and reward: explaining the approach, pseudocode, simple examples, and discussing why an approach works.",
        "- Do NOT require perfect syntax or exact code.",
        "- Evaluate: problem understanding, approach correctness, reasoning, edge cases, and complexity when relevant.",
      ]
    : [
        "Evaluate all of: conceptual understanding, practical understanding, reasoning, communication, trade-off awareness, technical accuracy, and the ability to apply the concept. Do not reward memorized definitions alone.",
      ];

  const user = [
    "CANDIDATE PROFILE",
    compactCandidate(input.candidate),
    "",
    "INTERVIEW MEMORY",
    compactMemory(input.memory),
    "",
    ...scoring,
    "",
    "QUESTION",
    `Type: ${input.question.type} | Difficulty: ${input.question.difficulty}`,
    `Related curriculum days: ${input.question.relatedDayIds.join(", ")}`,
    input.question.prompt,
    "",
    "CANDIDATE'S ANSWER",
    truncate(input.answer, 2000),
    input.answer && isDontKnowAnswer(input.answer)
      ? "NOTE: the candidate effectively said they don't know. Score low, recommend 'easier', and set needsFollowUp true."
      : "",
    "",
    "Return the JSON evaluation.",
  ].join("\n");

  return { system: SYSTEM_PROMPT.replace("{mode}", MODE_INSTRUCTIONS[input.mode ?? "ai_engineering"]), user };
}
