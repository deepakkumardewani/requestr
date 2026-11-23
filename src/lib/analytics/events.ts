import type { RelayErrorCode } from "@/lib/relay/errors";
import type { RelayPermissionMode } from "@/lib/relay/permission";

/**
 * Single source of truth for analytics events. `EVENT_SCHEMA` is a runtime
 * structure; `EventMap` and `EVENT_ALLOWLIST` are both derived from it so the
 * client types, the client runtime and the server validator cannot drift.
 * Nothing here may import PostHog or browser-only APIs.
 */

// --- Prop definitions -------------------------------------------------------

type EnumProp<V extends string = string> = {
  readonly kind: "enum";
  readonly values: readonly V[];
};
type BoolProp = { readonly kind: "boolean" };
type IntProp = { readonly kind: "int" };
type StringProp = { readonly kind: "string"; readonly maxLength: number };
type PropDef = EnumProp | BoolProp | IntProp | StringProp;

const enumOf = <const V extends string>(values: readonly V[]): EnumProp<V> => ({
  kind: "enum",
  values,
});
const BOOL: BoolProp = { kind: "boolean" };
const INT: IntProp = { kind: "int" };
const stringOf = (maxLength: number): StringProp => ({
  kind: "string",
  maxLength,
});

// --- Constants --------------------------------------------------------------

export const MAX_SHORT_STRING_LENGTH = 64;
export const MAX_ERROR_MESSAGE_LENGTH = 300;
export const MAX_ERROR_FRAMES_LENGTH = 1000;
export const MAX_SURVEY_TEXT_LENGTH = 2000;
export const MAX_SURVEY_EMAIL_LENGTH = 254;
export const MAX_RATING = 5;
export const MIN_RATING = 1;

export const EXCEPTION_EVENT = "$exception";
export const SURVEY_EVENT = "survey_sent";

export const BUCKETS = {
  duration: ["<100ms", "<500ms", "<2s", "2s+"],
  count: ["0", "1-5", "6-20", "21-100", "100+"],
  length: ["<50", "<200", "<1000", "1000+"],
  size: ["<10kb", "<100kb", "<1mb", "1mb+"],
  expiry: ["<1d", "1d-7d", "7d+", "never"],
  sessionDay: ["1", "2", "3-6", "7+"],
  daysSinceLast: ["0", "1", "2-6", "7-29", "30+"],
} as const;

export const PROTOCOLS = ["http", "graphql", "websocket", "socketio"] as const;
export const REQUEST_SOURCES = [
  "manual",
  "sample",
  "history",
  "chain",
  "relay",
] as const;
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "other",
] as const;
export const LANDING_PATHS = [
  "/",
  "/features",
  "/compare",
  "/privacy",
  "/terms",
  "other",
] as const;
export const LANDING_CTA_IDS = [
  "hero_open_app",
  "nav_open_app",
  "final_open_app",
] as const;
export const TOUR_STEP_IDS = [
  "url_bar",
  "samples",
  "save",
  "environments",
  "chains",
  "relay",
  "palette",
] as const;
export const SAMPLE_IDS = [
  "get_json",
  "post_json",
  "graphql",
  "websocket",
  "socketio",
] as const;
export const SHORTCUT_IDS = [
  "send_request",
  "command_palette",
  "shortcuts_help",
  "save_request",
  "new_request",
  "close_tab",
] as const;
export const SETTING_IDS = [
  "theme",
  "locale",
  "follow_redirects",
  "ssl_verification",
  "relay_enabled",
] as const;
/** Mirrors `ChangeEntity` in relay/changeLog (plus `backup`), kept literal so the server stays free of Relay imports. */
export const RELAY_ENTITIES = [
  "request",
  "collection",
  "folder",
  "environment",
  "chain",
  "tree",
  "requests",
  "activeEnvironment",
  "tab",
  "tabRequest",
  "settings",
  "backup",
] as const;
export const RELAY_ERROR_CODE_VALUES = [
  "relay_unavailable",
  "rate_limited",
  "offline",
  "context_too_long",
  "tool_failed",
  "aborted",
  "not_configured",
] as const satisfies readonly RelayErrorCode[];
export const RELAY_PERMISSION_MODE_VALUES = [
  "always-ask",
  "review",
  "skip",
] as const satisfies readonly RelayPermissionMode[];

const countBucket = enumOf(BUCKETS.count);
const durationBucket = enumOf(BUCKETS.duration);
const protocol = enumOf(PROTOCOLS);
const requestSource = enumOf(REQUEST_SOURCES);
const landingPath = enumOf(LANDING_PATHS);
const relayEntity = enumOf(RELAY_ENTITIES);
const tourStep = enumOf(TOUR_STEP_IDS);
const NO_PROPS = {} as const;

// --- Event schema -----------------------------------------------------------

export const COMMON_PROPS = {
  app_version: stringOf(MAX_SHORT_STRING_LENGTH),
  locale: stringOf(MAX_SHORT_STRING_LENGTH),
  viewport_class: enumOf(["desktop", "tablet", "mobile"]),
  session_day_index: enumOf(BUCKETS.sessionDay),
  theme: enumOf(["light", "dark"]),
} as const satisfies Record<string, PropDef>;

export const EVENT_SCHEMA = {
  landing_viewed: {
    path: landingPath,
    referrer_domain: stringOf(MAX_SHORT_STRING_LENGTH),
  },
  landing_cta_clicked: {
    cta_id: enumOf(LANDING_CTA_IDS),
    path: landingPath,
  },
  app_opened: {
    is_first_session: BOOL,
    days_since_last_bucket: enumOf(BUCKETS.daysSinceLast),
  },
  tour_started: { trigger: enumOf(["auto", "replay"]) },
  tour_step_viewed: { step_id: tourStep, index: INT },
  tour_completed: { steps_seen: INT },
  tour_skipped: { step_id: tourStep, index: INT },
  first_request_sent: { protocol, source: requestSource },
  request_sent: {
    method: enumOf(HTTP_METHODS),
    protocol,
    status_class: enumOf(["2xx", "3xx", "4xx", "5xx", "error"]),
    duration_bucket: durationBucket,
    source: requestSource,
  },
  sample_request_used: { sample_id: enumOf(SAMPLE_IDS) },
  request_saved: { is_first: BOOL },
  collection_created: NO_PROPS,
  environment_created: { variable_count_bucket: countBucket },
  environment_switched: NO_PROPS,
  chain_created: { source: enumOf(["manual", "relay", "import"]) },
  chain_run: {
    status: enumOf(["success", "failed", "stopped"]),
    node_count_bucket: countBucket,
    duration_bucket: durationBucket,
    has_loop: BOOL,
    has_subchain: BOOL,
  },
  relay_opened: NO_PROPS,
  relay_message_sent: { length_bucket: enumOf(BUCKETS.length) },
  relay_tool_applied: { entity: relayEntity },
  relay_undo: { entity: relayEntity },
  relay_confirm_declined: NO_PROPS,
  relay_error: { code: enumOf(RELAY_ERROR_CODE_VALUES) },
  relay_permission_mode_changed: {
    from: enumOf(RELAY_PERMISSION_MODE_VALUES),
    to: enumOf(RELAY_PERMISSION_MODE_VALUES),
  },
  share_created: { expiry_bucket: enumOf(BUCKETS.expiry) },
  share_opened: NO_PROPS,
  import_completed: {
    source_type: enumOf(["curl", "postman", "openapi", "hub", "backup"]),
    item_count_bucket: countBucket,
  },
  backup_exported: {
    mode: enumOf(["full", "selected"]),
    size_bucket: enumOf(BUCKETS.size),
  },
  backup_imported: { mode: enumOf(["merge", "replace"]) },
  command_palette_opened: NO_PROPS,
  shortcut_used: { shortcut_id: enumOf(SHORTCUT_IDS) },
  setting_changed: {
    setting_id: enumOf(SETTING_IDS),
    value_kind: enumOf(["bool", "enum"]),
  },
  whats_new_shown: { version: stringOf(MAX_SHORT_STRING_LENGTH) },
  whats_new_dismissed: { version: stringOf(MAX_SHORT_STRING_LENGTH) },
  feedback_prompt_shown: { trigger: enumOf(["auto", "menu"]) },
  feedback_prompt_dismissed: { trigger: enumOf(["auto", "menu"]) },
  feedback_submitted: { rating: INT, has_text: BOOL, has_email: BOOL },
  backup_nudge_shown: NO_PROPS,
  backup_nudge_accepted: NO_PROPS,
  backup_nudge_dismissed: NO_PROPS,
  [EXCEPTION_EVENT]: {
    message: stringOf(MAX_ERROR_MESSAGE_LENGTH),
    type: stringOf(MAX_SHORT_STRING_LENGTH),
    frames: stringOf(MAX_ERROR_FRAMES_LENGTH),
    source: enumOf(["window", "boundary", "promise"]),
  },
  [SURVEY_EVENT]: {
    rating: INT,
    text: stringOf(MAX_SURVEY_TEXT_LENGTH),
    email: stringOf(MAX_SURVEY_EMAIL_LENGTH),
  },
} as const satisfies Record<string, Record<string, PropDef>>;

// --- Derived types ----------------------------------------------------------

type PropValue<P extends PropDef> = P extends EnumProp<infer V>
  ? V
  : P extends BoolProp
    ? boolean
    : P extends IntProp
      ? number
      : string;

type PropsOf<D extends Record<string, PropDef>> = {
  [K in keyof D]?: PropValue<D[K]>;
};

export type EventMap = {
  [E in keyof typeof EVENT_SCHEMA]: PropsOf<(typeof EVENT_SCHEMA)[E]>;
};
export type EventName = keyof EventMap;
export type CommonProps = PropsOf<typeof COMMON_PROPS>;

/** Name -> allowed prop definitions; shared by the client adapter and the server validator. */
export const EVENT_ALLOWLIST: Readonly<
  Record<string, Readonly<Record<string, PropDef>>>
> = EVENT_SCHEMA;

export type { PropDef };

// --- Bucket helpers ---------------------------------------------------------

const DURATION_FAST_MS = 100;
const DURATION_OK_MS = 500;
const DURATION_SLOW_MS = 2000;
const COUNT_SMALL_MAX = 5;
const COUNT_MEDIUM_MAX = 20;
const COUNT_LARGE_MAX = 100;

export type DurationBucket = (typeof BUCKETS.duration)[number];
export type CountBucket = (typeof BUCKETS.count)[number];

export function bucketDuration(ms: number): DurationBucket {
  if (ms < DURATION_FAST_MS) return "<100ms";
  if (ms < DURATION_OK_MS) return "<500ms";
  if (ms < DURATION_SLOW_MS) return "<2s";
  return "2s+";
}

export function bucketCount(count: number): CountBucket {
  if (count <= 0) return "0";
  if (count <= COUNT_SMALL_MAX) return "1-5";
  if (count <= COUNT_MEDIUM_MAX) return "6-20";
  if (count <= COUNT_LARGE_MAX) return "21-100";
  return "100+";
}

// --- Wire format (client -> /api/ingest) ------------------------------------

export type WireEvent = {
  name: string;
  props: Record<string, unknown>;
  /** Client timestamp, epoch milliseconds. */
  ts: number;
};

/** `id` is the analytics id; survey batches omit it so feedback is not linkable to usage. */
export type IngestBatch = {
  id?: string;
  events: WireEvent[];
};

export type SurveyResponse = EventMap[typeof SURVEY_EVENT];
export type ErrorRecord = EventMap[typeof EXCEPTION_EVENT];
