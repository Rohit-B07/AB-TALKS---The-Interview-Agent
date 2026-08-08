import { randomUUID } from "node:crypto";
import { AppError } from "@/server/errors/app-error";
import { sessionStore, type SessionStore } from "@/server/store/session-store";
import type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  Evaluation,
  FinalEvaluation,
  InterviewMemory,
  InterviewMode,
  InterviewQuestion,
  InterviewSession,
  InterviewerPersonality,
  QuestionSource,
} from "@/server/types";

export interface CreateSessionInput {
  id: string;
  candidate: Candidate;
  curriculum: CurriculumDay[];
  firstQuestion: InterviewQuestion;
  personality: InterviewerPersonality;
  mode: InterviewMode;
  initialMemory: InterviewMemory;
}

/**
 * Owns the shape and lifecycle of an interview session: creation, lookups,
 * recording answers, advancing to the next question, and completion.
 */
export class SessionService {
  constructor(private readonly store: SessionStore) {}

  async createSession(input: CreateSessionInput): Promise<InterviewSession> {
    const now = new Date().toISOString();
    const firstTurn: ConversationTurn = {
      id: randomUUID(),
      role: "assistant",
      content: input.firstQuestion.prompt,
      questionId: input.firstQuestion.id,
      difficulty: input.firstQuestion.difficulty,
      relatedDayIds: input.firstQuestion.relatedDayIds,
      context: input.firstQuestion.context,
      createdAt: now,
    };

    const { coveredDays, coveredTopics } = this.coverageFromQuestion(
      input.curriculum,
      input.firstQuestion
    );

    const session: InterviewSession = {
      id: input.id,
      candidate: input.candidate,
      curriculum: input.curriculum,
      transcript: [firstTurn],
      currentQuestion: input.firstQuestion,
      personality: input.personality,
      mode: input.mode,
      currentQuestionNumber: 1,
      questionsAsked: 1,
      coveredDays,
      coveredTopics,
      evaluations: [],
      memory: { ...input.initialMemory, coveredDays, coveredTopics },
      currentQuestionSource: null,
      status: "active",
      finalEvaluation: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.store.create(session);
  }

  async getSession(sessionId: string): Promise<InterviewSession> {
    const session = await this.store.get(sessionId);
    if (!session) {
      throw new AppError("INVALID_SESSION", `Interview session "${sessionId}" was not found.`);
    }
    return session;
  }

  /**
   * Records the candidate's answer to the current question plus the internal
   * evaluation and updated memory. Does not advance the interview.
   */
  async recordAnswer(
    sessionId: string,
    answer: string,
    evaluation: Evaluation,
    memory: InterviewMemory
  ): Promise<InterviewSession> {
    const session = await this.getSession(sessionId);
    const question = session.currentQuestion;

    if (!question) {
      throw new AppError("QUESTION_ALREADY_ANSWERED", "There is no active question to answer.");
    }
    if (this.hasAnswered(session, question.id)) {
      throw new AppError("QUESTION_ALREADY_ANSWERED", "This question has already been answered.");
    }

    const turn: ConversationTurn = {
      id: randomUUID(),
      role: "candidate",
      content: answer,
      questionId: question.id,
      createdAt: new Date().toISOString(),
    };

    session.transcript.push(turn);
    session.evaluations.push(evaluation);
    session.memory = memory;
    session.updatedAt = new Date().toISOString();

    return this.store.update(session);
  }

  /** Advances the interview to the next question and tracks coverage. */
  async advance(
    sessionId: string,
    question: InterviewQuestion,
    source: QuestionSource
  ): Promise<InterviewSession> {
    const session = await this.getSession(sessionId);
    const now = new Date().toISOString();

    const turn: ConversationTurn = {
      id: randomUUID(),
      role: "assistant",
      content: question.prompt,
      questionId: question.id,
      difficulty: question.difficulty,
      relatedDayIds: question.relatedDayIds,
      context: question.context,
      createdAt: now,
    };

    const { coveredDays, coveredTopics } = this.coverageFromQuestion(session.curriculum, question);

    session.transcript.push(turn);
    session.currentQuestion = question;
    session.currentQuestionSource = source;
    session.questionsAsked += 1;
    session.currentQuestionNumber += 1;
    session.coveredDays = this.mergeUnique(session.coveredDays, coveredDays);
    session.coveredTopics = this.mergeUnique(session.coveredTopics, coveredTopics);
    session.updatedAt = now;

    return this.store.update(session);
  }

  /** Marks the session complete; clears the active question. */
  async complete(session: InterviewSession): Promise<InterviewSession> {
    session.status = "completed";
    session.currentQuestion = null;
    session.currentQuestionSource = null;
    session.updatedAt = new Date().toISOString();
    return this.store.update(session);
  }

  /** Persists the final evaluation for a completed session. */
  async setFinalEvaluation(
    sessionId: string,
    evaluation: FinalEvaluation
  ): Promise<InterviewSession> {
    const session = await this.getSession(sessionId);
    session.finalEvaluation = evaluation;
    session.updatedAt = new Date().toISOString();
    return this.store.update(session);
  }

  /** Whether the candidate has already answered the given question. */
  hasAnswered(session: InterviewSession, questionId: string): boolean {
    return session.transcript.some(
      (turn) => turn.role === "candidate" && turn.questionId === questionId
    );
  }

  private coverageFromQuestion(
    curriculum: CurriculumDay[],
    question: InterviewQuestion
  ): { coveredDays: string[]; coveredTopics: string[] } {
    const coveredDays = [...question.relatedDayIds];
    const coveredTopics = question.relatedDayIds.map(
      (id) => curriculum.find((day) => day.id === id)?.topic ?? id
    );
    return { coveredDays, coveredTopics };
  }

  private mergeUnique(existing: string[], incoming: string[]): string[] {
    const set = new Set(existing);
    for (const value of incoming) set.add(value);
    return [...set];
  }
}

export const sessionService = new SessionService(sessionStore);
