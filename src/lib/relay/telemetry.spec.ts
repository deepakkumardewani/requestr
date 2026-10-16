/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_TELEMETRY_EVENT,
  type RelayTelemetryDetail,
  setRelayTelemetrySink,
  trackRelayEvent,
} from "./telemetry";

afterEach(() => {
  setRelayTelemetrySink(null);
  vi.restoreAllMocks();
});

describe("relay telemetry", () => {
  it("emits a DOM event by default", () => {
    const seen: RelayTelemetryDetail[] = [];
    const listener = (event: Event) =>
      seen.push((event as CustomEvent<RelayTelemetryDetail>).detail);
    window.addEventListener(RELAY_TELEMETRY_EVENT, listener);

    trackRelayEvent("relay_message_sent", { length: 3 });

    window.removeEventListener(RELAY_TELEMETRY_EVENT, listener);
    expect(seen).toEqual([
      { name: "relay_message_sent", payload: { length: 3 } },
    ]);
  });

  it("delivers each event with its payload to the installed sink", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);

    trackRelayEvent("relay_message_sent", { length: 12 });
    trackRelayEvent("relay_error", { code: "rate_limited" });

    expect(sink).toHaveBeenNthCalledWith(1, "relay_message_sent", { length: 12 });
    expect(sink).toHaveBeenNthCalledWith(2, "relay_error", {
      code: "rate_limited",
    });
  });

  it("restores the default sink when cleared", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);
    setRelayTelemetrySink(null);

    trackRelayEvent("relay_undo", { entity: "request" });

    expect(sink).not.toHaveBeenCalled();
  });

  it("logs and survives a sink that throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setRelayTelemetrySink(() => {
      throw new Error("boom");
    });

    expect(() => trackRelayEvent("relay_opened", {})).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});

describe("relay_feedback privacy (FR-192)", () => {
  it("emits the rating only and writes nothing to storage", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const openDb = vi.fn();
    vi.stubGlobal("indexedDB", { open: openDb });
    localStorage.clear();

    trackRelayEvent("relay_feedback", { rating: "up" });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith("relay_feedback", { rating: "up" });
    expect(Object.keys(sink.mock.calls[0][1])).toEqual(["rating"]);
    expect(setItem).not.toHaveBeenCalled();
    expect(openDb).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    vi.unstubAllGlobals();
  });

  it("does not throw when there is no window", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(() => trackRelayEvent("relay_feedback", { rating: "down" })).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
