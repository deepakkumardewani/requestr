import { describe, expect, it, vi } from "vitest";
import { createLaneRegistry, isOwnTerminalUpdate } from "./schedulerLanes";

describe("isOwnTerminalUpdate", () => {
  it("is true for the node's own non-running update", () => {
    expect(isOwnTerminalUpdate("n", "n", "passed", {})).toBe(true);
    expect(isOwnTerminalUpdate("n", "n", "failed", {})).toBe(true);
  });

  it("is false while the node is still running", () => {
    expect(isOwnTerminalUpdate("n", "n", "running", {})).toBe(false);
  });

  it("is false for another node's update", () => {
    expect(isOwnTerminalUpdate("n", "other", "passed", {})).toBe(false);
  });

  it("is false for a nested update carrying a parentStepId", () => {
    expect(
      isOwnTerminalUpdate("n", "n", "passed", { parentStepId: "p" }),
    ).toBe(false);
  });
});

describe("createLaneRegistry", () => {
  it("opens a scope whose signal is live while the run is live", () => {
    const registry = createLaneRegistry();

    const scope = registry.open("n", new AbortController().signal, vi.fn());

    expect(scope.signal.aborted).toBe(false);
  });

  it("aborts the scope when the run signal aborts", () => {
    const registry = createLaneRegistry();
    const run = new AbortController();
    const scope = registry.open("n", run.signal, vi.fn());

    run.abort();

    expect(scope.signal.aborted).toBe(true);
  });

  it("opens an already-aborted scope when the run signal is already aborted", () => {
    const registry = createLaneRegistry();
    const run = new AbortController();
    run.abort();

    const scope = registry.open("n", run.signal, vi.fn());

    expect(scope.signal.aborted).toBe(true);
  });

  it("forwards every update to the notifier for a lane that was not cut", () => {
    const registry = createLaneRegistry();
    const notify = vi.fn();
    const scope = registry.open("n", new AbortController().signal, notify);

    scope.onUpdate("n", "running", {});
    scope.onUpdate("n", "passed", {});

    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("aborts only the cut lane and reports the cut", () => {
    const registry = createLaneRegistry();
    const run = new AbortController().signal;
    const cutScope = registry.open("a", run, vi.fn());
    const otherScope = registry.open("b", run, vi.fn());

    const didCut = registry.cut("a");

    expect(didCut).toBe(true);
    expect(cutScope.signal.aborted).toBe(true);
    expect(otherScope.signal.aborted).toBe(false);
  });

  it("returns false when cutting a lane that was never opened", () => {
    expect(createLaneRegistry().cut("ghost")).toBe(false);
  });

  it("returns false when cutting a lane that was already closed", () => {
    const registry = createLaneRegistry();
    registry.open("n", new AbortController().signal, vi.fn());
    registry.close("n");

    expect(registry.cut("n")).toBe(false);
  });

  it("mutes the terminal update of a cut lane but keeps its running and nested updates", () => {
    const registry = createLaneRegistry();
    const notify = vi.fn();
    const scope = registry.open("n", new AbortController().signal, notify);
    registry.cut("n");

    scope.onUpdate("n", "aborted", {});
    scope.onUpdate("n", "passed", { parentStepId: "n" });
    scope.onUpdate("n", "running", {});

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).not.toHaveBeenCalledWith("n", "aborted", {});
  });

  it("does not mute terminal updates of other nodes in a cut lane", () => {
    const registry = createLaneRegistry();
    const notify = vi.fn();
    const scope = registry.open("n", new AbortController().signal, notify);
    registry.cut("n");

    scope.onUpdate("child", "passed", {});

    expect(notify).toHaveBeenCalledWith("child", "passed", {});
  });

  it("reports whether a closed lane had been cut", () => {
    const registry = createLaneRegistry();
    registry.open("cutLane", new AbortController().signal, vi.fn());
    registry.open("plainLane", new AbortController().signal, vi.fn());
    registry.cut("cutLane");

    expect(registry.close("cutLane")).toBe(true);
    expect(registry.close("plainLane")).toBe(false);
  });

  it("clears the cut flag on close so a reopened lane is not muted", () => {
    const registry = createLaneRegistry();
    const notify = vi.fn();
    registry.open("n", new AbortController().signal, vi.fn());
    registry.cut("n");
    registry.close("n");

    const reopened = registry.open("n", new AbortController().signal, notify);
    reopened.onUpdate("n", "passed", {});

    expect(notify).toHaveBeenCalledWith("n", "passed", {});
  });

  it("stops following the run signal after close", () => {
    const registry = createLaneRegistry();
    const run = new AbortController();
    const scope = registry.open("n", run.signal, vi.fn());
    registry.close("n");

    run.abort();

    expect(scope.signal.aborted).toBe(false);
  });

  it("reuses a node id after close with an independent signal", () => {
    const registry = createLaneRegistry();
    const run = new AbortController().signal;
    const first = registry.open("n", run, vi.fn());
    registry.cut("n");
    registry.close("n");

    const second = registry.open("n", run, vi.fn());

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });

  it("returns false when closing a lane that was never opened", () => {
    expect(createLaneRegistry().close("ghost")).toBe(false);
  });
});
