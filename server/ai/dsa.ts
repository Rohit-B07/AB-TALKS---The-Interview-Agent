import type { Difficulty } from "@/server/types";
import type { PlannerQuestionType } from "@/server/ai/schemas";

/**
 * DSA Friendly question bank for beginner / first-year college students.
 *
 * Each topic carries question scaffolds per difficulty, a hint, and a short
 * "reteach" explanation. The fallback engine uses these to keep questions
 * gradual, supportive, and firmly within fundamentals (no hard LeetCode,
 * advanced DP, or advanced graph material).
 */

export interface DsaTopic {
  id: string;
  name: string;
  baseDifficulty: Difficulty;
  prompts: Record<Difficulty, string[]>;
  hint: string;
  explanation: string;
  keywords: string[];
}

export const DSA_TOPICS: DsaTopic[] = [
  {
    id: "arrays",
    name: "Arrays & Loops",
    baseDifficulty: "beginner",
    prompts: {
      beginner: [
        "Given an array of numbers, how would you find the largest number?",
        "Given an array of numbers, how would you compute the sum of all the elements?",
        "Given an array, how would you count how many elements are greater than a given value?",
      ],
      intermediate: [
        "How would you find the second largest number in an array?",
        "How would you check whether an array contains a specific value, and describe the steps?",
        "How would you reverse an array in place, step by step?",
      ],
      advanced: [
        "Given two sorted arrays, how would you merge them into one sorted array?",
        "How would you rotate an array to the right by k steps?",
        "Given an array, how would you find the contiguous subarray with the largest sum?",
      ],
    },
    hint: "Keep track of the best answer you have seen so far as you loop, and update it when you find something better.",
    explanation:
      "Finding the largest number is just comparing elements one by one and remembering the biggest one you have seen so far.",
    keywords: [
      "array",
      "loop",
      "iterate",
      "largest",
      "compare",
      "sum",
      "index",
      "element",
      "track",
      "max",
      "min",
    ],
  },
  {
    id: "strings",
    name: "Strings",
    baseDifficulty: "beginner",
    prompts: {
      beginner: [
        "Given a string, how would you count how many times a letter appears in it?",
        "How would you reverse the characters in a string?",
        "How would you check whether a word reads the same forwards and backwards?",
      ],
      intermediate: [
        "How would you check whether one string is an anagram of another?",
        "How would you find the first character in a string that never repeats?",
        "How would you count the number of words in a sentence?",
      ],
      advanced: [
        "How would you find the longest stretch of a string with no repeating characters?",
        "How would you check whether two strings are the same after at most one edit?",
      ],
    },
    hint: "Process the string character by character and keep a small counter of what you have seen.",
    explanation:
      "A string is just a sequence of characters, and most string problems are solved by looking at each character one at a time.",
    keywords: [
      "string",
      "character",
      "char",
      "letter",
      "reverse",
      "palindrome",
      "count",
      "word",
      "index",
    ],
  },
  {
    id: "searching",
    name: "Searching",
    baseDifficulty: "beginner",
    prompts: {
      beginner: [
        "Given an array of numbers, how would you find out whether a specific number is present?",
        "How would you look through an array one element at a time to find a value?",
      ],
      intermediate: [
        "If the array is already sorted, how could you search for a value faster than checking every element?",
        "How would you find the position where a new value should be inserted into a sorted array?",
      ],
      advanced: [
        "How would you use binary search to find a value, and why does it only need a few steps?",
        "How would you find a peak element in an array using binary search?",
      ],
    },
    hint: "If the list is sorted, you can compare to the middle and throw away half the options in one step.",
    explanation:
      "Searching means checking whether a value exists; when the list is sorted you can cut the search in half each step instead of checking everything.",
    keywords: [
      "search",
      "binary",
      "middle",
      "find",
      "sorted",
      "present",
      "compare",
      "half",
    ],
  },
  {
    id: "sorting",
    name: "Sorting",
    baseDifficulty: "intermediate",
    prompts: {
      beginner: [
        "How would you arrange a small list of numbers from smallest to largest by hand?",
        "Explain the steps you would take to sort a handful of numbers.",
      ],
      intermediate: [
        "How does bubble sort work? Walk me through one pass over a small list.",
        "How would you merge two already-sorted lists into a single sorted list?",
      ],
      advanced: [
        "How would you sort an array with merge sort, and why is it fast on big inputs?",
        "What makes quicksort fast in practice, and when could it become slow?",
      ],
    },
    hint: "Repeatedly find the smallest remaining element and place it next in line.",
    explanation:
      "Sorting puts items in order; the simplest way is to repeatedly pick the smallest remaining item and set it aside.",
    keywords: [
      "sort",
      "order",
      "compare",
      "swap",
      "bubble",
      "merge",
      "smallest",
      "sorted",
    ],
  },
  {
    id: "hashmaps",
    name: "Hash Maps",
    baseDifficulty: "intermediate",
    prompts: {
      beginner: [
        "How would you count how many times each word appears in a list of words?",
        "How would you store someone's details so you can look them up by name quickly?",
      ],
      intermediate: [
        "How would you check whether two numbers in an array add up to a target using a hash map?",
        "How would you find the most frequently appearing element in an array?",
      ],
      advanced: [
        "How would you use a hash map to find the longest run of consecutive numbers in an array?",
      ],
    },
    hint: "A hash map lets you remember things you have already seen and look them up almost instantly.",
    explanation:
      "A hash map stores key-value pairs, so you can remember something you have seen and find it again quickly.",
    keywords: [
      "hash",
      "map",
      "dictionary",
      "key",
      "store",
      "lookup",
      "count",
      "pair",
      "remember",
    ],
  },
  {
    id: "stacks-queues",
    name: "Stacks & Queues",
    baseDifficulty: "intermediate",
    prompts: {
      beginner: [
        "What is the difference between a stack and a queue?",
        "Given a stack, how would you reverse its contents?",
      ],
      intermediate: [
        "How would you use a stack to check whether a string of parentheses is balanced?",
        "How would you build a queue using two stacks?",
      ],
      advanced: [
        "How would you use a stack to evaluate a calculation written in postfix form?",
      ],
    },
    hint: "A stack is last-in-first-out, like a pile of plates; a queue is first-in-first-out, like a line of people.",
    explanation:
      "A stack adds and removes from the top (last in, first out); a queue removes from the front (first in, first out).",
    keywords: [
      "stack",
      "queue",
      "push",
      "pop",
      "top",
      "front",
      "back",
      "parentheses",
      "balanced",
      "order",
    ],
  },
  {
    id: "linked-lists",
    name: "Linked Lists",
    baseDifficulty: "advanced",
    prompts: {
      beginner: [
        "What is a linked list, and how is it different from an array?",
        "How would you walk through a linked list from its first node to its last?",
      ],
      intermediate: [
        "How would you reverse a linked list?",
        "How would you detect whether a linked list has a cycle?",
      ],
      advanced: [
        "How would you merge two sorted linked lists into one?",
        "How would you find the middle node of a linked list in a single pass?",
      ],
    },
    hint: "Follow the next pointers one node at a time and keep track of where you are.",
    explanation:
      "A linked list is a chain of nodes where each node points to the next one in the chain.",
    keywords: [
      "node",
      "link",
      "pointer",
      "next",
      "head",
      "traverse",
      "cycle",
      "middle",
    ],
  },
  {
    id: "recursion",
    name: "Recursion & Complexity",
    baseDifficulty: "advanced",
    prompts: {
      beginner: [
        "What does it mean for a function to call itself?",
        "How would you compute a factorial using a function that calls itself?",
      ],
      intermediate: [
        "How would you compute the nth Fibonacci number using recursion?",
        "How would you add up an array using recursion instead of a loop?",
      ],
      advanced: [
        "Why can recursion become slow, and how would you avoid recomputing the same thing?",
        "How would you estimate the number of steps a recursive solution takes as the input grows?",
      ],
    },
    hint: "Break the problem into a smaller version of itself, plus one small step, until you reach a simple base case.",
    explanation:
      "Recursion solves a problem by solving a smaller version of the same problem until it reaches a simple base case.",
    keywords: [
      "recursion",
      "base",
      "case",
      "call",
      "fibonacci",
      "factorial",
      "smaller",
      "complexity",
      "steps",
    ],
  },
];

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export function difficultyRank(difficulty: Difficulty): number {
  return DIFFICULTY_RANK[difficulty];
}

export function dsaTopicById(id: string): DsaTopic | null {
  return DSA_TOPICS.find((topic) => topic.id === id) ?? null;
}

export function dsaTopicByName(name: string): DsaTopic | null {
  return DSA_TOPICS.find((topic) => topic.name === name) ?? null;
}

/** Extracts a DSA topic name from a question context string like "DSA Friendly · Arrays & Loops". */
export function dsaTopicFromContext(context: string | undefined): DsaTopic | null {
  if (!context) return null;
  const marker = "DSA Friendly · ";
  const index = context.indexOf(marker);
  if (index === -1) return null;
  return dsaTopicByName(context.slice(index + marker.length).trim());
}

const DONT_KNOW_PATTERN =
  /(i (don'?t|do not|dunno|do not) know|not sure|no idea|no clue|unsure|i (don'?t|do not) get it|i (don'?t|do not) understand|haven'?t (learned|studied|seen)|didn'?t (learn|study|understand)|idk|no idea)/i;

/**
 * True when the candidate effectively said "I don't know" (or gave an empty /
 * one-word answer). These answers are never punished: the interviewer should
 * reteach the concept briefly and ask a simpler verification question.
 */
export function isDontKnowAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  const lower = trimmed.toLowerCase();
  if (lower.length === 0) return true;
  if (lower.length <= 3) return true;
  return DONT_KNOW_PATTERN.test(lower);
}

/** Generic reasoning signals rewarded by the DSA fallback evaluator. */
export const DSA_REASONING_KEYWORDS = [
  "loop",
  "iterate",
  "compare",
  "track",
  "store",
  "return",
  "sort",
  "search",
  "find",
  "check",
  "while",
  "for",
  "if",
  "then",
  "because",
  "would",
  "first",
  "next",
  "keep",
  "count",
  "index",
  "pointer",
];

export const FALLBACK_DSA_QUESTION_TYPE: PlannerQuestionType = "conceptual";
