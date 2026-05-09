"use client";

import { create } from "zustand";
import type { BulkCloseAction } from "@/types";

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
}));
