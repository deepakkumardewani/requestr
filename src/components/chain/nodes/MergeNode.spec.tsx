/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MergeNode } from "./MergeNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("MergeNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows 'Wait for all' for mode all", () => {
    render(
      <MergeNode data={{ nodeId: "n1", mode: "all", state: "idle" }} />,
    );

    expect(screen.getByText("Merge")).toBeInTheDocument();
    expect(screen.getByText("Wait for all")).toBeInTheDocument();
  });

  it("shows 'First to pass' for mode any", () => {
    render(
      <MergeNode data={{ nodeId: "n1", mode: "any", state: "idle" }} />,
    );

    expect(screen.getByText("First to pass")).toBeInTheDocument();
  });

  it("shows the error strip when failed", () => {
    render(
      <MergeNode
        data={{
          nodeId: "n1",
          mode: "all",
          state: "failed",
          error: "Dependency failed or skipped upstream",
        }}
      />,
    );

    expect(
      screen.getByText("Dependency failed or skipped upstream"),
    ).toBeInTheDocument();
  });
});
