import type { Node } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
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

  return useCallback(
    (direction: NudgeDirection, large = false): boolean => {
      const selected = nodes.filter((node) => node.selected);
      if (disabled || selected.length === 0) return false;

      const distance = GRID_STEP * (large ? SHIFT_NUDGE_STEPS : 1);
      const vector = DIRECTION_VECTORS[direction];
      const positions = Object.fromEntries(
        selected.map((node) => [
          node.id,
          {
            x: node.position.x + vector.x * distance,
            y: node.position.y + vector.y * distance,
          },
        ]),
      );

      setNodes((prev) =>
        prev.map((node) =>
          positions[node.id] ? { ...node, position: positions[node.id] } : node,
        ),
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
