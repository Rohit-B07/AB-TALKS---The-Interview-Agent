import { buildFirstQuestionPrompt } from "@/prompts/first-question";
import type { Candidate, CurriculumDay, InterviewQuestion } from "@/server/types";

export interface GenerateFirstQuestionInput {
  candidate: Candidate;
  curriculum: CurriculumDay[];
  lastCompletedDay: CurriculumDay | null;
}

/**
 * Boundary between the interview flow and the AI layer.
 *
 * Phase 1 ships a deterministic mock engine. Phase 2 can provide an
 * LLM-backed implementation (see server/engine/index.ts and server/ai/)
 * without touching the services that consume it.
 */
export interface InterviewEngine {
  generateFirstQuestion(input: GenerateFirstQuestionInput): Promise<InterviewQuestion>;
}

/**
 * Deterministic mock engine.
 *
 * Builds the opening question from the candidate's most recent completed
 * curriculum day (falling back to day 1 when the candidate has no completed
 * days). Output is fully mocked — no LLM call is made yet.
 */
export class MockInterviewEngine implements InterviewEngine {
  async generateFirstQuestion({
    candidate,
    curriculum,
    lastCompletedDay,
  }: GenerateFirstQuestionInput): Promise<InterviewQuestion> {
    const day =
      lastCompletedDay ??
      [...curriculum].sort((a, b) => a.day - b.day)[0] ??
      this.fallbackDay();

    const { system } = buildFirstQuestionPrompt({ candidate, day });
    const prompt = this.buildQuestionText(candidate, day);

    return {
      id: `q-${candidate.id}-${day.id}`,
      type: "open-ended",
      prompt,
      context: system,
      difficulty: day.difficulty,
      relatedDayIds: [day.id],
      createdAt: new Date().toISOString(),
    };
  }

  private buildQuestionText(candidate: Candidate, day: CurriculumDay): string {
    const objective = day.learningObjectives[day.learningObjectives.length - 1];
    return [
      `Welcome, ${candidate.name}. I can see you've completed the ${day.module} module — ${day.topic} (Day ${day.day}).`,
      `Let's start there. Consider the learning objective "${objective}" and walk me through how you would approach it, step by step.`,
      `Mention the tools you used along the way: ${day.tools.join(", ")}.`,
    ].join(" ");
  }

  private fallbackDay(): CurriculumDay {
    return {
      id: "day-1",
      day: 1,
      module: "Foundations",
      topic: "AI Fundamentals & Python Setup",
      learningObjectives: ["Explain what artificial intelligence is"],
      tools: ["Python", "Jupyter Notebooks"],
      difficulty: "beginner",
    };
  }
}
