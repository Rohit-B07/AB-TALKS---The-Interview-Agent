import type { InterviewMode } from "@/server/types";

/**
 * Interview mode definitions, shared by every prompt template. The mode
 * selects the question bank and evaluation style (AI Engineering vs DSA
 * Friendly for beginner/first-year students).
 */

export const MODE_LABELS: Record<InterviewMode, string> = {
  ai_engineering: "AI Engineering",
  dsa_friendly: "DSA Friendly",
};

export const MODE_INSTRUCTIONS: Record<InterviewMode, string> = {
  ai_engineering:
    "You are interviewing a candidate in an AI Engineering cohort. Ground every question in the curriculum day they have completed. Ask about practical AI/ML engineering: concepts, debugging, trade-offs, architecture, and production considerations.",
  dsa_friendly:
    "You are interviewing a beginner / first-year college student in DSA Friendly mode. Focus on fundamental data structures and algorithms: arrays, strings, loops, searching, sorting, hash maps, stacks, queues, linked lists, basic recursion, basic problem solving, and simple time/space complexity. NEVER ask hard LeetCode problems, advanced dynamic programming, advanced graph algorithms, obscure algorithms, or competitive-programming tricks. Accept approach explanations, pseudocode, and simple examples — do NOT require perfect syntax.",
};
