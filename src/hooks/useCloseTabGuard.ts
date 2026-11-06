"use client";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { TabState } from "@/types";

/**
 * Centralizes the "close with dirty-check" logic for tabs.
 * All close actions (button, context menu, dropdown, keyboard) go through here
 * so the confirmation dialogs are triggered consistently.
 */
export function useCloseTabGuard() {
  const { tabs, closeTab, closeOtherTabs, closeAllTabs } = useTabsStore();
  const { setPendingCloseTabId, setPendingBulkClose } = useUIStore();
  const confirmCloseUnsavedTabs = useSettingsStore(
    (s) => s.confirmCloseUnsavedTabs,
  );

  function handleCloseTab(tab: TabState) {
    if (confirmCloseUnsavedTabs && tab.isDirty) {
      setPendingCloseTabId(tab.tabId);
    } else {
      closeTab(tab.tabId);
    }
  }

  function handleCloseOthers(keepTabId: string) {
    const hasDirtyOthers = tabs.some((t) => t.tabId !== keepTabId && t.isDirty);
    if (confirmCloseUnsavedTabs && hasDirtyOthers) {
      setPendingBulkClose({ kind: "others", keepTabId });
    } else {
      closeOtherTabs(keepTabId);
    }
  }

  function handleCloseAll() {
    const hasDirty = tabs.some((t) => t.isDirty);
    if (confirmCloseUnsavedTabs && hasDirty) {
      setPendingBulkClose({ kind: "all" });
    } else {
      closeAllTabs();
    }
  }

  return { handleCloseTab, handleCloseOthers, handleCloseAll };
}
