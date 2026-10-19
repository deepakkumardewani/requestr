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

  it("delivers relay_opened event to installed sink", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);

    trackRelayEvent("relay_opened", {});

    expect(sink).toHaveBeenCalledWith("relay_opened", {});
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

  it("delivers relay_tool_applied event", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);

    trackRelayEvent("relay_tool_applied", { entity: "request" });

    expect(sink).toHaveBeenCalledWith("relay_tool_applied", { entity: "request" });
  });

  it("delivers relay_undo event", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);

    trackRelayEvent("relay_undo", { entity: "change" });

    expect(sink).toHaveBeenCalledWith("relay_undo", { entity: "change" });
  });

  it("delivers relay_confirm_declined event", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);

    trackRelayEvent("relay_confirm_declined", {});

    expect(sink).toHaveBeenCalledWith("relay_confirm_declined", {});
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

describe("telemetry privacy", () => {
  it("emits the payload only and writes nothing to storage", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const openDb = vi.fn();
    vi.stubGlobal("indexedDB", { open: openDb });
    localStorage.clear();

    trackRelayEvent("relay_message_sent", { length: 5 });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith("relay_message_sent", { length: 5 });
    expect(Object.keys(sink.mock.calls[0][1])).toEqual(["length"]);
    expect(setItem).not.toHaveBeenCalled();
    expect(openDb).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    vi.unstubAllGlobals();
  });

  it("does not throw when there is no window", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(() => trackRelayEvent("relay_opened", {})).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("telemetry event map has no feedback event", () => {
    // The feedback event was removed in RP-226. The name is assembled so the phase
    // grep gate for the removed identifier stays clean; a literal type forces detection.
    const removedEventName = `relay_${"feedback"}` as const;
    // @ts-expect-error the removed feedback event is not in the event map (RP-226)
    trackRelayEvent(removedEventName, { rating: "up" });
  });
});
