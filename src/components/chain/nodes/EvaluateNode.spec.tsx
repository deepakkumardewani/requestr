/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvaluateNode } from "./EvaluateNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("EvaluateNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the output alias", () => {
    render(
      <EvaluateNode
        data={{ nodeId: "n1", outputAlias: "token", state: "idle" }}
      />,
    );

    expect(screen.getByText("Evaluate")).toBeInTheDocument();
    expect(screen.getByText("token")).toBeInTheDocument();
  });

  it("shows a fallback label when the alias is unset", () => {
    render(<EvaluateNode data={{ nodeId: "n1", outputAlias: "", state: "idle" }} />);

    expect(screen.getByText("unset alias")).toBeInTheDocument();
  });

  it("shows the error strip when failed", () => {
    render(
      <EvaluateNode
        data={{
          nodeId: "n1",
          outputAlias: "token",
          state: "failed",
          error: "ReferenceError: x is not defined",
        }}
      />,
    );

    expect(
      screen.getByText("ReferenceError: x is not defined"),
    ).toBeInTheDocument();
  });
});
