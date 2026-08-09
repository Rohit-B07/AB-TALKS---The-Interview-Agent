import type {
  FinalEvaluation,
  InterviewSession,
  TopicPerformance,
} from "@/server/types";
import type { FinalEvaluationNarrative } from "@/server/ai/schemas";
import type { EvaluationEvidence } from "@/server/ai/final-evaluation/aggregate";

/**
 * Deterministic narrative text for the final evaluation. Used whenever Gemini
 * is unavailable or returns invalid output, so the report is ALWAYS available.
 * The language adapts to the interview mode and is grounded in the structured
 * evidence (never generic praise).
 */

const READINESS_ADJECTIVE: Record<EvaluationEvidence["readiness"], string> = {
  strong: "strong",
  intermediate: "solid",
  developing: "developing",
  beginner: "early-stage",
};

/** 2-4 sentence overall summary built purely from the evidence. */
/**
 * 2-4 sentence overall summary built purely from the evidence.
 *
 * Positive phrasing is gated on actual scores: "strongest in X ... with
 * consistent understanding" is only used when the best topic is genuinely
 * strong (>= 75). Minimum-level performance is described as such, never with
 * misleading praise.
 */
export function summaryFallback(evidence: EvaluationEvidence): string {
  const name = evidence.candidate.name.split(" ")[0] || evidence.candidate.name;
  const sentences: string[] = [];

  sentences.push(
    `${name} demonstrated ${READINESS_ADJECTIVE[evidence.readiness]} overall performance, earning a score of ${evidence.overallScore}/100.`
  );

  const best = [...evidence.topics].sort((a, b) => b.score - a.score)[0];
  const worst = [...evidence.topics].sort((a, b) => a.score - b.score)[0];

  if (evidence.overallScore < 50) {
    // Minimum-level performance: unambiguous, negative framing.
    sentences.push(
      best
        ? `Performance was at or below the minimum level: even the best topic (${best.topic}, ${best.score}/100) was below passing, so substantial improvement is needed across all topics.`
        : "Performance was consistently below the passing level, and substantial improvement is needed."
    );
  } else if (best && best.score >= 75) {
    sentences.push(
      `They were strongest in ${best.topic}, where they answered ${best.questionsAsked} question${best.questionsAsked === 1 ? "" : "s"} with consistent understanding.`
    );
  } else if (best) {
    sentences.push(
      `The area with the highest score was ${best.topic} (${best.score}/100), which still needs further practice.`
    );
  }

  if (worst && best && worst.score < best.score - 10) {
    sentences.push(`${worst.topic} showed clear room for improvement.`);
  }

  if (evidence.idkCount > 0) {
    sentences.push(
      evidence.overallScore < 50
        ? "They repeatedly indicated they did not know the answer, and struggled to recover even with simpler follow-ups."
        : "They needed support when facing unfamiliar concepts, and generally recovered after a simpler follow-up."
    );
  } else if (evidence.secondHalfAvg > evidence.firstHalfAvg + 0.3) {
    sentences.push("Performance improved as the interview progressed.");
  } else if (evidence.secondHalfAvg < evidence.firstHalfAvg - 0.3) {
    sentences.push("Performance dipped as the questions became harder.");
  }

  return sentences.slice(0, 4).join(" ");
}

/** Short per-topic summary for the fallback path. */
export function topicSummaryFallback(topic: string, score: number, questionsAsked: number): string {
  const count = `${questionsAsked} question${questionsAsked === 1 ? "" : "s"}`;
  if (score >= 80) return `Strong grasp of ${topic} — consistent, well-explained answers across ${count}.`;
  if (score >= 65) return `Solid, developing understanding of ${topic} across ${count}.`;
  if (score >= 50) return `Partial understanding of ${topic} across ${count}; some gaps remain.`;
  return `Struggled with ${topic} across ${count}; worth reviewing the fundamentals.`;
}

/** Explains how the candidate responded to the adaptive interview. */
export function adaptiveBehaviorFallback(evidence: EvaluationEvidence): string {
  const sentences: string[] = [];

  if (evidence.hintCount > 0) {
    sentences.push(
      `You were offered hints or simpler reframings on ${evidence.hintCount} question${evidence.hintCount === 1 ? "" : "s"}, and you were usually able to continue from there.`
    );
  }
  if (evidence.idkCount > 0) {
    sentences.push(
      `You indicated uncertainty on ${evidence.idkCount} question${evidence.idkCount === 1 ? "" : "s"}. The interviewer re-explained the concept and followed up with a simpler verification question, and you generally recovered after that support.`
    );
  }

  const shift = evidence.secondHalfAvg - evidence.firstHalfAvg;
  if (shift >= 0.5) {
    sentences.push("Your answers grew stronger as the interview went on, which suggests the adaptation and support were working.");
  } else if (shift <= -0.5) {
    sentences.push("Your answers became less detailed as the difficulty increased, especially in the later questions.");
  }

  const advanced = evidence.progression.find((entry) => entry.difficulty === "advanced");
  const intermediate = evidence.progression.find((entry) => entry.difficulty === "intermediate");

  if (advanced && advanced.performance === "strong") {
    sentences.push("You maintained strong performance as the difficulty increased.");
  } else if (advanced && advanced.performance === "not-reached") {
    sentences.push(
      evidence.mode === "dsa_friendly"
        ? "Advanced questions were not reached in this session, which is not penalized in DSA Friendly mode."
        : "Advanced material was only partially explored by the end of the interview."
    );
  } else if (intermediate && intermediate.performance === "weak") {
    sentences.push("Moving from beginner to intermediate material was where you hit the most friction.");
  }

  if (sentences.length === 0) {
    sentences.push("The interview stayed within your demonstrated comfort zone and the questions adapted to keep pace with your answers.");
  }

  return sentences.slice(0, 3).join(" ");
}

/** 3-5 specific, actionable next steps derived from weak topics and behavior. */
export function recommendationsFallback(evidence: EvaluationEvidence): string[] {
  const recommendations: string[] = [];
  const isDsa = evidence.mode === "dsa_friendly";

  const weakTopics = evidence.topics
    .filter((topic) => topic.score < 70)
    .sort((a, b) => a.score - b.score);

  for (const topic of weakTopics.slice(0, 3)) {
    recommendations.push(
      isDsa
        ? `Practice ${topic.topic.toLowerCase()} problems, starting with simple loop-based examples and building up.`
        : `Strengthen ${topic.topic} by working through a concrete end-to-end example.`
    );
  }

  if (evidence.idkCount >= 2) {
    recommendations.push(
      isDsa
        ? "When a problem feels unfamiliar, restate it in your own words and sketch a tiny example before giving up."
        : "When you are unsure, practice framing what you do know about the problem before asking for a hint."
    );
  }
  if (evidence.briefAnswerCount >= 3) {
    recommendations.push("Practice explaining your reasoning out loud, step by step, even for simple questions.");
  }
  if (recommendations.length < 3) {
    recommendations.push(
      isDsa
        ? "Review basic time complexity for common loops (O(n) and O(n^2)) and practice explaining why an approach is efficient."
        : "Review model-evaluation fundamentals: train/test splits, metrics, and how to tell overfitting from underfitting."
    );
  }
  if (recommendations.length < 3) {
    recommendations.push(
      isDsa
        ? "Do one small coding exercise per day and explain your approach before you start coding."
        : "Practice walking through a system or pipeline design out loud, naming each component and its trade-off."
    );
  }

  const unique: string[] = [];
  for (const recommendation of recommendations.slice(0, 5)) {
    const key = recommendation.toLowerCase();
    if (!unique.some((existing) => existing.toLowerCase() === key)) {
      unique.push(recommendation);
    }
  }
  return unique;
}

/** Merges deterministic scoring with optional Gemini narrative into the report. */
export function assembleFinalEvaluation(
  session: InterviewSession,
  evidence: EvaluationEvidence,
  narrative: FinalEvaluationNarrative | null
): FinalEvaluation {
  const topicSummaryMap = new Map<string, string>();
  for (const item of narrative?.topicSummaries ?? []) {
    topicSummaryMap.set(item.topic.trim().toLowerCase(), item.summary.trim());
  }

  const topicPerformance: TopicPerformance[] = evidence.topics.map((topic) => ({
    topic: topic.topic,
    score: topic.score,
    questionsAsked: topic.questionsAsked,
    // Below 50 the deterministic summary is always used so a failing topic
    // is never described with positive LLM phrasing.
    summary:
      topic.score < 50
        ? topicSummaryFallback(topic.topic, topic.score, topic.questionsAsked)
        : topicSummaryMap.get(topic.topic.trim().toLowerCase()) ??
          topicSummaryFallback(topic.topic, topic.score, topic.questionsAsked),
  }));

  return {
    sessionId: session.id,
    mode: session.mode,
    createdAt: new Date().toISOString(),
    overallScore: evidence.overallScore,
    readiness: evidence.readiness,
    // A minimum-level overall score is always described with the deterministic
    // negative summary; Gemini narrative is never allowed to soften it.
    summary:
      evidence.overallScore < 50
        ? summaryFallback(evidence)
        : narrative?.summary.trim() || summaryFallback(evidence),
    topicPerformance,
    strengths: evidence.strengths,
    knowledgeGaps: evidence.knowledgeGaps,
    improvementQuestions: evidence.improvementQuestions,
    difficultyProgression: evidence.progression,
    adaptiveBehavior: narrative?.adaptiveBehavior.trim() || adaptiveBehaviorFallback(evidence),
    recommendations: narrative?.recommendations ?? recommendationsFallback(evidence),
  };
}
