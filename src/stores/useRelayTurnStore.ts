"use client";

import { create } from "zustand";

/**
 * Where the turn in flight is. `stopped` is entered only by the Stop button
 * and left only by a new send or a Retry/Regenerate, so a late tool result can
 * never restart a turn the user ended.
 */
export const TURN_PHASES = [
  "idle",
  "streaming",
  "awaiting-user",
  "running-tools",
  "stopped",
  "capped",
  "errored",
] as const;

export type TurnPhase = (typeof TURN_PHASES)[number];

const LEGAL_TRANSITIONS: Readonly<Record<TurnPhase, readonly TurnPhase[]>> = {
  // A batched render can show a settled chat without ever showing it streaming.
  idle: [
    "streaming",
    "awaiting-user",
    "running-tools",
    "capped",
    "errored",
    "stopped",
  ],
  streaming: [
    "idle",
    "awaiting-user",
    "running-tools",
    "stopped",
    "capped",
    "errored",
  ],
  "awaiting-user": ["streaming", "running-tools", "idle", "stopped", "errored"],
  "running-tools": [
    "streaming",
    "awaiting-user",
    "idle",
    "stopped",
    "capped",
    "errored",
  ],
  stopped: ["streaming"],
  capped: ["streaming", "idle", "stopped"],
  errored: ["streaming", "idle", "stopped"],
};

export function isLegalTransition(from: TurnPhase, to: TurnPhase): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** A turn change the user is being asked about before the turn is cut (Regenerate, Edit & resend). */
export type KeepUndoRequest = {
  /** The turn whose applied changes are at stake. */
  turnId: string;
  changeIds: readonly string[];
  /**
   * Called once the user chose. `kept` lists the changes that stay applied;
   * `null` means the user backed out and nothing is cut.
   */
  resolve: (kept: readonly string[] | null) => void;
};

type TurnState = {
  phase: TurnPhase;
  keepUndoRequest: KeepUndoRequest | null;
};

type TurnActions = {
  /** Moves to `to` when the transition is legal; an illegal one is refused and logged. */
  transition: (to: TurnPhase, reason?: string) => boolean;
  /** Back to idle without a transition, for a thread switch that discards the turn. */
  reset: () => void;
  requestKeepUndo: (request: KeepUndoRequest) => void;
  clearKeepUndo: () => void;
};

export const useRelayTurnStore = create<TurnState & TurnActions>(
  (set, get) => ({
    phase: "idle",
    keepUndoRequest: null,

    transition(to, reason) {
      const from = get().phase;
      if (from === to) return true;
      if (!isLegalTransition(from, to)) {
        console.warn("[relay] illegal turn transition refused", {
          from,
          to,
          reason,
        });
        return false;
      }
      set({ phase: to });
      return true;
    },

    reset() {
      set({ phase: "idle", keepUndoRequest: null });
    },

    requestKeepUndo(request) {
      set({ keepUndoRequest: request });
    },

    clearKeepUndo() {
      set({ keepUndoRequest: null });
    },
  }),
);
