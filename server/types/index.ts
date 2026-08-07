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
  GetSessionResponse,
  InterviewAnswer,
  InterviewQuestion,
  InterviewSession,
  InterviewState,
  ListCandidatesResponse,
  QuestionType,
  SessionStatus,
  StartInterviewRequest,
  StartInterviewResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from "@/server/schemas";
