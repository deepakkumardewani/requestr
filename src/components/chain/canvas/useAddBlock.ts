import { useStoreApi } from "@xyflow/react";
import { useCallback } from "react";
import { generateId } from "@/lib/utils";
import { type ConnectFrom, useChainStore } from "@/stores/useChainStore";
import type { AddApiIntent, ChainBlock, ChainNodeType } from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";
import {
  BLOCK_REGISTRY,
  type GhostBlockType,
  isGhostBlockType,
} from "../blockRegistry";
import type { PanelOpeners } from "./hooks/useCanvasPanels";

const DEFAULT_DELAY_MS = 1000;
const DEFAULT_LOOP_MAX_ITERATIONS = 100;

type Point = { x: number; y: number };

type GhostBlock = Exclude<ChainBlock, { type: "start" | "history" }>;

/** A freshly added block of `type` with the same defaults click-to-place uses. */
export function createDefaultBlock(
  type: GhostBlockType,
  id: string = generateId(),
): GhostBlock {
  switch (type) {
    case "delay":
      return { id, type, delayMs: DEFAULT_DELAY_MS };
    case "display":
      return {
        id,
        type,
        sourceJsonPath: "",
        targetField: "header",
        targetKey: "",
      };
    case "evaluate":
      return { id, type, code: "return data;", outputAlias: "result" };
    case "validate":
      return { id, type, schema: "{}", sourceJsonPath: "" };
    case "merge":
      return { id, type, mode: "all" };
    case "loop":
      return {
        id,
        type,
        sourceJsonPath: "",
        itemAlias: "item",
        maxIterations: DEFAULT_LOOP_MAX_ITERATIONS,
      };
    case "collect":
      return { id, type, loopId: "" };
    case "subchain":
      return { id, type, chainId: "", inputBindings: {} };
    case "condition":
      return {
        id,
        type,
        variable: "{{value}}",
        branches: [
          { id: generateId(), label: "branch 1", expression: "== 'value'" },
          { id: generateId(), label: CHAIN_HANDLE_IDS.ELSE, expression: "" },
        ],
      };
  }
}

/** Where a block lands and what it attaches to; both optional. */
export type AddBlockOptions = {
  position?: Point;
  connectFrom?: ConnectFrom;
};

/** Signature of the shared add-block command returned by `useAddBlock`. */
export type AddBlockFn = (
  type: ChainNodeType,
  options?: AddBlockOptions,
) => void;

type UseAddBlockParams = {
  chainId: string;
  hasStartBlock: boolean;
  /** Opens the Add API dialog carrying where/how the first request should land. */
  onOpenApiPicker: (intent?: AddApiIntent) => void;
  onEnterGhostMode: (type: GhostBlockType) => void;
  panelOpeners: PanelOpeners;
  onOpenSubChainPicker: (nodeId: string) => void;
};

/** Moves keyboard focus onto the node card once React Flow has rendered it. */
function focusNodeCard(nodeId: string): void {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(
        `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`,
      )
      ?.focus();
  });
}

/**
 * The single "add a block" command shared by the toolbar menu, the pane
 * right-click menu, the connection-drop menu and the empty-canvas cards.
 */
export function useAddBlock({
  chainId,
  onOpenApiPicker,
  onEnterGhostMode,
  panelOpeners,
  onOpenSubChainPicker,
}: UseAddBlockParams): AddBlockFn {
  const storeApi = useStoreApi();

  const viewportCenter = useCallback((): Point => {
    const { width, height, transform } = storeApi.getState();
    const [tx, ty, zoom] = transform;
    return { x: (width / 2 - tx) / zoom, y: (height / 2 - ty) / zoom };
  }, [storeApi]);

  const openConfigSurface = useCallback(
    (type: GhostBlockType, id: string) => {
      if (type === "subchain") onOpenSubChainPicker(id);
      else if (type !== "delay" && type !== "display") {
        panelOpeners[type](id);
      }
    },
    [panelOpeners, onOpenSubChainPicker],
  );

  const addAt = useCallback(
    (block: ChainBlock, options: AddBlockOptions) => {
      useChainStore.getState().addBlockWithEdge(chainId, block, options);
      focusNodeCard(block.id);
    },
    [chainId],
  );

  return useCallback(
    (type: ChainNodeType, { position, connectFrom }: AddBlockOptions = {}) => {
      const { addAction } = BLOCK_REGISTRY[type];
      if (addAction === "request") {
        onOpenApiPicker({ position, pendingConnection: connectFrom });
        return;
      }
      if (addAction === "start") {
        // Start has no target handle. A second Start is refused by the store,
        // which toasts instead of inserting another block.
        if (connectFrom) return;
        addAt(
          { id: generateId(), type: "start", inputs: [] },
          { position: position ?? viewportCenter() },
        );
        return;
      }
      if (!isGhostBlockType(type)) return;
      if (!position) {
        onEnterGhostMode(type);
        return;
      }
      const block = createDefaultBlock(type);
      addAt(block, { position, connectFrom });
      openConfigSurface(type, block.id);
    },
    [
      onOpenApiPicker,
      onEnterGhostMode,
      addAt,
      viewportCenter,
      openConfigSurface,
    ],
  );
}
