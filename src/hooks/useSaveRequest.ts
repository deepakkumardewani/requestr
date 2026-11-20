"use client";

import { toast } from "sonner";
import { isTrackingActive, track } from "@/lib/analytics/adapter";
import { shouldSendOnce } from "@/lib/analytics/dedupe";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HttpTab } from "@/types";

const FIRST_SAVE_ONCE_KEY = "request_saved";

/**
 * The one place a tab's edits are written into its saved request, so the
 * editor, Save all & close and the dirty-tab gate keep the same fields
 * (assertions included, HH-M14).
 */
export function saveTabToRequest(tab: HttpTab, requestId: string): void {
  useCollectionsStore.getState().updateRequest(requestId, {
    name: tab.name,
    method: tab.method,
    url: tab.url,
    params: tab.params,
    headers: tab.headers,
    auth: tab.auth,
    body: tab.body,
    preScript: tab.preScript,
    postScript: tab.postScript,
    timeoutMs: tab.timeoutMs,
    assertions: tab.assertions,
  });
  useTabsStore.getState().updateTabState(tab.tabId, { isDirty: false });
  if (!isTrackingActive()) return;
  track("request_saved", { is_first: shouldSendOnce(FIRST_SAVE_ONCE_KEY) });
}

/**
 * Handles save logic for the active tab.
 * - If the tab is already linked to a collection request, updates it in place and toasts.
 * - Otherwise opens the SaveRequestModal to let the user pick/create a collection.
 */
export function useSaveRequest() {
  const { tabs, activeTabId } = useTabsStore();
  const { requests } = useCollectionsStore();
  const setSaveModalOpen = useUIStore((s) => s.setSaveModalOpen);

  const activeTab = tabs.find((t) => t.tabId === activeTabId);

  function save() {
    if (!activeTab) return;
    if (activeTab.type !== "http") {
      toast.info("Saving is only available for HTTP requests");
      return;
    }

    if (activeTab.requestId) {
      const existing = requests.find((r) => r.id === activeTab.requestId);
      if (!existing) return;

      saveTabToRequest(activeTab, activeTab.requestId);
      toast.success("Request saved");
    } else {
      setSaveModalOpen(true);
    }
  }

  return { save, activeTab };
}
