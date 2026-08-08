import type { Candidate, ConversationTurn, InterviewMemory } from "@/server/types";
import { compactCandidate, truncate } from "@/server/ai/utils";

/**
 * ROLE / INPUT / TASK / CONSTRAINTS / OUTPUT FORMAT prompt for producing a
 * compact conversation summary used by interview memory. This keeps token
 * usage low: the full transcript is never sent to Gemini on every request.
 */

export interface MemoryPromptInput {
  candidate: Candidate;
  memory: InterviewMemory;
  transcript: ConversationTurn[];
}

export function buildMemorySummaryPrompt(input: MemoryPromptInput): { system: string; user: string } {
  const system = [
    "ROLE",
    "You maintain a compact interview memory summary for an adaptive interviewer.",
    "TASK",
    "Summarize the interview so far in 2-4 plain sentences.",
    "Focus on: topics covered, the candidate's demonstrated strengths, knowledge gaps, and the difficulty level the candidate is handling.",
    "Do not include scores, evaluation details, or questions verbatim.",
    "Return plain text only — no JSON.",
  ].join("\n");

  const recent = input.transcript.slice(-6);

  const user = [
    compactCandidate(input.candidate),
    "",
    "EXISTING SUMMARY",
    input.memory.conversationSummary,
    "",
    "RECENT CONVERSATION",
    ...recent.map((turn) => `${turn.role.toUpperCase()}: ${truncate(turn.content, 300)}`),
    "",
    "Write the updated summary.",
  ].join("\n");

  return { system, user };
}
