/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainNodeType } from "@/types/chain";
import type { ConfigurableBlockType } from "../blockRegistry";
import { ChainCanvasPanels } from "./ChainCanvasPanels";

type PanelsProps = Parameters<typeof ChainCanvasPanels>[0];

const CONFIGURABLE: ConfigurableBlockType[] = [
  "start",
  "display",
  "condition",
  "evaluate",
  "validate",
  "merge",
  "loop",
  "collect",
  "subchain",
];

function renderPanels(
  nodeType: ChainNodeType,
  extra: Partial<PanelsProps> = {},
) {
  const onConfigureBlock = vi.fn();
  const onCloseContextMenu = vi.fn();
  const props = {
    contextMenu: { x: 0, y: 0, nodeId: "node-1", nodeType },
    requests: [],
    chainEdges: [],
    runState: {},
    blocks: [],
    panelIds: {
      condition: null,
      start: null,
      evaluate: null,
      validate: null,
      merge: null,
      loop: null,
      collect: null,
      subchain: null,
    },
    arrowPanel: { open: false, edgeId: null, displayNodeId: null },
    onCloseContextMenu,
    onConfigureBlock,
    ...extra,
  } as unknown as PanelsProps;
  render(<ChainCanvasPanels {...props} />);
  return { onConfigureBlock, onCloseContextMenu };
}

afterEach(cleanup);

describe("ChainCanvasPanels context-menu Configure", () => {
  it.each(CONFIGURABLE)("opens the %s config surface", async (type) => {
    const { onConfigureBlock, onCloseContextMenu } = renderPanels(type);
    await userEvent
      .setup()
      .click(screen.getByRole("menuitem", { name: /configure/i }));
    expect(onConfigureBlock).toHaveBeenCalledTimes(1);
    expect(onConfigureBlock).toHaveBeenCalledWith(type, "node-1");
    expect(onCloseContextMenu).toHaveBeenCalled();
  });
});

describe("ChainCanvasPanels context-menu Change reference", () => {
  it("routes the Sub-chain entry to onChangeSubChainReference and closes the menu", async () => {
    const onChangeSubChainReference = vi.fn();
    const { onCloseContextMenu } = renderPanels("subchain", {
      onChangeSubChainReference,
    });
    await userEvent
      .setup()
      .click(screen.getByRole("menuitem", { name: /change/i }));
    expect(onChangeSubChainReference).toHaveBeenCalledWith("node-1");
    expect(onCloseContextMenu).toHaveBeenCalled();
  });

  it("hides the entry when no handler is supplied", () => {
    renderPanels("subchain");
    expect(screen.queryByRole("menuitem", { name: /change/i })).toBeNull();
  });
});
