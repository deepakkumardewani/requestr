"use client";

import { create } from "zustand";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import {
  RELAY_DEFAULT_POSITION,
  RELAY_DEFAULT_WIDTH_PX,
  RELAY_MAX_WIDTH_VW,
  RELAY_MIN_WIDTH_PX,
  RELAY_PANEL_POSITIONS,
  RELAY_STORAGE_KEYS,
  RELAY_WORKSPACE_ID,
  type RelayPanelPosition,
} from "@/lib/relay/constants";

/** Thread storage is only needed once a thread is read or created, so it stays out of the main chunk (NFR-2). */
const loadThreadDb = () => import("@/lib/relay/threadDb");

const PERCENT = 100;
/** Not in RELAY_STORAGE_KEYS: it is a privacy setting owned by this store (FR-61). */
const SHARE_VALUES_KEY = "rq_relay_share_values";

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
  /** Chips seeded by an "Open in Relay" entry point for the next message. */
  draftChips: readonly RelayChip[];
  /** Chip keys the user removed for the next message (FR-13); cleared on send. */
  removedChipKeys: readonly string[];
  /** A prompt chosen outside the composer (a suggestion); the chat sends it and clears it. */
  pendingPrompt: string | null;
  /** Text an entry point wants pre-filled into the composer; the dock applies it and clears it. */
  composerPrefill: string | null;
  /** User preference to use Relay at all (FR-81); on by default, independent of the build flag. */
  enabled: boolean;
  /** Edge the dock defaults to (FR-81); persisted. */
  position: RelayPanelPosition;
  /** Let non-secret environment values reach the model; off by default (FR-61). */
  shareValues: boolean;
  /**
   * Bumped on every user-initiated open so the dock can move focus to the
   * composer. Transient and never persisted: restoring `open` from storage
   * on load must not steal focus.
   */
  focusRequest: number;
};

type RelayActions = {
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setShareValues: (shareValues: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setPosition: (position: RelayPanelPosition) => void;
  removeChip: (key: string) => void;
  resetRemovedChips: () => void;
  submitPrompt: (text: string) => void;
  clearPendingPrompt: () => void;
  /** Opens the dock with `prompt` in the composer and `chips` seeded and visible. */
  openWithDraft: (draft: {
    prompt: string;
    chips: readonly RelayChip[];
  }) => void;
  clearComposerPrefill: () => void;
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

/** Largest allowed dock width for a viewport (FR-2: 60vw). */
export function getRelayMaxWidth(viewportWidth: number): number {
  return Math.floor((viewportWidth * RELAY_MAX_WIDTH_VW) / PERCENT);
}

/** Clamps a width to 320px..60vw; a non-finite width falls back to the default. */
export function clampRelayWidth(
  width: number,
  viewportWidth: number = window.innerWidth,
): number {
  if (!Number.isFinite(width)) return RELAY_DEFAULT_WIDTH_PX;
  const max = Math.max(RELAY_MIN_WIDTH_PX, getRelayMaxWidth(viewportWidth));
  return Math.min(max, Math.max(RELAY_MIN_WIDTH_PX, Math.round(width)));
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

function readPosition(): RelayPanelPosition {
  const stored = readPreference(RELAY_STORAGE_KEYS.position);
  return (
    RELAY_PANEL_POSITIONS.find((p) => p === stored) ?? RELAY_DEFAULT_POSITION
  );
}

function readOpen(): boolean {
  return readPreference(RELAY_STORAGE_KEYS.open) === "true";
}

function readWidth(): number {
  const stored = readPreference(RELAY_STORAGE_KEYS.width);
  if (stored === null || stored.trim() === "") return RELAY_DEFAULT_WIDTH_PX;
  return clampRelayWidth(Number(stored));
}

export const useRelayStore = create<RelayState & RelayActions>((set, get) => ({
  open: false,
  width: RELAY_DEFAULT_WIDTH_PX,
  activeThreadId: null,
  hydrated: false,
  prunedNotice: false,
  draftChips: [],
  shareValues: false,
  enabled: true,
  position: RELAY_DEFAULT_POSITION,
  removedChipKeys: [],
  pendingPrompt: null,
  composerPrefill: null,
  focusRequest: 0,

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

  setPosition(position) {
    writePreference(RELAY_STORAGE_KEYS.position, position);
    set({ position });
  },

  removeChip(key) {
    set((state) =>
      state.removedChipKeys.includes(key)
        ? state
        : { removedChipKeys: [...state.removedChipKeys, key] },
    );
  },

  resetRemovedChips() {
    set({ removedChipKeys: [] });
  },

  submitPrompt(text) {
    set({ pendingPrompt: text });
  },

  clearPendingPrompt() {
    set({ pendingPrompt: null });
  },

  openWithDraft({ prompt, chips }) {
    set((state) => {
      const seededKeys = chips.map(chipKey);
      return {
        ...nextOpenState(state, true),
        composerPrefill: prompt,
        draftChips: chips,
        // A chip the user removed earlier must be back so the context matches the entry point.
        removedChipKeys: state.removedChipKeys.filter(
          (key) => !seededKeys.includes(key),
        ),
      };
    });
  },

  clearComposerPrefill() {
    set({ composerPrefill: null });
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
    set({
      open: readOpen(),
      width: readWidth(),
      shareValues: readPreference(SHARE_VALUES_KEY) === "true",
      // Only an explicit "false" opts out, so a fresh profile starts enabled.
      enabled: readPreference(RELAY_STORAGE_KEYS.enabled) !== "false",
      position: readPosition(),
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
