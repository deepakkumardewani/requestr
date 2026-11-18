import type { Edge, Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { toast } from "sonner";
import { computeAutoLayout } from "@/lib/chainLayout";
import { useChainStore } from "@/stores/useChainStore";

export const FIT_VIEW_OPTIONS = { padding: 0.2 } as const;

type UseAutoLayoutParams = {
  chainId: string;
  nodes: Node[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
};

/** Returns a callback that re-lays out the canvas, persists positions and fits the view. Shared by the toolbar button and the `L` shortcut. */
export function useAutoLayout({
  chainId,
  nodes,
  edges,
  setNodes,
  onUpdateNodePosition,
}: UseAutoLayoutParams) {
  const { fitView } = useReactFlow();
  const t = useTranslations("chain");

  return useCallback(() => {
    const positions = computeAutoLayout(nodes, edges);

    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        position: positions[node.id] ?? node.position,
      })),
    );

    const store = useChainStore.getState();
    // Batched so one layout is a single undo entry, not one per moved node.
    store.pauseHistory(chainId);
    for (const [id, pos] of Object.entries(positions)) {
      onUpdateNodePosition(id, pos);
    }
    store.resumeHistory(chainId);

    requestAnimationFrame(() => fitView(FIT_VIEW_OPTIONS));
    toast.success(t("autoLayoutApplied"));
  }, [chainId, nodes, edges, setNodes, onUpdateNodePosition, fitView, t]);
}
