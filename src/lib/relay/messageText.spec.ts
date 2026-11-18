import { describe, expect, it } from "vitest";
import { joinTextParts, messageText, TEXT_PART_SEPARATOR } from "./messageText";
import type { UIMessage } from "ai";

const toolPart = {
  type: "tool-test" as const,
  toolCallId: "1",
  state: "input-available" as const,
  input: {},
};

describe("joinTextParts", () => {
  it("joins multiple text parts with separator", () => {
    const parts = [
      { type: "text" as const, text: "Hello" },
      { type: "text" as const, text: "World" },
    ];

    expect(joinTextParts(parts)).toBe("Hello\n\nWorld");
  });

  it("skips non-text parts", () => {
    const parts = [
      { type: "text" as const, text: "First" },
      toolPart,
      { type: "text" as const, text: "Second" },
    ];

    expect(joinTextParts(parts)).toBe("First\n\nSecond");
  });

  it("skips text parts with empty text", () => {
    const parts = [
      { type: "text" as const, text: "First" },
      { type: "text" as const, text: "" },
      { type: "text" as const, text: "Second" },
    ];

    expect(joinTextParts(parts)).toBe("First\n\nSecond");
  });

  it("skips text parts without text property", () => {
    const parts = [
      { type: "text" as const, text: "First" },
      { type: "text" as const } as unknown as UIMessage["parts"][number],
      { type: "text" as const, text: "Third" },
    ];

    expect(joinTextParts(parts)).toBe("First\n\nThird");
  });

  it("returns empty string for empty array", () => {
    expect(joinTextParts([])).toBe("");
  });

  it("returns empty string when no text parts", () => {
    const parts = [
      toolPart,
    ];

    expect(joinTextParts(parts)).toBe("");
  });

  it("returns single text part as-is without separator", () => {
    const parts = [{ type: "text" as const, text: "Only one" }];

    expect(joinTextParts(parts)).toBe("Only one");
  });

  it("preserves text with whitespace and newlines", () => {
    const parts = [
      { type: "text" as const, text: "Line 1\nLine 2" },
      { type: "text" as const, text: "Another\n  paragraph" },
    ];

    expect(joinTextParts(parts)).toBe(
      "Line 1\nLine 2\n\nAnother\n  paragraph"
    );
  });
});

describe("messageText", () => {
  it("returns joined text from message parts", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        { type: "text" as const, text: "Hello" },
        { type: "text" as const, text: "World" },
      ],
    };

    expect(messageText(message)).toBe("Hello\n\nWorld");
  });

  it("delegates to joinTextParts", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        { type: "text" as const, text: "Part 1" },
        toolPart,
        { type: "text" as const, text: "Part 2" },
      ],
    };

    expect(messageText(message)).toBe("Part 1\n\nPart 2");
  });

  it("returns empty string when message has no text parts", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [],
    };

    expect(messageText(message)).toBe("");
  });
});

describe("TEXT_PART_SEPARATOR", () => {
  it("is a double newline for paragraph separation", () => {
    expect(TEXT_PART_SEPARATOR).toBe("\n\n");
  });
});
