/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChainEdge, ConditionNodeConfig } from "@/types/chain";
import { buildFlowEdges, useChainEdges } from "./useChainEdges";

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    useEdgesState: (initial: unknown) => {
      const [edges, setEdges] = React.useState(initial);
      const onEdgesChange = React.useCallback(() => {}, []);
      return [edges, setEdges, onEdgesChange];
    },
  };
});

const conditionNode: ConditionNodeConfig = {
  id: "cond-1",
  type: "condition",
  variable: "{{role}}",
  branches: [{ id: "branch-1", label: "Admin", expression: "== 'admin'" }],
};

describe("buildFlowEdges", () => {
  const base: ChainEdge = {
    id: "e",
    sourceRequestId: "a",
    targetRequestId: "b",
    injections: [],
  };
  const callbacks = { onDeleteEdge: vi.fn() };

  it("styles a fail-branch edge with the fail handle", () => {
    const [edge] = buildFlowEdges([{ ...base, branchId: "fail" }], [], callbacks);
    expect(edge.sourceHandle).toBe("fail");
    expect(edge.style?.stroke).toBe("var(--chain-edge-fail)");
    expect(edge.data?.statusLabel).toBe("fail");
  });

  it("styles a success-branch edge as dashed", () => {
    const [edge] = buildFlowEdges([{ ...base, branchId: "success" }], [], callbacks);
    expect(edge.sourceHandle).toBe("success");
    expect(edge.style?.strokeDasharray).toBe("4 2");
    expect(edge.data?.statusLabel).toBe("success");
  });

  it("styles a plain edge with the default stroke and no handle", () => {
    const [edge] = buildFlowEdges([base], [], callbacks);
    expect(edge.sourceHandle).toBeUndefined();
    expect(edge.style?.stroke).toBe("var(--chain-edge-default)");
    expect(edge.style?.strokeDasharray).toBeUndefined();
    expect(edge.data?.statusLabel).toBeUndefined();
  });

  it("falls back to the branch id when the branch has no label", () => {
    const cond = { ...conditionNode, branches: [{ id: "b9", label: "", expression: "" }] };
    const [edge] = buildFlowEdges(
      [{ ...base, sourceRequestId: "cond-1", branchId: "b9" }],
      [cond],
      callbacks,
    );
    expect((edge.data as { label: string }).label).toBe("b9");
  });

  it("falls back to the branch id when the branch is unknown", () => {
    const [edge] = buildFlowEdges(
      [{ ...base, sourceRequestId: "cond-1", branchId: "ghost" }],
      [conditionNode],
      callbacks,
    );
    expect((edge.data as { label: string }).label).toBe("ghost");
  });

  it("builds a branch-handle edge with the branch label from a condition node", () => {
    const edge: ChainEdge = {
      id: "e1",
      sourceRequestId: "cond-1",
      targetRequestId: "r2",
      injections: [],
      branchId: "branch-1",
    };
    const [flowEdge] = buildFlowEdges([edge], [conditionNode], {
      onDeleteEdge: vi.fn(),
    });
    expect(flowEdge.sourceHandle).toBe("branch-1");
    expect((flowEdge.data as { label: string }).label).toBe("Admin");
  });

  it("builds a plain edge with no special handle for a non-branch edge", () => {
    const edge: ChainEdge = {
      id: "e2",
      sourceRequestId: "r1",
      targetRequestId: "r2",
      injections: [],
    };
    const [flowEdge] = buildFlowEdges([edge], [], {
      onDeleteEdge: vi.fn(),
    });
    expect(flowEdge.sourceHandle).toBeUndefined();
    expect(flowEdge.id).toBe("e2");
  });
});

describe("useChainEdges", () => {
  it("resyncs edges when chainEdges changes", () => {
    const edge: ChainEdge = {
      id: "e1",
      sourceRequestId: "r1",
      targetRequestId: "r2",
      injections: [],
    };
    const onDeleteEdge = vi.fn();
    const conditionNodes: ConditionNodeConfig[] = [];
    const { result, rerender } = renderHook(
      (chainEdges: ChainEdge[]) =>
        useChainEdges({
          chainEdges,
          conditionNodes,
          onDeleteEdge,
        }),
      { initialProps: [] as ChainEdge[] },
    );

    expect(result.current.edges).toHaveLength(0);

    rerender([edge]);

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].id).toBe("e1");
  });
});
