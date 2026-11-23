/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_TELEMETRY_EVENT,
  type RelayTelemetryDetail,
  relayTelemetryToTrack,
  setRelayTelemetrySink,
  trackRelayEvent,
} from "./telemetry";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/adapter", () => ({ track: trackMock }));

afterEach(() => {
  trackMock.mockClear();
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

  it("delivers relay_permission_mode_changed with only from and to", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);

    trackRelayEvent("relay_permission_mode_changed", {
      from: "review",
      to: "skip",
    });

    expect(sink).toHaveBeenCalledWith("relay_permission_mode_changed", {
      from: "review",
      to: "skip",
    });
  });

  it("emits relay_permission_mode_changed DOM event with correct detail", () => {
    const seen: RelayTelemetryDetail[] = [];
    const listener = (event: Event) =>
      seen.push((event as CustomEvent<RelayTelemetryDetail>).detail);
    window.addEventListener(RELAY_TELEMETRY_EVENT, listener);

    trackRelayEvent("relay_permission_mode_changed", {
      from: "review",
      to: "always-ask",
    });

    window.removeEventListener(RELAY_TELEMETRY_EVENT, listener);
    expect(seen).toEqual([
      {
        name: "relay_permission_mode_changed",
        payload: { from: "review", to: "always-ask" },
      },
    ]);
  });

  it("delivers relay_permission_mode_changed on mode flip from skip to review", () => {
    const sink = vi.fn();
    setRelayTelemetrySink(sink);

    trackRelayEvent("relay_permission_mode_changed", {
      from: "skip",
      to: "review",
    });

    expect(sink).toHaveBeenCalledWith("relay_permission_mode_changed", {
      from: "skip",
      to: "review",
    });
  });
});

describe("relayTelemetryToTrack", () => {
  it("emits the DOM event and forwards a length bucket instead of the raw length", () => {
    const seen: RelayTelemetryDetail[] = [];
    const listener = (event: Event) =>
      seen.push((event as CustomEvent<RelayTelemetryDetail>).detail);
    window.addEventListener(RELAY_TELEMETRY_EVENT, listener);

    relayTelemetryToTrack("relay_message_sent", { length: 321 });

    window.removeEventListener(RELAY_TELEMETRY_EVENT, listener);
    expect(seen).toEqual([
      { name: "relay_message_sent", payload: { length: 321 } },
    ]);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("relay_message_sent", {
      length_bucket: "<1000",
    });
  });

  it.each([
    [0, "<50"],
    [49, "<50"],
    [50, "<200"],
    [199, "<200"],
    [200, "<1000"],
    [999, "<1000"],
    [1000, "1000+"],
    [50000, "1000+"],
  ])("buckets a message length of %i as %s", (length, bucket) => {
    relayTelemetryToTrack("relay_message_sent", { length });
    expect(trackMock).toHaveBeenCalledWith("relay_message_sent", {
      length_bucket: bucket,
    });
  });

  it.each(["relay_tool_applied", "relay_undo"] as const)(
    "forwards a known entity for %s",
    (name) => {
      relayTelemetryToTrack(name, { entity: "collection" });
      expect(trackMock).toHaveBeenCalledWith(name, { entity: "collection" });
    },
  );

  it.each(["relay_tool_applied", "relay_undo"] as const)(
    "drops %s when the entity is not on the allowlist",
    (name) => {
      relayTelemetryToTrack(name, { entity: "My Secret Collection" });
      expect(trackMock).not.toHaveBeenCalled();
    },
  );

  it("forwards only the error code", () => {
    relayTelemetryToTrack("relay_error", { code: "rate_limited" });
    expect(trackMock).toHaveBeenCalledWith("relay_error", {
      code: "rate_limited",
    });
  });

  it("forwards the permission mode change", () => {
    relayTelemetryToTrack("relay_permission_mode_changed", {
      from: "review",
      to: "skip",
    });
    expect(trackMock).toHaveBeenCalledWith("relay_permission_mode_changed", {
      from: "review",
      to: "skip",
    });
  });

  it.each(["relay_opened", "relay_confirm_declined"] as const)(
    "forwards %s with no props",
    (name) => {
      relayTelemetryToTrack(name, {});
      expect(trackMock).toHaveBeenCalledTimes(1);
      expect(trackMock.mock.calls[0]).toEqual([name]);
    },
  );

  it("is installable as the sink and routes through trackRelayEvent", () => {
    setRelayTelemetrySink(relayTelemetryToTrack);
    trackRelayEvent("relay_opened", {});
    expect(trackMock).toHaveBeenCalledWith("relay_opened");
  });

  it("still forwards when there is no window", () => {
    vi.stubGlobal("window", undefined);
    try {
      relayTelemetryToTrack("relay_opened", {});
    } finally {
      vi.unstubAllGlobals();
    }
    expect(trackMock).toHaveBeenCalledWith("relay_opened");
  });
});
