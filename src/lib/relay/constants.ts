/** Dock width bounds (RP-110): 30vw..40vw of the viewport, never below the px floor. */
export const RELAY_MIN_WIDTH_PX = 320;
export const RELAY_MIN_WIDTH_VW = 30;
export const RELAY_DEFAULT_WIDTH_VW = 30;
export const RELAY_MAX_WIDTH_VW = 40;
/** CSS bounds shared by the dock style and the reserved page gap; `min-width` wins over `max-width`, so the floor holds on small viewports. */
export const RELAY_MIN_WIDTH_CSS = `max(${RELAY_MIN_WIDTH_PX}px, ${RELAY_MIN_WIDTH_VW}vw)`;
export const RELAY_MAX_WIDTH_CSS = `max(${RELAY_MIN_WIDTH_PX}px, ${RELAY_MAX_WIDTH_VW}vw)`;
/** Width change per Arrow key press on the resize handle. */
export const RELAY_KEY_RESIZE_STEP_PX = 16;
/** Pointer hit area of the resize handle. */
export const RELAY_RESIZE_HANDLE_HIT_PX = 8;

/** Below this viewport width the dock renders as a full-height sheet (FR-2). */
export const RELAY_MOBILE_BREAKPOINT_PX = 768;
/** Minimum touch target size on the sheet layout. */
export const RELAY_MIN_TOUCH_TARGET_PX = 44;
/** Inline style that enlarges a control to the touch minimum on both axes. */
export const RELAY_TOUCH_TARGET_STYLE = {
  minWidth: RELAY_MIN_TOUCH_TARGET_PX,
  minHeight: RELAY_MIN_TOUCH_TARGET_PX,
} as const;

/** Enlarges an entry-point button to the 44px touch minimum below the `md` breakpoint. */
export const RELAY_ENTRY_TOUCH_CLASS = "max-md:min-h-11 max-md:min-w-11";

/** Enlarges an in-conversation control to the 44px touch minimum on coarse pointers. */
export const RELAY_COARSE_TOUCH_CLASS =
  "pointer-coarse:min-h-11 pointer-coarse:min-w-11";

/** Dock slide durations (ms): open is slower than close. */
export const RELAY_OPEN_DURATION_MS = 200;
export const RELAY_CLOSE_DURATION_MS = 140;

export const RELAY_STORAGE_KEYS = {
  open: "rq_relay_open",
  width: "rq_relay_width",
  activeThread: "rq_relay_active_thread",
  enabled: "rq_relay_enabled",
  position: "rq_relay_position",
  onboarded: "rq_relay_onboarded",
  recent: "rq_relay_recent",
} as const;

/** Edges the dock can default to (FR-81). */
export const RELAY_PANEL_POSITIONS = ["right", "left"] as const;
export type RelayPanelPosition = (typeof RELAY_PANEL_POSITIONS)[number];
export const RELAY_DEFAULT_POSITION: RelayPanelPosition = "right";

/** No workspace entity exists yet (SPIKE C), so every thread belongs to one. */
export const RELAY_WORKSPACE_ID = "local";

/** Threads kept per workspace before the oldest is pruned (FR-14). */
export const RELAY_MAX_THREADS = 50;
/** Quiet period before a finished turn is written to IndexedDB. */
export const RELAY_THREAD_SAVE_DEBOUNCE_MS = 300;
/** Longest auto-generated thread title (first ask), in characters. */
export const RELAY_THREAD_TITLE_MAX_CHARS = 60;
/** How long the Undo action stays on the "thread deleted" toast (FR-11). */
export const RELAY_UNDO_TOAST_MS = 5_000;

/** Horizontal padding of the dock header (Tailwind `px-3`); the overlay aligns to the panel edge by offsetting it. */
export const RELAY_HEADER_PADDING_X_PX = 12;
/**
 * Space left on each side of the floating list at the narrowest dock. The list
 * is `w-76` (19rem), which is the 320px minimum dock minus twice this inset; a
 * full-width list would overflow by a pixel and make the popover flip sides.
 */
export const RELAY_THREAD_OVERLAY_INSET_PX = 8;
/** Gap between the header trigger and the floating conversation list. */
export const RELAY_THREAD_OVERLAY_SIDE_OFFSET_PX = 6;

/** Tool-call steps allowed in one user turn (FR-21). */
export const RELAY_MAX_STEPS = 12;
/** The "Step n of max" indicator shows once a turn passes this many steps (FR-21). */
export const RELAY_STEP_INDICATOR_AFTER = 6;

/** Lists longer than this are virtualized; shorter ones render in full (FR-11, NFR-1). */
export const RELAY_VIRTUALIZE_THRESHOLD = 50;

/** Requests listed from an attached collection; the rest is summarised as a count (FR-127). */
export const RELAY_COLLECTION_ITEM_CAP = 50;

/** Most recent WebSocket / Socket.IO messages that reach the model (FR-144). */
export const RELAY_MESSAGE_LOG_CAP = 20;

/** Soft cap on user messages per session per day (NFR-4). */
export const RELAY_DAILY_MESSAGE_CAP = 300;
export const RELAY_DAILY_WINDOW_SEC = 86_400;

/** Key chord that toggles the dock; compared against a KeyboardEvent. */
export type RelayShortcutChord = {
  /** Lowercase `KeyboardEvent.key`. */
  key: string;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
};

/**
 * Cmd+I on Mac; Ctrl+Shift+L elsewhere because Ctrl+I is already Import
 * collection (FR-30). Both are consumed inside CodeMirror, which is accepted.
 */
export const RELAY_SHORTCUTS = {
  mac: { key: "i", meta: true, ctrl: false, shift: false },
  other: { key: "l", meta: false, ctrl: true, shift: true },
} as const satisfies Record<string, RelayShortcutChord>;

/**
 * Starts a fresh chat. Shift+Mod+O is only a Library shortcut in Firefox, so
 * the toolbar button stays the guaranteed path there (RP-106).
 */
export const RELAY_NEW_CHAT_SHORTCUTS = {
  mac: { key: "o", meta: true, ctrl: false, shift: true },
  other: { key: "o", meta: false, ctrl: true, shift: true },
} as const satisfies Record<string, RelayShortcutChord>;

/** Chat endpoint and the header carrying the anonymous user id (FR-72). */
export const RELAY_CHAT_API = "/api/relay/chat";
export const RELAY_USER_HEADER = "x-relay-user";

/** Recently attached items remembered for the launcher (RP-215). */
export const RELAY_RECENTS_CAP = 5;

/** Composer textarea starts at this many rows and grows with its content. */
export const RELAY_COMPOSER_MIN_ROWS = 2;
/** The composer textarea stops growing here and scrolls instead. */
export const RELAY_COMPOSER_MAX_HEIGHT_PX = 160;
/** Tallest the inline `@` mention menu gets before its list scrolls. */
export const RELAY_MENTION_MAX_HEIGHT_PX = 288;

/** Two lines (name and detail) per row in the workspace item lists. */
export const RELAY_PICKER_ROW_HEIGHT_PX = 44;
/** Rows rendered beyond the visible window of a virtualized item list. */
export const RELAY_PICKER_OVERSCAN_ROWS = 4;
