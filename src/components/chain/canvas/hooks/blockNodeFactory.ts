import type { Node } from "@xyflow/react";
import type { useChainErrorMessage } from "@/hooks/useChainErrorMessage";
import type {
  ChainNodeState,
  ChainNodeType,
  ChainRunState,
} from "@/types/chain";
import { BLOCK_REGISTRY } from "../../blockRegistry";

/** Fields every canvas node's `data` carries, derived from its run state. */
export type CommonNodeData = {
  state: ChainNodeState;
  error: string | undefined;
  isKeyboardFocused: boolean;
};

type RowLayout = { xStep: number; y: number };

/** Fallback position of a block with no saved one: a row per type, `xStep` apart. */
const DEFAULT_ROW_LAYOUT: Record<ChainNodeType, RowLayout> = {
  api: { xStep: 280, y: 120 },
  delay: { xStep: 200, y: 260 },
  condition: { xStep: 200, y: 400 },
  display: { xStep: 200, y: 320 },
  evaluate: { xStep: 200, y: 480 },
  validate: { xStep: 200, y: 560 },
  merge: { xStep: 200, y: 640 },
  loop: { xStep: 200, y: 680 },
  collect: { xStep: 200, y: 720 },
  subchain: { xStep: 200, y: 760 },
  // Above the main request row (y: 120) so it never collides with the first
  // API node's default position.
  start: { xStep: 0, y: -140 },
};

const FIRST_NODE_X = 40;

export type BlockNodeSpec<D extends Record<string, unknown>> = {
  block: { id: string };
  type: ChainNodeType;
  index: number;
  /** Builds the node's `data`; `common` carries the run-state-derived fields. */
  data: (common: CommonNodeData) => D;
  /** Extra memoization deps beyond block, position, run state and focus. */
  deps: unknown[];
};

export type BuildBlockNode = <D extends Record<string, unknown>>(
  spec: BlockNodeSpec<D>,
) => Node;

type BlockNodeFactoryInput = {
  runState: ChainRunState;
  nodePositions: Record<string, { x: number; y: number }>;
  keyboardFocusNodeId: string | null;
  chainErrorMessage: ReturnType<typeof useChainErrorMessage>;
  /** Per-id memo cache from `useNodeCache`. */
  nodeCache: (id: string, deps: unknown[], build: () => Node) => Node;
};

/** Returns the shared node builder: position fallback, run-state data and per-id memoization. */
export function createBlockNodeBuilder({
  runState,
  nodePositions,
  keyboardFocusNodeId,
  chainErrorMessage,
  nodeCache,
}: BlockNodeFactoryInput): BuildBlockNode {
  return ({ block, type, index, data, deps }) => {
    const { id } = block;
    const nodeState = runState[id];
    const focused = keyboardFocusNodeId === id;
    const layout = DEFAULT_ROW_LAYOUT[type];
    return nodeCache(
      id,
      [block, nodePositions[id], nodeState, focused, ...deps],
      () => ({
        id,
        type: BLOCK_REGISTRY[type].flowNodeType,
        position: nodePositions[id] ?? {
          x: index * layout.xStep + FIRST_NODE_X,
          y: layout.y,
        },
        selected: focused,
        deletable: false,
        data: data({
          state: nodeState?.state ?? "idle",
          error:
            chainErrorMessage(
              nodeState?.errorCode,
              nodeState?.errorParams,
              nodeState?.error,
            ) || undefined,
          isKeyboardFocused: focused,
        }),
      }),
    );
  };
}
