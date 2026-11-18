/** @vitest-environment happy-dom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasFocusBridge, type CanvasFocusApi } from "./CanvasFocusBridge";

const fitView = vi.fn();
const setNodes = vi.fn();
let existingNodeIds: string[] = [];

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    fitView,
    setNodes,
    getNode: (id: string) =>
      existingNodeIds.includes(id) ? { id } : undefined,
  }),
}));

function mountBridge() {
  const onCanvasFocusReady = vi.fn();
  const view = render(
    <CanvasFocusBridge onCanvasFocusReady={onCanvasFocusReady} />,
  );
  const api = onCanvasFocusReady.mock.calls[0][0] as CanvasFocusApi;
  return { api, view };
}

describe("CanvasFocusBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    fitView.mockClear();
    setNodes.mockClear();
    existingNodeIds = ["a", "b"];
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders nothing and registers its api", () => {
    const { view } = mountBridge();
    expect(view.container).toBeEmptyDOMElement();
  });

  it("fits the viewport to exactly the added node ids", () => {
    const { api } = mountBridge();
    api.fitNodes(["a", "b"]);
    vi.advanceTimersToNextFrame();
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: "a" }, { id: "b" }] }),
    );
  });

  it("waits until the added nodes exist in React Flow before fitting", () => {
    existingNodeIds = [];
    const { api } = mountBridge();
    api.fitNodes(["a"]);
    vi.advanceTimersToNextFrame();
    expect(fitView).not.toHaveBeenCalled();
    existingNodeIds = ["a"];
    vi.advanceTimersToNextFrame();
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: "a" }] }),
    );
  });

  it("selects only the target node and centers on it", () => {
    const { api } = mountBridge();
    api.showNode("b");
    vi.advanceTimersToNextFrame();
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: "b" }], maxZoom: 1 }),
    );
    const updater = setNodes.mock.calls[0][0] as (
      nodes: { id: string; selected?: boolean }[],
    ) => { id: string; selected?: boolean }[];
    const result = updater([
      { id: "a", selected: true },
      { id: "b" },
    ]);
    expect(result).toEqual([
      { id: "a", selected: false },
      { id: "b", selected: true },
    ]);
  });
});
