/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MergeBlock } from "@/types/chain";
import { MergeConfigPanel } from "./MergeConfigPanel";

function buildNode(overrides: Partial<MergeBlock> = {}): MergeBlock {
  return {
    id: "merge-1",
    type: "merge",
    mode: "all",
    ...overrides,
  };
}

describe("MergeConfigPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when node is null", () => {
    const { container } = render(
      <MergeConfigPanel
        open={false}
        node={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("toggles mode and saves", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <MergeConfigPanel
        open
        node={buildNode({ mode: "all" })}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("merge-config-mode-any-btn"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "any" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("deletes the node", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(
      <MergeConfigPanel
        open
        node={buildNode()}
        onClose={onClose}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete node/i }));

    expect(onDelete).toHaveBeenCalledWith("merge-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels without saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <MergeConfigPanel
        open
        node={buildNode()}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
