import type {
  Candidate,
  Difficulty,
  DifficultyProgressionEntry,
  Evaluation,
  ImprovementQuestion,
  InterviewMode,
  InterviewSession,
  ReadinessLevel,
} from "@/server/types";
import { dsaTopicFromContext } from "@/server/ai/dsa";
import { truncate } from "@/server/ai/utils";

/**
 * Deterministic aggregation of evaluator results into a structured evidence
 * bundle. Every number in the final report (overall score, topic scores,
 * readiness, difficulty progression) is computed here — never by an LLM — so
 * the report stays explainable and reproducible. Gemini (when available) only
 * paraphrases this evidence into narrative text.
 */

export interface AnswerRecord {
  questionId: string;
  prompt: string;
  answer: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  needsFollowUp: boolean;
  difficulty: Difficulty;
  topic: string;
}

export interface TopicScore {
  topic: string;
  score: number;
  questionsAsked: number;
}

export interface EvaluationEvidence {
  mode: InterviewMode;
  candidate: Candidate;
  records: AnswerRecord[];
  topics: TopicScore[];
  overallScore: number;
  readiness: ReadinessLevel;
  progression: DifficultyProgressionEntry[];
  strengths: string[];
  knowledgeGaps: string[];
  improvementQuestions: ImprovementQuestion[];
  idkCount: number;
  hintCount: number;
  briefAnswerCount: number;
  firstHalfAvg: number;
  secondHalfAvg: number;
}

const DIFFICULTY_ORDER: Difficulty[] = ["beginner", "intermediate", "advanced"];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function topicForDayIds(session: InterviewSession, dayIds: string[]): string | null {
  for (const dayId of dayIds) {
    const day = session.curriculum.find((candidate) => candidate.id === dayId);
    if (day) return day.topic;
  }
  return dayIds.length > 0 ? dayIds[0] : null;
}

function topicForContext(context: string | undefined): string | null {
  if (!context) return null;
  const parts = context.split("·").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/** Resolves the topic an answered question belongs to. */
export function topicForQuestion(session: InterviewSession, context: string | undefined, dayIds: string[]): string {
  if (session.mode === "dsa_friendly") {
    const topic = dsaTopicFromContext(context);
    if (topic) return topic.name;
  }
  return topicForDayIds(session, dayIds) ?? topicForContext(context) ?? "General";
}

/**
 * Reconstructs one record per answered question by zipping the transcript
 * (questions + answers) with the stored evaluations. Question metadata
 * (difficulty, related day ids, context) is read from assistant turns, which
 * SessionService persists on every question.
 */
export function buildAnswerRecords(session: InterviewSession): AnswerRecord[] {
  const answersByQuestion = new Map<string, string>();
  for (const turn of session.transcript) {
    if (turn.role === "candidate" && turn.questionId) {
      answersByQuestion.set(turn.questionId, turn.content);
    }
  }

  const evaluationsByQuestion = new Map<string, Evaluation>();
  for (const evaluation of session.evaluations) {
    evaluationsByQuestion.set(evaluation.questionId, evaluation);
  }

  const records: AnswerRecord[] = [];
  for (const turn of session.transcript) {
    if (turn.role !== "assistant" || !turn.questionId) continue;

    const evaluation = evaluationsByQuestion.get(turn.questionId);
    if (!evaluation) continue;

    records.push({
      questionId: turn.questionId,
      prompt: turn.content,
      answer: answersByQuestion.get(turn.questionId) ?? "",
      score: evaluation.score,
      strengths: evaluation.strengths ?? [],
      weaknesses: evaluation.weaknesses ?? [],
      needsFollowUp: evaluation.needsFollowUp,
      difficulty: turn.difficulty ?? session.memory.difficulty,
      topic: topicForQuestion(session, turn.context, turn.relatedDayIds ?? []),
    });
  }
  return records;
}

/** Per-topic aggregation: average score (out of 100) and question counts. */
export function aggregateTopicPerformance(session: InterviewSession): TopicScore[] {
  const records = buildAnswerRecords(session);
  const groups = new Map<string, { scores: number[]; count: number }>();
  const order: string[] = [];

  for (const record of records) {
    const group = groups.get(record.topic);
    if (group) {
      group.scores.push(record.score);
      group.count += 1;
    } else {
      groups.set(record.topic, { scores: [record.score], count: 1 });
      order.push(record.topic);
    }
  }

  return order.map((topic) => {
    const group = groups.get(topic)!;
    return {
      topic,
      score: roundToScore((mean(group.scores) / 5) * 100),
      questionsAsked: group.count,
    };
  });
}

/** Overall performance: the mean of the per-topic scores. */
export function aggregateOverallScore(topics: TopicScore[]): number {
  return roundToScore(mean(topics.map((topic) => topic.score)));
}

/** Readiness band derived from the overall score. */
export function readinessFor(score: number): ReadinessLevel {
  if (score >= 85) return "strong";
  if (score >= 70) return "intermediate";
  if (score >= 50) return "developing";
  return "beginner";
}

/** Per-difficulty performance: strong / developing / weak / not-reached. */
export function difficultyProgression(session: InterviewSession): DifficultyProgressionEntry[] {
  const records = buildAnswerRecords(session);
  const byDifficulty = new Map<Difficulty, number[]>();
  for (const record of records) {
    const list = byDifficulty.get(record.difficulty) ?? [];
    list.push(record.score);
    byDifficulty.set(record.difficulty, list);
  }

  return DIFFICULTY_ORDER.map((difficulty) => {
    const scores = byDifficulty.get(difficulty);
    if (!scores || scores.length === 0) {
      return { difficulty, performance: "not-reached" as const, questionsAsked: 0 };
    }
    const average = mean(scores);
    const performance = average >= 4 ? "strong" : average >= 3 ? "developing" : "weak";
    return { difficulty, performance, questionsAsked: scores.length };
  });
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}

/** Concrete strengths supported by interview evidence. */
export function extractStrengths(evidence: {
  mode: InterviewMode;
  candidate: Candidate;
  records: AnswerRecord[];
  topics: TopicScore[];
}): string[] {
  const frequencies = new Map<string, number>();
  for (const record of evidence.records) {
    for (const strength of record.strengths) {
      const key = strength.trim().toLowerCase();
      if (key.length === 0) continue;
      frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    }
  }

  const observed = [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      // Recover the original casing from any record that produced it.
      const original = evidence.records
        .flatMap((record) => record.strengths)
        .find((strength) => strength.trim().toLowerCase() === key);
      return { text: original ?? key, count };
    });

  const strengths = uniqueStrings(observed.slice(0, 4).map((entry) => entry.text));

  // Topic-derived strengths ground the report in demonstrated performance even
  // when the evaluator only produced generic strength labels.
  for (const topic of evidence.topics) {
    if (strengths.length >= 5) break;
    if (topic.score >= 75) {
      strengths.push(
        evidence.mode === "dsa_friendly"
          ? `Comfortable explaining ${topic.topic} approaches`
          : `Solid understanding of ${topic.topic}`
      );
    }
  }

  for (const candidateStrength of evidence.candidate.strengths) {
    if (strengths.length >= 5) break;
    strengths.push(candidateStrength);
  }

  if (strengths.length === 0) {
    strengths.push(
      evidence.mode === "dsa_friendly"
        ? "Consistently explained an approach out loud"
        : "Provided structured, detailed answers"
    );
  }

  return uniqueStrings(strengths);
}

/** Main knowledge gaps, prioritized by how much they impacted performance. */
export function extractKnowledgeGaps(evidence: {
  mode: InterviewMode;
  candidate: Candidate;
  records: AnswerRecord[];
  topics: TopicScore[];
  idkCount: number;
}): string[] {
  const frequencies = new Map<string, number>();
  for (const record of evidence.records) {
    for (const weakness of record.weaknesses) {
      const key = weakness.trim().toLowerCase();
      if (key.length === 0) continue;
      frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    }
  }

  const gaps = uniqueStrings(
    [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([key]) => {
        const original = evidence.records
          .flatMap((record) => record.weaknesses)
          .find((weakness) => weakness.trim().toLowerCase() === key);
        return original ?? key;
      })
  );

  const weakTopics = evidence.topics.filter((topic) => topic.score < 55).sort((a, b) => a.score - b.score);
  for (const topic of weakTopics) {
    if (gaps.length >= 5) break;
    gaps.push(`Needs to strengthen ${topic.topic}`);
  }

  if (evidence.idkCount > 0) {
    gaps.push(
      evidence.mode === "dsa_friendly"
        ? "Still building confidence with unfamiliar problems"
        : "Could engage with unfamiliar concepts more confidently"
    );
  }

  for (const candidateGap of evidence.candidate.weaknesses) {
    if (gaps.length >= 5) break;
    gaps.push(candidateGap);
  }

  return uniqueStrings(gaps);
}

/**
 * Picks 2-4 questions that need improvement: the lowest-scoring, most
 * follow-up-heavy questions across distinct topics, so the report stays
 * focused instead of overwhelming the candidate.
 */
export function selectImprovementQuestions(evidence: {
  records: AnswerRecord[];
}): ImprovementQuestion[] {
  const candidates = evidence.records
    .filter((record) => record.score <= 3)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.needsFollowUp !== b.needsFollowUp) return a.needsFollowUp ? -1 : 1;
      return a.prompt.localeCompare(b.prompt);
    });

  const selected: AnswerRecord[] = [];
  const usedTopics = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= 4) break;
    if (usedTopics.has(candidate.topic)) continue;
    usedTopics.add(candidate.topic);
    selected.push(candidate);
  }
  if (selected.length === 0 && candidates.length > 0) {
    selected.push(candidates[0]);
  }

  return selected.map((record) => ({
    question: truncate(record.prompt, 180),
    topic: record.topic,
    issue: issueFor(record),
    improvement: improvementFor(record),
  }));
}

function issueFor(record: AnswerRecord): string {
  if (isDontKnowAnswer(record.answer)) {
    return "Indicated uncertainty and did not attempt the reasoning.";
  }
  if (record.weaknesses.length > 0) {
    return truncate(record.weaknesses.join("; "), 140);
  }
  if (record.answer.trim().length < 40) {
    return "The answer was too brief to show full reasoning.";
  }
  return "The reasoning was incomplete or missed a key step.";
}

function isDontKnowAnswer(answer: string): boolean {
  const lower = answer.trim().toLowerCase();
  if (lower.length === 0 || lower.length <= 3) return true;
  return /(i (don'?t|do not|dunno) know|not sure|no idea|no clue|unsure|idk)/i.test(lower);
}

function improvementFor(record: AnswerRecord): string {
  return `Revisit ${record.topic} fundamentals, then practice working through a concrete example out loud before worrying about a perfect answer.`;
}

/** Builds the full deterministic evidence bundle used by the service and the LLM. */
export function buildEvidence(session: InterviewSession): EvaluationEvidence {
  const records = buildAnswerRecords(session);
  const topics = aggregateTopicPerformance(session);
  const overallScore = aggregateOverallScore(topics);
  const progression = difficultyProgression(session);

  const idkCount = records.filter((record) => isDontKnowAnswer(record.answer)).length;
  const hintCount = records.filter((record) =>
    /(here's a small hint|let's make that simpler|that's completely fine)/i.test(record.prompt)
  ).length;
  const briefAnswerCount = records.filter((record) => record.answer.trim().length < 40).length;

  const mid = Math.ceil(records.length / 2);
  const firstHalfAvg = mean(records.slice(0, mid).map((record) => record.score));
  const secondHalfAvg = mean(records.slice(mid).map((record) => record.score));

  return {
    mode: session.mode,
    candidate: session.candidate,
    records,
    topics,
    overallScore,
    readiness: readinessFor(overallScore),
    progression,
    strengths: extractStrengths({ mode: session.mode, candidate: session.candidate, records, topics }),
    knowledgeGaps: extractKnowledgeGaps({
      mode: session.mode,
      candidate: session.candidate,
      records,
      topics,
      idkCount,
    }),
    improvementQuestions: selectImprovementQuestions({ records }),
    idkCount,
    hintCount,
    briefAnswerCount,
    firstHalfAvg,
    secondHalfAvg,
  };
}
