"use client";

import { create } from "zustand";
import type {
  PromptSegment,
  SerializedEditor,
} from "@/components/relay/editorTypes";
import type { PickerKind } from "@/hooks/useRelayPickerItems";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import {
  RELAY_DEFAULT_WIDTH_VW,
  RELAY_MAX_WIDTH_VW,
  RELAY_MIN_WIDTH_PX,
  RELAY_MIN_WIDTH_VW,
  RELAY_STORAGE_KEYS,
  RELAY_WORKSPACE_ID,
} from "@/lib/relay/constants";
import type { TurnTiming } from "@/lib/relay/timing";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";

/** Thread storage is only needed once a thread is read or created, so it stays out of the main chunk (NFR-2). */
const loadThreadDb = () => import("@/lib/relay/threadDb");

const PERCENT = 100;
/** Not in RELAY_STORAGE_KEYS: it is a privacy setting owned by this store (FR-61). */
export const SHARE_VALUES_KEY = "rq_relay_share_values";
/** Persisted choice of speech engine; the store field lands in Phase 7. Exported for the workspace backup. */
export const SPEECH_ENGINE_KEY = "rq_relay_speech_engine";

/** Asks the composer to open the mention menu for one kind of item, with a hint line. */
export type RelayMentionRequest = {
  kind: Exclude<PickerKind, "all"> | null;
  /** Message key under `relay` for the hint. */
  hintKey: string;
};

/** What the composer hands the chat for the message being sent. */
export type OutgoingDraft = Pick<SerializedEditor, "attachments" | "segments">;

export type RelayChipKind = ContextChip["kind"];
export type RelayChip = ContextChip;

type RelayState = {
  /** Whether the dock is open; persisted across reloads. */
  open: boolean;
  /** Dock width in px, clamped to the FR-2 bounds; persisted across reloads. */
  width: number;
  /** Thread the dock shows; persisted so a reload restores it (FR-12). */
  activeThreadId: string | null;
  /** True once preferences and the last active thread are resolved after mount. */
  hydrated: boolean;
  /** Creating a thread pruned the oldest one; shown until dismissed (FR-14). */
  prunedNotice: boolean;
  /**
   * The pills in the composer, mirrored from the editor on every change so the
   * launcher, menus and slash targets can read them (FR-122). The editor is the
   * only source of truth: nothing adds or removes an item here. Transient and
   * never written to storage (NFR-10).
   */
  attachedItems: readonly RelayChip[];
  /** Bumped when a new conversation starts, so the composer drops the pills it holds (FR-122). Transient. */
  attachmentResetRequest: number;
  /** The message being sent; the composer stages it and the chat takes it before its first await. */
  outgoing: OutgoingDraft | null;
  /** A prompt chosen outside the composer (a suggestion); the chat sends it and clears it. */
  pendingPrompt: string | null;
  /** Text an entry point wants pre-filled into the composer; the dock applies it and clears it. */
  composerPrefill: string | null;
  /** A draft with its pills that an entry point opened; the composer loads it into the editor and clears it. */
  composerDraft: readonly PromptSegment[] | null;
  /** User preference to use Relay at all (FR-81); on by default, independent of the build flag. */
  enabled: boolean;
  /** Let non-secret environment values reach the model; off by default (FR-61). */
  shareValues: boolean;
  /**
   * Bumped on every user-initiated open so the dock can move focus to the
   * composer. Transient and never persisted: restoring `open` from storage
   * on load must not steal focus.
   */
  focusRequest: number;
  /** The composer holds text; follow-up chips hide meanwhile. Transient and never persisted. */
  composerHasText: boolean;
  /** The approval-mode popover is open; the launcher opens it from elsewhere. Transient and never persisted. */
  permissionPopoverOpen: boolean;
  /** The capabilities popover is open; the launcher opens it from elsewhere. Transient and never persisted. */
  capabilitiesOpen: boolean;
  /** A starter that needs a target; the composer consumes it once and clears it. Transient and never persisted. */
  mentionRequest: RelayMentionRequest | null;
  /**
   * Timing of the turn in flight, keyed by its assistant message. Kept here
   * rather than on the message because the stream rewrites the message on
   * every chunk. Transient and never persisted; it is merged into
   * `metadata.turn` when the turn settles.
   */
  liveTurn: { messageId: string; turn: TurnTiming } | null;
};

type RelayActions = {
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setShareValues: (shareValues: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  /** Mirrors the editor's pills; the composer calls it on every change and unmount. */
  syncAttachedItems: (items: readonly RelayChip[]) => void;
  stageOutgoing: (draft: OutgoingDraft) => void;
  /** Returns the staged message once and clears it; null for a send that did not come from the composer. */
  takeOutgoing: () => OutgoingDraft | null;
  submitPrompt: (text: string) => void;
  clearPendingPrompt: () => void;
  /** Opens the dock with `segments` (text and pills) loaded into the composer. */
  openWithDraft: (draft: { segments: readonly PromptSegment[] }) => void;
  clearComposerDraft: () => void;
  clearComposerPrefill: () => void;
  setComposerHasText: (hasText: boolean) => void;
  setPermissionPopoverOpen: (open: boolean) => void;
  setCapabilitiesOpen: (open: boolean) => void;
  requestMention: (request: RelayMentionRequest) => void;
  clearMentionRequest: () => void;
  setLiveTurn: (liveTurn: RelayState["liveTurn"]) => void;
  setActiveThreadId: (id: string | null) => void;
  /** Creates a persisted thread (reusing `id` when given) and makes it active. */
  startThread: (init?: { id?: string }) => Promise<string>;
  /** Starts a fresh thread unless the current one is still empty (FR-12). */
  newThread: () => Promise<void>;
  dismissPrunedNotice: () => void;
  /**
   * Loads the persisted preferences, then the last active thread. Called
   * after mount, never at store creation, so the first client render matches
   * the server-rendered HTML. The preference part applies synchronously.
   */
  hydrate: () => Promise<void>;
};

function vwToPx(viewportWidth: number, vw: number): number {
  return Math.floor((viewportWidth * vw) / PERCENT);
}

/** Smallest allowed dock width for a viewport: 30vw, never below the px floor. */
export function getRelayMinWidth(viewportWidth: number): number {
  return Math.max(
    RELAY_MIN_WIDTH_PX,
    vwToPx(viewportWidth, RELAY_MIN_WIDTH_VW),
  );
}

/** Dock width when nothing is saved: 30vw, never below the px floor. */
export function getRelayDefaultWidth(viewportWidth: number): number {
  return Math.max(
    RELAY_MIN_WIDTH_PX,
    vwToPx(viewportWidth, RELAY_DEFAULT_WIDTH_VW),
  );
}

/** Largest allowed dock width for a viewport: 40vw, but the floor wins when it is larger. */
export function getRelayMaxWidth(viewportWidth: number): number {
  return Math.max(
    getRelayMinWidth(viewportWidth),
    vwToPx(viewportWidth, RELAY_MAX_WIDTH_VW),
  );
}

/** Clamps a width to the viewport's min..max; a non-finite width falls back to the default. */
export function clampRelayWidth(
  width: number,
  viewportWidth: number = window.innerWidth,
): number {
  if (!Number.isFinite(width)) return getRelayDefaultWidth(viewportWidth);
  return Math.min(
    getRelayMaxWidth(viewportWidth),
    Math.max(getRelayMinWidth(viewportWidth), Math.round(width)),
  );
}

/**
 * localStorage can throw (private mode, quota, disabled storage). A failed
 * preference read/write must never break the UI, so callers fall back to
 * defaults, but the failure is still logged with its key for diagnosis.
 */
function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("[relay] preference read failed", { key, error });
    return null;
  }
}

function writePreference(key: string, value: string | number | boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn("[relay] preference write failed", { key, error });
  }
}

function removePreference(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("[relay] preference remove failed", { key, error });
  }
}

function readActiveThreadId(): string | null {
  const stored = readPreference(RELAY_STORAGE_KEYS.activeThread);
  return stored?.trim() ? stored : null;
}

function persistActiveThreadId(id: string | null): void {
  if (id) writePreference(RELAY_STORAGE_KEYS.activeThread, id);
  else removePreference(RELAY_STORAGE_KEYS.activeThread);
}

/** Falls back to "no recent thread" so a storage failure never blocks the dock. */
async function findLastActiveThreadId(): Promise<string | null> {
  try {
    const { getLastActive } = await loadThreadDb();
    return (await getLastActive(RELAY_WORKSPACE_ID))?.id ?? null;
  } catch (error) {
    console.warn("[relay] reading the last active thread failed", { error });
    return null;
  }
}

/** The Position setting was removed (BUG-06); drop the value an older build saved. */
function removeLegacyPosition(): void {
  try {
    localStorage.removeItem("rq_relay_position");
  } catch (error) {
    console.warn("[relay] legacy preference remove failed", { error });
  }
}

function readOpen(): boolean {
  return readPreference(RELAY_STORAGE_KEYS.open) === "true";
}

function readWidth(): number {
  const stored = readPreference(RELAY_STORAGE_KEYS.width);
  if (stored === null || stored.trim() === "")
    return getRelayDefaultWidth(window.innerWidth);
  return clampRelayWidth(Number(stored));
}

export const useRelayStore = create<RelayState & RelayActions>((set, get) => ({
  open: false,
  // No `window` here (SSR); `hydrate` replaces it with the viewport default.
  width: RELAY_MIN_WIDTH_PX,
  activeThreadId: null,
  hydrated: false,
  prunedNotice: false,
  shareValues: false,
  enabled: true,
  attachedItems: [],
  attachmentResetRequest: 0,
  outgoing: null,
  pendingPrompt: null,
  composerPrefill: null,
  composerDraft: null,
  focusRequest: 0,
  composerHasText: false,
  permissionPopoverOpen: false,
  capabilitiesOpen: false,
  mentionRequest: null,
  liveTurn: null,

  toggle() {
    set((state) => nextOpenState(state, !state.open));
  },

  setOpen(open) {
    set((state) => nextOpenState(state, open));
  },

  setWidth(width) {
    const clamped = clampRelayWidth(width);
    writePreference(RELAY_STORAGE_KEYS.width, clamped);
    set({ width: clamped });
  },

  setShareValues(shareValues) {
    writePreference(SHARE_VALUES_KEY, shareValues);
    set({ shareValues });
  },

  setEnabled(enabled) {
    writePreference(RELAY_STORAGE_KEYS.enabled, enabled);
    set({ enabled });
  },

  syncAttachedItems(items) {
    set((state) => {
      const unchanged =
        items.length === state.attachedItems.length &&
        items.every(
          (item, index) =>
            chipKey(item) === chipKey(state.attachedItems[index]),
        );
      return unchanged ? state : { attachedItems: items };
    });
  },

  stageOutgoing(draft) {
    set({ outgoing: draft });
  },

  takeOutgoing() {
    const { outgoing } = get();
    if (outgoing) set({ outgoing: null });
    return outgoing;
  },

  submitPrompt(text) {
    set({ pendingPrompt: text });
  },

  clearPendingPrompt() {
    set({ pendingPrompt: null });
  },

  openWithDraft({ segments }) {
    set((state) => ({
      ...nextOpenState(state, true),
      composerDraft: segments,
    }));
  },

  clearComposerDraft() {
    set({ composerDraft: null });
  },

  clearComposerPrefill() {
    set({ composerPrefill: null });
  },

  setComposerHasText(hasText) {
    set({ composerHasText: hasText });
  },

  setPermissionPopoverOpen(open) {
    set({ permissionPopoverOpen: open });
  },

  setCapabilitiesOpen(open) {
    set({ capabilitiesOpen: open });
  },

  requestMention(request) {
    set({ mentionRequest: request });
  },

  clearMentionRequest() {
    set({ mentionRequest: null });
  },

  setLiveTurn(liveTurn) {
    set({ liveTurn });
  },

  setActiveThreadId(id) {
    persistActiveThreadId(id);
    set({ activeThreadId: id });
  },

  async startThread(init) {
    const { createThread } = await loadThreadDb();
    const { thread, pruned } = await createThread({
      workspaceId: RELAY_WORKSPACE_ID,
      id: init?.id,
    });
    persistActiveThreadId(thread.id);
    set((state) => ({
      activeThreadId: thread.id,
      prunedNotice: state.prunedNotice || pruned,
    }));
    return thread.id;
  },

  async newThread() {
    // A new conversation starts with nothing attached, even when the empty
    // thread is reused below (FR-122). The composer empties its editor on the
    // request; the mirror is cleared too so it is right with no composer mounted.
    set((state) => ({
      attachedItems: [],
      attachmentResetRequest: state.attachmentResetRequest + 1,
    }));
    // Queued saves must land first or a just-sent first message reads as empty.
    const { flushThreadWrites, getThread } = await loadThreadDb();
    await flushThreadWrites();
    const { activeThreadId, startThread } = get();
    const current = activeThreadId ? await getThread(activeThreadId) : null;
    // Repeated clicks reuse the empty thread instead of piling up blank ones.
    if (current?.messages.length === 0) return;
    await startThread();
  },

  dismissPrunedNotice() {
    set({ prunedNotice: false });
  },

  async hydrate() {
    useRelayPermissionStore.getState().hydrate();
    removeLegacyPosition();
    set({
      open: readOpen(),
      width: readWidth(),
      shareValues: readPreference(SHARE_VALUES_KEY) === "true",
      // Only an explicit "false" opts out, so a fresh profile starts enabled.
      enabled: readPreference(RELAY_STORAGE_KEYS.enabled) !== "false",
      activeThreadId: readActiveThreadId(),
    });
    if (!get().activeThreadId) {
      const lastActiveId = await findLastActiveThreadId();
      // The user may have started a thread while the lookup was running.
      if (lastActiveId && !get().activeThreadId) {
        persistActiveThreadId(lastActiveId);
        set({ activeThreadId: lastActiveId });
      }
    }
    set({ hydrated: true });
  },
}));

function nextOpenState(
  state: RelayState,
  open: boolean,
): Pick<RelayState, "open" | "focusRequest"> {
  writePreference(RELAY_STORAGE_KEYS.open, open);
  return {
    open,
    focusRequest: open ? state.focusRequest + 1 : state.focusRequest,
  };
}
