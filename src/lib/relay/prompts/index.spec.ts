import { describe, expect, it } from "vitest";
import { ACTION_PROMPTS, type ActionName } from "./index";

const BANNED = /deepseek|openai|anthropic|claude|gpt/i;

describe("ACTION_PROMPTS", () => {
  it("exports all eight action prompts", () => {
    expect(Object.keys(ACTION_PROMPTS).sort()).toEqual([
      "build-request",
      "explain-error",
      "generate-body",
      "suggest-assertions",
      "suggest-headers",
      "suggest-jsonpath",
      "summarize-response",
      "write-script",
    ]);
  });

  it.each(Object.keys(ACTION_PROMPTS) as ActionName[])(
    "%s renders with empty input and names no vendor",
    (name) => {
      const prompt = (ACTION_PROMPTS[name] as (i: object) => string)({});
      expect(prompt.length).toBeGreaterThan(40);
      expect(prompt).not.toMatch(BANNED);
    },
  );

  it("interpolates payload fields", () => {
    expect(
      ACTION_PROMPTS["suggest-assertions"]({
        status: 404,
        headers: { a: "b" },
        bodySnippet: "nope",
      }),
    ).toContain('Status: 404\nHeaders: {"a":"b"}\nBody (first 2000 chars): nope');
    expect(ACTION_PROMPTS["write-script"]({ scriptType: "pre" })).toContain(
      "pre-request",
    );
    expect(ACTION_PROMPTS["write-script"]({ scriptType: "post" })).toContain(
      "post-response",
    );
    expect(ACTION_PROMPTS["generate-body"]({})).toContain("json request body");
    expect(ACTION_PROMPTS["suggest-headers"]({ existingKeys: ["x"] })).toContain(
      '["x"]',
    );
  });
});
