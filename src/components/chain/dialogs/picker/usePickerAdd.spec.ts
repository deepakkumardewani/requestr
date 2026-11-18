/** @vitest-environment happy-dom */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AFTER_NODE_OFFSET_X,
  NODE_WIDTH_ESTIMATE,
  RIGHT_OF_BOUNDS_GAP,
  STACK_GAP_Y,
} from "@/lib/nodePlacement";
import { useChainStore } from "@/stores/useChainStore";
import type { AddApiIntent, Chain } from "@/types/chain";
import { usePickerAdd } from "./usePickerAdd";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/idb", () => ({ getDB: () => undefined }));

const CHAIN_ID = "chain-1";

function seedChain(overrides: Partial<Chain> = {}): Chain {
  return {
    id: CHAIN_ID,
    scope: "standalone",
    schemaVersion: 5,
    name: "Test chain",
    createdAt: 0,
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
    ...overrides,
  };
}

function setup(intent?: AddApiIntent, chain: Chain = seedChain()) {
  useChainStore.setState({
    chains: { [CHAIN_ID]: chain },
    hydrated: true,
    history: {},
  });
  const onClose = vi.fn();
  const onNodesAdded = vi.fn();
  const { result } = renderHook(() =>
    usePickerAdd({ chainId: CHAIN_ID, intent, onClose, onNodesAdded })
  );
  return { add: result.current, onClose, onNodesAdded };
}

const chainState = () => useChainStore.getState().chains[CHAIN_ID];

describe("usePickerAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places on the viewport fallback for an empty canvas, staggered in selection order", () => {
    const { add } = setup();
    add(["a", "b", "c"]);
    const { nodePositions } = chainState();
    expect(nodePositions.a).toEqual({ x: 0, y: 0 });
    expect(nodePositions.b).toEqual({ x: 0, y: STACK_GAP_Y });
    expect(nodePositions.c).toEqual({ x: 0, y: STACK_GAP_Y * 2 });
  });

  it("places right of the existing bounds by default", () => {
    const { add } = setup(
      undefined,
      seedChain({
        nodeIds: ["x", "y"],
        nodePositions: { x: { x: 10, y: 40 }, y: { x: 300, y: 90 } },
      })
    );
    add(["a"]);
    expect(chainState().nodePositions.a).toEqual({
      x: 300 + NODE_WIDTH_ESTIMATE + RIGHT_OF_BOUNDS_GAP,
      y: 40,
    });
  });

  it("places after the anchor node", () => {
    const { add } = setup(
      { anchorNodeId: "x" },
      seedChain({ nodeIds: ["x"], nodePositions: { x: { x: 50, y: 60 } } })
    );
    add(["a"]);
    expect(chainState().nodePositions.a).toEqual({
      x: 50 + AFTER_NODE_OFFSET_X,
      y: 60,
    });
  });

  it("places at an explicit drop position", () => {
    const { add } = setup({ position: { x: 5, y: 7 } });
    add(["a"]);
    expect(chainState().nodePositions.a).toEqual({ x: 5, y: 7 });
  });

  it("joins the pending connection to the first node only", () => {
    const { add } = setup({
      position: { x: 5, y: 7 },
      pendingConnection: { nodeId: "src" },
    });
    add(["a", "b"]);
    const { edges } = chainState();
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      sourceRequestId: "src",
      targetRequestId: "a",
    });
  });

  it("removes every added node with a single undo", () => {
    const { add } = setup();
    add(["a", "b", "c"]);
    expect(chainState().nodeIds).toEqual(["a", "b", "c"]);
    useChainStore.getState().undo(CHAIN_ID);
    expect(chainState().nodeIds).toEqual([]);
  });

  it("closes, reports added ids, and skips ids already in the chain", () => {
    const { add, onClose, onNodesAdded } = setup(
      undefined,
      seedChain({ nodeIds: ["a"] })
    );
    const result = add(["a", "b"]);
    expect(result).toEqual({ added: ["b"], skipped: ["a"] });
    expect(onNodesAdded).toHaveBeenCalledWith(["b"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("adds nothing and records no history when every id is already present", () => {
    const { add, onClose, onNodesAdded } = setup(
      undefined,
      seedChain({ nodeIds: ["a"] })
    );
    expect(add(["a"])).toEqual({ added: [], skipped: ["a"] });
    expect(onNodesAdded).not.toHaveBeenCalled();
    expect(useChainStore.getState().history[CHAIN_ID]).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it("never touches the chain until add is called", () => {
    setup({ pendingConnection: { nodeId: "src" } });
    expect(chainState().nodeIds).toEqual([]);
    expect(chainState().edges).toEqual([]);
  });
});
