/**
 * Re-export of every domain and API type.
 *
 * Types are derived from the Zod schemas in server/schemas so there is a
 * single source of truth. Re-exporting keeps the import surface clean and
 * lets server and client code share types via `import type`.
 */
export type {
  Candidate,
  ConversationTurn,
  CurriculumDay,
  Difficulty,
  DifficultyPerformance,
  DifficultyProgressionEntry,
  DifficultyRecommendation,
  Evaluation,
  FinalEvaluation,
  GetFinalEvaluationResponse,
  GetSessionResponse,
  ImprovementQuestion,
  InterviewAnswer,
  InterviewMemory,
  InterviewQuestion,
  InterviewSession,
  InterviewMode,
  InterviewState,
  InterviewerPersonality,
  ListCandidatesResponse,
  QuestionSource,
  QuestionType,
  ReadinessLevel,
  SessionStatus,
  StartInterviewRequest,
  StartInterviewResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  TopicPerformance,
} from "@/server/schemas";
