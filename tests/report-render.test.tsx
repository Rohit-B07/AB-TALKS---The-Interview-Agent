import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) => (
    <a href={typeof href === "string" ? href : "/"} {...rest}>
      {children}
    </a>
  ),
}));

import { FinalReport } from "@/components/report/final-report";
import { ReportError, ReportUnavailable } from "@/components/report/report-states";
import type { Candidate, FinalEvaluation, InterviewMode } from "@/server/types";

function makeCandidate(mode: InterviewMode): Candidate {
  return {
    id: "candidate-1",
    name: mode === "dsa_friendly" ? "Rohit" : "Vatsal",
    defaultMode: mode,
    completedDays: ["day-1"],
    skippedDays: [],
    attempts: 1,
    strengths: ["Arrays"],
    weaknesses: [],
    learningSignals: [],
  };
}

function makeEvaluation(
  mode: InterviewMode,
  overrides: Partial<FinalEvaluation> = {}
): FinalEvaluation {
  return {
    sessionId: "sess-report",
    mode,
    createdAt: "2026-08-08T12:00:00.000Z",
    overallScore: 78,
    readiness: "intermediate",
    summary: "A well-reasoned interview overall, with clear explanations.",
    topicPerformance: [
      {
        topic: "Arrays & Loops",
        score: 80,
        questionsAsked: 4,
        summary: "Confident traversal and loop reasoning.",
      },
      {
        topic: "Strings",
        score: 60,
        questionsAsked: 2,
        summary: "Needs more practice with edge cases.",
      },
    ],
    strengths: ["Clear step-by-step reasoning", "Good edge-case awareness"],
    knowledgeGaps: ["Advanced algorithms"],
    improvementQuestions: [
      {
        question: "Anagram check",
        topic: "Strings",
        issue: "Did not mention hash maps",
        improvement: "Use a frequency counter.",
      },
    ],
    difficultyProgression: [
      { difficulty: "beginner", performance: "strong", questionsAsked: 5 },
      { difficulty: "intermediate", performance: "developing", questionsAsked: 2 },
      { difficulty: "advanced", performance: "not-reached", questionsAsked: 0 },
    ],
    adaptiveBehavior: "The interviewer re-explained concepts after the candidate hesitated.",
    recommendations: ["Practice two-pointer problems daily.", "Review hash maps."],
    ...overrides,
  };
}

describe("FinalReport", () => {
  it("renders every report section without throwing", () => {
    const html = renderToString(
      <FinalReport
        candidate={makeCandidate("dsa_friendly")}
        mode="dsa_friendly"
        evaluation={makeEvaluation("dsa_friendly")}
      />
    );

    expect(html).toContain("Rohit");
    expect(html).toContain("78");
    expect(html).toContain("Arrays &amp; Loops");
    expect(html).toContain("Clear step-by-step reasoning");
    expect(html).toContain("Advanced algorithms");
    expect(html).toContain("Anagram check");
    expect(html).toContain("Practice two-pointer problems daily.");
    expect(html).toContain("Intermediate");
  });

  it("renders progress bars without context errors", () => {
    const evaluation = makeEvaluation("dsa_friendly", {
      topicPerformance: [
        { topic: "Arrays & Loops", score: 80, questionsAsked: 4, summary: "x" },
      ],
    });
    const html = renderToString(
      <FinalReport
        candidate={makeCandidate("dsa_friendly")}
        mode="dsa_friendly"
        evaluation={evaluation}
      />
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain("Overall score");
  });

  it("uses mode-specific report language", () => {
    const dsaHtml = renderToString(
      <FinalReport
        candidate={makeCandidate("dsa_friendly")}
        mode="dsa_friendly"
        evaluation={makeEvaluation("dsa_friendly")}
      />
    );
    const aiHtml = renderToString(
      <FinalReport
        candidate={makeCandidate("ai_engineering")}
        mode="ai_engineering"
        evaluation={makeEvaluation("ai_engineering")}
      />
    );

    expect(dsaHtml).toContain("problem solving");
    expect(aiHtml).toContain("AI engineering");
    expect(dsaHtml).not.toContain("AI engineering");
  });

  it("handles missing evaluation data safely", () => {
    const evaluation = makeEvaluation("dsa_friendly", {
      topicPerformance: [],
      strengths: [],
      knowledgeGaps: [],
      improvementQuestions: [],
      recommendations: [],
    });
    const html = renderToString(
      <FinalReport
        candidate={makeCandidate("dsa_friendly")}
        mode="dsa_friendly"
        evaluation={evaluation}
      />
    );

    expect(html).toContain("No topic data is available for this report");
    expect(html).toContain("No standout strengths were recorded");
    expect(html).toContain("No specific questions needed improvement");
  });
});

describe("report states", () => {
  it("shows a friendly unavailable state for an incomplete interview", () => {
    const html = renderToString(<ReportUnavailable sessionId="sess-incomplete" />);

    expect(html).toContain("Report not ready yet");
    expect(html).toContain("Back to interview");
    expect(html).toContain("sess-incomplete");
  });

  it("shows a friendly error state with a retry link", () => {
    const html = renderToString(<ReportError sessionId="sess-error" />);

    expect(html).toContain("could not load your report");
    expect(html).toContain("Try again");
    expect(html).toContain("sess-error");
  });
});
