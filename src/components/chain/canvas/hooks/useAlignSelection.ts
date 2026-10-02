import type { Node } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import {
  type AlignEdge,
  alignNodes,
  type DistributeAxis,
  distribute,
} from "@/lib/nodeAlign";
import { useChainStore } from "@/stores/useChainStore";

type UseAlignSelectionParams = {
  chainId: string;
  nodes: Node[];
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
};

/** Align/distribute for the current multi-selection; each action is one store mutation (one undo entry). */
export function useAlignSelection({
  chainId,
  nodes,
  setNodes,
}: UseAlignSelectionParams) {
  const selected = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  const apply = useCallback(
    (transform: (selection: Node[]) => Node[]) => {
      const moved = transform(selected);
      const positions: Record<string, { x: number; y: number }> = {};
      selected.forEach((node, index) => {
        const next = moved[index].position;
        if (next.x !== node.position.x || next.y !== node.position.y) {
          positions[node.id] = next;
        }
      });
      if (Object.keys(positions).length === 0) return;
      setNodes((prev) =>
        prev.map((n) =>
          positions[n.id] ? { ...n, position: positions[n.id] } : n,
        ),
      );
      useChainStore.getState().updateNodePositions(chainId, positions);
    },
    [chainId, selected, setNodes],
  );

  const align = useCallback(
    (edge: AlignEdge) => apply((s) => alignNodes(s, edge)),
    [apply],
  );
  const distributeNodes = useCallback(
    (axis: DistributeAxis) => apply((s) => distribute(s, axis)),
    [apply],
  );

  return {
    selectedCount: selected.length,
    align,
    distribute: distributeNodes,
  };
}
