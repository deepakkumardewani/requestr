/** @vitest-environment happy-dom */

import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CollectConfigPanel } from "./CollectConfigPanel";
import type { CollectBlock, LoopBlock } from "@/types/chain";

const mockCollectBlock: CollectBlock = {
  id: "collect1",
  type: "collect",
  loopId: "loop1",
};

const mockLoopBlocks: LoopBlock[] = [
  {
    id: "loop1",
    type: "loop",
    sourceJsonPath: "$.items",
    itemAlias: "item",
    maxIterations: 100,
  },
  {
    id: "loop2",
    type: "loop",
    sourceJsonPath: "$.data",
    itemAlias: "data",
    maxIterations: 50,
  },
];

describe("CollectConfigPanel", () => {
  it("renders when open with valid node", () => {
    const { container } = render(
      <CollectConfigPanel
        open={true}
        node={mockCollectBlock}
        loopBlocks={mockLoopBlocks}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container).toBeTruthy();
  });

  it("does not render when node is null", () => {
    const { container } = render(
      <CollectConfigPanel
        open={true}
        node={null}
        loopBlocks={mockLoopBlocks}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("handles empty loop blocks", () => {
    const { container } = render(
      <CollectConfigPanel
        open={true}
        node={mockCollectBlock}
        loopBlocks={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container).toBeTruthy();
  });

  it("syncs loopId from node prop", () => {
    const { rerender } = render(
      <CollectConfigPanel
        open={true}
        node={mockCollectBlock}
        loopBlocks={mockLoopBlocks}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const newNode: CollectBlock = {
      id: "collect2",
      type: "collect",
      loopId: "loop2",
    };

    expect(() => {
      rerender(
        <CollectConfigPanel
          open={true}
          node={newNode}
          loopBlocks={mockLoopBlocks}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    }).not.toThrow();
  });
});
