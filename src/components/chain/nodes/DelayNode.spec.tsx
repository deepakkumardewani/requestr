/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DelayNode } from "./DelayNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("DelayNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows wait duration when idle", () => {
    render(
      <DelayNode
        data={{
          nodeId: "d1",
          delayMs: 2500,
          state: "idle",
        }}
      />,
    );

    expect(screen.getByText("Wait")).toBeInTheDocument();
    expect(screen.getByText("2500")).toBeInTheDocument();
    expect(screen.getByText("ms")).toBeInTheDocument();
  });

  it("shows error message when failed", () => {
    render(
      <DelayNode
        data={{
          nodeId: "d1",
          delayMs: 2500,
          state: "failed",
          error: "Delay interrupted",
        }}
      />,
    );

    expect(screen.getByText("Delay interrupted")).toBeInTheDocument();
  });

  it("does not show error message when idle", () => {
    render(
      <DelayNode
        data={{
          nodeId: "d1",
          delayMs: 2500,
          state: "idle",
          error: "Delay interrupted",
        }}
      />,
    );

    expect(screen.queryByText("Delay interrupted")).not.toBeInTheDocument();
  });
});
