import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/ai/gemini", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/lib/ai/gemini";
import {
  extractJsonObject,
  parseJsonLoose,
  requestStructuredJSON,
  validateStructured,
} from "@/server/ai/structured";

const schema = z.object({
  action: z.enum(["follow_up", "new_topic"]),
  curriculumDay: z.string().min(1),
});

const mockedGenerate = vi.mocked(generateContent);

describe("structured JSON parsing", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("extracts a JSON object from a fenced response", () => {
    const text = "```json\n{\"action\":\"new_topic\"}\n```";
    expect(extractJsonObject(text)).toBe('{"action":"new_topic"}');
  });

  it("returns null when no JSON object is present", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });

  it("parseJsonLoose parses a bare object", () => {
    expect(parseJsonLoose('{"action":"new_topic"}')).toEqual({ action: "new_topic" });
  });

  it("validateStructured accepts schema-valid JSON", () => {
    const result = validateStructured('{"action":"new_topic","curriculumDay":"day-7"}', schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.curriculumDay).toBe("day-7");
  });

  it("validateStructured rejects malformed JSON", () => {
    const result = validateStructured("{action: new_topic", schema);
    expect(result.ok).toBe(false);
  });

  it("validateStructured rejects schema-invalid JSON", () => {
    const result = validateStructured('{"action":"bogus"}', schema);
    expect(result.ok).toBe(false);
  });
});

describe("requestStructuredJSON recovery", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("returns parsed data on a valid first response", async () => {
    mockedGenerate.mockResolvedValueOnce('{"action":"new_topic","curriculumDay":"day-5"}');
    const data = await requestStructuredJSON({
      system: "sys",
      user: "usr",
      schema,
      fallback: () => ({ action: "new_topic" as const, curriculumDay: "day-1" }),
    });
    expect(data.curriculumDay).toBe("day-5");
    expect(mockedGenerate).toHaveBeenCalledTimes(1);
  });

  it("retries once with a correction prompt when the first response is malformed", async () => {
    mockedGenerate
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce('{"action":"follow_up","curriculumDay":"day-7"}');
    const data = await requestStructuredJSON({
      system: "sys",
      user: "usr",
      schema,
      fallback: () => ({ action: "new_topic" as const, curriculumDay: "day-1" }),
    });
    expect(data.action).toBe("follow_up");
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });

  it("uses the safe fallback when both attempts fail validation", async () => {
    mockedGenerate.mockResolvedValue("still broken");
    const fallback = vi.fn(() => ({ action: "new_topic" as const, curriculumDay: "day-1" }));
    const data = await requestStructuredJSON({ system: "sys", user: "usr", schema, fallback });
    expect(data).toEqual({ action: "new_topic", curriculumDay: "day-1" });
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
