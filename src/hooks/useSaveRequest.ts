"use client";

import { toast } from "sonner";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

/**
 * Handles save logic for the active tab.
 * - If the tab is already linked to a collection request, updates it in place and toasts.
 * - Otherwise opens the SaveRequestModal to let the user pick/create a collection.
 */
export function useSaveRequest() {
  const { tabs, activeTabId, updateTabState } = useTabsStore();
  const { requests, updateRequest } = useCollectionsStore();
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

      updateRequest(activeTab.requestId, {
        name: activeTab.name,
        method: activeTab.method,
        url: activeTab.url,
        params: activeTab.params,
        headers: activeTab.headers,
        auth: activeTab.auth,
        body: activeTab.body,
        preScript: activeTab.preScript,
        postScript: activeTab.postScript,
        timeoutMs: activeTab.timeoutMs,
        assertions: activeTab.assertions,
      });

      updateTabState(activeTab.tabId, { isDirty: false });
      toast.success("Request saved");
    } else {
      setSaveModalOpen(true);
    }
  }

  return { save, activeTab };
}
