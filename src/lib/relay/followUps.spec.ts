import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { deriveFollowUps, MAX_FOLLOW_UPS } from "./followUps";

function toolPart(
  tool: string,
  output: unknown,
  state = "output-available",
): UIMessage["parts"][number] {
  return {
    type: `tool-${tool}`,
    toolCallId: "c1",
    state,
    input: {},
    output,
  } as unknown as UIMessage["parts"][number];
}

function assistant(...parts: UIMessage["parts"]): UIMessage {
  return { id: "a1", role: "assistant", parts };
}

describe("deriveFollowUps", () => {
  it("returns nothing for an empty thread", () => {
    expect(deriveFollowUps([])).toEqual([]);
  });

  it("returns nothing when the last message is from the user", () => {
    const user: UIMessage = {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "hi" }],
    };
    expect(deriveFollowUps([assistant(toolPart("send_request", { ok: false })), user])).toEqual([]);
  });

  it("returns nothing when the answer ran no tool", () => {
    expect(deriveFollowUps([assistant({ type: "text", text: "hello" })])).toEqual([]);
  });

  it("returns nothing while the newest tool call is still pending", () => {
    const pending = toolPart("send_request", undefined, "input-available");
    expect(deriveFollowUps([assistant(pending)])).toEqual([]);
  });

  it("returns nothing when the tool output is not an object", () => {
    expect(deriveFollowUps([assistant(toolPart("send_request", "boom"))])).toEqual([]);
  });

  it("uses only the newest tool call", () => {
    const older = toolPart("send_request", { ok: true, data: { status: 200 } });
    const newest = toolPart("send_request", { ok: false });
    expect(deriveFollowUps([assistant(older, newest)])).toEqual(["fixRequest"]);
  });

  it("returns nothing for tools it has no chips for", () => {
    expect(deriveFollowUps([assistant(toolPart("list_requests", { ok: true }))])).toEqual([]);
  });

  describe("send_request", () => {
    it("offers a fix when the call failed", () => {
      expect(deriveFollowUps([assistant(toolPart("send_request", { ok: false }))])).toEqual([
        "fixRequest",
      ]);
    });

    it("offers fix and explanations on a 500 and caps at 3", () => {
      const keys = deriveFollowUps([
        assistant(toolPart("send_request", { ok: true, data: { status: 500 } })),
      ]);
      expect(keys).toEqual(["fixRequest", "explainHeaders", "explainResponse"]);
      expect(keys.length).toBeLessThanOrEqual(MAX_FOLLOW_UPS);
    });

    it("treats 400 as the first error status", () => {
      expect(
        deriveFollowUps([assistant(toolPart("send_request", { ok: true, data: { status: 400 } }))]),
      ).toEqual(["fixRequest", "explainHeaders", "explainResponse"]);
    });

    it("offers assertions on a 399 or 200 success", () => {
      expect(
        deriveFollowUps([assistant(toolPart("send_request", { ok: true, data: { status: 399 } }))]),
      ).toEqual(["addAssertions", "explainResponse"]);
      expect(
        deriveFollowUps([assistant(toolPart("send_request", { ok: true, data: { status: 200 } }))]),
      ).toEqual(["addAssertions", "explainResponse"]);
    });

    it("offers nothing when status is missing or not a number", () => {
      expect(deriveFollowUps([assistant(toolPart("send_request", { ok: true }))])).toEqual([]);
      expect(
        deriveFollowUps([assistant(toolPart("send_request", { ok: true, data: { status: "200" } }))]),
      ).toEqual([]);
    });
  });

  describe("run_chain", () => {
    it("offers a retry when the run itself failed", () => {
      expect(deriveFollowUps([assistant(toolPart("run_chain", { ok: false }))])).toEqual([
        "retryChain",
      ]);
    });

    it("explains and retries when steps failed", () => {
      expect(
        deriveFollowUps([assistant(toolPart("run_chain", { ok: true, data: { failed: ["s1"] } }))]),
      ).toEqual(["whyChainFailed", "retryChain"]);
    });

    it("offers nothing when no step failed", () => {
      expect(
        deriveFollowUps([assistant(toolPart("run_chain", { ok: true, data: { failed: [] } }))]),
      ).toEqual([]);
      expect(deriveFollowUps([assistant(toolPart("run_chain", { ok: true }))])).toEqual([]);
    });
  });
});

describe("deriveFollowUps independence from the workspace", () => {
  it("derives the same chips from the thread alone, whatever tab is open", () => {
    const thread = [assistant(toolPart("send_request", { ok: true, data: { status: 500 } }))];
    const first = deriveFollowUps(thread);
    expect(first).toEqual(["fixRequest", "explainHeaders", "explainResponse"]);
    expect(deriveFollowUps(thread)).toEqual(first);
  });

  it("offers no chip that needs a tab for an answer that ran no tool", () => {
    expect(deriveFollowUps([assistant({ type: "text", text: "Attach a tab first" })])).toEqual([]);
  });

  it("ignores an old get_active_context part", () => {
    const old = toolPart("get_active_context", { ok: true, data: { attached: [] } });
    expect(deriveFollowUps([assistant(old)])).toEqual([]);
  });
});
