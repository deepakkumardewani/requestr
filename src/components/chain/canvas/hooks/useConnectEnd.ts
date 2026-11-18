import type { FinalConnectionState } from "@xyflow/react";
import { useCallback } from "react";
import type { ConnectFrom } from "@/stores/useChainStore";
import type { ChainEdge } from "@/types/chain";
import { isValidChainConnection } from "./chainConnectionRules";

type Point = { x: number; y: number };

type UseConnectEndParams = {
  chainEdges: ChainEdge[];
  disabled?: boolean;
  /** Opens the add-block menu at `anchor`, attached to `connectFrom`. */
  openMenu: (anchor: Point, connectFrom: ConnectFrom) => void;
};

/** Drop coordinates of a mouse or touch gesture end. */
function dropPoint(event: MouseEvent | TouchEvent): Point {
  const source = "changedTouches" in event ? event.changedTouches[0] : event;
  return { x: source.clientX, y: source.clientY };
}

/**
 * `onConnectEnd` handler: a drag from a source handle released over empty
 * canvas opens the add-block menu there. Drops on a node/handle are left to
 * React Flow's own `onConnect`.
 */
export function useConnectEnd({
  chainEdges,
  disabled = false,
  openMenu,
}: UseConnectEndParams) {
  return useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      const { fromNode, fromHandle, toNode } = state;
      if (disabled || toNode || !fromNode || fromHandle?.type !== "source") {
        return;
      }
      const handleId = fromHandle.id ?? null;
      const allowed = isValidChainConnection(
        {
          source: fromNode.id,
          target: "",
          sourceHandle: handleId,
          targetHandle: null,
        },
        chainEdges,
      );
      if (!allowed) return;
      openMenu(dropPoint(event), { nodeId: fromNode.id, handleId });
    },
    [chainEdges, disabled, openMenu],
  );
}
