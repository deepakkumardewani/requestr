/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import enChain from "../../../../messages/en/chain.json";
import { BLOCK_REGISTRY } from "../blockRegistry";
import { AnchoredBlockMenu, BlockMenu } from "./BlockMenu";

describe("BlockMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens menu and invokes onAddBlock for HTTP Request", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();

    render(<BlockMenu onAddBlock={onAddBlock} />);

    await user.click(screen.getByRole("button", { name: /block/i }));
    await user.click(screen.getByRole("button", { name: /HTTP Request/i }));

    expect(onAddBlock).toHaveBeenCalledTimes(1);
    expect(onAddBlock).toHaveBeenCalledWith("api");
  });

  it("renders every registry block type grouped by category", async () => {
    const user = userEvent.setup();
    render(<BlockMenu onAddBlock={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /block/i }));

    for (const type of Object.keys(BLOCK_REGISTRY)) {
      expect(screen.getByTestId(`block-menu-item-${type}`)).toBeInTheDocument();
    }
    const categories = new Set(
      Object.values(BLOCK_REGISTRY).map((def) => def.categoryKey),
    );
    for (const key of categories) {
      expect(screen.getByText(enChain[key])).toBeInTheDocument();
    }
  });

  it("narrows the block list by fuzzy match on name", async () => {
    const user = userEvent.setup();

    render(
      <BlockMenu onAddBlock={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));
    await user.type(screen.getByTestId("block-menu-search"), "del");

    expect(screen.getByTestId("block-menu-item-delay")).toBeInTheDocument();
    expect(
      screen.queryByTestId("block-menu-item-condition"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("block-menu-item-api"),
    ).not.toBeInTheDocument();
  });

  it("matches non-contiguous fuzzy subsequences", async () => {
    const user = userEvent.setup();

    render(
      <BlockMenu onAddBlock={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));
    // "cdn" is a subsequence of "Condition" but not a substring
    await user.type(screen.getByTestId("block-menu-search"), "cdn");

    expect(
      screen.getByTestId("block-menu-item-condition"),
    ).toBeInTheDocument();
  });

  it("shows a no-results message when nothing matches", async () => {
    const user = userEvent.setup();

    render(
      <BlockMenu onAddBlock={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));
    await user.type(screen.getByTestId("block-menu-search"), "zzz");

    expect(screen.getByText("No blocks found")).toBeInTheDocument();
  });

  it("invokes onAddBlock for Start", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();

    render(<BlockMenu onAddBlock={onAddBlock} />);

    await user.click(screen.getByRole("button", { name: /block/i }));
    await user.click(screen.getByTestId("block-menu-item-start"));

    expect(onAddBlock).toHaveBeenCalledWith("start");
  });

  it("renders the Start entry's localized name and description from messages", async () => {
    const user = userEvent.setup();

    render(<BlockMenu onAddBlock={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /block/i }));

    const startItem = screen.getByTestId("block-menu-item-start");
    expect(startItem).toHaveTextContent(enChain.blockMenuStartName);
    expect(startItem).toHaveTextContent(enChain.blockMenuStartDescription);
  });

  it("hides the Start entry once the chain already has a Start node", async () => {
    const user = userEvent.setup();

    render(
      <BlockMenu onAddBlock={vi.fn()} hasStartNode />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));

    expect(
      screen.queryByTestId("block-menu-item-start"),
    ).not.toBeInTheDocument();
  });

  it("navigates results with ArrowDown/Enter", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();

    render(<BlockMenu onAddBlock={onAddBlock} />);

    await user.click(screen.getByRole("button", { name: /block/i }));
    const search = screen.getByTestId("block-menu-search");
    await user.type(search, "e");
    // First filtered item is highlighted by default; move down one and select.
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onAddBlock).toHaveBeenCalledTimes(1);
  });
});

describe("AnchoredBlockMenu", () => {
  afterEach(() => {
    cleanup();
  });

  const anchor = { x: 120, y: 80 };

  it("lists every block type and passes position and connectFrom on choose", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();
    const onClose = vi.fn();
    const connectFrom = { nodeId: "n1", handleId: "body" };

    render(
      <AnchoredBlockMenu
        anchor={anchor}
        position={{ x: 5, y: 6 }}
        connectFrom={connectFrom}
        onAddBlock={onAddBlock}
        onClose={onClose}
      />,
    );

    for (const type of Object.keys(BLOCK_REGISTRY)) {
      expect(screen.getByTestId(`block-menu-item-${type}`)).toBeInTheDocument();
    }
    await user.click(screen.getByTestId("block-menu-item-delay"));

    expect(onAddBlock).toHaveBeenCalledWith("delay", {
      position: { x: 5, y: 6 },
      connectFrom,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("autofocuses the pane search field and filters", async () => {
    const user = userEvent.setup();
    render(
      <AnchoredBlockMenu
        anchor={anchor}
        onAddBlock={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const search = screen.getByTestId("block-menu-search");
    expect(search).toHaveAttribute("placeholder", enChain.paneMenuSearch);
    await user.type(search, "del");
    expect(screen.getByTestId("block-menu-item-delay")).toBeInTheDocument();
    expect(
      screen.queryByTestId("block-menu-item-condition"),
    ).not.toBeInTheDocument();
  });

  it("hides Start when one exists and hides blocks without a target handle on request", () => {
    const { rerender } = render(
      <AnchoredBlockMenu
        anchor={anchor}
        hasStartNode
        onAddBlock={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("block-menu-item-start"),
    ).not.toBeInTheDocument();

    rerender(
      <AnchoredBlockMenu
        anchor={anchor}
        hideWithoutTargetHandle
        onAddBlock={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("block-menu-item-start"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("block-menu-item-delay")).toBeInTheDocument();
  });

  it("closes on Escape without adding a block", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();
    const onClose = vi.fn();
    render(
      <AnchoredBlockMenu
        anchor={anchor}
        onAddBlock={onAddBlock}
        onClose={onClose}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(onAddBlock).not.toHaveBeenCalled();
  });
});

