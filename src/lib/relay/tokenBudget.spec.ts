import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { RELAY_KEEP_TOOL_RESULTS } from "./constants";
import {
  capToolResult,
  estimateTokens,
  MAX_RESULT_ARRAY_ITEMS,
  MAX_TOOL_RESULT_CHARS,
  prepareBodyForModel,
  RESPONSE_BODY_CAP_CHARS,
  stubOlderToolResults,
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

  it("keeps the required shape on the truncated stand-in", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`key${i}`, "v".repeat(300)]),
    );
    const out = capToolResult(wide, { workspace: {}, chips: [] });
    expect(out).toMatchObject({ workspace: {}, chips: [], truncated: true });
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

type ToolState = "output-available" | "input-available" | "approval-requested";

const toolPart = (n: number, state: ToolState = "output-available") =>
  ({
    type: "tool-get_request",
    toolCallId: `call${n}`,
    state,
    input: { id: `r${n}` },
    ...(state === "output-available" ? { output: { ok: true, data: `result ${n}` } } : {}),
  }) as unknown as UIMessage["parts"][number];

const assistant = (id: string, parts: UIMessage["parts"]): UIMessage => ({ id, role: "assistant", parts });

const outputOf = (m: UIMessage, i: number) => (m.parts[i] as { output?: unknown }).output;
const isStub = (output: unknown) => (output as { stubbed?: boolean } | undefined)?.stubbed === true;

describe("stubOlderToolResults (HH-M26)", () => {
  const user = message("u1", "user", "build it");

  it("stubs the earliest results after 8, leaving the latest 6 untouched", () => {
    const parts = Array.from({ length: 8 }, (_, i) => toolPart(i + 1));
    const out = stubOlderToolResults([user, assistant("a1", parts)]);
    const stubbed = out[1].parts.map((_, i) => isStub(outputOf(out[1], i)));
    expect(stubbed).toEqual([true, true, false, false, false, false, false, false]);
    expect(outputOf(out[1], 7)).toEqual({ ok: true, data: "result 8" });
  });

  it("keeps toolCallId, tool type, state and input on a stub so pairing stays valid", () => {
    const out = stubOlderToolResults([user, assistant("a1", Array.from({ length: 8 }, (_, i) => toolPart(i + 1)))]);
    expect(out[1].parts[0]).toMatchObject({
      type: "tool-get_request",
      toolCallId: "call1",
      state: "output-available",
      input: { id: "r1" },
    });
  });

  it("never stubs pending or awaiting-approval parts, even when they are the oldest", () => {
    const parts = [
      toolPart(1, "input-available"),
      toolPart(2, "approval-requested"),
      ...Array.from({ length: 8 }, (_, i) => toolPart(i + 3)),
    ];
    const out = stubOlderToolResults([user, assistant("a1", parts)]);
    expect(out[1].parts[0]).toEqual(parts[0]);
    expect(out[1].parts[1]).toEqual(parts[1]);
    const finished = out[1].parts.slice(2).map((_, i) => isStub(outputOf(out[1], i + 2)));
    expect(finished.filter(Boolean)).toHaveLength(2);
  });

  it("counts results across messages in the latest turn, oldest first", () => {
    const first = assistant("a1", [toolPart(1), toolPart(2), toolPart(3)]);
    const second = assistant("a2", [toolPart(4), toolPart(5), toolPart(6), toolPart(7), toolPart(8)]);
    const out = stubOlderToolResults([user, first, second]);
    expect([0, 1, 2].map((i) => isStub(outputOf(out[1], i)))).toEqual([true, true, false]);
    expect([0, 1, 2, 3, 4].some((i) => isStub(outputOf(out[2], i)))).toBe(false);
  });

  it("leaves earlier turns alone", () => {
    const earlier = assistant("a0", Array.from({ length: 10 }, (_, i) => toolPart(i + 100)));
    const out = stubOlderToolResults([message("u0", "user", "old"), earlier, user, assistant("a1", [toolPart(1)])]);
    expect(out[1]).toBe(earlier);
  });

  it("returns the same messages when nothing exceeds the keep count", () => {
    const messages = [user, assistant("a1", Array.from({ length: RELAY_KEEP_TOOL_RESULTS }, (_, i) => toolPart(i)))];
    expect(stubOlderToolResults(messages)).toBe(messages);
  });

  it("honours a custom keep count and handles an empty list", () => {
    const out = stubOlderToolResults([user, assistant("a1", [toolPart(1), toolPart(2)])], 1);
    expect(isStub(outputOf(out[1], 0))).toBe(true);
    expect(isStub(outputOf(out[1], 1))).toBe(false);
    expect(stubOlderToolResults([])).toEqual([]);
  });

  it("stubs dynamic tool parts and skips text parts", () => {
    const dynamic = { type: "dynamic-tool", toolName: "x", toolCallId: "d1", state: "output-available", input: {}, output: "big" } as unknown as UIMessage["parts"][number];
    const parts = [{ type: "text", text: "hi" } as UIMessage["parts"][number], dynamic, ...Array.from({ length: 6 }, (_, i) => toolPart(i))];
    const out = stubOlderToolResults([user, assistant("a1", parts)]);
    expect(out[1].parts[0]).toEqual({ type: "text", text: "hi" });
    expect(isStub(outputOf(out[1], 1))).toBe(true);
  });
});
