/** @vitest-environment happy-dom */

import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChainConnect } from "@/components/chain/canvas/hooks/useChainConnect";
import type { ChainEdge, ChainInput } from "@/types/chain";
import { StartNode } from "./StartNode";

vi.mock("@xyflow/react", () => ({
  Handle: (props: {
    id?: string;
    type: string;
    position: string;
    "aria-label"?: string;
  }) => (
    <div
      data-testid={`handle-${props.id ?? "default"}`}
      data-handle-type={props.type}
      data-position={props.position}
      aria-label={props["aria-label"]}
    />
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
    render(<StartNode data={{ nodeId: "s1", inputs: [], state: "idle" }} />);

    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("renders one output handle per input, keyed by the input's key", () => {
    render(<StartNode data={{ nodeId: "s1", inputs, state: "idle" }} />);

    expect(screen.getByTestId("handle-token")).toBeInTheDocument();
    expect(screen.getByTestId("handle-userId")).toBeInTheDocument();
    expect(screen.getByText("token")).toBeInTheDocument();
    expect(screen.getByText("userId")).toBeInTheDocument();
  });

  it("shows a placeholder message when there are no inputs", () => {
    render(<StartNode data={{ nodeId: "s1", inputs: [], state: "idle" }} />);

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
      />
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
      />
    );

    screen.getByLabelText("Configure start").click();
    expect(onConfigureNode).toHaveBeenCalledWith("s1");
  });

  it("renders the run-state icon when not idle", () => {
    render(<StartNode data={{ nodeId: "s1", inputs: [], state: "passed" }} />);

    expect(document.querySelector(`[data-testid="start-node-s1"]`)).toHaveClass(
      "border-emerald-500"
    );
  });

  describe("default output handle", () => {
    it("renders exactly one source handle on the right for 0 inputs, keeping the hint", () => {
      render(<StartNode data={{ nodeId: "s1", inputs: [], state: "idle" }} />);

      const handles = document.querySelectorAll("[data-handle-type=source]");
      expect(handles).toHaveLength(1);
      expect(screen.getByTestId("handle-default")).toHaveAttribute(
        "data-position",
        "right"
      );
      expect(screen.getByLabelText("Default output")).toBe(
        screen.getByTestId("handle-default")
      );
      expect(screen.getByText("No inputs defined")).toBeInTheDocument();
    });

    it("renders N keyed handles plus one default on the bottom for N inputs", () => {
      render(<StartNode data={{ nodeId: "s1", inputs, state: "idle" }} />);

      expect(
        document.querySelectorAll("[data-handle-type=source]")
      ).toHaveLength(inputs.length + 1);
      expect(screen.getByTestId("handle-default")).toHaveAttribute(
        "data-position",
        "bottom"
      );
      expect(screen.getByTestId("handle-token")).toHaveAttribute(
        "data-position",
        "right"
      );
      expect(screen.getByTestId("handle-userId")).toHaveAttribute(
        "data-position",
        "right"
      );
    });

    it("still renders legacy keyed handles whose edges used branchId === inputKey", () => {
      render(<StartNode data={{ nodeId: "s1", inputs, state: "idle" }} />);

      expect(screen.getByTestId("handle-token")).toBeInTheDocument();
      expect(screen.getByTestId("handle-userId")).toBeInTheDocument();
    });

    it("produces an edge with branchId undefined when connected from the default handle", () => {
      const upserted: ChainEdge[] = [];
      const { result } = renderHook(() =>
        useChainConnect({
          chainId: "chain-1",
          chainEdges: [],
          conditionNodes: [],
          delayNodes: [],
          displayNodes: [],
          onUpsertEdge: (edge) => upserted.push(edge),
          onDeleteEdge: vi.fn(),
          setEdges: vi.fn(),
        })
      );

      result.current.onConnect({
        source: "s1",
        target: "n2",
        sourceHandle: null,
        targetHandle: null,
      });

      expect(upserted).toHaveLength(1);
      expect(upserted[0].sourceRequestId).toBe("s1");
      expect(upserted[0].branchId).toBeUndefined();
    });

    it("keeps the default handle unkeyed when the first input is added later", () => {
      const { rerender } = render(
        <StartNode data={{ nodeId: "s1", inputs: [], state: "idle" }} />
      );
      expect(screen.getByTestId("handle-default")).toBeInTheDocument();

      rerender(<StartNode data={{ nodeId: "s1", inputs, state: "idle" }} />);

      // The id-less handle persists, so an existing branchId-less edge stays valid.
      expect(screen.getByTestId("handle-default")).toBeInTheDocument();
    });
  });
});
