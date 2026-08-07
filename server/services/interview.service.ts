import { randomUUID } from "node:crypto";
import { createInterviewEngine, type InterviewEngine } from "@/server/engine";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import { sessionService } from "@/server/services/session.service";
import type {
  InterviewQuestion,
  InterviewSession,
  InterviewState,
} from "@/server/types";

/**
 * Coordinates the interview flow. It is the only service the API layer talks
 * to, keeping handlers thin. Question generation is delegated to the
 * InterviewEngine so the AI layer can be swapped in Phase 2.
 */
export class InterviewService {
  constructor(private readonly engine: InterviewEngine = createInterviewEngine()) {}

  /**
   * Starts a new interview for a candidate: loads their profile and the
   * curriculum, generates the first question, and persists a session.
   */
  async startInterview(candidateId: string): Promise<{
    sessionId: string;
    question: InterviewQuestion;
    state: InterviewState;
  }> {
    const candidate = await candidateService.getCandidateById(candidateId);
    const curriculum = await curriculumService.getCurriculum();
    const lastCompletedDay = await curriculumService.getLastCompletedDay(candidate);

    const question = await this.engine.generateFirstQuestion({
      candidate,
      curriculum,
      lastCompletedDay,
    });

    const session = await sessionService.createSession({
      id: randomUUID(),
      candidate,
      curriculum,
      firstQuestion: question,
    });

    return { sessionId: session.id, question, state: this.toState(session) };
  }

  /** Records a candidate's answer and returns the updated interview state. */
  async submitAnswer(sessionId: string, answer: string): Promise<InterviewState> {
    const session = await sessionService.submitAnswer(sessionId, answer);
    return this.toState(session);
  }

  async getSession(sessionId: string): Promise<InterviewSession> {
    return sessionService.getSession(sessionId);
  }

  /** Maps a persisted session to the client-facing interview state. */
  toState(session: InterviewSession): InterviewState {
    const currentQuestionAnswered = session.currentQuestion
      ? sessionService.hasAnswered(session, session.currentQuestion.id)
      : false;

    return {
      sessionId: session.id,
      status: session.status,
      candidate: session.candidate,
      currentQuestion: session.currentQuestion,
      currentQuestionAnswered,
      transcript: session.transcript,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

export const interviewService = new InterviewService();
