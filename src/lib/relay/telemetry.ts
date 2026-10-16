import type { RelayErrorCode } from "@/lib/relay/errors";

export type RelayFeedbackRating = "up" | "down";

/**
 * Local-only usage events (FR-82). Payloads carry counts and codes, never
 * prompt or response text, so a sink can forward them without a privacy review.
 */
export type RelayEventMap = {
  relay_opened: Record<string, never>;
  relay_message_sent: { length: number };
  relay_tool_applied: { entity: string };
  relay_undo: { entity: string };
  relay_confirm_declined: Record<string, never>;
  relay_error: { code: RelayErrorCode };
  /** Rating only (FR-192): no message text, and nothing is stored. */
  relay_feedback: { rating: RelayFeedbackRating };
};

export type RelayEventName = keyof RelayEventMap;

export type RelayTelemetrySink = <Name extends RelayEventName>(
  name: Name,
  payload: RelayEventMap[Name],
) => void;

/** DOM event the default sink emits, so on-page listeners can observe usage. */
export const RELAY_TELEMETRY_EVENT = "relay:telemetry";

export type RelayTelemetryDetail = {
  name: RelayEventName;
  payload: RelayEventMap[RelayEventName];
};

/** Local-only: the event stays in the page and nothing is sent anywhere. */
const domEventSink: RelayTelemetrySink = (name, payload) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RelayTelemetryDetail>(RELAY_TELEMETRY_EVENT, {
      detail: { name, payload },
    }),
  );
};

let sink: RelayTelemetrySink = domEventSink;

/** Installs a sink; `null` restores the default DOM-event sink. */
export function setRelayTelemetrySink(next: RelayTelemetrySink | null): void {
  sink = next ?? domEventSink;
}

/** A failing sink is logged and dropped so telemetry can never break the UI. */
export function trackRelayEvent<Name extends RelayEventName>(
  name: Name,
  payload: RelayEventMap[Name],
): void {
  try {
    sink(name, payload);
  } catch (error) {
    console.warn("[relay] telemetry sink failed", { name, error });
  }
}
