import { describe, expect, it } from "vitest";
import { GeminiInterviewEngine } from "@/server/engine";
import { InterviewService } from "@/server/services/interview.service";
import { MemoryManager } from "@/server/ai/MemoryManager";
import { createFallbackPlan, createFallbackQuestion, evaluateFallbackAnswer } from "@/server/ai/fallback";
import type { AiServiceContainer } from "@/server/ai";
import type {
  EvaluateAnswerInput,
  GenerateQuestionInput,
  PlanNextInput,
} from "@/server/ai";

/**
 * Deterministic stand-ins for the AI services so the full orchestration
 * (engine + service + session store + memory) is exercised without a network.
 * They reuse the same adaptive fallback logic a real Gemini outage would.
 */
class FakePlanner {
  async planNext(input: PlanNextInput) {
    return { decision: createFallbackPlan(input), source: "ai" as const };
  }
}

class FakeQuestionGenerator {
  async generateQuestion(input: GenerateQuestionInput) {
    const question = createFallbackQuestion({
      candidate: input.candidate,
      day: input.day,
      plan: input.plan,
      memory: input.memory,
      previousAnswer: input.previousAnswer,
      personality: input.personality,
    });
    return { question, source: "ai" as const };
  }
}

class FakeEvaluator {
  async evaluateAnswer(input: EvaluateAnswerInput) {
    return {
      evaluation: { questionId: input.question.id, ...evaluateFallbackAnswer(input) },
      source: "ai" as const,
    };
  }
}

function makeAdaptiveService(): InterviewService {
  const container: AiServiceContainer = {
    planner: new FakePlanner(),
    questionGenerator: new FakeQuestionGenerator(),
    answerEvaluator: new FakeEvaluator(),
    memoryManager: new MemoryManager(),
  };
  return new InterviewService(new GeminiInterviewEngine(container));
}

const STRONG_ANSWERS = [
  "Artificial intelligence is different from traditional programming because we do not hand-code every rule; instead a model learns patterns from data. I would install Python, set up a local development environment, and write a first script that uses variables, conditionals, and loops. I would keep everything in a Jupyter notebook and use the VS Code interface to inspect results as I iterate.",
  "I would set up a clean Python environment and write scripts using variables, conditionals, and loops, then run the first script in a Jupyter notebook. I would track the whole project through the VS Code interface, adding a development checklist so the environment stays reproducible and the code remains easy to navigate and debug.",
  "I would build line, bar, and histogram charts with matplotlib and seaborn to explore the dataset. I would compute the mean, median, variance, and standard deviation, then recognize normal distributions, skew, and outliers in the data. Finally I would communicate insights from each chart clearly so the team can act on them.",
  "I would use cross-validation to estimate generalization performance and explain the bias-variance tradeoff, including underfitting versus overfitting. I would tune hyperparameters with grid search, then read confusion matrices and ROC curves to judge the model. This gives me a solid picture of where the model is struggling before I change anything.",
  "To go deeper, I would inspect the bias-variance tradeoff directly: cross-validation reports generalization performance, while the confusion matrix and ROC curves expose failure modes. I would run a grid search over hyperparameters and measure whether overfitting or underfitting dominates, then tune the model again and re-validate.",
  "I would tokenize the text and build a vocabulary, then represent words with dense embeddings instead of sparse one-hot vectors. I would explain how word2vec learns word representations from context, and finally train a text classification model on a sentiment dataset while measuring accuracy on a held-out split.",
  "I would design effective prompts with clear instructions and few-shot examples, and use chain-of-thought prompting to improve reasoning on hard steps. I would constrain the model output to valid JSON and enums so the rest of the system stays safe, and handle prompt injection and malformed output defensively.",
  "To make that production-ready, I would validate every model output against a JSON schema and enums before use, log prompt injection attempts, and retry on malformed output. I would keep the instructions and few-shot examples versioned so reasoning improvements are measurable across model versions.",
];

const WEAK_ANSWERS = [
  "not sure",
  "idk",
  "maybe",
  "no idea",
  "guess",
  "hmm",
  "unsure",
  "pass",
];

async function runInterview(service: InterviewService, candidateId: string, answers: string[]) {
  const { sessionId } = await service.startInterview(candidateId);
  let state;
  for (const answer of answers) {
    state = await service.submitAnswer(sessionId, answer);
  }
  const session = await service.getSession(sessionId);
  return { sessionId, state, session };
}

describe("adaptive interview integration", () => {
  it("runs the full strong-candidate flow: question -> answer -> evaluation -> memory -> next question", async () => {
    const service = makeAdaptiveService();
    const { session } = await runInterview(service, "candidate-vatsal", STRONG_ANSWERS);

    expect(session.status).toBe("completed");
    expect(session.questionsAsked).toBe(8);
    expect(session.transcript.filter((turn) => turn.role === "assistant")).toHaveLength(8);
    expect(session.transcript.filter((turn) => turn.role === "candidate")).toHaveLength(8);
    expect(session.evaluations).toHaveLength(8);
    expect(session.memory.questionNumber).toBe(8);
  });

  it("completes only after 8 questions AND at least 4 distinct curriculum days", async () => {
    const service = makeAdaptiveService();
    const { sessionId } = await service.startInterview("candidate-vatsal");

    for (let i = 0; i < 7; i += 1) {
      const state = await service.submitAnswer(sessionId, STRONG_ANSWERS[i]);
      expect(state.interviewComplete).toBe(false);
    }

    const final = await service.submitAnswer(sessionId, STRONG_ANSWERS[7]);
    expect(final.interviewComplete).toBe(true);
    expect(final.questionsAsked).toBe(8);
    expect(final.uniqueCurriculumDays).toBeGreaterThanOrEqual(4);
    expect(final.progress).toBe(100);
  });

  it("adapts to a strong candidate with follow-ups and difficulty increase", async () => {
    const service = makeAdaptiveService();
    const { session } = await runInterview(service, "candidate-vatsal", STRONG_ANSWERS);

    const hasFollowUp = session.transcript.some(
      (turn) => turn.role === "assistant" && turn.content.includes("You mentioned")
    );
    expect(hasFollowUp).toBe(true);

    const harderCount = session.evaluations.filter((e) => e.difficultyRecommendation === "harder").length;
    expect(harderCount).toBeGreaterThan(0);
    expect(session.memory.difficulty).toBe("advanced");
  });

  it("adapts to a weak candidate with clarifications and a lower difficulty", async () => {
    const service = makeAdaptiveService();
    const { session } = await runInterview(service, "candidate-rohit", WEAK_ANSWERS);

    expect(session.status).toBe("completed");
    const easierCount = session.evaluations.filter((e) => e.difficultyRecommendation === "easier").length;
    expect(easierCount).toBeGreaterThan(0);
    expect(session.memory.difficulty).toBe("beginner");
  });

  it("keeps the interview persistent and completes across separate calls", async () => {
    const service = makeAdaptiveService();
    const { sessionId } = await service.startInterview("candidate-varun");
    const afterOne = await service.submitAnswer(sessionId, STRONG_ANSWERS[0]);
    expect(afterOne.currentQuestionNumber).toBe(2);

    const restored = await service.getSession(sessionId);
    expect(restored.transcript.length).toBe(3);
    expect(restored.currentQuestionNumber).toBe(2);
  });

  it("refuses to answer a completed session with a brand new question (idempotent)", async () => {
    const service = makeAdaptiveService();
    const { sessionId } = await service.startInterview("candidate-vatsal");
    for (const answer of STRONG_ANSWERS) {
      await service.submitAnswer(sessionId, answer);
    }
    const state = await service.submitAnswer(sessionId, "extra answer after completion");
    expect(state.interviewComplete).toBe(true);
    expect(state.questionsAsked).toBe(8);
  });
});
