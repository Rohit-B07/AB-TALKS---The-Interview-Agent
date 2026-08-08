import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { MODE_LABELS } from "@/prompts/mode";
import type {
  Candidate,
  DifficultyPerformance,
  FinalEvaluation,
  InterviewMode,
  ReadinessLevel,
} from "@/server/types";

const READINESS_META: Record<
  ReadinessLevel,
  { label: string; className: string; description: string }
> = {
  strong: {
    label: "Strong",
    className: "bg-emerald-500/10 text-emerald-600",
    description:
      "You handled questions with confidence and clear reasoning — you are ready to move into more advanced topics.",
  },
  intermediate: {
    label: "Intermediate",
    className: "bg-sky-500/10 text-sky-600",
    description:
      "You have a solid grasp of the core topics — keep practicing to push into stronger territory.",
  },
  developing: {
    label: "Developing",
    className: "bg-amber-500/10 text-amber-600",
    description:
      "You understand the foundations — focused practice and review will close the gap quickly.",
  },
  beginner: {
    label: "Beginner",
    className: "bg-muted text-muted-foreground",
    description:
      "You are at the start of your journey — every practice session builds your foundation.",
  },
};

const PERFORMANCE_META: Record<DifficultyPerformance, string> = {
  strong: "Strong",
  developing: "Developing",
  weak: "Needs work",
  "not-reached": "Not reached",
};

const SCORE_EXPLANATION: Record<InterviewMode, string> = {
  dsa_friendly:
    "Your score reflects how clearly you approached each problem, your reasoning, edge-case awareness, and basic complexity thinking across the topics covered in this interview.",
  ai_engineering:
    "Your score reflects your conceptual understanding, practical know-how, debugging instincts, and engineering trade-off decisions across the topics covered in this interview.",
};

const TAGLINES: Record<InterviewMode, Record<ReadinessLevel, string>> = {
  dsa_friendly: {
    strong: "You solved problems independently and explained your reasoning clearly.",
    intermediate: "You are building a solid foundation in problem solving.",
    developing: "You are getting the core ideas — consistent practice will turn them into habits.",
    beginner: "You are getting started — every practice session builds your foundation.",
  },
  ai_engineering: {
    strong: "You reasoned about systems end-to-end with confident, practical answers.",
    intermediate: "You have a solid grasp of the core AI engineering concepts.",
    developing:
      "You understand the fundamentals — keep connecting them to real implementations.",
    beginner: "You are getting started — keep exploring how AI systems are built.",
  },
};

const ADAPTIVE_EXPLANATION =
  "The interviewer picked each question's difficulty based on your previous answers: strong answers moved you up a level, while uncertain answers kept you on familiar ground so you could build confidence before moving on.";

interface FinalReportProps {
  candidate: Candidate;
  mode: InterviewMode;
  evaluation: FinalEvaluation;
}

export function FinalReport({ candidate, mode, evaluation }: FinalReportProps) {
  const readiness = READINESS_META[evaluation.readiness];
  const generated = new Date(evaluation.createdAt).toLocaleString();
  const lastReached = [...evaluation.difficultyProgression]
    .reverse()
    .find((entry) => entry.questionsAsked > 0);

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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Overall score</p>
              <p className="mt-1 flex items-end gap-1">
                <span className="font-heading text-5xl font-semibold tabular-nums">
                  {evaluation.overallScore}
                </span>
                <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
              </p>
            </div>
            <Badge className={readiness.className}>{readiness.label} readiness</Badge>
          </div>

          <Progress value={evaluation.overallScore} className="flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <ProgressLabel>Overall score</ProgressLabel>
              <ProgressValue />
            </div>
          </Progress>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {TAGLINES[mode][evaluation.readiness]}
          </p>
          <p className="text-xs text-muted-foreground">Report generated {generated}</p>
        </CardContent>
      </Card>

      <Section title="What your score means">
        <p className="text-sm leading-relaxed text-muted-foreground">{SCORE_EXPLANATION[mode]}</p>
        <div className="mt-4 flex flex-col gap-1.5 rounded-lg border p-3">
          <p className="text-sm font-medium">{readiness.label} readiness</p>
          <p className="text-sm text-muted-foreground">{readiness.description}</p>
        </div>
      </Section>

      <Section title="Summary">
        <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.summary}</p>
      </Section>

      <Section
        title="Topic performance"
        description="How you performed across the topics covered in this interview."
      >
        <div className="flex flex-col gap-4">
          {evaluation.topicPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No topic data is available for this report.
            </p>
          ) : (
            evaluation.topicPerformance.map((topic) => (
              <div key={topic.topic} className="flex flex-col gap-1.5">
                <Progress value={topic.score} className="flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProgressLabel>{topic.topic}</ProgressLabel>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{topic.questionsAsked} q</Badge>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {topic.score}
                      </span>
                    </div>
                  </div>
                </Progress>
                <p className="text-xs text-muted-foreground">{topic.summary}</p>
              </div>
            ))
          )}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Strengths">
          {evaluation.strengths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No standout strengths were recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {evaluation.strengths.map((strength) => (
                <li key={strength} className="flex gap-2 text-sm">
                  <span className="text-emerald-500">+</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Knowledge gaps">
          {evaluation.knowledgeGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No major gaps were identified — great consistency.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {evaluation.knowledgeGaps.map((gap) => (
                <li key={gap} className="flex gap-2 text-sm">
                  <span className="text-amber-500">–</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          )}
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

      <Section
        title="Adaptive journey"
        description="The interview adjusted its difficulty based on your answers."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            {evaluation.difficultyProgression.map((entry, index) => (
              <div key={entry.difficulty} className="flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm capitalize">{entry.difficulty}</span>
                  <div className="flex items-center gap-2">
                    {entry.questionsAsked > 0 ? (
                      <Badge variant="secondary">{entry.questionsAsked} q</Badge>
                    ) : null}
                    <Badge variant="outline">{PERFORMANCE_META[entry.performance]}</Badge>
                  </div>
                </div>
                {index < evaluation.difficultyProgression.length - 1 ? (
                  <div className="flex items-center gap-2 py-0.5 pl-3">
                    <span className="h-4 w-px bg-border" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {lastReached && lastReached.difficulty !== "advanced" ? (
            <p className="text-xs text-muted-foreground">
              Advanced-level questions were not reached — the interview kept you on levels it could
              build on.
            </p>
          ) : null}

          <p className="text-sm leading-relaxed text-muted-foreground">
            {evaluation.adaptiveBehavior}
          </p>
          <p className="text-xs text-muted-foreground">{ADAPTIVE_EXPLANATION}</p>
        </div>
      </Section>

      <Section title="Improvement plan">
        {evaluation.recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recommendations were generated — great work.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {evaluation.recommendations.map((recommendation, index) => (
              <li key={recommendation} className="flex gap-3 text-sm">
                <span className="font-heading tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ol>
        )}
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
        <h2 className="font-heading text-base leading-snug font-medium">{title}</h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
