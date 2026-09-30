/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ValidateNode } from "./ValidateNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("ValidateNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the source JSONPath", () => {
    render(
      <ValidateNode
        data={{ nodeId: "n1", sourceJsonPath: "$.data.token", state: "idle" }}
      />,
    );

    expect(screen.getByText("Validate")).toBeInTheDocument();
    expect(screen.getByText("$.data.token")).toBeInTheDocument();
  });

  it("shows a fallback label when the path is unset", () => {
    render(
      <ValidateNode
        data={{ nodeId: "n1", sourceJsonPath: "", state: "idle" }}
      />,
    );

    expect(screen.getByText("$ (whole response)")).toBeInTheDocument();
  });

  it("shows the error strip with the first three errors when failed", () => {
    render(
      <ValidateNode
        data={{
          nodeId: "n1",
          sourceJsonPath: "",
          state: "failed",
          error: "$.id: must be number; $.name: is required",
        }}
      />,
    );

    expect(
      screen.getByText("$.id: must be number; $.name: is required"),
    ).toBeInTheDocument();
  });
});
