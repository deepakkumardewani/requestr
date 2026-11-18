/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GhostPlacementHandler } from "./GhostPlacementHandler";

const screenToFlowPosition = vi.fn(() => ({ x: 42, y: 43 }));

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ screenToFlowPosition }),
}));

describe("GhostPlacementHandler", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function buildProps(overrides: Partial<ComponentProps<typeof GhostPlacementHandler>>) {
    return {
      pendingNodeType: "delay" as const,
      cursorPos: { x: 12, y: 34 },
      onUpsertDelayNode: vi.fn(),
      onUpsertConditionNode: vi.fn(),
      onUpsertDisplayNode: vi.fn(),
      onUpsertEvaluateNode: vi.fn(),
      onUpsertValidateNode: vi.fn(),
      onUpsertMergeNode: vi.fn(),
      onUpsertLoopNode: vi.fn(),
      onUpsertCollectNode: vi.fn(),
      onUpsertSubChainNode: vi.fn(),
      onUpdateNodePosition: vi.fn(),
      onOpenConditionPanel: vi.fn(),
      onOpenEvaluatePanel: vi.fn(),
      onOpenValidatePanel: vi.fn(),
      onOpenMergePanel: vi.fn(),
      onOpenLoopPanel: vi.fn(),
      onOpenCollectPanel: vi.fn(),
      onOpenSubChainPicker: vi.fn(),
      onClearPending: vi.fn(),
      ...overrides,
    };
  }

  it("places a delay node when pane receives click", () => {
    const props = buildProps({ pendingNodeType: "delay" });

    render(<GhostPlacementHandler {...props} />);

    const pane = document.createElement("div");
    pane.className = "react-flow__pane";
    document.body.appendChild(pane);

    fireEvent.click(pane);

    expect(props.onUpsertDelayNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: "delay", delayMs: 1000 }),
    );
    expect(props.onUpdateNodePosition).toHaveBeenCalledWith(expect.any(String), {
      x: 42,
      y: 43,
    });
    expect(props.onClearPending).toHaveBeenCalled();
    expect(props.onUpsertConditionNode).not.toHaveBeenCalled();

    document.body.removeChild(pane);
  });

  it("places an evaluate node when pane receives click", () => {
    const props = buildProps({ pendingNodeType: "evaluate" });

    render(<GhostPlacementHandler {...props} />);

    const pane = document.createElement("div");
    pane.className = "react-flow__pane";
    document.body.appendChild(pane);

    fireEvent.click(pane);

    expect(props.onUpsertEvaluateNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: "evaluate" }),
    );
    expect(props.onUpdateNodePosition).toHaveBeenCalledWith(expect.any(String), {
      x: 42,
      y: 43,
    });
    expect(props.onOpenEvaluatePanel).toHaveBeenCalledWith(expect.any(String));
    expect(props.onClearPending).toHaveBeenCalled();

    document.body.removeChild(pane);
  });

  it("places a validate node when pane receives click", () => {
    const props = buildProps({ pendingNodeType: "validate" });

    render(<GhostPlacementHandler {...props} />);

    const pane = document.createElement("div");
    pane.className = "react-flow__pane";
    document.body.appendChild(pane);

    fireEvent.click(pane);

    expect(props.onUpsertValidateNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: "validate" }),
    );
    expect(props.onUpdateNodePosition).toHaveBeenCalledWith(expect.any(String), {
      x: 42,
      y: 43,
    });
    expect(props.onOpenValidatePanel).toHaveBeenCalledWith(expect.any(String));
    expect(props.onClearPending).toHaveBeenCalled();

    document.body.removeChild(pane);
  });

  it("places a merge node when pane receives click", () => {
    const props = buildProps({ pendingNodeType: "merge" });

    render(<GhostPlacementHandler {...props} />);

    const pane = document.createElement("div");
    pane.className = "react-flow__pane";
    document.body.appendChild(pane);

    fireEvent.click(pane);

    expect(props.onUpsertMergeNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: "merge", mode: "all" }),
    );
    expect(props.onUpdateNodePosition).toHaveBeenCalledWith(expect.any(String), {
      x: 42,
      y: 43,
    });
    expect(props.onOpenMergePanel).toHaveBeenCalledWith(expect.any(String));
    expect(props.onClearPending).toHaveBeenCalled();

    document.body.removeChild(pane);
  });

  it("places a subchain node when pane receives click", () => {
    const props = buildProps({ pendingNodeType: "subchain" });

    render(<GhostPlacementHandler {...props} />);

    const pane = document.createElement("div");
    pane.className = "react-flow__pane";
    document.body.appendChild(pane);

    fireEvent.click(pane);

    expect(props.onUpsertSubChainNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: "subchain", chainId: "", inputBindings: {} }),
    );
    expect(props.onUpdateNodePosition).toHaveBeenCalledWith(expect.any(String), {
      x: 42,
      y: 43,
    });
    expect(props.onOpenSubChainPicker).toHaveBeenCalledWith(expect.any(String));
    expect(props.onClearPending).toHaveBeenCalled();

    document.body.removeChild(pane);
  });
});
