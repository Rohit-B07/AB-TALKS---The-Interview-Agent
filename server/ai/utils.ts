import type { CurriculumDay, Difficulty, InterviewMemory } from "@/server/types";
import type { Candidate } from "@/server/types";
import { MIN_QUESTIONS } from "@/server/ai/constants";

/**
 * Deterministic helpers shared across the AI services and the fallback
 * system. Kept free of Gemini imports so they can be unit tested in
 * isolation.
 */

/** Curriculum days a candidate is allowed to be asked about. */
export function getEligibleDays(candidate: Candidate, curriculum: CurriculumDay[]): CurriculumDay[] {
  return curriculum.filter(
    (day) =>
      candidate.completedDays.includes(day.id) && !candidate.skippedDays.includes(day.id)
  );
}

export function getDayById(curriculum: CurriculumDay[], dayId: string): CurriculumDay | null {
  return curriculum.find((day) => day.id === dayId) ?? null;
}

/** The most recent eligible day for a candidate, if any. */
export function getLastCompletedDay(
  candidate: Candidate,
  curriculum: CurriculumDay[]
): CurriculumDay | null {
  const eligible = getEligibleDays(candidate, curriculum);
  return eligible.length > 0 ? eligible[eligible.length - 1] : null;
}

/** Maps the planner's "easy | beginner | intermediate | advanced" to curriculum difficulty. */
export function difficultyFromPlanner(level: string): Difficulty {
  if (level === "easy" || level === "beginner") return "beginner";
  if (level === "intermediate") return "intermediate";
  return "advanced";
}

/** Maps a curriculum difficulty back to the planner's "easy | intermediate | advanced". */
export function difficultyToPlanner(difficulty: Difficulty): "easy" | "intermediate" | "advanced" {
  if (difficulty === "beginner") return "easy";
  if (difficulty === "intermediate") return "intermediate";
  return "advanced";
}

const DIFFICULTY_ORDER: Difficulty[] = ["beginner", "intermediate", "advanced"];

export function nextDifficulty(
  current: Difficulty,
  recommendation: "same" | "harder" | "easier"
): Difficulty {
  if (recommendation === "harder") {
    return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, DIFFICULTY_ORDER.indexOf(current) + 1)];
  }
  if (recommendation === "easier") {
    return DIFFICULTY_ORDER[Math.max(0, DIFFICULTY_ORDER.indexOf(current) - 1)];
  }
  return current;
}

/** Human narrative for where the interview currently is. */
export function stageFor(questionNumber: number, target = MIN_QUESTIONS): string {
  if (questionNumber <= 0) return "opening";
  if (questionNumber === 1) return "opening";
  const ratio = questionNumber / target;
  if (ratio < 0.5) return "building";
  if (ratio < 1) return "deepening";
  return "wrapping up";
}

/** Compact one-line summary of the candidate's profile for prompts. */
export function compactCandidate(candidate: Candidate): string {
  return [
    `Name: ${candidate.name}`,
    `Completed days: ${candidate.completedDays.join(", ") || "none"}`,
    `Skipped days: ${candidate.skippedDays.join(", ") || "none"}`,
    `Strengths: ${candidate.strengths.join(", ") || "none"}`,
    `Weaknesses: ${candidate.weaknesses.join(", ") || "none"}`,
    `Learning signals: ${candidate.learningSignals.join("; ") || "none"}`,
  ].join("\n");
}

export function compactMemory(memory: InterviewMemory): string {
  return [
    `Question ${memory.questionNumber + 1} of ${memory.totalTargetQuestions}`,
    `Covered days: ${memory.coveredDays.join(", ") || "none"}`,
    `Covered topics: ${memory.coveredTopics.join(", ") || "none"}`,
    `Discovered strengths: ${memory.strengths.join(", ") || "none"}`,
    `Knowledge gaps: ${memory.knowledgeGaps.join(", ") || "none"}`,
    `Current difficulty: ${memory.difficulty}`,
    `Stage: ${memory.currentStage}`,
    `Conversation summary: ${memory.conversationSummary}`,
  ].join("\n");
}

export function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

// ---------------------------------------------------------------------------
// Duplicate-question detection
// ---------------------------------------------------------------------------

/** Words that carry no topical meaning and are ignored when comparing questions. */
const QUESTION_STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "with", "by", "from",
  "as", "and", "or", "but", "if", "then", "than", "that", "this", "these",
  "those", "you", "your", "yours", "we", "they", "it", "its", "my", "our",
  "their", "me", "us", "i", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "done", "have", "has", "had", "will", "would", "should",
  "could", "can", "may", "might", "must", "how", "what", "which", "why", "when",
  "where", "who", "whom", "whose", "not", "no", "yes", "please", "now", "just",
  "also", "about", "into", "during", "while", "given", "lets", "let", "good",
  "great", "ok", "okay", "like", "really", "quite", "maybe",
]);

/** Common synonyms normalized so near-duplicates with different wording match. */
const QUESTION_SYNONYMS: Record<string, string> = {
  largest: "max",
  biggest: "max",
  maximum: "max",
  smallest: "min",
  minimum: "min",
  lowest: "min",
  array: "list",
  arrays: "list",
  element: "item",
  elements: "items",
  numbers: "number",
  values: "value",
  strings: "string",
  characters: "character",
  words: "word",
  steps: "step",
  items: "items",
};

/**
 * Lowercases and strips punctuation so questions can be compared safely.
 * Used both by the duplicate detector and by tests.
 */
export function normalizeQuestionText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Content-bearing tokens of a question (stopwords removed, synonyms collapsed). */
function questionContentTokens(text: string): string[] {
  return normalizeQuestionText(text)
    .split(" ")
    .filter((word) => word.length > 2 && !QUESTION_STOPWORDS.has(word))
    .map((word) => QUESTION_SYNONYMS[word] ?? word);
}

/**
 * True when `question` repeats (or near-repeats) any question in `history`.
 *
 * Three signals, in order:
 * 1. exact match after normalization,
 * 2. one long text containing the other (templated repeats),
 * 3. content-token Jaccard similarity >= 0.6, which catches minor rewordings
 *    ("find the largest value" vs "find the largest number") while still
 *    allowing genuinely different reasoning steps ("What value would you keep
 *    track of while the loop runs?" shares no content words with the original).
 */
export function isDuplicateQuestion(question: string, history: string[]): boolean {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return false;

  for (const previous of history) {
    const prev = normalizeQuestionText(previous);
    if (!prev) continue;

    if (normalized === prev) return true;

    if (normalized.length > 60 && prev.includes(normalized)) return true;
    if (prev.length > 60 && normalized.includes(prev)) return true;

    const tokensA = questionContentTokens(question);
    const tokensB = questionContentTokens(previous);
    if (tokensA.length === 0 || tokensB.length === 0) continue;

    const intersection = tokensA.filter((token) => tokensB.includes(token));
    const union = new Set([...tokensA, ...tokensB]).size;
    if (intersection.length / union >= 0.6) return true;
  }
  return false;
}

/**
 * Caps a planner difficulty level so DSA Friendly mode never exceeds
 * intermediate. Beginner-first-year progression is: beginner -> slightly
 * harder beginner -> intermediate; advanced competitive-programming material
 * is never reached.
 */
export function capDsaDifficulty(
  level: "easy" | "beginner" | "intermediate" | "advanced"
): "easy" | "beginner" | "intermediate" | "advanced" {
  return level === "advanced" ? "intermediate" : level;
}
