/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blockGroups,
  graphFromBlocks,
  graphNodeIds,
} from "@/lib/chainRunner/runGraph";
import { idleRunState } from "@/lib/chainRunner/stepRecording";
import {
  CHAIN_NODE_TYPES,
  type ChainBlock,
  type ChainNodeType,
} from "@/types/chain";
import {
  BLOCK_REGISTRY,
  BLOCK_TYPES_IN_MENU_ORDER,
  FLOW_NODE_TYPES,
  getNodeType,
} from "./blockRegistry";
import { BlockMenu } from "./canvas/BlockMenu";
import { NodeContextMenu } from "./canvas/NodeContextMenu";

const ONE_OF_EACH_BLOCK: ChainBlock[] = [
  { id: "delay-1", type: "delay", delayMs: 100 },
  { id: "cond-1", type: "condition", variable: "{{x}}", branches: [] },
  {
    id: "disp-1",
    type: "display",
    sourceJsonPath: "$.a",
    targetField: "url",
    targetKey: "k",
  },
  { id: "start-1", type: "start", inputs: [] },
  { id: "eval-1", type: "evaluate", code: "1", outputAlias: "a" },
  { id: "val-1", type: "validate", schema: "{}", sourceJsonPath: "$.a" },
  { id: "merge-1", type: "merge", mode: "all" },
  {
    id: "loop-1",
    type: "loop",
    sourceJsonPath: "$.a",
    itemAlias: "item",
    maxIterations: 3,
  },
  { id: "collect-1", type: "collect", loopId: "loop-1" },
  { id: "sub-1", type: "subchain", chainId: "c2", inputBindings: {} },
];

function renderContextMenu(nodeType: ChainNodeType) {
  render(
    <NodeContextMenu
      x={0}
      y={0}
      requestId="node-1"
      nodeType={nodeType}
      onClose={vi.fn()}
      onAddAfter={vi.fn()}
      onRunUpTo={vi.fn()}
      onRunFromHere={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onConfigure={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("blockRegistry", () => {
  it("has an entry for every ChainNodeType", () => {
    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual(
      [...CHAIN_NODE_TYPES].sort(),
    );
    expect([...BLOCK_TYPES_IN_MENU_ORDER].sort()).toEqual(
      [...CHAIN_NODE_TYPES].sort(),
    );
  });

  it("registers a distinct React Flow component per block type", () => {
    const flowTypes = CHAIN_NODE_TYPES.map(
      (type) => BLOCK_REGISTRY[type].flowNodeType,
    );
    expect(new Set(flowTypes).size).toBe(CHAIN_NODE_TYPES.length);
    expect(Object.keys(FLOW_NODE_TYPES).sort()).toEqual([...flowTypes].sort());
    for (const type of CHAIN_NODE_TYPES) {
      expect(FLOW_NODE_TYPES[BLOCK_REGISTRY[type].flowNodeType]).toBe(
        BLOCK_REGISTRY[type].nodeComponent,
      );
    }
  });

  it("getNodeType resolves blocks and falls back to api for plain requests", () => {
    expect(getNodeType(ONE_OF_EACH_BLOCK, "merge-1")).toBe("merge");
    expect(getNodeType(ONE_OF_EACH_BLOCK, "start-1")).toBe("start");
    expect(getNodeType(ONE_OF_EACH_BLOCK, "request-1")).toBe("api");
  });
});

/** Expected BlockMenu contents, in DOM order (grouped by category), from pre-registry behaviour. */
const EXPECTED_MENU: ReadonlyArray<
  readonly [ChainNodeType, string, string, "request" | "start" | "ghost"]
> = [
  ["api", "HTTP Request", "Primitives", "request"],
  ["start", "Start", "Primitives", "start"],
  ["condition", "Condition", "Logic", "ghost"],
  ["delay", "Delay", "Logic", "ghost"],
  ["display", "Display", "Logic", "ghost"],
  ["evaluate", "Evaluate", "Logic", "ghost"],
  ["validate", "Validate", "Logic", "ghost"],
  ["merge", "Merge", "Logic", "ghost"],
  ["loop", "Loop", "Logic", "ghost"],
  ["collect", "Collect", "Logic", "ghost"],
  ["subchain", "Sub-chain", "Logic", "ghost"],
];

const CONFIGURE = "Configure";
const DUPLICATE = "Duplicate";
const RUN_UP_TO = "Run up to here";
const RUN_FROM = "Run from here";
const DELETE = "Delete node";
const CONFIGURE_DUPLICATE_RUN = [CONFIGURE, DUPLICATE, RUN_UP_TO, RUN_FROM, DELETE];
const CONFIGURE_RUN = [CONFIGURE, RUN_UP_TO, RUN_FROM, DELETE];

/** Expected context-menu entries per type, in order, from pre-registry behaviour. */
const EXPECTED_CONTEXT_MENU: Record<ChainNodeType, string[]> = {
  api: ["Add API after this", RUN_UP_TO, RUN_FROM, DELETE],
  delay: [RUN_UP_TO, RUN_FROM, DELETE],
  condition: CONFIGURE_RUN,
  display: [CONFIGURE, DUPLICATE, DELETE],
  start: CONFIGURE_RUN,
  evaluate: CONFIGURE_DUPLICATE_RUN,
  validate: CONFIGURE_DUPLICATE_RUN,
  merge: CONFIGURE_DUPLICATE_RUN,
  loop: CONFIGURE_DUPLICATE_RUN,
  collect: CONFIGURE_RUN,
  subchain: CONFIGURE_DUPLICATE_RUN,
};

describe("BlockMenu driven by the registry", () => {
  async function openMenu(hasStartNode: boolean) {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();
    render(<BlockMenu hasStartNode={hasStartNode} onAddBlock={onAddBlock} />);
    await user.click(screen.getByTestId("block-menu-trigger"));
    return { user, onAddBlock };
  }

  it("lists each block type in order with its label and category", async () => {
    await openMenu(false);
    const items = screen.getAllByTestId(/^block-menu-item-/);
    expect(
      items.map((el) => el.getAttribute("data-testid")?.replace("block-menu-item-", "")),
    ).toEqual(EXPECTED_MENU.map(([type]) => type));
    EXPECTED_MENU.forEach(([, label], index) => {
      expect(items[index]).toHaveTextContent(label);
    });
    expect(screen.getByText("Primitives")).toBeInTheDocument();
    expect(screen.getByText("Logic")).toBeInTheDocument();
  });

  it("hides only the Start item once the chain has one", async () => {
    await openMenu(true);
    expect(screen.queryByTestId("block-menu-item-start")).toBeNull();
    expect(screen.getAllByTestId(/^block-menu-item-/)).toHaveLength(
      EXPECTED_MENU.length - 1,
    );
  });

  it.each(EXPECTED_MENU)(
    "selecting %s (%s, %s) hands the type to the shared add-block command (%s)",
    async (type) => {
      const { user, onAddBlock } = await openMenu(false);
      await user.click(screen.getByTestId(`block-menu-item-${type}`));
      expect(onAddBlock).toHaveBeenCalledTimes(1);
      expect(onAddBlock).toHaveBeenCalledWith(type);
    },
  );
});

describe("NodeContextMenu entries per block type", () => {
  it.each(CHAIN_NODE_TYPES)("%s shows exactly its expected entries", (type) => {
    renderContextMenu(type);
    expect(
      screen.getAllByRole("menuitem").map((el) => el.textContent?.trim()),
    ).toEqual(EXPECTED_CONTEXT_MENU[type]);
  });
});

describe("idleRunState", () => {
  it("covers every block of every type when given the blocks", () => {
    const idle = idleRunState(ONE_OF_EACH_BLOCK.map((b) => b.id));

    expect(Object.keys(idle).sort()).toEqual(
      ONE_OF_EACH_BLOCK.map((b) => b.id).sort(),
    );
    for (const entry of Object.values(idle)) {
      expect(entry).toEqual({ state: "idle", extractedValues: {} });
    }
  });

  it("agrees with the ids of a graph built from the same blocks", () => {
    const graph = graphFromBlocks(ONE_OF_EACH_BLOCK, [], []);
    expect(Object.keys(idleRunState(graphNodeIds(graph))).sort()).toEqual(
      Object.keys(idleRunState(ONE_OF_EACH_BLOCK.map((b) => b.id))).sort(),
    );
  });

  it("the runner's block groups plus api/start cover every ChainNodeType", () => {
    const grouped = blockGroups({}).map(([type]) => type);
    expect([...grouped, "api", "start"].sort()).toEqual(
      [...CHAIN_NODE_TYPES].sort(),
    );
  });
});
