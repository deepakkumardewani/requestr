import type { Node, NodeMouseHandler, ReactFlowProps } from "@xyflow/react";
import { useCallback, useState } from "react";
import type { ChainBlock, ChainNodeType } from "@/types/chain";
import {
  BLOCK_REGISTRY,
  BLOCK_TYPES_IN_MENU_ORDER,
  type ConfigurableBlockType,
  getNodeType,
  isConfigurableBlockType,
} from "../../blockRegistry";
import type { ContextMenuState } from "../ChainCanvas.types";

const BLOCK_TYPE_BY_FLOW_TYPE = new Map<string, ChainNodeType>(
  BLOCK_TYPES_IN_MENU_ORDER.map((type) => [
    BLOCK_REGISTRY[type].flowNodeType,
    type,
  ]),
);

type UseNodeInteractionsParams = {
  blocks: readonly ChainBlock[];
  configureBlock: (type: ConfigurableBlockType, nodeId: string) => void;
};

/** Right-click menu and double-click-to-configure, both resolved through the block registry. */
export function useNodeInteractions({
  blocks,
  configureBlock,
}: UseNodeInteractionsParams) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeType: getNodeType(blocks, node.id),
      });
    },
    [blocks],
  );

  /**
   * With 2+ nodes selected React Flow draws a selection rect over them that
   * swallows right-clicks, so `onNodeContextMenu` never fires. Resolve the node
   * under the pointer (fallback: first selected) so the menu, and its
   * align/distribute entries, stay reachable.
   */
  const onSelectionContextMenu: NonNullable<
    ReactFlowProps["onSelectionContextMenu"]
  > = useCallback(
    (event, selectedNodes) => {
      const hoveredId = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((el) => el.classList.contains("react-flow__node"))
        ?.getAttribute("data-id");
      const target =
        selectedNodes.find((n) => n.id === hoveredId) ?? selectedNodes[0];
      if (!target) return;
      onNodeContextMenu(event, target);
    },
    [onNodeContextMenu],
  );

  /** Single dispatch for double-click and Enter; blocks without a config surface are a no-op. */
  const configureNode = useCallback(
    (node: Pick<Node, "id" | "type">) => {
      const type = BLOCK_TYPE_BY_FLOW_TYPE.get(node.type ?? "");
      if (type && isConfigurableBlockType(type)) configureBlock(type, node.id);
    },
    [configureBlock],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => configureNode(node),
    [configureNode],
  );

  return {
    contextMenu,
    closeContextMenu,
    onNodeContextMenu,
    onSelectionContextMenu,
    onNodeDoubleClick,
    configureNode,
  };
}
