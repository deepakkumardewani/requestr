/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayNode } from "./DisplayNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("DisplayNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders display header and JSON summary when configured with response", () => {
    render(
      <DisplayNode
        data={{
          nodeId: "disp1",
          config: {
            id: "disp1",
            type: "display",
            sourceJsonPath: "$.data",
            targetField: "body",
            targetKey: "out",
          },
          sourceResponse: {
            status: 200,
            statusText: "OK",
            headers: {},
            body: '{"foo":"bar","n":1}',
            duration: 12,
            size: 20,
            url: "https://api.example.com/x",
            method: "GET",
            timestamp: Date.now(),
          },
          state: "passed",
        }}
      />,
    );

    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText(/\.data/)).toBeInTheDocument();
  });

  it("hosts the toolbar in a NodeHoverFrame so it persists across the hover bridge", () => {
    const { container } = render(
      <DisplayNode
        data={{
          nodeId: "disp1",
          config: {
            id: "disp1",
            type: "display",
            sourceJsonPath: "$.data",
            targetField: "body",
            targetKey: "out",
          },
          state: "idle",
          onDeleteNode: vi.fn(),
        }}
      />,
    );
    const frame = container.firstElementChild as HTMLElement;

    expect(frame).toHaveClass("group/node", "-mt-9", "pt-9");
    expect(frame.querySelector(".rounded-full.border")).toHaveClass("top-0");
    expect(screen.getByTestId("display-node-disp1")).toBeInTheDocument();
    expect(container.querySelectorAll(".pt-9")).toHaveLength(1);
  });
});
