import { useTabsStore } from "@/stores/useTabsStore";
import { collectBackupData } from "./exporter";
import { countDanglingReferences } from "./selection";

export type ReconcileResult = {
  closedTabs: number;
  danglingCount: number;
};

function idsOf(list: unknown[] | undefined): Set<string> {
  return new Set(
    (list ?? []).map((item) => String((item as { id?: unknown }).id)),
  );
}

/**
 * Brings tabs and counts back in line with the restored data: tabs whose
 * request no longer exists are closed, and the references that now point at
 * missing records are counted for the restore summary.
 */
export async function reconcileAfterRestore(): Promise<ReconcileResult> {
  const data = await collectBackupData(["collections", "chains", "settings"]);
  const tabs = useTabsStore.getState();
  // Closing before hydration would persist an empty tab list over the saved one.
  if (!tabs.hydrated) await tabs.hydrate();
  const closedTabs = useTabsStore
    .getState()
    .closeTabsWithoutRequests(idsOf(data.requests));
  return { closedTabs, danglingCount: countDanglingReferences(data) };
}
