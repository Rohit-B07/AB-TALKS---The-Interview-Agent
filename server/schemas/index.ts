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

/** The interview mode controls which question bank and evaluation style is used. */
export const interviewModeSchema = z.enum(["ai_engineering", "dsa_friendly"]);
export type InterviewMode = z.infer<typeof interviewModeSchema>;

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
  defaultMode: interviewModeSchema.default("ai_engineering"),
});
export type Candidate = z.infer<typeof candidateSchema>;

// ---------------------------------------------------------------------------
// Interview domain
// ---------------------------------------------------------------------------

export const questionTypeSchema = z.enum([
  "conceptual",
  "practical",
  "debugging",
  "scenario",
  "tradeoff",
  "coding",
  "open-ended",
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

// ---------------------------------------------------------------------------
// Interviewer personality & internal evaluation / memory
// ---------------------------------------------------------------------------

export const interviewerPersonalitySchema = z.enum([
  "mentor",
  "hiring_manager",
  "senior_engineer",
]);
export type InterviewerPersonality = z.infer<typeof interviewerPersonalitySchema>;

export const difficultyRecommendationSchema = z.enum(["same", "harder", "easier"]);
export type DifficultyRecommendation = z.infer<typeof difficultyRecommendationSchema>;

export const questionSourceSchema = z.enum(["ai", "fallback"]);
export type QuestionSource = z.infer<typeof questionSourceSchema>;

/**
 * Internal evaluation of a single candidate answer. Never returned to the
 * client: it lives in server-side session state only.
 */
export const evaluationSchema = z.object({
  questionId: z.string().min(1),
  score: z.number().min(1).max(5),
  understanding: z.string().min(1),
  strengths: z.array(z.string().min(1)),
  weaknesses: z.array(z.string().min(1)),
  needsFollowUp: z.boolean(),
  followUpReason: z.string(),
  memoryUpdate: z.string(),
  confidence: z.number().min(0).max(1),
  difficultyRecommendation: difficultyRecommendationSchema,
});
export type Evaluation = z.infer<typeof evaluationSchema>;

/**
 * Long-lived interview memory carried server-side across the whole session.
 * Updated after every answer and consumed by the planner/question generator.
 */
export const interviewMemorySchema = z.object({
  candidateId: z.string().min(1),
  sessionId: z.string().min(1),
  personality: interviewerPersonalitySchema,
  questionNumber: z.number().int().nonnegative(),
  totalTargetQuestions: z.number().int().positive(),
  coveredDays: z.array(z.string().min(1)),
  coveredTopics: z.array(z.string().min(1)),
  questionHistory: z.array(z.string().min(1)),
  answerHistory: z.array(z.string().min(1)),
  strengths: z.array(z.string().min(1)),
  knowledgeGaps: z.array(z.string().min(1)),
  difficulty: difficultySchema,
  currentStage: z.string().min(1),
  lastEvaluation: evaluationSchema.nullable(),
  conversationSummary: z.string().min(1),
});
export type InterviewMemory = z.infer<typeof interviewMemorySchema>;

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
  // Phase 3: per-question attribution metadata on assistant turns so the final
  // evaluation can compute topic performance and difficulty progression.
  difficulty: difficultySchema.optional(),
  relatedDayIds: z.array(z.string().min(1)).optional(),
  context: z.string().optional(),
});
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

export const sessionStatusSchema = z.enum(["active", "completed"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

// ---------------------------------------------------------------------------
// Final evaluation (Phase 3)
// ---------------------------------------------------------------------------

/** Overall readiness band shown on the final report. */
export const readinessSchema = z.enum(["beginner", "developing", "intermediate", "strong"]);
export type ReadinessLevel = z.infer<typeof readinessSchema>;

/** How the candidate performed at a given difficulty level. */
export const difficultyPerformanceSchema = z.enum(["strong", "developing", "weak", "not-reached"]);
export type DifficultyPerformance = z.infer<typeof difficultyPerformanceSchema>;

export const topicPerformanceSchema = z.object({
  topic: z.string().min(1),
  score: z.number().min(0).max(100),
  questionsAsked: z.number().int().nonnegative(),
  summary: z.string().min(1),
});
export type TopicPerformance = z.infer<typeof topicPerformanceSchema>;

export const difficultyProgressionEntrySchema = z.object({
  difficulty: difficultySchema,
  performance: difficultyPerformanceSchema,
  questionsAsked: z.number().int().nonnegative(),
});
export type DifficultyProgressionEntry = z.infer<typeof difficultyProgressionEntrySchema>;

export const improvementQuestionSchema = z.object({
  question: z.string().min(1),
  topic: z.string().min(1),
  issue: z.string().min(1),
  improvement: z.string().min(1),
});
export type ImprovementQuestion = z.infer<typeof improvementQuestionSchema>;

/**
 * The candidate-facing final evaluation. Aggregation is deterministic and
 * explainable; only the narrative fields (summary, topic summaries, adaptive
 * behavior, recommendations) may be written by Gemini, with a deterministic
 * fallback. Never contains raw evaluations, confidence, or internal memory.
 */
export const finalEvaluationSchema = z.object({
  sessionId: z.string().min(1),
  mode: interviewModeSchema,
  createdAt: z.string().min(1),
  overallScore: z.number().min(0).max(100),
  readiness: readinessSchema,
  summary: z.string().min(1),
  topicPerformance: z.array(topicPerformanceSchema),
  strengths: z.array(z.string().min(1)),
  knowledgeGaps: z.array(z.string().min(1)),
  improvementQuestions: z.array(improvementQuestionSchema),
  difficultyProgression: z.array(difficultyProgressionEntrySchema),
  adaptiveBehavior: z.string().min(1),
  recommendations: z.array(z.string().min(1)),
});
export type FinalEvaluation = z.infer<typeof finalEvaluationSchema>;

export const interviewSessionSchema = z.object({
  id: z.string().min(1),
  candidate: candidateSchema,
  curriculum: z.array(curriculumDaySchema),
  transcript: z.array(conversationTurnSchema),
  currentQuestion: interviewQuestionSchema.nullable(),
  personality: interviewerPersonalitySchema,
  mode: interviewModeSchema,
  currentQuestionNumber: z.number().int().nonnegative(),
  questionsAsked: z.number().int().nonnegative(),
  coveredDays: z.array(z.string().min(1)),
  coveredTopics: z.array(z.string().min(1)),
  evaluations: z.array(evaluationSchema),
  memory: interviewMemorySchema,
  currentQuestionSource: questionSourceSchema.nullable(),
  status: sessionStatusSchema,
  finalEvaluation: finalEvaluationSchema.nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type InterviewSession = z.infer<typeof interviewSessionSchema>;

/** The client-facing snapshot of an interview session. */
export const interviewStateSchema = z.object({
  sessionId: z.string().min(1),
  status: sessionStatusSchema,
  candidate: candidateSchema,
  mode: interviewModeSchema,
  currentQuestion: interviewQuestionSchema.nullable(),
  currentQuestionAnswered: z.boolean(),
  transcript: z.array(conversationTurnSchema),
  currentQuestionNumber: z.number().int().positive(),
  questionsAsked: z.number().int().nonnegative(),
  questionsTarget: z.number().int().positive(),
  uniqueCurriculumDays: z.number().int().nonnegative(),
  progress: z.number().min(0).max(100),
  interviewComplete: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type InterviewState = z.infer<typeof interviewStateSchema>;

// ---------------------------------------------------------------------------
// API requests
// ---------------------------------------------------------------------------

export const startInterviewRequestSchema = z.object({
  candidateId: z.string().min(1, "candidateId is required"),
  personality: interviewerPersonalitySchema.default("hiring_manager"),
  mode: interviewModeSchema.optional(),
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
    mode: interviewModeSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    currentQuestionAnswered: z.boolean(),
    currentQuestionNumber: z.number().int().positive(),
    questionsAsked: z.number().int().nonnegative(),
    questionsTarget: z.number().int().positive(),
    uniqueCurriculumDays: z.number().int().nonnegative(),
    progress: z.number().min(0).max(100),
    interviewComplete: z.boolean(),
  }),
  currentQuestion: interviewQuestionSchema.nullable(),
  conversation: z.array(conversationTurnSchema),
});
export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>;

export const listCandidatesResponseSchema = z.object({
  candidates: z.array(candidateSchema),
});
export type ListCandidatesResponse = z.infer<typeof listCandidatesResponseSchema>;

export const getFinalEvaluationResponseSchema = z.object({
  evaluation: finalEvaluationSchema,
});
export type GetFinalEvaluationResponse = z.infer<typeof getFinalEvaluationResponseSchema>;
