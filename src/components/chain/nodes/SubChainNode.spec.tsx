/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubChainNode } from "./SubChainNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("SubChainNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the referenced chain by name when known", () => {
    render(
      <SubChainNode
        data={{
          nodeId: "n1",
          chainId: "chain-b",
          chainName: "Auth flow",
          state: "idle",
        }}
      />,
    );

    expect(screen.getByText("Sub-chain")).toBeInTheDocument();
    expect(screen.getByText("Auth flow")).toBeInTheDocument();
  });

  it("falls back to the raw chainId when no name is resolved", () => {
    render(
      <SubChainNode
        data={{ nodeId: "n1", chainId: "chain-b", state: "idle" }}
      />,
    );

    expect(screen.getByText("chain-b")).toBeInTheDocument();
  });

  it("shows a placeholder when no chain has been selected", () => {
    render(<SubChainNode data={{ nodeId: "n1", chainId: "", state: "idle" }} />);

    expect(screen.getByText("No chain selected")).toBeInTheDocument();
  });

  it("marks the node invalid with a warning icon", () => {
    const { container } = render(
      <SubChainNode
        data={{
          nodeId: "n1",
          chainId: "chain-b",
          chainName: "Deleted chain",
          isInvalid: true,
          state: "idle",
        }}
      />,
    );

    expect(container.querySelector('[data-testid="subchain-node-n1"]')).toHaveClass(
      "border-destructive",
    );
  });

  it("shows the error strip when failed", () => {
    render(
      <SubChainNode
        data={{
          nodeId: "n1",
          chainId: "chain-b",
          state: "failed",
          error: "Sub-chain run failed",
        }}
      />,
    );

    expect(screen.getByText("Sub-chain run failed")).toBeInTheDocument();
  });

  it("invokes onChangeReference, onConfigureNode, and onDeleteNode from the hover toolbar", () => {
    const onChangeReference = vi.fn();
    const onConfigureNode = vi.fn();
    const onDeleteNode = vi.fn();

    render(
      <SubChainNode
        data={{
          nodeId: "n1",
          chainId: "chain-b",
          state: "idle",
          onChangeReference,
          onConfigureNode,
          onDeleteNode,
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Change referenced chain"));
    fireEvent.click(screen.getByLabelText("Configure"));
    fireEvent.click(screen.getByLabelText("Remove from chain"));

    expect(onChangeReference).toHaveBeenCalledWith("n1");
    expect(onConfigureNode).toHaveBeenCalledWith("n1");
    expect(onDeleteNode).toHaveBeenCalledWith("n1");
  });
});
