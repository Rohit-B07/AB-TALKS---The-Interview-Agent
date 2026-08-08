import type {
  Candidate,
  CurriculumDay,
  Evaluation,
  InterviewerPersonality,
  InterviewMemory,
  InterviewQuestion,
} from "@/server/types";
import { MIN_QUESTIONS } from "@/server/ai/constants";
import { nextDifficulty, stageFor, truncate } from "@/server/ai/utils";

export interface BuildInitialMemoryInput {
  candidate: Candidate;
  sessionId: string;
  personality: InterviewerPersonality;
}

export interface UpdateMemoryInput {
  memory: InterviewMemory;
  candidate: Candidate;
  curriculum: CurriculumDay[];
  question: InterviewQuestion;
  answer: string;
  evaluation: Evaluation;
  personality: InterviewerPersonality;
}

function topicOf(curriculum: CurriculumDay[], dayId: string): string {
  return curriculum.find((day) => day.id === dayId)?.topic ?? dayId;
}

function pushUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

/**
 * Session-long memory of a candidate's performance. Updated after every
 * answer so the planner and question generator can reference prior answers,
 * discovered strengths, and knowledge gaps naturally.
 *
 * Updates are deterministic and cheap; the full transcript is never kept in
 * memory — only a compact summary plus the question/answer history.
 */
export class MemoryManager {
  buildInitialMemory(input: BuildInitialMemoryInput): InterviewMemory {
    return {
      candidateId: input.candidate.id,
      sessionId: input.sessionId,
      personality: input.personality,
      questionNumber: 0,
      totalTargetQuestions: MIN_QUESTIONS,
      coveredDays: [],
      coveredTopics: [],
      questionHistory: [],
      answerHistory: [],
      strengths: [],
      knowledgeGaps: [],
      difficulty: "beginner",
      currentStage: "opening",
      lastEvaluation: null,
      conversationSummary: `${input.candidate.name} is starting the interview with ${input.candidate.completedDays.length} completed curriculum days.`,
    };
  }

  async updateMemory(input: UpdateMemoryInput): Promise<InterviewMemory> {
    const next = structuredClone(input.memory);

    next.questionNumber += 1;
    next.questionHistory.push(input.question.prompt);
    next.answerHistory.push(input.answer);

    for (const dayId of input.question.relatedDayIds) {
      next.coveredDays = pushUnique(next.coveredDays, dayId);
      const topic = topicOf(input.curriculum, dayId);
      next.coveredTopics = pushUnique(next.coveredTopics, topic);
    }

    for (const strength of input.evaluation.strengths) {
      next.strengths = pushUnique(next.strengths, strength);
    }
    for (const gap of input.evaluation.weaknesses) {
      next.knowledgeGaps = pushUnique(next.knowledgeGaps, gap);
    }

    next.lastEvaluation = input.evaluation;
    next.difficulty = nextDifficulty(next.difficulty, input.evaluation.difficultyRecommendation);
    next.currentStage = stageFor(next.questionNumber, next.totalTargetQuestions);
    next.conversationSummary = this.summarize(next, input.evaluation);

    return next;
  }

  private summarize(memory: InterviewMemory, evaluation: Evaluation): string {
    const lastQuestion = memory.questionHistory[memory.questionHistory.length - 1];
    const lastAnswer = memory.answerHistory[memory.answerHistory.length - 1];

    const parts: string[] = [];
    parts.push(
      `Covered ${memory.coveredTopics.length > 0 ? memory.coveredTopics.join(", ") : "no topics yet"}.`
    );
    if (lastQuestion) parts.push(`Last Q: ${truncate(lastQuestion, 110)}`);
    if (lastAnswer) parts.push(`Last A: ${truncate(lastAnswer, 110)}`);
    parts.push(`Difficulty now: ${memory.difficulty}.`);
    if (evaluation.memoryUpdate) parts.push(`Note: ${truncate(evaluation.memoryUpdate, 140)}`);
    return parts.join(" ");
  }
}
