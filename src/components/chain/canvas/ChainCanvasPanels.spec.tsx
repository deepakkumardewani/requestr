/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainBlock, ChainEdge, ChainRunState } from "@/types/chain";
import { ChainCanvasPanels } from "./ChainCanvasPanels";

vi.mock("../panels/ConditionConfigPanel", () => ({
  ConditionConfigPanel: ({
    open,
    node,
    incomingEdges,
    onClose,
  }: {
    open: boolean;
    node: { id: string } | null;
    incomingEdges: { id: string }[];
    onClose: () => void;
  }) => (
    <div
      data-testid="condition-panel"
      data-open={String(open)}
      data-node={node?.id ?? ""}
    >
      <span data-testid="condition-edges">
        {incomingEdges.map((e) => e.id).join(",")}
      </span>
      <button type="button" data-testid="condition-close" onClick={onClose} />
    </div>
  ),
}));

vi.mock("../panels/LoopConfigPanel", () => ({
  LoopConfigPanel: ({
    sourceResponseBody,
  }: {
    sourceResponseBody?: string;
  }) => <div data-testid="loop-panel">{sourceResponseBody ?? "none"}</div>,
}));

type PanelsProps = Parameters<typeof ChainCanvasPanels>[0];

const NO_PANELS = {
  condition: null,
  start: null,
  evaluate: null,
  validate: null,
  merge: null,
  loop: null,
  collect: null,
  subchain: null,
};

function renderPanels(extra: Partial<PanelsProps> = {}) {
  const props = {
    contextMenu: null,
    requests: [],
    chainEdges: [],
    runState: {},
    blocks: [],
    panelIds: NO_PANELS,
    arrowPanel: { open: false, edgeId: null, displayNodeId: null },
    nodeAssertions: {},
    ...extra,
  } as unknown as PanelsProps;
  return render(<ChainCanvasPanels {...props} />);
}

const edge = (id: string, source: string, target: string): ChainEdge => ({
  id,
  sourceRequestId: source,
  targetRequestId: target,
  injections: [],
});

afterEach(cleanup);

describe("ChainCanvasPanels context menu", () => {
  it("renders no context menu when none is open", () => {
    renderPanels();

    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("duplicates the node and closes the menu when the block can be duplicated", async () => {
    const onDuplicateBlock = vi.fn();
    const onCloseContextMenu = vi.fn();
    renderPanels({
      contextMenu: { x: 0, y: 0, nodeId: "d1", nodeType: "delay" },
      onDuplicateBlock,
      onCloseContextMenu,
    });

    await userEvent.setup().click(screen.getByTestId("context-menu-duplicate"));

    expect(onDuplicateBlock).toHaveBeenCalledWith("d1");
    expect(onCloseContextMenu).toHaveBeenCalled();
  });

  it("does not offer Duplicate for a block type that cannot be duplicated", () => {
    renderPanels({
      contextMenu: { x: 0, y: 0, nodeId: "s1", nodeType: "start" },
    });

    expect(screen.queryByTestId("context-menu-duplicate")).toBeNull();
  });

  it("forwards Delete with the node id", async () => {
    const onDeleteNode = vi.fn();
    renderPanels({
      contextMenu: { x: 0, y: 0, nodeId: "d1", nodeType: "delay" },
      onDeleteNode,
      onCloseContextMenu: vi.fn(),
    });

    await userEvent.setup().click(screen.getByTestId("context-menu-delete"));

    expect(onDeleteNode).toHaveBeenCalledWith("d1");
  });
});

describe("ChainCanvasPanels condition panel", () => {
  const condition: ChainBlock = {
    id: "c1",
    type: "condition",
    variable: "{{x}}",
    branches: [],
  };

  it("keeps the panel closed with no node when no condition is targeted", () => {
    renderPanels({ blocks: [condition] });

    const panel = screen.getByTestId("condition-panel");
    expect(panel.dataset.open).toBe("false");
    expect(panel.dataset.node).toBe("");
  });

  it("opens with the targeted condition and only the edges pointing into it", async () => {
    renderPanels({
      blocks: [condition],
      panelIds: { ...NO_PANELS, condition: "c1" },
      chainEdges: [edge("in", "a", "c1"), edge("out", "c1", "b")],
    });

    const panel = await screen.findByTestId("condition-panel");
    expect(panel.dataset.open).toBe("true");
    expect(panel.dataset.node).toBe("c1");
    expect(screen.getByTestId("condition-edges")).toHaveTextContent(/^in$/);
  });

  it("closes the condition panel through onClosePanel", async () => {
    const onClosePanel = vi.fn();
    renderPanels({
      blocks: [condition],
      panelIds: { ...NO_PANELS, condition: "c1" },
      onClosePanel,
    });

    await userEvent.setup().click(await screen.findByTestId("condition-close"));

    expect(onClosePanel).toHaveBeenCalledWith("condition");
  });
});

describe("ChainCanvasPanels loop panel", () => {
  const loop: ChainBlock = {
    id: "l1",
    type: "loop",
    sourceJsonPath: "$",
    itemAlias: "item",
    maxIterations: 3,
  };
  const runState: ChainRunState = {
    api: {
      state: "passed",
      extractedValues: {},
      response: { body: "[1,2]" } as never,
    },
  };

  it("feeds the upstream request's response body to the loop panel", async () => {
    renderPanels({
      blocks: [loop],
      panelIds: { ...NO_PANELS, loop: "l1" },
      requests: [{ id: "api" } as never],
      chainEdges: [edge("e", "api", "l1")],
      runState,
    });

    expect(await screen.findByTestId("loop-panel")).toHaveTextContent("[1,2]");
  });

  it("passes no body when the loop has no upstream request", async () => {
    renderPanels({
      blocks: [loop],
      panelIds: { ...NO_PANELS, loop: "l1" },
      runState,
    });

    expect(await screen.findByTestId("loop-panel")).toHaveTextContent("none");
  });
});
