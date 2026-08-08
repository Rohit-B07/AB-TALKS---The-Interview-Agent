import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { MODE_LABELS } from "@/prompts/mode";
import type {
  Candidate,
  DifficultyPerformance,
  FinalEvaluation,
  InterviewMode,
  ReadinessLevel,
} from "@/server/types";

const READINESS_META: Record<ReadinessLevel, { label: string; className: string }> = {
  strong: { label: "Strong", className: "bg-emerald-500/10 text-emerald-600" },
  intermediate: { label: "Intermediate", className: "bg-sky-500/10 text-sky-600" },
  developing: { label: "Developing", className: "bg-amber-500/10 text-amber-600" },
  beginner: { label: "Beginner", className: "bg-muted text-muted-foreground" },
};

const PERFORMANCE_META: Record<DifficultyPerformance, string> = {
  strong: "Strong",
  developing: "Developing",
  weak: "Needs work",
  "not-reached": "Not reached",
};

interface FinalReportProps {
  candidate: Candidate;
  mode: InterviewMode;
  evaluation: FinalEvaluation;
}

export function FinalReport({ candidate, mode, evaluation }: FinalReportProps) {
  const readiness = READINESS_META[evaluation.readiness];
  const generated = new Date(evaluation.createdAt).toLocaleString();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Final interview evaluation</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{candidate.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{MODE_LABELS[mode]}</Badge>
          <Badge className={readiness.className}>{readiness.label}</Badge>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <span className="font-heading text-5xl font-semibold tabular-nums">
              {evaluation.overallScore}
            </span>
            <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
          </div>
          <Progress value={evaluation.overallScore}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <p className="text-xs text-muted-foreground">Report generated {generated}</p>
        </CardContent>
      </Card>

      <Section title="Summary">
        <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.summary}</p>
      </Section>

      <Section title="Topic performance">
        <div className="flex flex-col gap-4">
          {evaluation.topicPerformance.map((topic) => (
            <div key={topic.topic} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <ProgressLabel>{topic.topic}</ProgressLabel>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{topic.questionsAsked} q</Badge>
                  <span className="text-sm text-muted-foreground tabular-nums">{topic.score}</span>
                </div>
              </div>
              <Progress value={topic.score}>
                <ProgressTrack>
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <p className="text-xs text-muted-foreground">{topic.summary}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Strengths">
          <ul className="flex flex-col gap-2">
            {evaluation.strengths.map((strength) => (
              <li key={strength} className="flex gap-2 text-sm">
                <span className="text-emerald-500">+</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Knowledge gaps">
          <ul className="flex flex-col gap-2">
            {evaluation.knowledgeGaps.map((gap) => (
              <li key={gap} className="flex gap-2 text-sm">
                <span className="text-amber-500">–</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Questions to improve">
        {evaluation.improvementQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No specific questions needed improvement — great consistency.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {evaluation.improvementQuestions.map((item) => (
              <div key={item.question} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.topic}</Badge>
                </div>
                <p className="text-sm font-medium">{item.question}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-amber-500">What was missing: </span>
                  {item.issue}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-emerald-500">Suggested improvement: </span>
                  {item.improvement}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Difficulty progression">
          <div className="flex flex-col gap-2">
            {evaluation.difficultyProgression.map((entry) => (
              <div key={entry.difficulty} className="flex items-center justify-between gap-2">
                <span className="text-sm capitalize">{entry.difficulty}</span>
                <div className="flex items-center gap-2">
                  {entry.questionsAsked > 0 ? (
                    <Badge variant="secondary">{entry.questionsAsked} q</Badge>
                  ) : null}
                  <Badge variant="outline">{PERFORMANCE_META[entry.performance]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Adaptive interview">
          <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.adaptiveBehavior}</p>
        </Section>
      </div>

      <Section title="Recommended learning plan">
        <ol className="flex flex-col gap-2">
          {evaluation.recommendations.map((recommendation, index) => (
            <li key={recommendation} className="flex gap-3 text-sm">
              <span className="font-heading tabular-nums text-muted-foreground">{index + 1}.</span>
              <span>{recommendation}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
