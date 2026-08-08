import { randomUUID } from "node:crypto";
import type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  Evaluation,
  InterviewMode,
  InterviewerPersonality,
  InterviewMemory,
  InterviewQuestion,
} from "@/server/types";
import type { EvaluationResult, PlannerDecision } from "@/server/ai/schemas";
import {
  DSA_REASONING_KEYWORDS,
  DSA_TOPICS,
  dsaTopicByName,
  dsaTopicFromContext,
  difficultyRank,
  isDontKnowAnswer,
} from "@/server/ai/dsa";
import {
  capDsaDifficulty,
  difficultyFromPlanner,
  difficultyToPlanner,
  getDayById,
  getEligibleDays,
  isDuplicateQuestion,
  nextDifficulty,
  truncate,
} from "@/server/ai/utils";

/**
 * Deterministic fallback interview system.
 *
 * Used when Gemini is temporarily unavailable so the interview can continue
 * without crashing. Questions are curriculum-aware (or DSA-topic-aware in
 * DSA Friendly mode) and never repeat. These are never misrepresented as
 * AI-generated output: callers track the `source` field ("ai" vs "fallback").
 *
 * Adaptive rules:
 * - Strong answer  -> difficulty increases by AT MOST one level.
 * - Partial answer -> clarification at the same or slightly easier level.
 * - Weak answer    -> a simpler question on the same concept, with a small hint.
 * - "I don't know" -> the candidate is NOT punished; the concept is reframed
 *                     briefly and followed by a simpler verification question.
 * - Repeated weak answers stay at beginner/foundation level and never escalate.
 */

export interface FallbackPlanInput {
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

export interface FallbackQuestionInput {
  candidate: Candidate;
  day: CurriculumDay;
  plan: PlannerDecision;
  memory: InterviewMemory;
  previousAnswer: string | null;
  personality: InterviewerPersonality;
  mode?: InterviewMode;
  /** Prompts of every question already asked this session, for duplicate prevention. */
  questionHistory?: string[];
}

export interface FallbackEvaluationInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  question: InterviewQuestion;
  answer: string;
  memory: InterviewMemory;
  personality: InterviewerPersonality;
  mode?: InterviewMode;
}

const CYCLE_TYPES = ["conceptual", "practical", "debugging", "scenario", "tradeoff"] as const;

function topicOf(curriculum: CurriculumDay[], dayId: string): string {
  return getDayById(curriculum, dayId)?.topic ?? dayId;
}

/** The topic to keep using for a same-day follow-up (curriculum vs DSA topic). */
function previousTopic(input: FallbackPlanInput, mode: InterviewMode, lastDayId: string): string {
  if (mode === "dsa_friendly") {
    const topic = dsaTopicFromContext(input.previousQuestion?.context);
    return topic ? topic.name : DSA_TOPICS[0].name;
  }
  return topicOf(input.curriculum, lastDayId);
}

/** Question type used for a given planner action. */
function questionTypeFor(action: PlannerDecision["action"], index: number): PlannerDecision["questionType"] {
  if (action === "increase_difficulty") return "scenario";
  if (action === "clarify") return "conceptual";
  return CYCLE_TYPES[index % CYCLE_TYPES.length];
}

export function createFallbackPlan(input: FallbackPlanInput): PlannerDecision {
  const mode = input.mode ?? "ai_engineering";
  const eligible = getEligibleDays(input.candidate, input.curriculum);
  const lastEval = input.memory.lastEvaluation ?? input.lastEvaluation;
  const lastDayId = input.previousQuestion?.relatedDayIds[0];
  const qIndex = input.memory.questionNumber;
  const currentDifficulty = input.memory.difficulty;
  const lastAnswer = input.previousAnswer ?? "";

  // DSA Friendly never exceeds intermediate, regardless of the branch below.
  const diff = (level: "easy" | "intermediate" | "advanced") =>
    mode === "dsa_friendly" ? capDsaDifficulty(level) : level;

  if (eligible.length === 0) {
    return {
      action: "new_topic",
      curriculumDay: input.curriculum[0]?.id ?? "day-1",
      topic: mode === "dsa_friendly" ? DSA_TOPICS[0].name : (input.curriculum[0]?.topic ?? "AI Fundamentals & Python Setup"),
      difficulty: "easy",
      reason: "No completed curriculum days; starting with the earliest material.",
      questionType: "conceptual",
      referencePreviousAnswer: false,
    };
  }

  // Roughly every third question is a same-day adaptive slot, so at least four
  // distinct curriculum days still get covered within the interview length.
  const isFollowUpSlot = qIndex > 0 && qIndex % 3 === 1;

  if (isFollowUpSlot && lastDayId) {
    const topic = previousTopic(input, mode, lastDayId);

    // "I don't know": never punish — reteach and verify with a simpler question.
    if (isDontKnowAnswer(lastAnswer)) {
      return {
        action: "clarify",
        curriculumDay: lastDayId,
        topic,
        difficulty: "easy",
        reason: "The candidate said they don't know; reframe the concept briefly and ask a simpler verification question.",
        questionType: "conceptual",
        referencePreviousAnswer: true,
      };
    }

    if (lastEval && lastEval.score <= 2) {
      return {
        action: "clarify",
        curriculumDay: lastDayId,
        topic,
        difficulty: diff(difficultyToPlanner(nextDifficulty(currentDifficulty, "easier"))),
        reason: "Weak answer; ask a simpler question about the same concept and offer a small hint.",
        questionType: "conceptual",
        referencePreviousAnswer: true,
      };
    }

    if (lastEval && lastEval.score === 3) {
      return {
        action: "follow_up",
        curriculumDay: lastDayId,
        topic,
        difficulty: diff(difficultyToPlanner(currentDifficulty)),
        reason: "Partial answer; clarify the same concept at the same level.",
        questionType: questionTypeFor("follow_up", qIndex),
        referencePreviousAnswer: true,
      };
    }

    if (lastEval && lastEval.score >= 4) {
      return {
        action: "increase_difficulty",
        curriculumDay: lastDayId,
        topic,
        // Increase by at most one level — never jump straight to advanced.
        difficulty: diff(difficultyToPlanner(nextDifficulty(currentDifficulty, "harder"))),
        reason: "Strong answer; increase difficulty by exactly one level.",
        questionType: questionTypeFor("increase_difficulty", qIndex),
        referencePreviousAnswer: true,
      };
    }

    return {
      action: "follow_up",
      curriculumDay: lastDayId,
      topic,
      difficulty: diff(difficultyToPlanner(currentDifficulty)),
      reason: "Follow up on the previous answer at the same level.",
      questionType: questionTypeFor("follow_up", qIndex),
      referencePreviousAnswer: true,
    };
  }

  const covered = new Set(input.memory.coveredDays);
  const uncovered = eligible.filter((day) => !covered.has(day.id));
  const pool = uncovered.length > 0 ? uncovered : eligible;
  const day = pool[qIndex % pool.length];

  if (mode === "dsa_friendly") {
    // Unlock topics progressively: a beginner never sees advanced DSA material.
    const unlocked = DSA_TOPICS.filter(
      (topic) => difficultyRank(topic.baseDifficulty) <= difficultyRank(currentDifficulty)
    );
    const topicPool = unlocked.length > 0 ? unlocked : DSA_TOPICS;
    const dsaTopic = topicPool[qIndex % topicPool.length];
    return {
      action: "new_topic",
      curriculumDay: day.id,
      topic: dsaTopic.name,
      difficulty:
        qIndex === 0
          ? diff(difficultyToPlanner(dsaTopic.baseDifficulty))
          : diff(difficultyToPlanner(currentDifficulty)),
      reason: "Move to a DSA fundamentals topic that has not been covered yet.",
      questionType: "conceptual",
      referencePreviousAnswer: false,
    };
  }

  return {
    action: "new_topic",
    curriculumDay: day.id,
    topic: day.topic,
    // The first question starts at the candidate's frontier; afterwards the
    // difficulty tracks what they have actually demonstrated.
    difficulty:
      qIndex === 0 ? difficultyToPlanner(day.difficulty) : diff(difficultyToPlanner(currentDifficulty)),
    reason: "Move to a curriculum topic that has not been covered yet.",
    questionType: questionTypeFor("new_topic", qIndex),
    referencePreviousAnswer: false,
  };
}

export function createFallbackQuestion(input: FallbackQuestionInput): InterviewQuestion {
  if ((input.mode ?? "ai_engineering") === "dsa_friendly") {
    return createDsaFallbackQuestion(input);
  }
  return createAiFallbackQuestion(input);
}

function createAiFallbackQuestion(input: FallbackQuestionInput): InterviewQuestion {
  const { day, plan, memory } = input;
  const objectives = day.learningObjectives;
  const tools = day.tools.join(", ");
  const lastAnswer = input.previousAnswer?.trim() ?? "";
  const lastScore = memory.lastEvaluation?.score;
  const history = input.questionHistory ?? memory.questionHistory;
  const baseIndex = memory.questionNumber;

  const render = (objective: string): string => {
    if (plan.referencePreviousAnswer && lastAnswer) {
      if (isDontKnowAnswer(lastAnswer)) {
        return [
          `That's completely fine — you're not expected to know everything yet.`,
          `In short: ${day.topic} is about the learning objective "${objective}".`,
          `Let's make that simpler: in your own words, what is the very first step you would take for "${objective}"?`,
        ].join(" ");
      }
      if (typeof lastScore === "number" && lastScore <= 2) {
        return [
          `Good starting point. Let's make that simpler.`,
          `You mentioned "${truncate(lastAnswer, 120)}".`,
          `Focus on just "${objective}" and walk me through the smallest first step, using ${tools}.`,
        ].join(" ");
      }
      if (plan.action === "increase_difficulty") {
        return [
          `You mentioned "${truncate(lastAnswer, 120)}". That's a good foundation.`,
          `Now consider "${objective}" a bit further — what trade-off or edge case would you watch out for?`,
        ].join(" ");
      }
      return [
        `You mentioned "${truncate(lastAnswer, 120)}".`,
        `Let's look at one part of ${day.topic} — "${objective}".`,
        `How would you approach it, step by step?`,
      ].join(" ");
    }
    if (plan.action === "clarify") {
      return [
        `Let's focus on one part of ${day.topic}.`,
        `In your own words, explain how you would approach the objective "${objective}" step by step,`,
        `mentioning the tools you'd use (${tools}).`,
      ].join(" ");
    }
    return [
      `Let's look at a new area: ${day.module} — ${day.topic} (Day ${day.day}).`,
      `Consider the objective "${objective}" and walk me through how you would approach it.`,
      `You can lean on ${tools}.`,
    ].join(" ");
  };

  // Rotate objectives until the rendered question does not duplicate anything
  // already asked this session.
  let prompt = "";
  for (let i = 0; i < objectives.length; i += 1) {
    const objective = objectives[(baseIndex + i) % objectives.length];
    const candidate = render(objective);
    if (!isDuplicateQuestion(candidate, history)) {
      prompt = candidate;
      break;
    }
  }
  if (!prompt) {
    prompt = render(objectives[baseIndex % objectives.length]);
  }

  return {
    id: randomUUID(),
    type: plan.questionType,
    prompt,
    context: `${day.module} · ${day.topic}`,
    difficulty: difficultyFromPlanner(plan.difficulty),
    relatedDayIds: [day.id],
    createdAt: new Date().toISOString(),
  };
}

/** Generic scaffolding questions used when the DSA bank is exhausted. */
const SCAFFOLDING_PROMPTS = [
  "Let's take this one step at a time. What is the first thing you would do before writing any code?",
  "What is the smallest piece of information you need to remember as you work through the problem?",
  "How would you check your work step by step as you go?",
];

function scaffoldingPrompt(history: string[]): string {
  return (
    SCAFFOLDING_PROMPTS.find((prompt) => !isDuplicateQuestion(prompt, history)) ??
    SCAFFOLDING_PROMPTS[0]
  );
}

function createDsaFallbackQuestion(input: FallbackQuestionInput): InterviewQuestion {
  const { day, plan, memory } = input;
  const lastAnswer = input.previousAnswer?.trim() ?? "";
  const lastScore = memory.lastEvaluation?.score;
  const topic = dsaTopicByName(plan.topic) ?? DSA_TOPICS[0];
  const history = input.questionHistory ?? memory.questionHistory;

  // DSA Friendly never exceeds intermediate, regardless of planner intent.
  const targetDifficulty = difficultyFromPlanner(capDsaDifficulty(plan.difficulty));
  const prompts = topic.prompts[targetDifficulty];
  const beginnerPrompts = topic.prompts.beginner;
  const baseIndex = memory.questionNumber;

  const render = (prompt: string, simpler: string): string => {
    if (plan.referencePreviousAnswer && lastAnswer) {
      if (isDontKnowAnswer(lastAnswer)) {
        return `${topic.explanation} Now let's try a simpler version: ${simpler}`;
      }
      if (typeof lastScore === "number" && lastScore <= 2) {
        return `Good starting point. Let's make that simpler. Here's a small hint: ${topic.hint} Now: ${prompt}`;
      }
      return `That's a reasonable starting point. Let's go slightly further: ${prompt}`;
    }
    if (plan.action === "clarify") {
      return isDontKnowAnswer(lastAnswer)
        ? `${topic.explanation} Now let's try a simpler version: ${simpler}`
        : `Let's focus on the same idea. ${prompt}`;
    }
    return prompt;
  };

  // Rotate through the question bank, skipping any prompt whose rendered text
  // duplicates something already asked. A weak answer therefore moves to a
  // different (smaller) reasoning step instead of repeating the original.
  let text = "";
  const candidateCount = Math.max(prompts.length, beginnerPrompts.length);
  for (let i = 0; i < candidateCount; i += 1) {
    const candidatePrompt = prompts[(baseIndex + i) % prompts.length];
    const candidateSimpler = beginnerPrompts[(baseIndex + i) % beginnerPrompts.length];
    const candidateText = render(candidatePrompt, candidateSimpler);
    if (!isDuplicateQuestion(candidateText, history)) {
      text = candidateText;
      break;
    }
  }
  if (!text) {
    text = scaffoldingPrompt(history);
  }

  return {
    id: randomUUID(),
    type: plan.questionType,
    prompt: text,
    context: `DSA Friendly · ${topic.name}`,
    difficulty: targetDifficulty,
    relatedDayIds: [day.id],
    createdAt: new Date().toISOString(),
  };
}

function keywordScore(answer: string, curriculum: CurriculumDay[], dayId: string): number {
  const day = getDayById(curriculum, dayId);
  if (!day) return 0;
  const keywords = [...day.learningObjectives, ...day.tools]
    .flatMap((text) => text.split(/\s+/))
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
    .filter((word) => word.length > 3);
  const unique = [...new Set(keywords)];
  const lower = answer.toLowerCase();
  return unique.filter((word) => lower.includes(word)).length;
}

export function evaluateFallbackAnswer(input: FallbackEvaluationInput): EvaluationResult {
  const mode = input.mode ?? "ai_engineering";
  const answer = input.answer.trim();
  const length = answer.length;
  const idk = isDontKnowAnswer(answer);

  let score = 1;
  let strengths: string[] = [];
  let weaknesses: string[] = [];

  if (mode === "dsa_friendly") {
    // Reasoning-focused scoring: reward explaining the approach, examples, and
    // pseudocode. Perfect syntax is never required.
    const topic = dsaTopicFromContext(input.question.context);
    const keywords = [...(topic?.keywords ?? []), ...DSA_REASONING_KEYWORDS];
    const uniqueKeywords = [...new Set(keywords)];
    const lower = answer.toLowerCase();
    const matches = uniqueKeywords.filter((word) => lower.includes(word)).length;

    if (length >= 30) score += 1;
    if (length >= 90) score += 1;
    if (length >= 200) score += 1;
    if (matches >= 3) score += 1;
    if (matches >= 6) score += 1;
    if (/\b(first|then|next|if|for|while|because|would)\b|\(\)|\[\]|=/.test(answer)) score += 1;

    if (score >= 4) strengths = ["Explained a clear approach."];
    if (score <= 2) weaknesses = ["Answer was brief; try explaining your steps out loud."];
  } else {
    const matches = keywordScore(answer, input.curriculum, input.question.relatedDayIds[0]);
    if (length >= 80) score += 1;
    if (length >= 240) score += 1;
    if (matches >= 2) score += 1;
    if (matches >= 5) score += 1;
    if (score >= 3) strengths = ["Provided a substantive response."];
    if (score <= 2) weaknesses = ["Response was brief; limited technical depth."];
  }

  if (idk) {
    score = 1;
    strengths = [];
    weaknesses = ["Indicated uncertainty; needs a simpler verification question."];
  }

  score = Math.max(1, Math.min(5, score));
  const recommendation: Evaluation["difficultyRecommendation"] =
    idk || score <= 2 ? "easier" : score >= 4 ? "harder" : "same";

  return {
    score,
    understanding: idk
      ? "Candidate indicated they don't know; reteach the concept and verify with a simpler question."
      : `Heuristic evaluation (Gemini unavailable): ${length} characters, ${mode === "dsa_friendly" ? "reasoning markers" : "curriculum keyword matches"} present.`,
    strengths,
    weaknesses,
    needsFollowUp: score <= 3 || idk,
    followUpReason: score <= 3 || idk ? "Probe with a simpler question on the same concept." : "",
    memoryUpdate: `Answered with heuristic score ${score}/5 (Gemini unavailable).`,
    confidence: 0.4,
    difficultyRecommendation: recommendation,
  };
}
