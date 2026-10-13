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
