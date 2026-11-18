/** @vitest-environment happy-dom */

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlushChainOnLeave } from "./useFlushChainOnLeave";

const flushMock = vi.hoisted(() => vi.fn());

vi.mock("@/stores/useChainStore", () => ({
  persistChain: { flush: flushMock },
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useFlushChainOnLeave", () => {
  beforeEach(() => {
    flushMock.mockReset();
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    setVisibility("visible");
  });

  it("flushes on beforeunload", () => {
    renderHook(() => useFlushChainOnLeave());
    window.dispatchEvent(new Event("beforeunload"));
    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it("flushes when the document becomes hidden but not when visible", () => {
    renderHook(() => useFlushChainOnLeave());
    document.dispatchEvent(new Event("visibilitychange"));
    expect(flushMock).not.toHaveBeenCalled();

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it("flushes on unmount and stops listening afterwards", () => {
    const { unmount } = renderHook(() => useFlushChainOnLeave());
    unmount();
    expect(flushMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("beforeunload"));
    expect(flushMock).toHaveBeenCalledTimes(1);
  });
});
