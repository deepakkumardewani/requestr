import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KEPT_CHANGE_IDS_KEY } from "@/lib/relay/changeGroups";
import { RELAY_MAX_STEPS } from "@/lib/relay/constants";
import {
  TOOL_INTERRUPTED_ERROR,
  TOOL_MAYBE_APPLIED_ERROR,
} from "@/lib/relay/errors";
import { readTurnTiming, startTurn } from "@/lib/relay/timing";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useRelayTurnStore } from "@/stores/useRelayTurnStore";
import {
  AUTO_DECLINED_OUTPUT,
  beginLiveTurn,
  countStepsSinceLastUser,
  declinePendingTools,
  decidedMode,
  derivePhase,
  forgetAwaiting,
  hasOpenToolCall,
  hasText,
  hitStepCap,
  isToolAwaiting,
  isUnchangedRestore,
  mapClientError,
  observeSteps,
  pendingToolCalls,
  recordAwaiting,
  settleInterruptedCalls,
  settlePendingForMessage,
  shouldContinueToolLoop,
  toolNameOf,
  trimToLastCompletedStep,
  withKeptChangeIds,
  withRunningTurn,
} from "./relayTurnHelpers";

const user = (id = "u1", text = "q"): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

type PartSpec = {
  name: string;
  id: string;
  state: string;
  input?: unknown;
  output?: unknown;
};

const toolPart = ({ name, id, state, input = {}, output }: PartSpec) =>
  ({
    type: `tool-${name}`,
    toolCallId: id,
    state,
    input,
    ...(output === undefined ? {} : { output }),
  }) as unknown as UIMessage["parts"][number];

const stepStart = { type: "step-start" } as UIMessage["parts"][number];
const text = (value: string, state: "done" | "streaming" = "done") =>
  ({ type: "text", text: value, state }) as UIMessage["parts"][number];

const assistant = (parts: UIMessage["parts"], id = "a1"): UIMessage => ({
  id,
  role: "assistant",
  parts,
});

const DELETE_INPUT = { ids: ["r1"] };
const pendingDelete = (id = "d1") =>
  toolPart({ name: "delete_requests", id, state: "input-available", input: DELETE_INPUT });
const doneRead = (id: string) =>
  toolPart({
    name: "get_workspace_summary",
    id,
    state: "output-available",
    output: { ok: true, data: {} },
  });
const outputOf = (message: UIMessage | undefined, id: string) =>
  (message?.parts.find(
    (p) => "toolCallId" in p && p.toolCallId === id,
  ) as { output?: unknown; state: string } | undefined);

beforeEach(() => {
  useRelayTurnStore.getState().reset();
  useRelayPermissionStore.setState({ mode: "review" });
  useRelayStore.setState({ liveTurn: null });
});

afterEach(() => {
  for (const id of ["d1", "d2", "c1", "q1", "g1"]) forgetAwaiting(id);
});

describe("hasText", () => {
  it("is true only for an assistant message with non-empty text", () => {
    expect(hasText(assistant([text("hi")]))).toBe(true);
    expect(hasText(assistant([text("")]))).toBe(false);
    expect(hasText(assistant([stepStart]))).toBe(false);
    expect(hasText(user())).toBe(false);
    expect(hasText(undefined)).toBe(false);
  });
});

describe("isUnchangedRestore", () => {
  it("compares message objects, not the array", () => {
    const a = user("a");
    const b = assistant([text("x")], "b");
    expect(isUnchangedRestore([a, b], [a, b])).toBe(true);
    expect(isUnchangedRestore([a, { ...b }], [a, b])).toBe(false);
    expect(isUnchangedRestore([a], [a, b])).toBe(false);
    expect(isUnchangedRestore([a], null)).toBe(false);
  });
});

describe("step cap", () => {
  const steps = (count: number) =>
    assistant([...Array.from({ length: count }, () => stepStart), doneRead("c")]);

  it("counts step-start parts after the last user message only", () => {
    expect(countStepsSinceLastUser([steps(4), user(), steps(3)])).toBe(3);
  });

  it("hitStepCap is true at the cap and false under it or without finished tools", () => {
    expect(hitStepCap([user(), steps(RELAY_MAX_STEPS)])).toBe(true);
    expect(hitStepCap([user(), steps(RELAY_MAX_STEPS - 1)])).toBe(false);
    expect(hitStepCap([user(), assistant([text("done")])])).toBe(false);
  });

  it("shouldContinueToolLoop never continues a stopped turn, even under the cap", () => {
    const messages = [user(), steps(2)];
    expect(shouldContinueToolLoop({ messages })).toBe(true);

    useRelayTurnStore.getState().transition("stopped");

    expect(shouldContinueToolLoop({ messages })).toBe(false);
  });

  it("shouldContinueToolLoop stops at the cap", () => {
    expect(shouldContinueToolLoop({ messages: [user(), steps(RELAY_MAX_STEPS)] })).toBe(false);
  });
});

describe("awaiting decisions", () => {
  it("records the decision under the mode at arrival and exposes that mode", () => {
    const call = { toolName: "delete_requests", toolCallId: "d1", input: DELETE_INPUT };

    expect(recordAwaiting(call)).toBe(true);
    useRelayPermissionStore.setState({ mode: "skip" });

    expect(decidedMode("d1")).toBe("review");
    expect(isToolAwaiting("d1", "delete_requests", DELETE_INPUT)).toBe(true);
  });

  it("forgetAwaiting drops the record so the call is judged again under the current mode", () => {
    recordAwaiting({ toolName: "delete_requests", toolCallId: "d1", input: DELETE_INPUT });
    useRelayPermissionStore.setState({ mode: "skip" });
    forgetAwaiting("d1");

    expect(decidedMode("d1")).toBeUndefined();
    expect(isToolAwaiting("d1", "delete_requests", DELETE_INPUT)).toBe(false);
  });

  it("an unrecorded read tool does not await; an ask_user always does", () => {
    expect(isToolAwaiting("g1", "get_workspace_summary", {})).toBe(false);
    expect(
      isToolAwaiting("q1", "ask_user", { question: "Which?", options: ["A", "B"] }),
    ).toBe(true);
  });

  it("toolNameOf strips the tool- prefix", () => {
    expect(toolNameOf({ type: "tool-delete_requests" })).toBe("delete_requests");
  });
});

describe("pendingToolCalls", () => {
  it("lists open cards of the newest assistant message", () => {
    expect(pendingToolCalls([user(), assistant([pendingDelete()])])).toEqual([
      { toolName: "delete_requests", toolCallId: "d1", input: DELETE_INPUT },
    ]);
  });

  it("skips running calls, settled calls and non-assistant tails", () => {
    const message = assistant([pendingDelete(), doneRead("g1")]);
    expect(pendingToolCalls([user(), message], new Set(["d1"]))).toEqual([]);
    expect(pendingToolCalls([user()])).toEqual([]);
    expect(pendingToolCalls([])).toEqual([]);
  });

  it("does not list an auto tool that was not recorded as awaiting", () => {
    const auto = toolPart({ name: "get_workspace_summary", id: "g1", state: "input-available" });
    expect(pendingToolCalls([user(), assistant([auto])])).toEqual([]);
  });
});

describe("declinePendingTools", () => {
  it("returns the same array when nothing is pending", () => {
    const messages = [user(), assistant([doneRead("g1")])];
    expect(declinePendingTools(messages)).toBe(messages);
  });

  it("closes each pending card as auto-declined and leaves settled parts alone", () => {
    const messages = [user(), assistant([doneRead("g1"), pendingDelete()])];

    const settled = declinePendingTools(messages);

    expect(settled).not.toBe(messages);
    expect(outputOf(settled.at(-1), "d1")).toMatchObject({
      state: "output-available",
      output: AUTO_DECLINED_OUTPUT,
    });
    expect(outputOf(settled.at(-1), "g1")?.output).toEqual({ ok: true, data: {} });
  });

  it("does not decline a call that is running", () => {
    const messages = [user(), assistant([pendingDelete()])];
    expect(declinePendingTools(messages, new Set(["d1"]))).toBe(messages);
  });
});

describe("settlePendingForMessage", () => {
  const askCall = toolPart({
    name: "ask_user",
    id: "q1",
    state: "input-available",
    input: { question: "Which?", options: ["A", "B"] },
  });

  it("answers the first question card with the message and declines the rest", () => {
    const messages = [user(), assistant([askCall, pendingDelete()])];

    const settled = settlePendingForMessage(messages, new Set(), "the third");

    expect(outputOf(settled.at(-1), "q1")?.output).toEqual({
      ok: true,
      data: { choice: "the third", viaComposer: true },
    });
    expect(outputOf(settled.at(-1), "d1")?.output).toEqual(AUTO_DECLINED_OUTPUT);
  });

  it("declines everything when no question card is open", () => {
    const settled = settlePendingForMessage(
      [user(), assistant([pendingDelete()])],
      new Set(),
      "never mind",
    );
    expect(outputOf(settled.at(-1), "d1")?.output).toEqual(AUTO_DECLINED_OUTPUT);
  });

  it("returns the same array when nothing is open", () => {
    const messages = [user(), assistant([text("hi")])];
    expect(settlePendingForMessage(messages, new Set(), "x")).toBe(messages);
  });
});

describe("observeSteps", () => {
  it("times text and reasoning parts by index", () => {
    const message = assistant([
      { type: "reasoning", text: "hm", state: "done" } as UIMessage["parts"][number],
      text("partial", "streaming"),
    ]);
    expect(observeSteps(message)).toEqual([
      { id: "p0", kind: "thinking", done: true },
      { id: "p1", kind: "text", done: false },
    ]);
  });

  it("shows a waiting step for an open card and no step for streaming input", () => {
    const message = assistant([
      pendingDelete(),
      toolPart({ name: "get_request", id: "g1", state: "input-streaming" }),
    ]);
    expect(observeSteps(message)).toEqual([
      { id: "w:d1", kind: "waiting", toolName: "delete_requests", done: false },
    ]);
  });

  it("closes the waiting step and adds a tool step once a call is running or settled", () => {
    const message = assistant([pendingDelete(), doneRead("g1")]);

    expect(observeSteps(message, new Set(["d1"]))).toEqual([
      { id: "w:d1", kind: "waiting", toolName: "delete_requests", done: true },
      { id: "t:d1", kind: "tool", toolName: "delete_requests", done: false },
      { id: "w:g1", kind: "waiting", toolName: "get_workspace_summary", done: true },
      { id: "t:g1", kind: "tool", toolName: "get_workspace_summary", done: true },
    ]);
  });

  it("ignores parts that are neither text, reasoning nor tools", () => {
    expect(observeSteps(assistant([stepStart]))).toEqual([]);
  });
});

describe("hasOpenToolCall", () => {
  it("is true while a call has no result", () => {
    expect(hasOpenToolCall(assistant([pendingDelete()]))).toBe(true);
    expect(hasOpenToolCall(assistant([doneRead("g1")]))).toBe(false);
    expect(hasOpenToolCall(user())).toBe(false);
    expect(hasOpenToolCall(undefined)).toBe(false);
  });
});

describe("live turn", () => {
  it("beginLiveTurn starts a timer with no message yet", () => {
    beginLiveTurn();
    expect(useRelayStore.getState().liveTurn?.messageId).toBe("");
  });

  it("withRunningTurn stamps the running turn onto its message only", () => {
    const messages = [user(), assistant([text("hi")], "a1"), assistant([text("x")], "a2")];
    const live = { messageId: "a1", turn: startTurn(1000) };

    const stamped = withRunningTurn(messages, live);

    expect(readTurnTiming(stamped[1].metadata)?.status).toBe("running");
    expect(stamped[2]).toBe(messages[2]);
    expect(messages[1].metadata).toBeUndefined();
  });

  it("withRunningTurn returns the messages untouched with no live turn or no adopted message", () => {
    const messages = [user(), assistant([text("hi")])];
    expect(withRunningTurn(messages, null)).toBe(messages);
    expect(withRunningTurn(messages, { messageId: "", turn: startTurn(1) })).toBe(messages);
  });
});

describe("mapClientError", () => {
  it("falls back by transport state when the message carries no Relay code", () => {
    expect(mapClientError(new Error("boom"), true)).toEqual({ code: "relay_unavailable" });
    expect(mapClientError(new Error("boom"), false)).toEqual({ code: "offline" });
  });

  it("uses a Relay code carried in the message", () => {
    expect(mapClientError(new Error("not_configured"), true)).toEqual({
      code: "not_configured",
    });
  });
});

describe("trimToLastCompletedStep (HH-H05)", () => {
  const create = (id: string, state = "output-available") =>
    toolPart({
      name: "create_collection",
      id,
      state,
      input: { name: id },
      output: state === "output-available" ? { ok: true, data: {} } : undefined,
    });

  it("keeps the three finished creates and drops the half-finished fourth step", () => {
    const reply = assistant([
      stepStart,
      create("c1"),
      stepStart,
      create("c2"),
      stepStart,
      create("c3"),
      stepStart,
      create("c4", "input-available"),
    ]);
    const messages = [user(), reply];

    const trimmed = trimToLastCompletedStep(messages);

    const ids = trimmed
      .at(-1)
      ?.parts.flatMap((p) => ("toolCallId" in p ? [p.toolCallId] : []));
    expect(ids).toEqual(["c1", "c2", "c3"]);
  });

  it("returns the same array when the last step is complete", () => {
    const messages = [user(), assistant([stepStart, create("c1"), stepStart, create("c2")])];
    expect(trimToLastCompletedStep(messages)).toBe(messages);
  });

  it("drops the whole reply when no step has a finished tool call (plain resend)", () => {
    const u = user();
    const reply = assistant([stepStart, text("thinking"), stepStart, create("c1", "input-available")]);
    expect(trimToLastCompletedStep([u, reply])).toEqual([u]);
  });

  it("treats a reply with no step markers as one step", () => {
    const u = user();
    expect(trimToLastCompletedStep([u, assistant([create("c1", "input-available")])])).toEqual([u]);
    const complete = [u, assistant([create("c1")])];
    expect(trimToLastCompletedStep(complete)).toBe(complete);
  });

  it("leaves a thread that does not end on an assistant message alone", () => {
    const messages = [user()];
    expect(trimToLastCompletedStep(messages)).toBe(messages);
  });

  it("counts an errored tool result as settled", () => {
    const messages = [
      user(),
      assistant([stepStart, toolPart({ name: "get_request", id: "g1", state: "output-error" })]),
    ];
    expect(trimToLastCompletedStep(messages)).toBe(messages);
  });
});

describe("derivePhase", () => {
  const base = {
    status: "ready" as const,
    runningTools: 0,
    failed: false,
    messages: [user(), assistant([text("hi")])],
    running: new Set<string>(),
  };

  it("is streaming while the chat is submitted or streaming, even with errors or tools", () => {
    expect(derivePhase({ ...base, status: "submitted", failed: true })).toBe("streaming");
    expect(derivePhase({ ...base, status: "streaming", runningTools: 2 })).toBe("streaming");
  });

  it("counts running tools (auto tools included) as running-tools", () => {
    expect(derivePhase({ ...base, runningTools: 1 })).toBe("running-tools");
  });

  it("is errored on a failure or an error status", () => {
    expect(derivePhase({ ...base, failed: true })).toBe("errored");
    expect(derivePhase({ ...base, status: "error" })).toBe("errored");
  });

  it("is awaiting-user with an open card", () => {
    expect(derivePhase({ ...base, messages: [user(), assistant([pendingDelete()])] })).toBe(
      "awaiting-user",
    );
  });

  it("is capped at the step cap and idle otherwise", () => {
    const capped = assistant([
      ...Array.from({ length: RELAY_MAX_STEPS }, () => stepStart),
      doneRead("g1"),
    ]);
    expect(derivePhase({ ...base, messages: [user(), capped] })).toBe("capped");
    expect(derivePhase(base)).toBe("idle");
  });
});

describe("settleInterruptedCalls (HH-M22, L-03)", () => {
  it("settles a call marked running as maybe-applied", () => {
    const messages = [user(), assistant([pendingDelete()])];
    const settled = settleInterruptedCalls(messages, ["d1"], new Set());
    expect(outputOf(settled.at(-1), "d1")?.output).toEqual({
      ok: false,
      error: TOOL_MAYBE_APPLIED_ERROR,
    });
  });

  it("settles an unanswered card as declined", () => {
    const settled = settleInterruptedCalls([user(), assistant([pendingDelete()])], [], new Set());
    expect(outputOf(settled.at(-1), "d1")?.output).toEqual(AUTO_DECLINED_OUTPUT);
  });

  it("settles an auto tool that never returned as interrupted, not declined", () => {
    const auto = toolPart({
      name: "get_workspace_summary",
      id: "g1",
      state: "input-available",
    });
    const settled = settleInterruptedCalls([user(), assistant([auto])], [], new Set());
    expect(outputOf(settled.at(-1), "g1")?.output).toEqual({
      ok: false,
      error: TOOL_INTERRUPTED_ERROR,
    });
  });

  it("leaves calls still running in this page and settled calls alone", () => {
    const messages = [user(), assistant([pendingDelete(), doneRead("g1")])];
    expect(settleInterruptedCalls(messages, ["d1"], new Set(["d1"]))).toBe(messages);
  });
});

describe("withKeptChangeIds (HH-M23)", () => {
  it("records the kept ids under the metadata key and keeps other metadata", () => {
    const message = { ...assistant([text("hi")]), metadata: { other: 1 } };

    const kept = withKeptChangeIds(message, ["c1", "c2"]);

    expect(kept.metadata).toEqual({ other: 1, [KEPT_CHANGE_IDS_KEY]: ["c1", "c2"] });
    expect(message.metadata).toEqual({ other: 1 });
  });

  it("starts metadata when there is none and ignores an empty list", () => {
    const message = assistant([text("hi")]);
    expect(withKeptChangeIds(message, ["c1"]).metadata).toEqual({
      [KEPT_CHANGE_IDS_KEY]: ["c1"],
    });
    expect(withKeptChangeIds(message, [])).toBe(message);
  });
});
