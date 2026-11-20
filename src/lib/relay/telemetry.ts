import { track } from "@/lib/analytics/adapter";
import { type BUCKETS, RELAY_ENTITIES } from "@/lib/analytics/events";
import type { RelayErrorCode } from "@/lib/relay/errors";
import type { RelayPermissionMode } from "@/lib/relay/permission";

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
  relay_permission_mode_changed: {
    from: RelayPermissionMode;
    to: RelayPermissionMode;
  };
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

const LENGTH_SHORT_MAX = 50;
const LENGTH_MEDIUM_MAX = 200;
const LENGTH_LONG_MAX = 1000;

function bucketLength(length: number): (typeof BUCKETS.length)[number] {
  if (length < LENGTH_SHORT_MAX) return "<50";
  if (length < LENGTH_MEDIUM_MAX) return "<200";
  if (length < LENGTH_LONG_MAX) return "<1000";
  return "1000+";
}

const isRelayEntity = (
  entity: string,
): entity is (typeof RELAY_ENTITIES)[number] =>
  (RELAY_ENTITIES as readonly string[]).includes(entity);

/** Forwards only buckets and enums; message text, prompts and entity names never reach `track`. */
function forwardToAnalytics<Name extends RelayEventName>(
  name: Name,
  payload: RelayEventMap[Name],
): void {
  const event = { name, payload } as {
    [N in RelayEventName]: { name: N; payload: RelayEventMap[N] };
  }[RelayEventName];
  switch (event.name) {
    case "relay_message_sent":
      track(event.name, {
        length_bucket: bucketLength(event.payload.length),
      });
      return;
    case "relay_tool_applied":
    case "relay_undo":
      if (!isRelayEntity(event.payload.entity)) return;
      track(event.name, { entity: event.payload.entity });
      return;
    case "relay_error":
      track(event.name, { code: event.payload.code });
      return;
    case "relay_permission_mode_changed":
      track(event.name, event.payload);
      return;
    case "relay_opened":
    case "relay_confirm_declined":
      track(event.name);
      return;
  }
}

/** Production sink: keeps the `relay:telemetry` DOM event and queues the matching `relay_*` analytics event. */
export const relayTelemetryToTrack: RelayTelemetrySink = (name, payload) => {
  domEventSink(name, payload);
  forwardToAnalytics(name, payload);
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
