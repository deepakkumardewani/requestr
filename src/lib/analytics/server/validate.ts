import {
  COMMON_PROPS,
  EVENT_ALLOWLIST,
  type IngestBatch,
  type PropDef,
  type WireEvent,
} from "@/lib/analytics/events";

const MAX_ID_LENGTH = 64;
const MAX_TS_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_TS_FUTURE_MS = 5 * 60 * 1000;

/** Client clocks are untrusted: accept only a timestamp near server time, else use the server's. */
function sanitizeTimestamp(ts: unknown): number {
  const now = Date.now();
  const inWindow =
    typeof ts === "number" &&
    Number.isInteger(ts) &&
    ts >= now - MAX_TS_AGE_MS &&
    ts <= now + MAX_TS_FUTURE_MS;
  return inWindow ? ts : now;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type PropCheck = { ok: true } | { ok: false; oversize: boolean };
const OK: PropCheck = { ok: true };
const INVALID: PropCheck = { ok: false, oversize: false };
const OVERSIZE: PropCheck = { ok: false, oversize: true };

function checkProp(def: PropDef, value: unknown): PropCheck {
  switch (def.kind) {
    case "enum":
      return typeof value === "string" && def.values.includes(value)
        ? OK
        : INVALID;
    case "boolean":
      return typeof value === "boolean" ? OK : INVALID;
    case "int":
      return Number.isInteger(value) ? OK : INVALID;
    case "string":
      if (typeof value !== "string") return INVALID;
      return value.length > def.maxLength ? OVERSIZE : OK;
  }
}

/** Returns the sanitized props, or `null` when any string prop is oversize (the whole event is dropped). */
function sanitizeProps(
  allowed: Readonly<Record<string, PropDef>>,
  props: Record<string, unknown>,
): Record<string, unknown> | null {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const def = Object.hasOwn(allowed, key)
      ? allowed[key]
      : Object.hasOwn(COMMON_PROPS, key)
        ? COMMON_PROPS[key as keyof typeof COMMON_PROPS]
        : undefined;
    if (!def) continue;
    const check = checkProp(def, value);
    if (check.ok) clean[key] = value;
    else if (check.oversize) return null;
  }
  return clean;
}

function sanitizeEvent(raw: unknown): WireEvent | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  if (!Object.hasOwn(EVENT_ALLOWLIST, raw.name)) return null;
  const props = sanitizeProps(
    EVENT_ALLOWLIST[raw.name],
    isRecord(raw.props) ? raw.props : {},
  );
  if (!props) return null;
  return { name: raw.name, props, ts: sanitizeTimestamp(raw.ts) };
}

/**
 * Drops unknown events and props, invalid prop values and oversize events
 * (R13, R15). Pure; never throws on hostile input.
 */
export function validateBatch(input: unknown): IngestBatch {
  if (!isRecord(input) || !Array.isArray(input.events)) return { events: [] };
  const events = input.events.flatMap((raw) => {
    const event = sanitizeEvent(raw);
    return event ? [event] : [];
  });
  const id =
    typeof input.id === "string" && input.id.length <= MAX_ID_LENGTH
      ? input.id
      : undefined;
  return id === undefined ? { events } : { id, events };
}
