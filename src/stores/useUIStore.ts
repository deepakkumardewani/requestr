"use client";

import { create } from "zustand";
import { DEFAULT_CHAIN_CONCURRENCY } from "@/lib/chainConstants";
import type { BulkCloseAction } from "@/types";
import type { ChainBlock, ChainEdge } from "@/types/chain";

/**
 * A copied set of chain blocks (delay/condition/display — the block kinds
 * that are self-contained within `Chain.blocks` and can be reproduced with
 * fresh ids in any chain), the edges among them, and their source positions
 * so paste can offset relative to the original layout.
 */
export type ChainClipboardEntry = {
  blocks: ChainBlock[];
  edges: ChainEdge[];
  positions: Record<string, { x: number; y: number }>;
};

/** localStorage key for the run-log dock's persisted height, in px. */
const RUN_LOG_HEIGHT_STORAGE_KEY = "rq_chain_run_log_height";
/** localStorage key for the run-log dock's "auto-open on run" preference. */
const RUN_LOG_AUTO_OPEN_STORAGE_KEY = "rq_chain_run_log_auto_open";
/** localStorage key for the run-log dock's collapsed state. */
const RUN_LOG_COLLAPSED_STORAGE_KEY = "rq_chain_run_log_collapsed";
/** localStorage key for the chain runner's persisted concurrency setting. */
const CHAIN_CONCURRENCY_STORAGE_KEY = "rq_chain_concurrency";

/** Default and clamp bounds for the run-log dock height — mirrored by `RunLogDock`. */
export const DEFAULT_RUN_LOG_HEIGHT = 280;
export const MIN_RUN_LOG_HEIGHT = 160;
const DEFAULT_RUN_LOG_AUTO_OPEN = true;
const DEFAULT_RUN_LOG_COLLAPSED = true;

/** Clamp bounds for the chain runner's concurrency setting. */
export const MIN_CHAIN_CONCURRENCY = 1;
export const MAX_CHAIN_CONCURRENCY = 8;

/**
 * localStorage can throw (private mode, quota, disabled storage). A failed
 * preference read/write must never break the UI, so callers fall back to
 * defaults — but the failure is still logged with its key for diagnosis.
 */
function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("[ui] preference read failed", { key, error });
    return null;
  }
}

function writePreference(key: string, value: string | number | boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn("[ui] preference write failed", { key, error });
  }
}

function readBooleanPreference(key: string, fallback: boolean): boolean {
  const stored = readPreference(key);
  return stored === null ? fallback : stored === "true";
}

function readRunLogHeight(): number {
  const parsed = Number(readPreference(RUN_LOG_HEIGHT_STORAGE_KEY) ?? NaN);
  return Number.isFinite(parsed) && parsed >= MIN_RUN_LOG_HEIGHT
    ? parsed
    : DEFAULT_RUN_LOG_HEIGHT;
}

function clampConcurrency(value: number): number {
  return Math.min(
    MAX_CHAIN_CONCURRENCY,
    Math.max(MIN_CHAIN_CONCURRENCY, Math.round(value)),
  );
}

function readChainConcurrency(): number {
  const stored = readPreference(CHAIN_CONCURRENCY_STORAGE_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed)
    ? clampConcurrency(parsed)
    : DEFAULT_CHAIN_CONCURRENCY;
}

type UIState = {
  leftPanelWidth: number;
  splitRatio: number;
  commandPaletteOpen: boolean;
  mobileSidebarOpen: boolean;
  historyFilter: string | null;
  saveModalOpen: boolean;
  pendingCloseTabId: string | null;
  pendingBulkClose: BulkCloseAction | null;
  isCreatingCollection: boolean;
  isCreatingEnv: boolean;
  isImportOpen: boolean;
  envManagerOpen: boolean;
  envManagerFocusEnvId: string | null;
  keyboardShortcutsOpen: boolean;
  /** Run-log dock height in px, persisted across reloads. */
  chainRunLogHeight: number;
  /** Whether the run-log dock auto-opens when a run starts, persisted across reloads. */
  chainRunLogAutoOpen: boolean;
  /** Whether the run-log dock is collapsed to its 32px strip, persisted across reloads. */
  chainRunLogCollapsed: boolean;
  /** Last copied chain blocks, ready to paste — null once nothing has been copied yet. */
  chainClipboard: ChainClipboardEntry | null;
  /** Number of chain nodes the runner dispatches in parallel (1–8), persisted across reloads. */
  chainConcurrency: number;
};

type UIActions = {
  setLeftPanelWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setHistoryFilter: (filter: string | null) => void;
  setSaveModalOpen: (open: boolean) => void;
  setPendingCloseTabId: (id: string | null) => void;
  setPendingBulkClose: (action: BulkCloseAction | null) => void;
  setIsCreatingCollection: (value: boolean) => void;
  setIsCreatingEnv: (value: boolean) => void;
  setIsImportOpen: (open: boolean) => void;
  setEnvManagerOpen: (open: boolean, focusEnvId?: string | null) => void;
  setKeyboardShortcutsOpen: (open: boolean) => void;
  setChainRunLogHeight: (height: number) => void;
  setChainRunLogAutoOpen: (autoOpen: boolean) => void;
  setChainRunLogCollapsed: (collapsed: boolean) => void;
  setChainClipboard: (clipboard: ChainClipboardEntry | null) => void;
  setChainConcurrency: (concurrency: number) => void;
  /**
   * Loads the persisted chain preferences from localStorage. Called after
   * mount, never at store creation, so the first client render matches the
   * server-rendered HTML (which can only see the defaults).
   */
  hydrateChainPreferences: () => void;
};

export const useUIStore = create<UIState & UIActions>((set) => ({
  leftPanelWidth: 280,
  splitRatio: 50,
  commandPaletteOpen: false,
  mobileSidebarOpen: false,
  historyFilter: null,
  saveModalOpen: false,
  pendingCloseTabId: null,
  pendingBulkClose: null,
  isCreatingCollection: false,
  isCreatingEnv: false,
  isImportOpen: false,
  envManagerOpen: false,
  envManagerFocusEnvId: null,
  keyboardShortcutsOpen: false,
  chainRunLogHeight: DEFAULT_RUN_LOG_HEIGHT,
  chainRunLogAutoOpen: DEFAULT_RUN_LOG_AUTO_OPEN,
  chainRunLogCollapsed: DEFAULT_RUN_LOG_COLLAPSED,
  chainClipboard: null,
  chainConcurrency: DEFAULT_CHAIN_CONCURRENCY,

  hydrateChainPreferences() {
    set({
      chainRunLogHeight: readRunLogHeight(),
      chainRunLogAutoOpen: readBooleanPreference(
        RUN_LOG_AUTO_OPEN_STORAGE_KEY,
        DEFAULT_RUN_LOG_AUTO_OPEN,
      ),
      chainRunLogCollapsed: readBooleanPreference(
        RUN_LOG_COLLAPSED_STORAGE_KEY,
        DEFAULT_RUN_LOG_COLLAPSED,
      ),
      chainConcurrency: readChainConcurrency(),
    });
  },

  setLeftPanelWidth(width) {
    set({ leftPanelWidth: width });
  },

  setSplitRatio(ratio) {
    set({ splitRatio: ratio });
  },

  toggleCommandPalette() {
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
  },

  setCommandPaletteOpen(open) {
    set({ commandPaletteOpen: open });
  },

  toggleMobileSidebar() {
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen }));
  },

  setHistoryFilter(filter) {
    set({ historyFilter: filter });
  },

  setSaveModalOpen(open) {
    set({ saveModalOpen: open });
  },

  setPendingCloseTabId(id) {
    set({ pendingCloseTabId: id });
  },

  setPendingBulkClose(action) {
    set({ pendingBulkClose: action });
  },

  setIsCreatingCollection(value) {
    set({ isCreatingCollection: value });
  },

  setIsCreatingEnv(value) {
    set({ isCreatingEnv: value });
  },

  setIsImportOpen(open) {
    set({ isImportOpen: open });
  },

  setEnvManagerOpen(open, focusEnvId = null) {
    set({
      envManagerOpen: open,
      envManagerFocusEnvId: open ? focusEnvId : null,
    });
  },

  setKeyboardShortcutsOpen(open) {
    set({ keyboardShortcutsOpen: open });
  },

  setChainRunLogHeight(height) {
    const clamped = Math.max(height, MIN_RUN_LOG_HEIGHT);
    writePreference(RUN_LOG_HEIGHT_STORAGE_KEY, clamped);
    set({ chainRunLogHeight: clamped });
  },

  setChainRunLogAutoOpen(autoOpen) {
    writePreference(RUN_LOG_AUTO_OPEN_STORAGE_KEY, autoOpen);
    set({ chainRunLogAutoOpen: autoOpen });
  },

  setChainRunLogCollapsed(collapsed) {
    writePreference(RUN_LOG_COLLAPSED_STORAGE_KEY, collapsed);
    set({ chainRunLogCollapsed: collapsed });
  },

  setChainClipboard(clipboard) {
    set({ chainClipboard: clipboard });
  },

  setChainConcurrency(concurrency) {
    const clamped = clampConcurrency(concurrency);
    writePreference(CHAIN_CONCURRENCY_STORAGE_KEY, clamped);
    set({ chainConcurrency: clamped });
  },
}));
