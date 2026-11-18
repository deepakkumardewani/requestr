import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  activeMs,
  activeSeconds,
  endStep,
  finishTurn,
  isWaiting,
  readTurnTiming,
  resolveTurnLabel,
  startStep,
  startTurn,
  syncSteps,
  type TurnTiming,
  withoutTurnTiming,
  withTurnTiming,
} from "./timing";

const T0 = 1_000_000;
const SEC = 1000;

const thinking = { id: "t1", kind: "thinking" as const };
const tool = { id: "c1", kind: "tool" as const, toolName: "internal_tool" };
const waiting = { id: "w1", kind: "waiting" as const };
const text = { id: "x1", kind: "text" as const };

const message = (metadata?: unknown): UIMessage => ({
  id: "a1",
  role: "assistant",
  parts: [{ type: "text", text: "hi" }],
  ...(metadata === undefined ? {} : { metadata }),
});

describe("startTurn", () => {
  it("creates a running turn with no steps", () => {
    expect(startTurn(T0)).toEqual({ startedAt: T0, status: "running", steps: [] });
  });
});

describe("startStep", () => {
  it("appends a step stamped with the start time", () => {
    const turn = startStep(startTurn(T0), thinking, T0 + SEC);
    expect(turn.steps).toEqual([{ ...thinking, startedAt: T0 + SEC }]);
  });

  it("returns the same turn when the step id is already known", () => {
    const turn = startStep(startTurn(T0), thinking, T0);
    expect(startStep(turn, thinking, T0 + 5 * SEC)).toBe(turn);
  });

  it("ends an open thinking step when the next step starts", () => {
    const first = startStep(startTurn(T0), thinking, T0);
    const next = startStep(first, text, T0 + 2 * SEC);
    expect(next.steps[0].endedAt).toBe(T0 + 2 * SEC);
    expect(next.steps[1].endedAt).toBeUndefined();
  });

  it("keeps open tool and waiting steps running when another step starts", () => {
    let turn = startStep(startTurn(T0), tool, T0);
    turn = startStep(turn, waiting, T0 + SEC);
    turn = startStep(turn, text, T0 + 2 * SEC);
    expect(turn.steps.map((s) => s.endedAt)).toEqual([undefined, undefined, undefined]);
  });

  it("does not move the end of an already ended step", () => {
    let turn = startStep(startTurn(T0), thinking, T0);
    turn = startStep(turn, text, T0 + SEC);
    turn = startStep(turn, tool, T0 + 5 * SEC);
    expect(turn.steps[0].endedAt).toBe(T0 + SEC);
  });
});

describe("endStep", () => {
  it("stamps the end of the named step", () => {
    const turn = startStep(startTurn(T0), tool, T0);
    expect(endStep(turn, "c1", T0 + 3 * SEC).steps[0].endedAt).toBe(T0 + 3 * SEC);
  });

  it("returns the same turn for an unknown id", () => {
    const turn = startStep(startTurn(T0), tool, T0);
    expect(endStep(turn, "nope", T0 + SEC)).toBe(turn);
  });

  it("returns the same turn when the step already ended", () => {
    const turn = endStep(startStep(startTurn(T0), tool, T0), "c1", T0 + SEC);
    expect(endStep(turn, "c1", T0 + 9 * SEC)).toBe(turn);
  });

  it("only touches the named step", () => {
    let turn = startStep(startTurn(T0), tool, T0);
    turn = startStep(turn, { id: "c2", kind: "tool" }, T0);
    expect(endStep(turn, "c2", T0 + SEC).steps[0].endedAt).toBeUndefined();
  });
});

describe("syncSteps", () => {
  it("starts unseen steps and leaves unfinished ones open", () => {
    const turn = syncSteps(startTurn(T0), [{ ...tool, done: false }], T0 + SEC);
    expect(turn.steps).toEqual([{ ...tool, startedAt: T0 + SEC }]);
  });

  it("starts and ends a step that is already done on first sight", () => {
    const turn = syncSteps(startTurn(T0), [{ ...tool, done: true }], T0 + SEC);
    expect(turn.steps[0]).toMatchObject({ startedAt: T0 + SEC, endedAt: T0 + SEC });
  });

  it("ends a previously started step once the stream reports it done", () => {
    const open = syncSteps(startTurn(T0), [{ ...tool, done: false }], T0);
    const closed = syncSteps(open, [{ ...tool, done: true }], T0 + 4 * SEC);
    expect(closed.steps).toHaveLength(1);
    expect(closed.steps[0].endedAt).toBe(T0 + 4 * SEC);
  });

  it("is idempotent for repeated observations", () => {
    const observed = [{ ...thinking, done: false }];
    const once = syncSteps(startTurn(T0), observed, T0);
    expect(syncSteps(once, observed, T0 + SEC)).toBe(once);
  });

  it("ignores a done waiting card that was never seen pending", () => {
    const turn = startTurn(T0);
    expect(syncSteps(turn, [{ ...waiting, done: true }], T0 + SEC)).toBe(turn);
  });

  it("ends a waiting card that was seen pending", () => {
    const pending = syncSteps(startTurn(T0), [{ ...waiting, done: false }], T0);
    const answered = syncSteps(pending, [{ ...waiting, done: true }], T0 + 2 * SEC);
    expect(answered.steps[0].endedAt).toBe(T0 + 2 * SEC);
  });
});

describe("finishTurn", () => {
  it.each(["done", "stopped", "error"] as const)("settles the turn as %s and closes open steps", (status) => {
    const running = startStep(startTurn(T0), tool, T0 + SEC);
    const finished = finishTurn(running, status, T0 + 5 * SEC);
    expect(finished).toMatchObject({ status, endedAt: T0 + 5 * SEC });
    expect(finished.steps[0].endedAt).toBe(T0 + 5 * SEC);
  });

  it("keeps step ends that were already set", () => {
    const turn = endStep(startStep(startTurn(T0), tool, T0), "c1", T0 + SEC);
    expect(finishTurn(turn, "done", T0 + 9 * SEC).steps[0].endedAt).toBe(T0 + SEC);
  });

  it("does not change a turn that already settled", () => {
    const done = finishTurn(startTurn(T0), "done", T0 + SEC);
    expect(finishTurn(done, "error", T0 + 9 * SEC)).toBe(done);
  });
});

describe("isWaiting", () => {
  it("is false without steps", () => {
    expect(isWaiting(startTurn(T0))).toBe(false);
  });

  it("is true while a waiting card is open", () => {
    expect(isWaiting(startStep(startTurn(T0), waiting, T0))).toBe(true);
  });

  it("is false once the card ended", () => {
    const turn = endStep(startStep(startTurn(T0), waiting, T0), "w1", T0 + SEC);
    expect(isWaiting(turn)).toBe(false);
  });

  it("ignores open non-waiting steps", () => {
    expect(isWaiting(startStep(startTurn(T0), tool, T0))).toBe(false);
  });
});

describe("activeMs and activeSeconds", () => {
  it("counts up to now while the turn is running", () => {
    expect(activeMs(startTurn(T0), T0 + 7 * SEC)).toBe(7 * SEC);
  });

  it("uses the recorded end once settled, ignoring now", () => {
    const done = finishTurn(startTurn(T0), "done", T0 + 3 * SEC);
    expect(activeMs(done, T0 + 99 * SEC)).toBe(3 * SEC);
  });

  it("excludes closed waiting time", () => {
    let turn = startStep(startTurn(T0), waiting, T0 + 2 * SEC);
    turn = endStep(turn, "w1", T0 + 6 * SEC);
    expect(activeMs(turn, T0 + 10 * SEC)).toBe(6 * SEC);
  });

  it("excludes an open waiting card up to now so the clock pauses", () => {
    const turn = startStep(startTurn(T0), waiting, T0 + 2 * SEC);
    expect(activeMs(turn, T0 + 10 * SEC)).toBe(2 * SEC);
    expect(activeMs(turn, T0 + 20 * SEC)).toBe(2 * SEC);
  });

  it("is zero for a non-running turn without an end", () => {
    const odd: TurnTiming = { startedAt: T0, status: "done", steps: [] };
    expect(activeMs(odd, T0 + 5 * SEC)).toBe(0);
  });

  it("never goes negative when now precedes the start", () => {
    expect(activeMs(startTurn(T0), T0 - SEC)).toBe(0);
  });

  it("floors seconds", () => {
    expect(activeSeconds(startTurn(T0), T0 + 4999)).toBe(4);
  });
});

describe("resolveTurnLabel", () => {
  it("is legacy without a turn", () => {
    expect(resolveTurnLabel(undefined)).toEqual({ kind: "legacy" });
  });

  it("is worked for a done turn with active seconds", () => {
    const turn = finishTurn(startTurn(T0), "done", T0 + 12_500);
    expect(resolveTurnLabel(turn)).toEqual({ kind: "worked", seconds: 12 });
  });

  it("is stopped for a stopped turn", () => {
    const turn = finishTurn(startTurn(T0), "stopped", T0 + 3 * SEC);
    expect(resolveTurnLabel(turn)).toEqual({ kind: "stopped", seconds: 3 });
  });

  it("is failed for an errored turn", () => {
    const turn = finishTurn(startTurn(T0), "error", T0 + 8 * SEC);
    expect(resolveTurnLabel(turn)).toEqual({ kind: "failed", seconds: 8 });
  });

  it("excludes waiting time from the settled seconds", () => {
    let turn = startStep(startTurn(T0), waiting, T0 + SEC);
    turn = endStep(turn, "w1", T0 + 31 * SEC);
    const done = finishTurn(turn, "done", T0 + 35 * SEC);
    expect(resolveTurnLabel(done)).toEqual({ kind: "worked", seconds: 5 });
  });

  it("is zero seconds for a settled turn with no end recorded", () => {
    const odd: TurnTiming = { startedAt: T0, status: "error", steps: [] };
    expect(resolveTurnLabel(odd)).toEqual({ kind: "failed", seconds: 0 });
  });

  it("reads a persisted running turn as interrupted at its last step end", () => {
    let turn = startStep(startTurn(T0), thinking, T0);
    turn = endStep(turn, "t1", T0 + 9 * SEC);
    expect(resolveTurnLabel(turn)).toEqual({ kind: "interrupted", seconds: 9 });
  });

  it("falls back to the last step start when it never ended", () => {
    const turn = startStep(startTurn(T0), tool, T0 + 4 * SEC);
    expect(resolveTurnLabel(turn)).toEqual({ kind: "interrupted", seconds: 4 });
  });

  it("falls back to zero when an interrupted turn has no steps", () => {
    expect(resolveTurnLabel(startTurn(T0))).toEqual({ kind: "interrupted", seconds: 0 });
  });

  it("excludes waiting time from interrupted seconds", () => {
    let turn = startStep(startTurn(T0), waiting, T0 + SEC);
    turn = endStep(turn, "w1", T0 + 21 * SEC);
    turn = startStep(turn, text, T0 + 23 * SEC);
    expect(resolveTurnLabel(turn)).toEqual({ kind: "interrupted", seconds: 3 });
  });

  it("does not mutate the persisted running turn", () => {
    const turn = startStep(startTurn(T0), tool, T0 + SEC);
    const snapshot = structuredClone(turn);
    resolveTurnLabel(turn);
    expect(turn).toEqual(snapshot);
  });
});

describe("readTurnTiming", () => {
  const valid = finishTurn(startStep(startTurn(T0), tool, T0), "done", T0 + SEC);

  it("returns the turn from metadata", () => {
    expect(readTurnTiming({ turn: valid })).toEqual(valid);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "x"],
    ["metadata without turn", { other: 1 }],
    ["a null turn", { turn: null }],
    ["a non-object turn", { turn: 5 }],
    ["a missing startedAt", { turn: { status: "done", steps: [] } }],
    ["a string startedAt", { turn: { startedAt: "1", status: "done", steps: [] } }],
    ["a missing status", { turn: { startedAt: 1, steps: [] } }],
    ["a non-array steps", { turn: { startedAt: 1, status: "done", steps: {} } }],
  ])("returns undefined for %s", (_label, metadata) => {
    expect(readTurnTiming(metadata)).toBeUndefined();
  });

  it("survives a JSON round trip", () => {
    const restored = readTurnTiming(JSON.parse(JSON.stringify({ turn: valid })));
    expect(restored).toEqual(valid);
  });
});

describe("withTurnTiming", () => {
  const turn = startTurn(T0);

  it("adds the turn to a message without metadata", () => {
    expect(withTurnTiming(message(), turn).metadata).toEqual({ turn });
  });

  it("keeps other metadata", () => {
    expect(withTurnTiming(message({ keep: 1 }), turn).metadata).toEqual({ keep: 1, turn });
  });

  it("replaces non-object metadata", () => {
    expect(withTurnTiming(message("junk"), turn).metadata).toEqual({ turn });
  });

  it("does not mutate the input message", () => {
    const input = message({ keep: 1 });
    withTurnTiming(input, turn);
    expect(input.metadata).toEqual({ keep: 1 });
  });

  it("round-trips through JSON and readTurnTiming", () => {
    const stamped = withTurnTiming(message(), finishTurn(turn, "done", T0 + SEC));
    const restored = JSON.parse(JSON.stringify(stamped)) as UIMessage;
    expect(readTurnTiming(restored.metadata)).toEqual(finishTurn(turn, "done", T0 + SEC));
  });
});

describe("withoutTurnTiming", () => {
  const turn = startTurn(T0);

  it("returns the same object when there is no metadata", () => {
    const input = message();
    expect(withoutTurnTiming(input)).toBe(input);
  });

  it("returns the same object when metadata has no turn", () => {
    const input = message({ keep: 1 });
    expect(withoutTurnTiming(input)).toBe(input);
  });

  it("returns the same object for non-object metadata", () => {
    const input = message("junk");
    expect(withoutTurnTiming(input)).toBe(input);
  });

  it("drops metadata entirely when turn was its only key", () => {
    expect(withoutTurnTiming(message({ turn }))).not.toHaveProperty("metadata");
  });

  it("keeps the remaining metadata keys", () => {
    expect(withoutTurnTiming(message({ turn, keep: 1 })).metadata).toEqual({ keep: 1 });
  });

  it("does not mutate the input", () => {
    const input = message({ turn, keep: 1 });
    withoutTurnTiming(input);
    expect(input.metadata).toEqual({ turn, keep: 1 });
  });
});
