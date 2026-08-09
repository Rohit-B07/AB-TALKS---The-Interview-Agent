import type { ReactNode } from "react";
import { AlertTriangle, Check, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { ExpandableItem } from "@/components/report/expandable-item";
import { RadarChart } from "@/components/report/radar-chart";
import { ReportNav } from "@/components/report/report-nav";
import { cn } from "@/lib/utils";
import { MODE_LABELS } from "@/prompts/mode";
import type {
  Candidate,
  DifficultyPerformance,
  FinalEvaluation,
  ImprovementQuestion,
  InterviewMode,
  ReadinessLevel,
  TopicPerformance,
} from "@/server/types";

const READINESS_META: Record<
  ReadinessLevel,
  {
    label: string;
    className: string;
    ringClassName: string;
    description: string;
  }
> = {
  strong: {
    label: "Strong",
    className: "bg-emerald-500/10 text-emerald-600",
    ringClassName: "text-emerald-600 dark:text-emerald-500",
    description:
      "You handled questions with confidence and clear reasoning — you are ready to move into more advanced topics.",
  },
  intermediate: {
    label: "Intermediate",
    className: "bg-sky-500/10 text-sky-600",
    ringClassName: "text-sky-600 dark:text-sky-500",
    description:
      "You have a solid grasp of the core topics — keep practicing to push into stronger territory.",
  },
  developing: {
    label: "Developing",
    className: "bg-amber-500/10 text-amber-600",
    ringClassName: "text-amber-600 dark:text-amber-500",
    description:
      "You understand the foundations — focused practice and review will close the gap quickly.",
  },
  beginner: {
    label: "Beginner",
    className: "bg-muted text-muted-foreground",
    ringClassName: "text-muted-foreground",
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

  const domains = evaluation.topicPerformance.map((topic) => ({
    label: topic.topic,
    value: topic.score,
  }));

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

      <ReportNav />

      {/* TOP: Overall score / readiness + Summary */}
      <div id="overview" className="grid scroll-mt-20 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overall score</CardTitle>
            <CardDescription>Your readiness classification</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-5">
              <ScoreRing score={evaluation.overallScore} colorClass={readiness.ringClassName} />
              <div className="flex flex-col gap-2">
                <Badge className={readiness.className}>{readiness.label} readiness</Badge>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {TAGLINES[mode][evaluation.readiness]}
                </p>
              </div>
            </div>

            <Progress value={evaluation.overallScore} className="flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <ProgressLabel>Overall score</ProgressLabel>
                <ProgressValue />
              </div>
            </Progress>

            <p className="text-xs text-muted-foreground">Report generated {generated}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.summary}</p>
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <p className="text-sm font-medium">What your score means</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {SCORE_EXPLANATION[mode]}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <p className="text-sm font-medium">{readiness.label} readiness</p>
              <p className="text-sm text-muted-foreground">{readiness.description}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MIDDLE: Strengths + Areas for Growth */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="strengths" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>💪 Strengths</CardTitle>
            <CardDescription>What stood out in this interview</CardDescription>
          </CardHeader>
          <CardContent>
            {evaluation.strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">No standout strengths were recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {evaluation.strengths.map((strength, index) => (
                  <StrengthItem
                    key={strength}
                    id={`strength-${index}`}
                    strength={strength}
                    topics={evaluation.topicPerformance}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card id="growth" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>🔍 Areas for Growth</CardTitle>
            <CardDescription>Where to focus your next practice</CardDescription>
          </CardHeader>
          <CardContent>
            {evaluation.knowledgeGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No major gaps were identified — great consistency.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {evaluation.knowledgeGaps.map((gap, index) => (
                  <GrowthItem
                    key={gap}
                    id={`growth-${index}`}
                    gap={gap}
                    topics={evaluation.topicPerformance}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM: Recommended Next Steps (left) + Domain Proficiency radar (right) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="next-steps" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>🚀 Recommended Next Steps</CardTitle>
            <CardDescription>Suggested focus areas for your next session</CardDescription>
          </CardHeader>
          <CardContent>
            {evaluation.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recommendations were generated — great work.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {evaluation.recommendations.map((recommendation, index) => (
                  <li key={recommendation}>
                    <ExpandableItem
                      id={`next-${index}`}
                      icon={<Rocket aria-hidden="true" className="size-4 shrink-0" />}
                      title={<span className="leading-snug">{recommendation}</span>}
                      meta={<Badge variant="outline">Step {index + 1}</Badge>}
                    >
                      <RecommendationDetail
                        recommendation={recommendation}
                        topics={evaluation.topicPerformance}
                        gaps={evaluation.knowledgeGaps}
                      />
                    </ExpandableItem>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card id="domains" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>📈 Domain Proficiency</CardTitle>
            <CardDescription>Your score per domain covered in this interview</CardDescription>
          </CardHeader>
          <CardContent>
            <RadarChart data={domains} />
          </CardContent>
        </Card>
      </div>

      {/* TOPIC PERFORMANCE */}
      <Card id="topics" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Topic Performance</CardTitle>
          <CardDescription>
            How you performed across the topics covered in this interview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluation.topicPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No topic data is available for this report.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {evaluation.topicPerformance.map((topic, index) => (
                <li key={topic.topic}>
                  <TopicItem
                    id={`topic-${index}`}
                    topic={topic}
                    improvementQuestions={evaluation.improvementQuestions}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}

/** Circular progress ring for the overall score. Pure SVG, no dependencies. */
function ScoreRing({ score, colorClass }: { score: number; colorClass: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg
      viewBox="0 0 120 120"
      className="size-28 shrink-0"
      role="img"
      aria-label={`Overall score ${score} out of 100`}
    >
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        strokeWidth="10"
        className="stroke-muted"
      />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        className={cn("transition-[stroke-dashoffset] duration-700 ease-out", colorClass)}
      />
      <text
        x="60"
        y="57"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-heading text-2xl font-semibold tabular-nums"
      >
        {score}
      </text>
      <text
        x="60"
        y="75"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground text-[10px]"
      >
        / 100
      </text>
    </svg>
  );
}

/** True when the topic's name appears in the text (existing data only). */
function matchingTopics(text: string, topics: TopicPerformance[]): TopicPerformance[] {
  const lower = text.toLowerCase();
  return topics.filter((topic) => lower.includes(topic.topic.toLowerCase()));
}

function StrengthItem({
  id,
  strength,
  topics,
}: {
  id: string;
  strength: string;
  topics: TopicPerformance[];
}) {
  const related = matchingTopics(strength, topics);

  if (related.length === 0) {
    return (
      <li className="flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <span className="text-sm leading-snug">{strength}</span>
      </li>
    );
  }

  return (
    <li>
      <ExpandableItem
        id={id}
        icon={<Check aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />}
        title={<span className="leading-snug">{strength}</span>}
      >
        <TopicDetail topics={related} label="Related domains" />
      </ExpandableItem>
    </li>
  );
}

function GrowthItem({
  id,
  gap,
  topics,
}: {
  id: string;
  gap: string;
  topics: TopicPerformance[];
}) {
  const related = matchingTopics(gap, topics);

  if (related.length === 0) {
    return (
      <li className="flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <span className="text-sm leading-snug">{gap}</span>
      </li>
    );
  }

  return (
    <li>
      <ExpandableItem
        id={id}
        icon={<AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-amber-500" />}
        title={<span className="leading-snug">{gap}</span>}
      >
        <TopicDetail topics={related} label="Related domains" />
      </ExpandableItem>
    </li>
  );
}

function TopicDetail({ topics, label }: { topics: TopicPerformance[]; label: string }) {
  return (
    <ul className="flex flex-col gap-3">
      <li>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      </li>
      {topics.map((topic) => (
        <li key={topic.topic} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{topic.topic}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{topic.score}</span>
          </div>
          <Progress value={topic.score} aria-label={`${topic.topic} score`} />
          <p className="text-xs text-muted-foreground">{topic.summary}</p>
        </li>
      ))}
    </ul>
  );
}

function RecommendationDetail({
  recommendation,
  topics,
  gaps,
}: {
  recommendation: string;
  topics: TopicPerformance[];
  gaps: string[];
}) {
  const relatedTopics = matchingTopics(recommendation, topics).filter((topic) => topic.score < 50);
  const lower = recommendation.toLowerCase();
  const relatedGaps = gaps.filter((gap) => lower.includes(gap.toLowerCase()));

  if (relatedTopics.length === 0 && relatedGaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No additional detail was recorded for this step.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {relatedTopics.length > 0 ? (
        <TopicDetail topics={relatedTopics} label="Related domains" />
      ) : null}
      {relatedGaps.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          <li>
            <p className="text-xs font-medium text-muted-foreground">Related gap</p>
          </li>
          {relatedGaps.map((gap) => (
            <li key={gap} className="text-sm text-muted-foreground">
              {gap}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TopicItem({
  id,
  topic,
  improvementQuestions,
}: {
  id: string;
  topic: TopicPerformance;
  improvementQuestions: ImprovementQuestion[];
}) {
  const related = improvementQuestions.filter((item) => item.topic === topic.topic);

  return (
    <ExpandableItem
      id={id}
      title={topic.topic}
      meta={
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{topic.questionsAsked} q</Badge>
          <span className="text-sm text-muted-foreground tabular-nums">{topic.score}</span>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Progress value={topic.score} aria-label={`${topic.topic} score`}>
          <div className="flex items-center justify-between gap-2">
            <ProgressLabel>Score</ProgressLabel>
            <ProgressValue />
          </div>
        </Progress>
        <p className="text-sm text-muted-foreground">{topic.summary}</p>
        {related.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Questions to revisit</p>
            {related.map((item) => (
              <div key={item.question} className="flex flex-col gap-1 rounded-lg border p-2.5">
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
        ) : null}
      </div>
    </ExpandableItem>
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
