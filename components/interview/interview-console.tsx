"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnswerForm } from "@/components/interview/answer-form";
import { ConversationLog } from "@/components/interview/conversation-log";
import { ProgressIndicator } from "@/components/interview/progress-indicator";
import { QuestionPanel } from "@/components/interview/question-panel";
import { SessionHeader } from "@/components/interview/session-header";
import { ThinkingIndicator } from "@/components/interview/thinking-indicator";
import { WelcomeScreen } from "@/components/interview/welcome-screen";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { WelcomeInfo } from "@/server/services/insights.service";
import type { GetSessionResponse, InterviewState, SubmitAnswerResponse } from "@/server/types";

interface InterviewConsoleProps {
  sessionId: string;
  welcome: WelcomeInfo;
  initialState: InterviewState | null;
}

function toState(data: GetSessionResponse): InterviewState {
  return {
    sessionId: data.sessionId,
    status: data.metadata.status,
    candidate: data.candidate,
    mode: data.metadata.mode,
    currentQuestion: data.currentQuestion,
    currentQuestionAnswered: data.metadata.currentQuestionAnswered,
    transcript: data.conversation,
    currentQuestionNumber: data.metadata.currentQuestionNumber,
    questionsAsked: data.metadata.questionsAsked,
    questionsTarget: data.metadata.questionsTarget,
    uniqueCurriculumDays: data.metadata.uniqueCurriculumDays,
    progress: data.metadata.progress,
    interviewComplete: data.metadata.interviewComplete,
    createdAt: data.metadata.createdAt,
    updatedAt: data.metadata.updatedAt,
  };
}

const THINKING_PHASES = [
  "Analyzing your reasoning...",
  "Checking your understanding...",
  "Planning the next question...",
];

export function InterviewConsole({ sessionId, welcome, initialState }: InterviewConsoleProps) {
  const [state, setState] = useState<InterviewState | null>(initialState);
  const [loading, setLoading] = useState(initialState === null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState("");
  const [begun, setBegun] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await apiFetch<GetSessionResponse>(`/api/interview/${sessionId}`);
        if (!active) return;
        setState(toState(data));
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load this session.");
      } finally {
        if (active) setLoading(false);
      }
    };
    if (initialState === null) void run();
    return () => {
      active = false;
    };
  }, [sessionId, reloadKey, initialState]);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  const handleSubmit = async () => {
    const content = answer.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<SubmitAnswerResponse>("/api/interview/answer", {
        method: "POST",
        body: JSON.stringify({ sessionId, answer: content }),
      });
      setState(data.state);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading interview..." />;
  }

  if (error && !state) {
    return <ErrorState message={error} onRetry={retryLoad} />;
  }

  if (!state) {
    return null;
  }

  const hasAnsweredAny = state.transcript.some((turn) => turn.role === "candidate");
  const showWelcome = !begun && !hasAnsweredAny;

  if (showWelcome) {
    return <WelcomeScreen welcome={welcome} onBegin={() => setBegun(true)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SessionHeader
        candidate={state.candidate}
        status={state.status}
        createdAt={state.createdAt}
        answered={state.currentQuestionAnswered}
      />

      <ProgressIndicator
        questionNumber={state.currentQuestionNumber}
        estimatedQuestions={state.questionsTarget}
        progress={state.progress}
      />

      {error ? <ErrorState title="Could not submit answer" message={error} /> : null}

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-6">
          {state.currentQuestion ? (
            <QuestionPanel
              question={state.currentQuestion}
              questionNumber={state.currentQuestionNumber}
              answered={state.currentQuestionAnswered}
            />
          ) : state.interviewComplete ? (
            <Card>
              <CardHeader>
                <CardTitle>Interview complete</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  You answered {state.questionsAsked} questions across{" "}
                  {state.uniqueCurriculumDays} curriculum areas.
                </p>
                <Link
                  href={`/interview/${sessionId}/report`}
                  className={buttonVariants({})}
                >
                  View your report
                </Link>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              Preparing your next question…
            </p>
          )}

          {state.interviewComplete ? null : (
            <AnswerForm
              value={answer}
              onChange={setAnswer}
              onSubmit={handleSubmit}
              disabled={loading}
              submitting={submitting}
              answered={state.currentQuestionAnswered}
            />
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <ConversationLog turns={state.transcript} />
            </CardContent>
          </Card>
          {submitting ? <ThinkingIndicator phases={THINKING_PHASES} /> : null}
        </aside>
      </div>
    </div>
  );
}
