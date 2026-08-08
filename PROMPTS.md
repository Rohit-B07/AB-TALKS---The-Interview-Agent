# ABTalks Prompt History

A running log of prompts for this project and their outcomes. Preserve existing
entries; append new ones in reverse-chronological order.

## Phase 3: Final AI Interview Evaluation & Candidate Feedback

- **Session**: OpenCode, deepseek-v4-flash-free
- **Prompt**: After the candidate completes the interview, generate a professional
  final interview evaluation. The report must be based on actual performance —
  candidate profile, mode, curriculum coverage, questions, answers, evaluator
  results, difficulty progression, strengths/weaknesses, knowledge gaps,
  follow-up behavior, memory, and question history. Do NOT generate a report
  after every answer; only when `interviewComplete === true`. Structure: overall
  summary, overall score 1–100, readiness level (Beginner/Developing/
  Intermediate/Strong), per-topic performance (only topics actually covered),
  3–5 evidence-based strengths, prioritized knowledge gaps, 2–4 questions that
  need improvement, difficulty progression, adaptive-interview analysis,
  recommended learning plan (3–5 items), and the interview mode. Scoring must be
  a lightweight deterministic aggregation layer (answer scores → topic
  aggregation → overall performance) — the LLM may summarize structured evidence
  but must NEVER invent scores. Add a `FinalEvaluationService`, a typed
  `FinalEvaluation` model, a `GET /api/interview/[sessionId]/evaluation` endpoint
  that verifies the session, returns the stored evaluation, generates it once if
  the interview is complete, and never regenerates it unnecessarily. Persist with
  the session so it survives refresh. Add a dedicated feedback UI page reusing
  the existing visual language. NEVER expose raw evaluator JSON, confidence,
  internal reasoning, planner decisions, prompts, memory, or retry info. DSA
  Friendly reports must be beginner-friendly and never penalize not reaching
  advanced; AI Engineering reports focus on ML/AI concepts, Python/data tooling,
  architecture, and trade-offs. Handle edge cases (exactly 8 / more than 8
  questions, weak and strong candidates, repeated "I don't know", hint-heavy
  interviews, incomplete answers, no clear topic coverage, Gemini unavailable,
  malformed Gemini output, evaluation generation failure) with deterministic
  fallback summaries so the report is always available.
- **Purpose**: Turn the interview conversation and evaluator results into useful,
  professional candidate feedback after the interview completes.
- **Architecture changes**:
  - Scoring stays deterministic and explainable: `buildAnswerRecords` zips the
    transcript (questions/answers) with stored evaluations; `aggregateTopicPerformance`
    averages scores per topic; `aggregateOverallScore` averages topic scores;
    `readinessFor` maps to Beginner/Developing/Intermediate/Strong.
  - Gemini writes ONLY narrative text (summary, topic summaries, adaptive
    behavior, recommendations) via a dedicated prompt and schema; strengths,
    knowledge gaps, improvement questions, difficulty progression, and all
    scores are computed deterministically.
  - The final evaluation is generated lazily once per completed session
    (`InterviewService.getFinalEvaluation`) and persisted on the session; the API
    returns the stored copy on subsequent requests.
  - Assistant conversation turns now carry `difficulty`, `relatedDayIds`, and
    `context` metadata so topic/difficulty attribution is exact.
- **Files changed**:
  - new: `server/ai/FinalEvaluationService.ts`,
    `server/ai/final-evaluation/aggregate.ts`,
    `server/ai/final-evaluation/narrative.ts`,
    `prompts/final-evaluation.prompt.ts`, `server/api/get-evaluation.ts`,
    `app/api/interview/[sessionId]/evaluation/route.ts`,
    `app/interview/[sessionId]/report/page.tsx`,
    `components/report/final-report.tsx`, `tests/final-evaluation.test.ts`
  - modified: `server/schemas/index.ts` (final evaluation + session field +
    turn metadata), `server/types/index.ts`, `server/ai/schemas.ts` (narrative
    schema), `server/services/session.service.ts` (metadata + `setFinalEvaluation`),
    `server/services/interview.service.ts` (`getFinalEvaluation`),
    `server/errors/app-error.ts` (`EVALUATION_NOT_AVAILABLE`),
    `lib/api.ts`, `server/ai/index.ts`, `components/interview/interview-console.tsx`
    (View your report link), `tests/session.service.test.ts`,
    `tests/session-store.test.ts`, `PROMPTS.md`
- **Final evaluation prompt** (Gemini narrative; scores are NOT in this schema):
  ```
  ROLE: senior AI engineering lead writing a candidate-facing evaluation.
  TASK: from structured evidence write summary (2-4 sentences), topicSummaries
  (1-2 sentences per provided topic, exact names only), adaptiveBehavior (1-3
  sentences), recommendations (exactly 3-5 actionable items).
  RULES: base every sentence only on the evidence; never mention confidence,
  internal scoring, or hidden systems; for DSA Friendly never penalize not
  reaching advanced; emphasize reasoning, approach, and improvement after support.
  OUTPUT FORMAT: only a single JSON object matching
  {"summary": string, "topicSummaries": [{topic, summary}],
  "adaptiveBehavior": string, "recommendations": [string]}.
  ```
- **Fallback strategy**: Every narrative field has a deterministic builder in
  `server/ai/final-evaluation/narrative.ts` (summary, topic summaries, adaptive
  behavior, recommendations) driven by the same evidence, so a Gemini outage or
  malformed output still yields a complete, mode-aware report. Scores are never
  affected by the LLM. `requestStructuredJSON` retries once with a correction
  prompt before falling back.
- **Tests**: `tests/final-evaluation.test.ts` (23 tests) covers aggregation,
  overall/topic scoring, readiness, strengths/gaps extraction, improvement
  question selection, difficulty progression, DSA vs AI reports, weak/strong
  candidates, "I don't know" behavior, hint-heavy interviews, exactly 8 and more
  than 8 questions, incomplete-interview rejection, generate-once persistence,
  refresh/reload, Gemini failure + malformed fallback, and API non-exposure of
  internal evaluator data.
- **Status**: done (118 tests, typecheck passes, lint 0 errors, production build
  passes)
- **Date**: 2026-08-08

## Phase 2: Gemini-backed adaptive interview engine

- **Session**: OpenCode, deepseek-v4-flash-free
- **Prompt**: Build the Phase 2 interview engine. Each service (planner, question
  generator, answer evaluator, memory) hits Gemini for structured JSON and falls
  back to a deterministic, curriculum-aware rule set on any failure or outage.
  The engine composes the services; the interview service drives Q&A, memory, and
  completion (8 questions across >= 4 distinct curriculum days). Clamp numeric
  AI output to valid ranges instead of failing; track ai/fallback source
  internally. Add integration tests covering adaptive behavior and full-session
  completion during a simulated Gemini outage.
- **Rationale**: Make interviews resilient to API failures and keep questions
  coherent, difficulty-aware, and grounded in prior answers.
- **Files**:
  - new: `server/ai/index.ts`, `server/ai/structured.ts`,
    `server/ai/InterviewPlanner.ts`, `server/ai/QuestionGenerator.ts`,
    `server/ai/AnswerEvaluator.ts`, `server/ai/MemoryManager.ts`,
    `server/ai/fallback.ts`, `server/ai/utils.ts`, `server/ai/schemas.ts`,
    `server/engine/index.ts`, `server/engine/interview-engine.ts`,
    `prompts/*.ts`, `tests/interview.adaptive.test.ts`,
    `tests/interview.fallback.integration.test.ts`
  - modified: `server/services/interview.service.ts`,
    `server/services/session.service.ts`, `server/schemas/index.ts`,
    `README.md`
- **Status**: done (85 tests, lint, typecheck, and production build pass)
- **Date**: 2026-08-08
