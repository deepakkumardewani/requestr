/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import enChain from "../../../../messages/en/chain.json";
import { BlockMenu } from "./BlockMenu";

describe("BlockMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens menu and invokes onAddApiClick for HTTP Request", async () => {
    const user = userEvent.setup();
    const onAddApiClick = vi.fn();
    const onEnterGhostMode = vi.fn();

    render(
      <BlockMenu
        onAddApiClick={onAddApiClick}
        onEnterGhostMode={onEnterGhostMode}
      />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));

    await user.click(screen.getByRole("button", { name: /HTTP Request/i }));

    expect(onAddApiClick).toHaveBeenCalledTimes(1);
    expect(onEnterGhostMode).not.toHaveBeenCalled();
  });

  it("narrows the block list by fuzzy match on name", async () => {
    const user = userEvent.setup();

    render(
      <BlockMenu onAddApiClick={vi.fn()} onEnterGhostMode={vi.fn()} />,
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
      <BlockMenu onAddApiClick={vi.fn()} onEnterGhostMode={vi.fn()} />,
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
      <BlockMenu onAddApiClick={vi.fn()} onEnterGhostMode={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));
    await user.type(screen.getByTestId("block-menu-search"), "zzz");

    expect(screen.getByText("No blocks found")).toBeInTheDocument();
  });

  it("invokes onAddStartClick for Start", async () => {
    const user = userEvent.setup();
    const onAddStartClick = vi.fn();
    const onEnterGhostMode = vi.fn();

    render(
      <BlockMenu
        onAddApiClick={vi.fn()}
        onEnterGhostMode={onEnterGhostMode}
        onAddStartClick={onAddStartClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));
    await user.click(screen.getByTestId("block-menu-item-start"));

    expect(onAddStartClick).toHaveBeenCalledTimes(1);
    expect(onEnterGhostMode).not.toHaveBeenCalled();
  });

  it("renders the Start entry's localized name and description from messages", async () => {
    const user = userEvent.setup();

    render(<BlockMenu onAddApiClick={vi.fn()} onEnterGhostMode={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /block/i }));

    const startItem = screen.getByTestId("block-menu-item-start");
    expect(startItem).toHaveTextContent(enChain.blockMenuStartName);
    expect(startItem).toHaveTextContent(enChain.blockMenuStartDescription);
  });

  it("hides the Start entry once the chain already has a Start node", async () => {
    const user = userEvent.setup();

    render(
      <BlockMenu
        onAddApiClick={vi.fn()}
        onEnterGhostMode={vi.fn()}
        hasStartNode
      />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));

    expect(
      screen.queryByTestId("block-menu-item-start"),
    ).not.toBeInTheDocument();
  });

  it("navigates results with ArrowDown/Enter", async () => {
    const user = userEvent.setup();
    const onEnterGhostMode = vi.fn();

    render(
      <BlockMenu onAddApiClick={vi.fn()} onEnterGhostMode={onEnterGhostMode} />,
    );

    await user.click(screen.getByRole("button", { name: /block/i }));
    const search = screen.getByTestId("block-menu-search");
    await user.type(search, "e");
    // First filtered item is highlighted by default; move down one and select.
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onEnterGhostMode).toHaveBeenCalledTimes(1);
  });
});
