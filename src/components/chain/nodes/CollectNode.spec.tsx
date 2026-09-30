/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectNode } from "./CollectNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("CollectNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows its bound Loop by label when known", () => {
    render(
      <CollectNode
        data={{
          nodeId: "n1",
          loopId: "loop-1",
          loopLabel: "Loop",
          state: "idle",
        }}
      />,
    );

    expect(screen.getByText("Collect")).toBeInTheDocument();
    expect(screen.getByText("from Loop")).toBeInTheDocument();
  });

  it("falls back to the raw loopId when no label is supplied", () => {
    render(
      <CollectNode data={{ nodeId: "n1", loopId: "loop-1", state: "idle" }} />,
    );

    expect(screen.getByText("from loop-1")).toBeInTheDocument();
  });

  it("shows 'unpaired' when there is no bound loop", () => {
    render(<CollectNode data={{ nodeId: "n1", loopId: "", state: "idle" }} />);

    expect(screen.getByText("unpaired")).toBeInTheDocument();
  });

  it("shows the error strip when failed", () => {
    render(
      <CollectNode
        data={{
          nodeId: "n1",
          loopId: "loop-1",
          state: "failed",
          error: "Run stopped",
        }}
      />,
    );

    expect(screen.getByText("Run stopped")).toBeInTheDocument();
  });
});
