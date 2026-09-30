/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainInput } from "@/types/chain";
import { StartNode } from "./StartNode";

vi.mock("@xyflow/react", () => ({
  Handle: (props: { id?: string }) => (
    <div data-testid={`handle-${props.id ?? "default"}`} />
  ),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

const inputs: ChainInput[] = [
  { key: "token", defaultValue: "abc", source: "literal" },
  { key: "userId", defaultValue: "", source: "env", envVarKey: "USER_ID" },
];

describe("StartNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the Start label", () => {
    render(
      <StartNode data={{ nodeId: "s1", inputs: [], state: "idle" }} />,
    );

    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("renders one output handle per input, keyed by the input's key", () => {
    render(
      <StartNode data={{ nodeId: "s1", inputs, state: "idle" }} />,
    );

    expect(screen.getByTestId("handle-token")).toBeInTheDocument();
    expect(screen.getByTestId("handle-userId")).toBeInTheDocument();
    expect(screen.getByText("token")).toBeInTheDocument();
    expect(screen.getByText("userId")).toBeInTheDocument();
  });

  it("shows a placeholder message when there are no inputs", () => {
    render(
      <StartNode data={{ nodeId: "s1", inputs: [], state: "idle" }} />,
    );

    expect(screen.getByText("No inputs defined")).toBeInTheDocument();
  });

  it("invokes onDeleteNode when the delete button is clicked", () => {
    const onDeleteNode = vi.fn();
    render(
      <StartNode
        data={{
          nodeId: "s1",
          inputs: [],
          state: "idle",
          onDeleteNode,
        }}
      />,
    );

    screen.getByLabelText("Remove start from chain").click();
    expect(onDeleteNode).toHaveBeenCalledWith("s1");
  });

  it("invokes onConfigureNode when the configure button is clicked", () => {
    const onConfigureNode = vi.fn();
    render(
      <StartNode
        data={{
          nodeId: "s1",
          inputs: [],
          state: "idle",
          onConfigureNode,
        }}
      />,
    );

    screen.getByLabelText("Configure start").click();
    expect(onConfigureNode).toHaveBeenCalledWith("s1");
  });

  it("renders the run-state icon when not idle", () => {
    render(
      <StartNode data={{ nodeId: "s1", inputs: [], state: "passed" }} />,
    );

    expect(document.querySelector(`[data-testid="start-node-s1"]`)).toHaveClass(
      "border-emerald-500",
    );
  });
});
