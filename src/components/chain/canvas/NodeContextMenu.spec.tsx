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

  it("offers Change reference only for sub-chain nodes and calls back with the node id", async () => {
    const user = userEvent.setup();
    const onChangeReference = vi.fn();
    const props = {
      x: 100,
      y: 100,
      requestId: "sub-1",
      onClose: vi.fn(),
      onAddAfter: vi.fn(),
      onRunUpTo: vi.fn(),
      onRunFromHere: vi.fn(),
      onDelete: vi.fn(),
      onChangeReference,
    };
    const { unmount } = render(<NodeContextMenu {...props} nodeType="subchain" />);

    await user.click(screen.getByRole("menuitem", { name: /change reference/i }));
    expect(onChangeReference).toHaveBeenCalledWith("sub-1");
    unmount();

    render(<NodeContextMenu {...props} nodeType="api" />);
    expect(screen.queryByRole("menuitem", { name: /change reference/i })).toBeNull();
  });
  describe("align / distribute", () => {
    const base = {
      x: 100,
      y: 100,
      requestId: "req-1",
      nodeType: "api" as const,
      onClose: vi.fn(),
      onAddAfter: vi.fn(),
      onRunUpTo: vi.fn(),
      onRunFromHere: vi.fn(),
      onDelete: vi.fn(),
    };

    it("hides align and distribute items for a single selection", () => {
      render(<NodeContextMenu {...base} selectedCount={1} />);
      expect(screen.queryByRole("menuitem", { name: /align left/i })).toBeNull();
      expect(screen.queryByRole("menuitem", { name: /distribute/i })).toBeNull();
    });

    it("shows align items and disables distribute for exactly 2 nodes", async () => {
      const user = userEvent.setup();
      const onAlign = vi.fn();
      const onDistribute = vi.fn();
      const onClose = vi.fn();
      render(
        <NodeContextMenu
          {...base}
          onClose={onClose}
          selectedCount={2}
          onAlign={onAlign}
          onDistribute={onDistribute}
        />,
      );

      for (const name of [/align left/i, /align top/i, /align right/i, /align bottom/i]) {
        expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
      }
      const horizontal = screen.getByRole("menuitem", { name: /distribute horizontally/i });
      expect(horizontal).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("menuitem", { name: /distribute vertically/i }),
      ).toHaveAttribute("aria-disabled", "true");

      await user.click(screen.getByRole("menuitem", { name: /align right/i }));
      expect(onAlign).toHaveBeenCalledTimes(1);
      expect(onAlign).toHaveBeenCalledWith("right");
      expect(onClose).toHaveBeenCalled();
      expect(onDistribute).not.toHaveBeenCalled();
    });

    it("enables distribute for 3+ nodes and reports the axis", async () => {
      const user = userEvent.setup();
      const onDistribute = vi.fn();
      render(
        <NodeContextMenu {...base} selectedCount={3} onDistribute={onDistribute} />,
      );

      await user.click(
        screen.getByRole("menuitem", { name: /distribute vertically/i }),
      );
      expect(onDistribute).toHaveBeenCalledWith("vertical");
    });
  });
});
