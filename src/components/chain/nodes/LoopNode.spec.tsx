/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoopNode } from "./LoopNode";

vi.mock("@xyflow/react", () => ({
  Handle: ({ id }: { id?: string }) => <div data-handle-id={id ?? "target"} />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("LoopNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the item alias and max iterations", () => {
    render(
      <LoopNode
        data={{
          nodeId: "n1",
          itemAlias: "item",
          maxIterations: 100,
          state: "idle",
        }}
      />,
    );

    expect(screen.getByText("Loop")).toBeInTheDocument();
    expect(screen.getByText("for item · max 100")).toBeInTheDocument();
  });

  it("renders a body handle and a completion (done) handle", () => {
    render(
      <LoopNode
        data={{
          nodeId: "n1",
          itemAlias: "item",
          maxIterations: 100,
          state: "idle",
        }}
      />,
    );

    expect(screen.getByText("Loop").closest("div")).toBeInTheDocument();
    expect(document.querySelector('[data-handle-id="body"]')).toBeInTheDocument();
    expect(document.querySelector('[data-handle-id="done"]')).toBeInTheDocument();
  });

  it("shows the paired Collect's label when bound", () => {
    render(
      <LoopNode
        data={{
          nodeId: "n1",
          itemAlias: "item",
          maxIterations: 100,
          state: "idle",
          pairedCollectLabel: "Collect",
        }}
      />,
    );

    expect(screen.getByText("→ Collect")).toBeInTheDocument();
  });

  it("shows the error strip when failed", () => {
    render(
      <LoopNode
        data={{
          nodeId: "n1",
          itemAlias: "item",
          maxIterations: 100,
          state: "failed",
          error: "sourceJsonPath did not resolve to an array",
        }}
      />,
    );

    expect(
      screen.getByText("sourceJsonPath did not resolve to an array"),
    ).toBeInTheDocument();
  });
});
