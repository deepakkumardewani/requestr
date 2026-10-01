/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainPageFooter } from "./ChainPageFooter";
import type { ChainEdge, ChainRunState } from "@/types/chain";

// Mock the next-intl translation hook
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      footerHintDragNodes: "Drag nodes to reposition",
      footerHintDrawConnections:
        "Draw from handle to handle to create connections",
      footerHintDeleteEdges: "Delete/Backspace to remove edges",
      clickEdgeToMapData: "Click an edge to map data",
      rightClickNodeForPartialRuns: "Right-click a node for partial runs",
      unresolvedVariables: `${params?.count ?? 0} unresolved variable${params?.count === 1 ? "" : "s"}`,
    };
    return translations[key] ?? key;
  },
}));

describe("ChainPageFooter", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders static hints by default", () => {
    render(<ChainPageFooter />);
    expect(screen.getByText(/Drag nodes to reposition/)).toBeInTheDocument();
    expect(
      screen.getByText(/Draw from handle to handle to create connections/)
    ).toBeInTheDocument();
  });

  it("hides the Delete/Backspace hint when there are no edges to delete", () => {
    render(<ChainPageFooter />);
    expect(
      screen.queryByText(/Delete\/Backspace to remove edges/)
    ).not.toBeInTheDocument();
  });

  it("lists hints in a fixed order: drag, draw, partial runs, edge mapping, delete, unresolved", () => {
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "b", injections: [] },
    ];
    const runState: ChainRunState = {
      a: { state: "idle", extractedValues: {}, unresolvedVars: ["x"] },
    };
    render(<ChainPageFooter edges={edges} runState={runState} />);
    expect(screen.getByRole("contentinfo").textContent).toBe(
      [
        "Drag nodes to reposition",
        "Draw from handle to handle to create connections",
        "Right-click a node for partial runs",
        "Click an edge to map data",
        "Delete/Backspace to remove edges",
        "1 unresolved variable",
      ].join(" · ")
    );
  });

  it("shows contextual hint when edges exist without injections", () => {
    const edges: ChainEdge[] = [
      {
        id: "edge1",
        sourceRequestId: "req1",
        targetRequestId: "req2",
        injections: [],
      },
    ];
    render(<ChainPageFooter edges={edges} />);
    expect(screen.getByText(/Click an edge to map data/)).toBeInTheDocument();
  });

  it("does not show edge hint when edges are configured", () => {
    const edges: ChainEdge[] = [
      {
        id: "edge1",
        sourceRequestId: "req1",
        targetRequestId: "req2",
        injections: [
          {
            sourceJsonPath: "$.value",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
      },
    ];
    render(<ChainPageFooter edges={edges} />);
    expect(
      screen.queryByText(/Click an edge to map data/)
    ).not.toBeInTheDocument();
  });

  it("shows partial runs hint", () => {
    render(<ChainPageFooter />);
    expect(
      screen.getByText(/Right-click a node for partial runs/)
    ).toBeInTheDocument();
  });

  it("shows unresolved variable count when nodes have unresolved vars", () => {
    const runState: ChainRunState = {
      req1: {
        state: "idle",
        extractedValues: {},
        unresolvedVars: ["baseUrl"],
      },
      req2: {
        state: "idle",
        extractedValues: {},
        unresolvedVars: ["token", "apiKey"],
      },
    };
    render(<ChainPageFooter runState={runState} />);
    expect(screen.getByText(/3 unresolved variables/)).toBeInTheDocument();
  });

  it("shows correct singular form for 1 unresolved variable", () => {
    const runState: ChainRunState = {
      req1: {
        state: "idle",
        extractedValues: {},
        unresolvedVars: ["baseUrl"],
      },
    };
    render(<ChainPageFooter runState={runState} />);
    expect(screen.getByText(/1 unresolved variable/)).toBeInTheDocument();
  });

  it("does not show unresolved count when no variables are unresolved", () => {
    const runState: ChainRunState = {
      req1: {
        state: "passed",
        extractedValues: {},
      },
    };
    render(<ChainPageFooter runState={runState} />);
    expect(screen.queryByText(/unresolved/)).not.toBeInTheDocument();
  });

  it("aggregates unresolved count from all nodes", () => {
    const runState: ChainRunState = {
      node1: {
        state: "idle",
        extractedValues: {},
        unresolvedVars: ["var1"],
      },
      node2: {
        state: "idle",
        extractedValues: {},
        unresolvedVars: ["var2", "var3"],
      },
      node3: {
        state: "idle",
        extractedValues: {},
        unresolvedVars: [],
      },
      node4: {
        state: "idle",
        extractedValues: {},
      },
    };
    render(<ChainPageFooter runState={runState} />);
    expect(screen.getByText(/3 unresolved variables/)).toBeInTheDocument();
  });

  it("combines edge configuration hint with other hints", () => {
    const edges: ChainEdge[] = [
      {
        id: "edge1",
        sourceRequestId: "req1",
        targetRequestId: "req2",
        injections: [],
      },
    ];
    const runState: ChainRunState = {
      req1: {
        state: "idle",
        extractedValues: {},
        unresolvedVars: ["baseUrl"],
      },
    };
    render(<ChainPageFooter edges={edges} runState={runState} />);
    expect(screen.getByText(/Click an edge to map data/)).toBeInTheDocument();
    expect(
      screen.getByText(/Right-click a node for partial runs/)
    ).toBeInTheDocument();
    expect(screen.getByText(/1 unresolved variable/)).toBeInTheDocument();
  });

  it("should not include dead string 'Add a Display node'", () => {
    render(<ChainPageFooter />);
    expect(
      screen.queryByText(/Add a Display node/)
    ).not.toBeInTheDocument();
  });

  it("excludes variables the chain defines upstream from the pre-run count", () => {
    const requests = [
      {
        id: "req1",
        url: "https://x.test/{{userId}}/{{typo}}",
        headers: [],
        params: [],
        body: { type: "none", content: "" },
      },
    ] as never;
    const passthrough = (text: string) => text;
    render(
      <ChainPageFooter
        requests={requests}
        resolveVariables={passthrough}
        declaredNamespace={{ chainInputs: {}, aliasValues: { userId: "" } }}
      />,
    );
    expect(screen.getByText(/1 unresolved variable/)).toBeInTheDocument();
  });
});
