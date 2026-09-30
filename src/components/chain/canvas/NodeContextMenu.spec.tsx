/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeContextMenu } from "./NodeContextMenu";

describe("NodeContextMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("runs callback when choosing Run up to here", async () => {
    const user = userEvent.setup();
    const onRunUpTo = vi.fn();
    const onClose = vi.fn();

    render(
      <NodeContextMenu
        x={100}
        y={100}
        requestId="req-9"
        nodeType="api"
        onClose={onClose}
        onAddAfter={vi.fn()}
        onRunUpTo={onRunUpTo}
        onRunFromHere={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("menuitem", { name: /run up to here/i }));

    expect(onRunUpTo).toHaveBeenCalledWith("req-9");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not offer Duplicate for a start node (at most one Start per chain)", async () => {
    render(
      <NodeContextMenu
        x={100}
        y={100}
        requestId="start-1"
        nodeType="start"
        onClose={vi.fn()}
        onAddAfter={vi.fn()}
        onRunUpTo={vi.fn()}
        onRunFromHere={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onConfigure={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("menuitem", { name: /duplicate/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /configure/i }),
    ).toBeInTheDocument();
  });

  it("offers Configure, Duplicate, and Delete for a merge node", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const onConfigure = vi.fn();
    const onClose = vi.fn();

    render(
      <NodeContextMenu
        x={100}
        y={100}
        requestId="merge-1"
        nodeType="merge"
        onClose={onClose}
        onAddAfter={vi.fn()}
        onRunUpTo={vi.fn()}
        onRunFromHere={vi.fn()}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onConfigure={onConfigure}
      />,
    );

    expect(
      screen.getByRole("menuitem", { name: /configure/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /duplicate/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));
    expect(onDuplicate).toHaveBeenCalledWith("merge-1");
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    await user.click(screen.getByRole("menuitem", { name: /delete node/i }));
    expect(onDelete).toHaveBeenCalledWith("merge-1");
  });
});
