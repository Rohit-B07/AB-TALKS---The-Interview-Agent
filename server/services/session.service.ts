import { randomUUID } from "node:crypto";
import { AppError } from "@/server/errors/app-error";
import { sessionStore, type SessionStore } from "@/server/store/session-store";
import type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  InterviewQuestion,
  InterviewSession,
} from "@/server/types";

export interface CreateSessionInput {
  id: string;
  candidate: Candidate;
  curriculum: CurriculumDay[];
  firstQuestion: InterviewQuestion;
}

/**
 * Owns the shape and lifecycle of an interview session: creation, lookups,
 * and recording answers into the transcript.
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
      createdAt: now,
    };

    const session: InterviewSession = {
      id: input.id,
      candidate: input.candidate,
      curriculum: input.curriculum,
      transcript: [firstTurn],
      currentQuestion: input.firstQuestion,
      status: "active",
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
   * Records a candidate's answer to the current question in the transcript.
   * Phase 1 does not generate a follow-up question, so the current question
   * stays in place until a later phase advances the interview.
   */
  async submitAnswer(sessionId: string, content: string): Promise<InterviewSession> {
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
      content,
      questionId: question.id,
      createdAt: new Date().toISOString(),
    };

    session.transcript.push(turn);
    session.updatedAt = new Date().toISOString();

    return this.store.update(session);
  }

  /** Whether the candidate has already answered the given question. */
  hasAnswered(session: InterviewSession, questionId: string): boolean {
    return session.transcript.some(
      (turn) => turn.role === "candidate" && turn.questionId === questionId
    );
  }
}

export const sessionService = new SessionService(sessionStore);
