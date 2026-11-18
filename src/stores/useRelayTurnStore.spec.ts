import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLegalTransition,
  TURN_PHASES,
  type TurnPhase,
  useRelayTurnStore,
} from "./useRelayTurnStore";

/** Independent of the source table: the phases each phase may move to. */
const ALLOWED: Record<TurnPhase, TurnPhase[]> = {
  idle: ["streaming", "awaiting-user", "running-tools", "capped", "errored", "stopped"],
  streaming: ["idle", "awaiting-user", "running-tools", "stopped", "capped", "errored"],
  "awaiting-user": ["streaming", "running-tools", "idle", "stopped", "errored"],
  "running-tools": ["streaming", "awaiting-user", "idle", "stopped", "capped", "errored"],
  stopped: ["streaming"],
  capped: ["streaming", "idle", "stopped"],
  errored: ["streaming", "idle", "stopped"],
};

const pairs = TURN_PHASES.flatMap((from) =>
  TURN_PHASES.filter((to) => to !== from).map((to) => [from, to] as const),
);

describe("useRelayTurnStore", () => {
  beforeEach(() => {
    useRelayTurnStore.getState().reset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isLegalTransition", () => {
    it.each(pairs)("%s -> %s matches the lifecycle table", (from, to) => {
      expect(isLegalTransition(from, to)).toBe(ALLOWED[from].includes(to));
    });

    it("a stopped turn can only be left by a new turn", () => {
      const exits = TURN_PHASES.filter((to) => isLegalTransition("stopped", to));
      expect(exits).toEqual(["streaming"]);
    });
  });

  describe("transition", () => {
    it("starts idle", () => {
      expect(useRelayTurnStore.getState().phase).toBe("idle");
    });

    it("moves on a legal transition and reports success", () => {
      expect(useRelayTurnStore.getState().transition("streaming")).toBe(true);
      expect(useRelayTurnStore.getState().phase).toBe("streaming");
    });

    it("refuses an illegal transition, keeps the phase and logs why", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayTurnStore.getState().transition("stopped");

      const moved = useRelayTurnStore.getState().transition("idle", "late tool result");

      expect(moved).toBe(false);
      expect(useRelayTurnStore.getState().phase).toBe("stopped");
      expect(warn).toHaveBeenCalledWith(
        "[relay] illegal turn transition refused",
        { from: "stopped", to: "idle", reason: "late tool result" },
      );
    });

    it("a late running-tools result cannot restart a stopped turn", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayTurnStore.getState().transition("stopped");

      expect(useRelayTurnStore.getState().transition("running-tools")).toBe(false);
      expect(useRelayTurnStore.getState().phase).toBe("stopped");
    });

    it("treats a move to the current phase as a quiet success", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayTurnStore.getState().transition("streaming");

      expect(useRelayTurnStore.getState().transition("streaming")).toBe(true);
      expect(warn).not.toHaveBeenCalled();
    });

    it("a new send leaves stopped through streaming", () => {
      useRelayTurnStore.getState().transition("stopped");
      expect(useRelayTurnStore.getState().transition("streaming")).toBe(true);
      expect(useRelayTurnStore.getState().phase).toBe("streaming");
    });
  });

  describe("reset", () => {
    it("returns to idle from stopped without a transition and drops a pending request", () => {
      useRelayTurnStore.getState().transition("stopped");
      useRelayTurnStore
        .getState()
        .requestKeepUndo({ turnId: "u1", changeIds: ["c1"], resolve: vi.fn() });

      useRelayTurnStore.getState().reset();

      expect(useRelayTurnStore.getState().phase).toBe("idle");
      expect(useRelayTurnStore.getState().keepUndoRequest).toBeNull();
    });
  });

  describe("keep/undo request", () => {
    it("holds the request until it is cleared", () => {
      const resolve = vi.fn();
      useRelayTurnStore
        .getState()
        .requestKeepUndo({ turnId: "u1", changeIds: ["c1", "c2"], resolve });

      expect(useRelayTurnStore.getState().keepUndoRequest).toMatchObject({
        turnId: "u1",
        changeIds: ["c1", "c2"],
      });

      useRelayTurnStore.getState().clearKeepUndo();
      expect(useRelayTurnStore.getState().keepUndoRequest).toBeNull();
      expect(resolve).not.toHaveBeenCalled();
    });
  });
});
