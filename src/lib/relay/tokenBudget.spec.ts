import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  capToolResult,
  estimateTokens,
  MAX_RESULT_ARRAY_ITEMS,
  MAX_TOOL_RESULT_CHARS,
  prepareBodyForModel,
  RESPONSE_BODY_CAP_CHARS,
  trimHistory,
  truncateHeadTail,
} from "./tokenBudget";

const message = (id: string, role: "user" | "assistant", text: string): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text }],
});

describe("estimateTokens", () => {
  it("uses four characters per token, rounding up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("truncateHeadTail", () => {
  it("leaves short text alone", () => {
    expect(truncateHeadTail("hello")).toEqual({ text: "hello", truncated: false });
  });

  it("keeps head and tail around a marker when over the cap", () => {
    const text = `HEAD${"x".repeat(10_000)}TAIL`;
    const out = truncateHeadTail(text);
    expect(out.truncated).toBe(true);
    expect(out.text.startsWith("HEAD")).toBe(true);
    expect(out.text.endsWith("TAIL")).toBe(true);
    expect(out.text).toContain("[truncated");
    expect(out.text.length).toBeLessThan(RESPONSE_BODY_CAP_CHARS + 100);
  });
});

describe("prepareBodyForModel", () => {
  it("truncates a text body over 4 KB and reports the original size", () => {
    const body = "a".repeat(5000);
    const out = prepareBodyForModel({ body, contentType: "text/plain", sizeBytes: 5000 });
    expect(out).toMatchObject({ kind: "text", truncated: true, totalChars: 5000 });
  });

  it("keeps a small text body whole", () => {
    const out = prepareBodyForModel({ body: "{}", contentType: "application/json", sizeBytes: 2 });
    expect(out).toEqual({ kind: "text", text: "{}", truncated: false, totalChars: 2 });
  });

  it("replaces binary content types with metadata", () => {
    const out = prepareBodyForModel({ body: "xxxx", contentType: "image/png", sizeBytes: 4 });
    expect(out).toEqual({ kind: "binary", contentType: "image/png", sizeBytes: 4 });
  });

  it("detects binary by NUL bytes", () => {
    const out = prepareBodyForModel({ body: "a\u0000b", contentType: "", sizeBytes: 3 });
    expect(out.kind).toBe("binary");
  });
});

describe("capToolResult", () => {
  it("passes small values through", () => {
    expect(capToolResult({ a: [1, 2], b: "x", c: null })).toEqual({ a: [1, 2], b: "x", c: null });
  });

  it("caps arrays and notes what was omitted", () => {
    const out = capToolResult(Array.from({ length: 80 }, (_, i) => i)) as unknown[];
    expect(out).toHaveLength(MAX_RESULT_ARRAY_ITEMS + 1);
    expect(out.at(-1)).toBe("...30 more omitted");
  });

  it("truncates long strings", () => {
    const out = capToolResult({ s: "z".repeat(9000) }) as { s: string };
    expect(out.s).toContain("[truncated");
  });

  it("replaces an oversized result with a bounded preview", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`key${i}`, "v".repeat(300)]),
    );
    const out = capToolResult(wide) as { truncated: boolean; preview: string };
    expect(out.truncated).toBe(true);
    expect(out.preview.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS + 3);
  });

  it("handles undefined", () => {
    expect(capToolResult(undefined)).toBeUndefined();
  });
});

describe("trimHistory", () => {
  const long = "w".repeat(4000);
  const history = [
    message("u1", "user", long),
    message("a1", "assistant", long),
    message("u2", "user", long),
    message("a2", "assistant", long),
    message("u3", "user", "latest question"),
  ];

  it("keeps everything when it fits", () => {
    const out = trimHistory(history, 100_000);
    expect(out.messages).toHaveLength(5);
    expect(out.droppedTurns).toBe(0);
  });

  it("drops the oldest whole turns first and keeps the latest turn", () => {
    const oneDropped = trimHistory(history, 2100);
    expect(oneDropped.droppedTurns).toBe(1);
    expect(oneDropped.messages.map((m) => m.id)).toEqual(["u2", "a2", "u3"]);
    const out = trimHistory(history, 1000);
    expect(out.droppedTurns).toBe(2);
    expect(out.messages.map((m) => m.id)).toEqual(["u3"]);
  });

  it("keeps the latest turn even when it alone exceeds the budget", () => {
    const out = trimHistory(history, 1);
    expect(out.messages.map((m) => m.id)).toEqual(["u3"]);
  });

  it("handles an empty history", () => {
    expect(trimHistory([])).toEqual({ messages: [], droppedTurns: 0 });
  });

  it("starts a turn on a leading assistant message", () => {
    const out = trimHistory([message("a0", "assistant", "hi"), message("u1", "user", "q")], 100_000);
    expect(out.messages).toHaveLength(2);
  });
});
