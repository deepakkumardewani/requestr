import type { Node } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useRef } from "react";
import { GRID_STEP } from "@/lib/chainConstants";
import { createCoalescer } from "@/lib/createCoalescer";
import { useChainStore } from "@/stores/useChainStore";

/** Shift+Arrow moves this many cells. */
export const SHIFT_NUDGE_STEPS = 10;
/** Presses closer together than this fold into a single undo entry. */
export const NUDGE_COALESCE_MS = 400;

export type NudgeDirection = "up" | "down" | "left" | "right";

const DIRECTION_VECTORS: Record<NudgeDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type UseNudgeParams = {
  chainId: string;
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  /** Blocks nudging while a run is animating the graph (mirrors auto-layout). */
  disabled?: boolean;
};

/**
 * Persists positions without opening an undo entry. History is paused for the
 * write and the captured snapshot is dropped, so the burst's first press (which
 * did record) stays the only entry.
 */
function persistPositionsWithoutHistory(
  chainId: string,
  positions: Record<string, { x: number; y: number }>,
): void {
  const store = useChainStore.getState();
  // An enclosing batch owns its own pause; leave it to resume normally.
  if (chainId in store.pausedHistory) {
    store.updateNodePositions(chainId, positions);
    return;
  }
  store.pauseHistory(chainId);
  store.updateNodePositions(chainId, positions);
  useChainStore.setState((state) => {
    const { [chainId]: _discarded, ...pausedHistory } = state.pausedHistory;
    return { pausedHistory };
  });
}

/**
 * Returns a callback that moves the selected nodes one step. Callers own the
 * canvas-focus / editable-target checks; this returns false when it did nothing
 * (no selection, or disabled) so the key can fall through to other handlers.
 */
export function useNudge({
  chainId,
  nodes,
  setNodes,
  disabled = false,
}: UseNudgeParams) {
  const coalescer = useMemo(
    () => createCoalescer({ windowMs: NUDGE_COALESCE_MS }),
    [],
  );
  const nodesRef = useRef(nodes);
  const pendingPositions = useRef<Record<string, { x: number; y: number }>>({});

  if (nodesRef.current !== nodes) {
    const previous = new Map(
      nodesRef.current.map((node) => [node.id, node.position]),
    );
    for (const node of nodes) {
      const pending = pendingPositions.current[node.id];
      if (!pending) continue;
      const prior = previous.get(node.id);
      const caughtUp =
        pending.x === node.position.x && pending.y === node.position.y;
      const unchanged =
        prior?.x === node.position.x && prior?.y === node.position.y;
      if (caughtUp || !unchanged) {
        delete pendingPositions.current[node.id];
      }
    }
    nodesRef.current = nodes;
  }

  return useCallback(
    (direction: NudgeDirection, large = false): boolean => {
      const selected = nodes.filter((node) => node.selected);
      if (disabled || selected.length === 0) return false;

      const distance = GRID_STEP * (large ? SHIFT_NUDGE_STEPS : 1);
      const vector = DIRECTION_VECTORS[direction];
      const positions: Record<string, { x: number; y: number }> = {};
      for (const node of selected) {
        const base = pendingPositions.current[node.id] ?? node.position;
        positions[node.id] = {
          x: base.x + vector.x * distance,
          y: base.y + vector.y * distance,
        };
      }
      pendingPositions.current = {
        ...pendingPositions.current,
        ...positions,
      };

      const measuredById = new Map(
        nodes
          .filter(
            (node) =>
              typeof node.measured?.width === "number" &&
              typeof node.measured?.height === "number",
          )
          .map((node) => [node.id, node.measured]),
      );

      setNodes((prev) =>
        prev.map((node) => {
          const position = positions[node.id];
          if (!position) return node;
          const measured =
            typeof node.measured?.width === "number" &&
            typeof node.measured?.height === "number"
              ? node.measured
              : measuredById.get(node.id);
          return measured
            ? { ...node, position, measured }
            : { ...node, position };
        }),
      );

      if (coalescer.tick()) {
        persistPositionsWithoutHistory(chainId, positions);
      } else {
        useChainStore.getState().updateNodePositions(chainId, positions);
      }
      return true;
    },
    [chainId, nodes, setNodes, disabled, coalescer],
  );
}
