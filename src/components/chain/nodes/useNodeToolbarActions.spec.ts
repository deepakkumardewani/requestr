/** @vitest-environment happy-dom */

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBlockNodeActions, useRequestNodeActions } from "./useNodeToolbarActions";

function setPlatform(platform: string) {
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBlockNodeActions", () => {
  it("returns no actions when neither handler is provided", () => {
    const { result } = renderHook(() => useBlockNodeActions({ nodeId: "n1" }));

    expect(result.current).toEqual([]);
  });

  it("returns configure then remove in order when both handlers are provided", () => {
    const { result } = renderHook(() =>
      useBlockNodeActions({
        nodeId: "n1",
        onConfigureNode: vi.fn(),
        onDeleteNode: vi.fn(),
      }),
    );

    expect(result.current.map((a) => a.id)).toEqual(["configure", "remove"]);
  });

  it("passes the node id to the configure handler", () => {
    const onConfigureNode = vi.fn();
    const { result } = renderHook(() =>
      useBlockNodeActions({ nodeId: "n7", onConfigureNode }),
    );

    result.current[0].onClick();

    expect(onConfigureNode).toHaveBeenCalledExactlyOnceWith("n7");
  });

  it("passes the node id to the delete handler and marks remove destructive", () => {
    const onDeleteNode = vi.fn();
    const { result } = renderHook(() =>
      useBlockNodeActions({ nodeId: "n7", onDeleteNode }),
    );

    result.current[0].onClick();

    expect(result.current[0].destructive).toBe(true);
    expect(onDeleteNode).toHaveBeenCalledExactlyOnceWith("n7");
  });

  it("uses default labels when no label overrides are given", () => {
    const { result } = renderHook(() =>
      useBlockNodeActions({
        nodeId: "n1",
        onConfigureNode: vi.fn(),
        onDeleteNode: vi.fn(),
      }),
    );

    expect(result.current.map((a) => a.label)).toEqual([
      "Configure",
      "Remove from chain",
    ]);
  });

  it("overrides accessible labels but keeps the generic tooltip text for configure", () => {
    const { result } = renderHook(() =>
      useBlockNodeActions({
        nodeId: "n1",
        onConfigureNode: vi.fn(),
        onDeleteNode: vi.fn(),
        labels: { configure: "Configure condition", remove: "Remove condition" },
      }),
    );

    expect(result.current[0].label).toBe("Configure condition");
    expect(result.current[0].tooltip).toBe("Configure");
    expect(result.current[1].label).toBe("Remove condition");
  });

  it("appends the Delete shortcut to the remove tooltip on non-Mac platforms", () => {
    setPlatform("Win32");
    const { result } = renderHook(() =>
      useBlockNodeActions({ nodeId: "n1", onDeleteNode: vi.fn() }),
    );

    expect(result.current[0].tooltip).toBe("Remove from chain (Delete)");
  });
});

describe("useRequestNodeActions", () => {
  const allHandlers = () => ({
    onRunNode: vi.fn(),
    onClickNode: vi.fn(),
    onDuplicateNode: vi.fn(),
    onDeleteNode: vi.fn(),
  });

  it("returns no actions when no handlers are provided", () => {
    const { result } = renderHook(() =>
      useRequestNodeActions({ requestId: "r1" }),
    );

    expect(result.current).toEqual([]);
  });

  it("returns run, details, duplicate, remove in order when all handlers are provided", () => {
    const { result } = renderHook(() =>
      useRequestNodeActions({ requestId: "r1", ...allHandlers() }),
    );

    expect(result.current.map((a) => a.id)).toEqual([
      "run",
      "details",
      "duplicate",
      "remove",
    ]);
  });

  it("omits actions whose handler is missing", () => {
    const { result } = renderHook(() =>
      useRequestNodeActions({
        requestId: "r1",
        onRunNode: vi.fn(),
        onDeleteNode: vi.fn(),
      }),
    );

    expect(result.current.map((a) => a.id)).toEqual(["run", "remove"]);
  });

  it("routes each action to its own handler with the request id", () => {
    const handlers = allHandlers();
    const { result } = renderHook(() =>
      useRequestNodeActions({ requestId: "r9", ...handlers }),
    );

    for (const action of result.current) action.onClick();

    expect(handlers.onRunNode).toHaveBeenCalledExactlyOnceWith("r9");
    expect(handlers.onClickNode).toHaveBeenCalledExactlyOnceWith("r9");
    expect(handlers.onDuplicateNode).toHaveBeenCalledExactlyOnceWith("r9");
    expect(handlers.onDeleteNode).toHaveBeenCalledExactlyOnceWith("r9");
  });

  it("marks only remove as destructive", () => {
    const { result } = renderHook(() =>
      useRequestNodeActions({ requestId: "r1", ...allHandlers() }),
    );

    expect(
      result.current.filter((a) => a.destructive).map((a) => a.id),
    ).toEqual(["remove"]);
  });

  it("gives details no custom tooltip so the label is used", () => {
    const { result } = renderHook(() =>
      useRequestNodeActions({ requestId: "r1", ...allHandlers() }),
    );

    const details = result.current.find((a) => a.id === "details");
    expect(details?.label).toBe("View details");
    expect(details?.tooltip).toBeUndefined();
  });

  it("formats shortcut tooltips with Mac symbols on macOS", () => {
    setPlatform("MacIntel");
    const { result } = renderHook(() =>
      useRequestNodeActions({ requestId: "r1", ...allHandlers() }),
    );

    const tooltips = Object.fromEntries(
      result.current.map((a) => [a.id, a.tooltip]),
    );
    expect(tooltips.run).toBe("Run independently (⌘Enter)");
    expect(tooltips.duplicate).toBe("Duplicate (⌘D)");
  });

  it("formats shortcut tooltips with Ctrl and plus separators on other platforms", () => {
    setPlatform("Win32");
    const { result } = renderHook(() =>
      useRequestNodeActions({ requestId: "r1", ...allHandlers() }),
    );

    const tooltips = Object.fromEntries(
      result.current.map((a) => [a.id, a.tooltip]),
    );
    expect(tooltips.run).toBe("Run independently (Ctrl+Enter)");
    expect(tooltips.duplicate).toBe("Duplicate (Ctrl+D)");
    expect(tooltips.remove).toBe("Remove from chain (Delete)");
  });
});
