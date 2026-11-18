/** @vitest-environment happy-dom */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSyncOnNode } from "./useSyncOnNode";

type TestNode = { id: string; value: string };

describe("useSyncOnNode", () => {
  it("does nothing while the node is null", () => {
    const reset = vi.fn();
    renderHook(() => useSyncOnNode<TestNode>(null, reset));
    expect(reset).not.toHaveBeenCalled();
  });

  it("resets once when a node is provided", () => {
    const reset = vi.fn();
    const node = { id: "a", value: "1" };
    renderHook(() => useSyncOnNode(node, reset));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith(node);
  });

  it("resets again only when the node identity changes", () => {
    const reset = vi.fn();
    const first = { id: "a", value: "1" };
    const second = { id: "a", value: "2" };
    const { rerender } = renderHook(
      ({ node }) => useSyncOnNode(node, reset),
      { initialProps: { node: first } },
    );

    rerender({ node: first });
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ node: second });
    expect(reset).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenLastCalledWith(second);
  });

  it("uses the latest reset closure without re-running on closure changes", () => {
    const node = { id: "a", value: "1" };
    const firstReset = vi.fn();
    const secondReset = vi.fn();
    const { rerender } = renderHook(
      ({ reset }) => useSyncOnNode(node, reset),
      { initialProps: { reset: firstReset } },
    );

    rerender({ reset: secondReset });

    expect(firstReset).toHaveBeenCalledTimes(1);
    expect(secondReset).not.toHaveBeenCalled();
  });
});
