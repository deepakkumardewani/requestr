// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { noopAdapter } from "@/lib/analytics/noopAdapter";

describe("noopAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("performs no network, storage or logging when every method is called", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    noopAdapter.track("collection_created");
    noopAdapter.captureError({
      message: "m",
      type: "Error",
      frames: "f",
      source: "window",
    });
    noopAdapter.submitSurvey({ rating: 5, text: "t", email: "a@b.co" });
    noopAdapter.setEnabled(false);
    noopAdapter.setEnabled(true);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns undefined from every method", () => {
    expect(noopAdapter.track("collection_created")).toBeUndefined();
    expect(noopAdapter.setEnabled(true)).toBeUndefined();
  });
});
