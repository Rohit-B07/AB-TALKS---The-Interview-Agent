import { randomUUID } from "node:crypto";
import { AppError } from "@/server/errors/app-error";
import { createInterviewEngine, type InterviewEngine } from "@/server/engine";
import { MemoryManager } from "@/server/ai/MemoryManager";
import { FinalEvaluationService } from "@/server/ai/FinalEvaluationService";
import { DEFAULT_PERSONALITY, MIN_QUESTIONS, MIN_UNIQUE_DAYS } from "@/server/ai/constants";
import { getEligibleDays } from "@/server/ai/utils";
import { candidateService } from "@/server/services/candidate.service";
import { curriculumService } from "@/server/services/curriculum.service";
import { sessionService } from "@/server/services/session.service";
import type {
  FinalEvaluation,
  InterviewerPersonality,
  InterviewMode,
  InterviewQuestion,
  InterviewSession,
  InterviewState,
} from "@/server/types";

/**
 * Coordinates the adaptive interview flow. It is the only service the API
 * layer talks to. Question generation, answer evaluation, and memory updates
 * are delegated to the InterviewEngine + MemoryManager so the AI layer can be
 * swapped without touching handlers.
 */
export class InterviewService {
  constructor(
    private readonly engine: InterviewEngine = createInterviewEngine(),
    private readonly memoryManager: MemoryManager = new MemoryManager(),
    private readonly finalEvaluationService: FinalEvaluationService = new FinalEvaluationService()
  ) {}

  /**
   * Starts a new interview for a candidate: loads their profile and the
   * curriculum, plans and generates the first question, and persists a
   * session with initial memory. The mode defaults to the candidate's
   * preferred mode when not explicitly requested.
   */
  async startInterview(
    candidateId: string,
    personality: InterviewerPersonality = DEFAULT_PERSONALITY,
    mode?: InterviewMode
  ): Promise<{ sessionId: string; question: InterviewQuestion; state: InterviewState }> {
    const candidate = await candidateService.getCandidateById(candidateId);
    const curriculum = await curriculumService.getCurriculum();
    const resolvedMode: InterviewMode = mode ?? candidate.defaultMode;
    const sessionId = randomUUID();

    const initialMemory = this.memoryManager.buildInitialMemory({
      candidate,
      sessionId,
      personality,
    });

    const { question } = await this.engine.generateFirstQuestion({
      candidate,
      curriculum,
      memory: initialMemory,
      personality,
      mode: resolvedMode,
    });

    const session = await sessionService.createSession({
      id: sessionId,
      candidate,
      curriculum,
      firstQuestion: question,
      personality,
      mode: resolvedMode,
      initialMemory,
    });

    return { sessionId: session.id, question, state: this.toState(session) };
  }

  /**
   * Records a candidate's answer, evaluates it, updates memory, decides
   * whether the interview is complete, and — when it is not — plans and
   * generates the next question. Returns the updated interview state.
   */
  async submitAnswer(sessionId: string, answer: string): Promise<InterviewState> {
    const session = await sessionService.getSession(sessionId);

    if (session.status === "completed") {
      return this.toState(session);
    }

    const question = session.currentQuestion;
    if (!question || sessionService.hasAnswered(session, question.id)) {
      throw new AppError(
        "QUESTION_ALREADY_ANSWERED",
        "This question has already been answered."
      );
    }

    const { evaluation } = await this.engine.evaluateAnswer({
      candidate: session.candidate,
      curriculum: session.curriculum,
      question,
      answer,
      memory: session.memory,
      personality: session.personality,
      mode: session.mode,
    });

    const updatedMemory = await this.memoryManager.updateMemory({
      memory: session.memory,
      candidate: session.candidate,
      curriculum: session.curriculum,
      question,
      answer,
      evaluation,
      personality: session.personality,
    });

    const recorded = await sessionService.recordAnswer(sessionId, answer, evaluation, updatedMemory);

    if (this.isComplete(recorded)) {
      const completed = await sessionService.complete(recorded);
      return this.toState(completed);
    }

    const { question: nextQuestion, source } = await this.engine.generateNextQuestion({
      candidate: session.candidate,
      curriculum: session.curriculum,
      memory: updatedMemory,
      previousQuestion: question,
      previousAnswer: answer,
      lastEvaluation: evaluation,
      personality: session.personality,
      transcript: recorded.transcript,
      mode: session.mode,
    });

    const advanced = await sessionService.advance(sessionId, nextQuestion, source);
    return this.toState(advanced);
  }

  async getSession(sessionId: string): Promise<InterviewSession> {
    return sessionService.getSession(sessionId);
  }

  /**
   * Returns the final evaluation for a completed interview, generating and
   * persisting it once if it does not exist yet. Never generates a report for
   * an active interview, and never regenerates an already-persisted one.
   */
  async getFinalEvaluation(sessionId: string): Promise<FinalEvaluation> {
    const session = await sessionService.getSession(sessionId);

    if (session.status !== "completed") {
      throw new AppError(
        "EVALUATION_NOT_AVAILABLE",
        "The final evaluation is available only after the interview is complete."
      );
    }
    if (session.finalEvaluation) {
      return session.finalEvaluation;
    }

    const evaluation = await this.finalEvaluationService.generate(session);
    await sessionService.setFinalEvaluation(sessionId, evaluation);
    return evaluation;
  }

  /** True when both completion requirements are satisfied. */
  private isComplete(session: InterviewSession): boolean {
    const eligibleDays = getEligibleDays(session.candidate, session.curriculum).length;
    const requiredDays = Math.min(MIN_UNIQUE_DAYS, eligibleDays);
    return (
      session.questionsAsked >= MIN_QUESTIONS &&
      new Set(session.coveredDays).size >= requiredDays
    );
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
      mode: session.mode,
      currentQuestion: session.currentQuestion,
      currentQuestionAnswered,
      transcript: session.transcript,
      currentQuestionNumber: Math.max(1, session.currentQuestionNumber),
      questionsAsked: session.questionsAsked,
      questionsTarget: MIN_QUESTIONS,
      uniqueCurriculumDays: new Set(session.coveredDays).size,
      progress: Math.min(100, Math.round((session.questionsAsked / MIN_QUESTIONS) * 100)),
      interviewComplete: session.status === "completed",
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

export const interviewService = new InterviewService();
