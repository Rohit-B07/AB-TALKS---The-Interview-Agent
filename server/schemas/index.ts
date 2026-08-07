import { z } from "zod";

/**
 * Zod schemas are the single source of truth for every domain type and
 * every API contract in the app. Domain types (see server/types) are derived
 * from these schemas with `z.infer` so nothing is ever duplicated.
 */

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const curriculumDaySchema = z.object({
  id: z.string().min(1),
  day: z.number().int().positive(),
  module: z.string().min(1),
  topic: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(1),
  tools: z.array(z.string().min(1)).min(1),
  difficulty: difficultySchema,
});
export type CurriculumDay = z.infer<typeof curriculumDaySchema>;

export const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  completedDays: z.array(z.string().min(1)),
  skippedDays: z.array(z.string().min(1)),
  attempts: z.number().int().nonnegative(),
  strengths: z.array(z.string().min(1)),
  weaknesses: z.array(z.string().min(1)),
  learningSignals: z.array(z.string().min(1)),
});
export type Candidate = z.infer<typeof candidateSchema>;

// ---------------------------------------------------------------------------
// Interview domain
// ---------------------------------------------------------------------------

export const questionTypeSchema = z.enum(["conceptual", "coding", "open-ended"]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const interviewQuestionSchema = z.object({
  id: z.string().min(1),
  type: questionTypeSchema,
  prompt: z.string().min(1),
  context: z.string().min(1),
  difficulty: difficultySchema,
  relatedDayIds: z.array(z.string().min(1)),
  createdAt: z.string().min(1),
});
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;

export const interviewAnswerSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  content: z.string().min(1),
  submittedAt: z.string().min(1),
});
export type InterviewAnswer = z.infer<typeof interviewAnswerSchema>;

export const conversationTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["assistant", "candidate"]),
  content: z.string().min(1),
  questionId: z.string().optional(),
  answerId: z.string().optional(),
  createdAt: z.string().min(1),
});
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

export const sessionStatusSchema = z.enum(["active", "completed"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const interviewSessionSchema = z.object({
  id: z.string().min(1),
  candidate: candidateSchema,
  curriculum: z.array(curriculumDaySchema),
  transcript: z.array(conversationTurnSchema),
  currentQuestion: interviewQuestionSchema.nullable(),
  status: sessionStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type InterviewSession = z.infer<typeof interviewSessionSchema>;

/** The client-facing snapshot of an interview session. */
export const interviewStateSchema = z.object({
  sessionId: z.string().min(1),
  status: sessionStatusSchema,
  candidate: candidateSchema,
  currentQuestion: interviewQuestionSchema.nullable(),
  currentQuestionAnswered: z.boolean(),
  transcript: z.array(conversationTurnSchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type InterviewState = z.infer<typeof interviewStateSchema>;

// ---------------------------------------------------------------------------
// API requests
// ---------------------------------------------------------------------------

export const startInterviewRequestSchema = z.object({
  candidateId: z.string().min(1, "candidateId is required"),
});
export type StartInterviewRequest = z.infer<typeof startInterviewRequestSchema>;

export const submitAnswerRequestSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  answer: z.string().trim().min(1, "answer must not be empty"),
});
export type SubmitAnswerRequest = z.infer<typeof submitAnswerRequestSchema>;

// ---------------------------------------------------------------------------
// API responses
// ---------------------------------------------------------------------------

export const startInterviewResponseSchema = z.object({
  sessionId: z.string().min(1),
  question: interviewQuestionSchema,
  state: interviewStateSchema,
});
export type StartInterviewResponse = z.infer<typeof startInterviewResponseSchema>;

export const submitAnswerResponseSchema = z.object({
  state: interviewStateSchema,
});
export type SubmitAnswerResponse = z.infer<typeof submitAnswerResponseSchema>;

export const getSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  candidate: candidateSchema,
  metadata: z.object({
    status: sessionStatusSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    currentQuestionAnswered: z.boolean(),
  }),
  currentQuestion: interviewQuestionSchema.nullable(),
  conversation: z.array(conversationTurnSchema),
});
export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>;

export const listCandidatesResponseSchema = z.object({
  candidates: z.array(candidateSchema),
});
export type ListCandidatesResponse = z.infer<typeof listCandidatesResponseSchema>;
