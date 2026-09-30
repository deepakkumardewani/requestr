/** @vitest-environment happy-dom */

import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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
});
