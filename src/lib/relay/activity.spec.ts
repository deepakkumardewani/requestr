import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import type { RelayChatStatus } from "@/hooks/useRelayChat";
import { deriveActivity } from "./activity";

const user: UIMessage = {
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "hi" }],
};

const assistant = (parts: unknown[]): UIMessage =>
  ({ id: "a1", role: "assistant", parts }) as UIMessage;

const toolPart = (type: string, state: string, input?: unknown) => ({
  type,
  toolCallId: "c1",
  state,
  input,
});

const THINKING = { kind: "thinking" };

describe("deriveActivity", () => {
  it.each<RelayChatStatus>(["ready", "error"])("is null when the turn is %s", (status) => {
    expect(deriveActivity([user], status)).toBeNull();
  });

  it.each<RelayChatStatus>(["submitted", "streaming"])(
    "is thinking while %s and the last message is the user's",
    (status) => {
      expect(deriveActivity([user], status)).toEqual(THINKING);
    },
  );

  it("is thinking with no messages at all while submitted", () => {
    expect(deriveActivity([], "submitted")).toEqual(THINKING);
  });

  it("is thinking when the assistant message has no parts", () => {
    expect(deriveActivity([user, assistant([])], "streaming")).toEqual(THINKING);
  });

  it("ignores step-start and reasoning parts", () => {
    const parts = [{ type: "step-start" }, { type: "reasoning", text: "hmm" }];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual(THINKING);
  });

  it("is null once assistant text has started", () => {
    const parts = [{ type: "text", text: "Here" }];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toBeNull();
  });

  it("is thinking while the assistant text part is still empty", () => {
    const parts = [{ type: "text", text: "" }];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual(THINKING);
  });

  it("is thinking after a non-tool, non-text part such as a source", () => {
    const parts = [{ type: "source-url", sourceId: "s", url: "https://x.test" }];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual(THINKING);
  });

  it.each(["input-streaming", "input-available"])(
    "returns the tool step for a call in state %s",
    (state) => {
      const input = { name: "Orders", parentId: null };
      const parts = [toolPart("tool-create_collection", state, input)];
      expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual({
        kind: "tool",
        toolName: "create_collection",
        input,
      });
    },
  );

  it("shows only the last tool when earlier ones have finished", () => {
    const parts = [
      toolPart("tool-get_request", "output-available", { id: "r1" }),
      toolPart("tool-search_workspace", "input-available", { query: "a" }),
    ];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual({
      kind: "tool",
      toolName: "search_workspace",
      input: { query: "a" },
    });
  });

  it.each(["output-available", "output-error"])(
    "is thinking once the last tool call is %s",
    (state) => {
      const parts = [toolPart("tool-get_request", state, { id: "r1" })];
      expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual(THINKING);
    },
  );

  it("is null when the in-flight call waits for the user (confirm tool)", () => {
    const parts = [toolPart("tool-delete_request", "input-available", { ids: ["r1"] })];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toBeNull();
  });

  it("is null when the in-flight call is a question", () => {
    const parts = [
      toolPart("tool-ask_user", "input-available", {
        question: "Which one?",
        options: ["A", "B"],
      }),
    ];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toBeNull();
  });

  it("still shows the step when a confirm tool's input is malformed", () => {
    const parts = [toolPart("tool-delete_request", "input-available", { ids: [] })];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual({
      kind: "tool",
      toolName: "delete_request",
      input: { ids: [] },
    });
  });

  it("returns an unregistered tool as a tool step so the label can go generic", () => {
    const parts = [toolPart("tool-mystery", "input-streaming")];
    expect(deriveActivity([user, assistant(parts)], "streaming")).toEqual({
      kind: "tool",
      toolName: "mystery",
      input: undefined,
    });
  });
});
