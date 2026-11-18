/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { LoopConfigPanel } from "./LoopConfigPanel";
import type { LoopBlock } from "@/types/chain";

const mockLoopBlock: LoopBlock = {
  id: "loop1",
  type: "loop",
  sourceJsonPath: "$.items",
  itemAlias: "item",
  maxIterations: 100,
};

describe("LoopConfigPanel", () => {
  afterEach(cleanup);

  it("renders when open with valid node", () => {
    const { container } = render(
      <LoopConfigPanel
        open={true}
        node={mockLoopBlock}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container).toBeTruthy();
  });

  it("does not render when node is null", () => {
    const { container } = render(
      <LoopConfigPanel
        open={true}
        node={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("syncs state from node prop", () => {
    const { rerender } = render(
      <LoopConfigPanel
        open={true}
        node={mockLoopBlock}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const newNode: LoopBlock = {
      id: "loop2",
      type: "loop",
      sourceJsonPath: "$.newItems",
      itemAlias: "newItem",
      maxIterations: 50,
    };

    expect(() => {
      rerender(
        <LoopConfigPanel
          open={true}
          node={newNode}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    }).not.toThrow();
  });

  it.each(["index", "my-var", "collect.x"])(
    "disables Save and explains the rule for invalid alias %s",
    async (alias) => {
      const user = userEvent.setup();
      render(
        <LoopConfigPanel
          open
          node={mockLoopBlock}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />,
      );

      const input = screen.getByPlaceholderText("e.g. item");
      await user.clear(input);
      await user.type(input, alias);

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByText(/cannot be "index"/)).toBeInTheDocument();
    },
  );

  it("keeps Save enabled for a valid alias", () => {
    render(
      <LoopConfigPanel
        open
        node={mockLoopBlock}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
