/** @vitest-environment happy-dom */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useOpenSessionKey } from "./useOpenSessionKey";

afterEach(cleanup);

describe("useOpenSessionKey", () => {
  it("changes on every closed-to-open transition", () => {
    const { result, rerender } = renderHook(
      ({ open }) => useOpenSessionKey(open, "e1"),
      { initialProps: { open: false } },
    );
    const closed = result.current;
    rerender({ open: true });
    const firstOpen = result.current;
    expect(firstOpen).not.toBe(closed);
    rerender({ open: false });
    expect(result.current).toBe(firstOpen);
    rerender({ open: true });
    expect(result.current).not.toBe(firstOpen);
  });

  it("changes when the target changes while open", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useOpenSessionKey(true, id),
      { initialProps: { id: "e1" } },
    );
    const first = result.current;
    rerender({ id: "e2" });
    expect(result.current).not.toBe(first);
  });
});
