import type { OnUpdateFn } from "./types";

/** Per-node view of the run: a signal a Merge can cut, and an `onUpdate` that mutes a cut lane. */
export type NodeScope = {
  signal: AbortSignal;
  onUpdate: OnUpdateFn;
};

type Lane = { controller: AbortController; dispose: () => void };

export type LaneRegistry = {
  open: (
    nodeId: string,
    runSignal: AbortSignal,
    notify: OnUpdateFn,
  ) => NodeScope;
  /** Aborts an in-flight lane and marks it cut. Returns false if no lane is open. */
  cut: (nodeId: string) => boolean;
  /** Disposes the lane; returns true when it had been cut. */
  close: (nodeId: string) => boolean;
};

/**
 * True for a node's own terminal update. Nested updates (loop iterations,
 * sub-chain steps) carry `parentStepId` and are never terminal for the node.
 */
export function isOwnTerminalUpdate(
  nodeId: string,
  ...[id, state, data]: Parameters<OnUpdateFn>
): boolean {
  return (
    id === nodeId && data.parentStepId === undefined && state !== "running"
  );
}

/** Lanes of dispatched nodes, so an "any" Merge can cut the ones in flight. */
export function createLaneRegistry(): LaneRegistry {
  const lanes = new Map<string, Lane>();
  const cutLanes = new Set<string>();

  const open: LaneRegistry["open"] = (nodeId, runSignal, notify) => {
    const controller = new AbortController();
    const followRun = () => controller.abort();
    if (runSignal.aborted) followRun();
    else runSignal.addEventListener("abort", followRun, { once: true });
    lanes.set(nodeId, {
      controller,
      dispose: () => runSignal.removeEventListener("abort", followRun),
    });

    // The node's own terminal update is replaced by the "skipped" recorded on close.
    const onUpdate: OnUpdateFn = (id, state, data) => {
      if (isOwnTerminalUpdate(nodeId, id, state, data) && cutLanes.has(nodeId))
        return;
      notify(id, state, data);
    };
    return { signal: controller.signal, onUpdate };
  };

  const cut: LaneRegistry["cut"] = (nodeId) => {
    const lane = lanes.get(nodeId);
    if (!lane) return false;
    cutLanes.add(nodeId);
    lane.controller.abort();
    return true;
  };

  const close: LaneRegistry["close"] = (nodeId) => {
    lanes.get(nodeId)?.dispose();
    lanes.delete(nodeId);
    return cutLanes.delete(nodeId);
  };

  return { open, cut, close };
}
