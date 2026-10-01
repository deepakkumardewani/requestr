/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Edge } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoLayoutControl } from "./AutoLayoutControl";

const fitView = vi.fn();

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ fitView }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

describe("AutoLayoutControl", () => {
  afterEach(() => {
    cleanup();
    fitView.mockClear();
  });

  it("runs layout and fits view when clicked", async () => {
    const user = userEvent.setup();
    const onUpdateNodePosition = vi.fn();
    const setNodes = vi.fn();

    render(
      <AutoLayoutControl
        chainId="chain-1"
        nodes={[
          {
            id: "n1",
            position: { x: 0, y: 0 },
            data: {},
          },
        ]}
        edges={[] as Edge[]}
        disabled={false}
        onUpdateNodePosition={onUpdateNodePosition}
        setNodes={setNodes}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /auto-arrange nodes/i }),
    );

    expect(setNodes).toHaveBeenCalled();
    expect(onUpdateNodePosition).toHaveBeenCalled();
  });
});
