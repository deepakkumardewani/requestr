/** @vitest-environment happy-dom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { RunSelectionSyncBridge } from "./RunSelectionSyncBridge";

const fitView = vi.fn();

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ fitView }),
}));

const steps = [
  { id: "s1", nodeId: "n1" },
  { id: "s2", nodeId: "n2" },
  { id: "s3", nodeId: "n1" },
] as RunStep[];

type BridgeProps = React.ComponentProps<typeof RunSelectionSyncBridge>;

function renderBridge(overrides: Partial<BridgeProps> = {}) {
  const props: BridgeProps = {
    steps,
    selectedStepId: null,
    syncSource: "timeline",
    selectStep: vi.fn(),
    onCanvasNodeClickReady: vi.fn(),
    ...overrides,
  };
  const view = render(<RunSelectionSyncBridge {...props} />);
  return { props, view };
}

describe("RunSelectionSyncBridge", () => {
  beforeEach(() => fitView.mockClear());
  afterEach(cleanup);

  it("renders nothing", () => {
    const { view } = renderBridge();
    expect(view.container).toBeEmptyDOMElement();
  });

  it("pans to the selected step's node when selection came from the timeline", () => {
    renderBridge({ selectedStepId: "s2" });
    expect(fitView).toHaveBeenCalledWith({
      nodes: [{ id: "n2" }],
      duration: 300,
    });
  });

  it("does not pan when selection came from the canvas", () => {
    renderBridge({ selectedStepId: "s2", syncSource: "canvas" });
    expect(fitView).not.toHaveBeenCalled();
  });

  it("registers a canvas-click handler that selects the node's latest step as canvas-sourced", () => {
    const { props } = renderBridge();
    const handler = vi.mocked(props.onCanvasNodeClickReady).mock.calls[0][0];

    handler("n1");

    expect(props.selectStep).toHaveBeenCalledWith("s3", "canvas");
    expect(fitView).not.toHaveBeenCalled();
  });
});
