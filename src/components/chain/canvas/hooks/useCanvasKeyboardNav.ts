import type { Node } from "@xyflow/react";
import { useCallback } from "react";
import { isEditableTarget } from "@/lib/isEditableTarget";

const REQUEST_FLOW_NODE_TYPE = "chainNode";

type UseCanvasKeyboardNavParams = {
  nodes: Node[];
  keyboardFocusNodeId: string | null;
  setKeyboardFocusNodeId: (id: string | null) => void;
  pendingNodeType:
    | "delay"
    | "condition"
    | "display"
    | "evaluate"
    | "validate"
    | "merge"
    | "loop"
    | "collect"
    | "subchain"
    | null;
  onClickNode: (requestId: string) => void;
  onConfigureNode: (node: Node) => void;
  onCloseDetails: () => void;
};

/** Sorts nodes into a stable reading order (top-to-bottom, then left-to-right). */
function sortNodeIds(nodes: Node[]): string[] {
  return [...nodes]
    .sort((a, b) => {
      const dy = a.position.y - b.position.y;
      if (Math.abs(dy) > 10) return dy;
      return a.position.x - b.position.x;
    })
    .map((n) => n.id);
}

/** Arrow / Enter / Escape navigation for the chain canvas. */
export function useCanvasKeyboardNav({
  nodes,
  keyboardFocusNodeId,
  setKeyboardFocusNodeId,
  pendingNodeType,
  onClickNode,
  onConfigureNode,
  onCloseDetails,
}: UseCanvasKeyboardNavParams) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(e.target)) return;
      if (pendingNodeType) return;

      const sortedIds = sortNodeIds(nodes);
      if (sortedIds.length === 0) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setKeyboardFocusNodeId(null);
        onCloseDetails();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const id = keyboardFocusNodeId ?? sortedIds[0];
        const node = nodes.find((n) => n.id === id);
        if (!node) return;
        // Requests open their details sheet; every other block configures like a double-click.
        if (node.type === REQUEST_FLOW_NODE_TYPE) onClickNode(id);
        else onConfigureNode(node);
        return;
      }

      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp"
      ) {
        e.preventDefault();
        const focusIdx = keyboardFocusNodeId
          ? sortedIds.indexOf(keyboardFocusNodeId)
          : -1;
        let nextIdx = focusIdx >= 0 ? focusIdx : 0;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          nextIdx = (nextIdx + 1) % sortedIds.length;
        } else {
          nextIdx = (nextIdx - 1 + sortedIds.length) % sortedIds.length;
        }
        setKeyboardFocusNodeId(sortedIds[nextIdx]);
      }
    },
    [
      pendingNodeType,
      nodes,
      keyboardFocusNodeId,
      setKeyboardFocusNodeId,
      onClickNode,
      onConfigureNode,
      onCloseDetails,
    ],
  );
}
