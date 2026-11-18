import type { Connection, Edge, EdgeChange, Node } from "@xyflow/react";
import { useCallback } from "react";
import { useChainStore } from "@/stores/useChainStore";
import type { ChainEdge } from "@/types/chain";
import { isValidChainConnection } from "./useChainConnect";

type UseFlowHandlersParams = {
  chainId: string;
  chainEdges: ChainEdge[];
  onEdgesChange: (changes: EdgeChange[]) => void;
  onDeleteEdge: (edgeId: string) => void;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
};

/** React Flow's drag, edge-change and connection-validity handlers, wired to the chain store. */
export function useFlowHandlers({
  chainId,
  chainEdges,
  onEdgesChange,
  onDeleteEdge,
  onUpdateNodePosition,
}: UseFlowHandlersParams) {
  const isValidConnection = useCallback(
    (edgeOrConnection: Edge | Connection) =>
      isValidChainConnection(edgeOrConnection as Connection, chainEdges),
    [chainEdges],
  );

  // A drag is one undo entry, however many position updates it produces.
  const onNodeDragStart = useCallback(() => {
    useChainStore.getState().pauseHistory(chainId);
  }, [chainId]);

  const onNodeDragStop = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      onUpdateNodePosition(node.id, node.position);
      useChainStore.getState().resumeHistory(chainId);
    },
    [onUpdateNodePosition, chainId],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") onDeleteEdge(change.id);
      }
    },
    [onDeleteEdge, onEdgesChange],
  );

  return {
    isValidConnection,
    onNodeDragStart,
    onNodeDragStop,
    handleEdgesChange,
  };
}
