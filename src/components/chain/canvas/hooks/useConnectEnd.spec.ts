/** @vitest-environment happy-dom */
import type { FinalConnectionState } from "@xyflow/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChainEdge } from "@/types/chain";
import { useConnectEnd } from "./useConnectEnd";

function state(partial: {
  fromNode?: { id: string } | null;
  fromHandle?: { id: string | null; type: "source" | "target" } | null;
  toNode?: { id: string } | null;
}): FinalConnectionState {
  return {
    fromNode: { id: "loop-1" },
    fromHandle: { id: "body", type: "source" },
    toNode: null,
    ...partial,
  } as unknown as FinalConnectionState;
}

const mouseDrop = { clientX: 30, clientY: 40 } as MouseEvent;

function setup(chainEdges: ChainEdge[] = [], disabled = false) {
  const openMenu = vi.fn();
  const { result } = renderHook(() =>
    useConnectEnd({ chainEdges, disabled, openMenu }),
  );
  return { onConnectEnd: result.current, openMenu };
}

describe("useConnectEnd", () => {
  it("opens the menu at the drop point attached to the source handle", () => {
    const { onConnectEnd, openMenu } = setup();
    onConnectEnd(mouseDrop, state({}));
    expect(openMenu).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      { nodeId: "loop-1", handleId: "body" },
    );
  });

  it("uses the first changed touch for touch gestures", () => {
    const { onConnectEnd, openMenu } = setup();
    const touch = {
      changedTouches: [{ clientX: 7, clientY: 8 }],
    } as unknown as TouchEvent;
    onConnectEnd(touch, state({}));
    expect(openMenu).toHaveBeenCalledWith({ x: 7, y: 8 }, expect.anything());
  });

  it("normalizes an unnamed handle to null", () => {
    const { onConnectEnd, openMenu } = setup();
    onConnectEnd(mouseDrop, state({ fromHandle: { id: null, type: "source" } }));
    expect(openMenu).toHaveBeenCalledWith(expect.anything(), {
      nodeId: "loop-1",
      handleId: null,
    });
  });

  it("ignores drops that land on a node", () => {
    const { onConnectEnd, openMenu } = setup();
    onConnectEnd(mouseDrop, state({ toNode: { id: "x" } }));
    expect(openMenu).not.toHaveBeenCalled();
  });

  it("ignores drags that did not start from a source handle", () => {
    const { onConnectEnd, openMenu } = setup();
    onConnectEnd(mouseDrop, state({ fromHandle: { id: "t", type: "target" } }));
    onConnectEnd(mouseDrop, state({ fromHandle: null }));
    onConnectEnd(mouseDrop, state({ fromNode: null }));
    expect(openMenu).not.toHaveBeenCalled();
  });

  it("ignores everything while disabled", () => {
    const { onConnectEnd, openMenu } = setup([], true);
    onConnectEnd(mouseDrop, state({}));
    expect(openMenu).not.toHaveBeenCalled();
  });

  it("opens no menu when the single-use Loop handle is already connected", () => {
    const used: ChainEdge = {
      id: "e1",
      sourceRequestId: "loop-1",
      targetRequestId: "x",
      injections: [],
      branchId: "body",
    };
    const { onConnectEnd, openMenu } = setup([used]);
    onConnectEnd(mouseDrop, state({}));
    expect(openMenu).not.toHaveBeenCalled();
  });
});
