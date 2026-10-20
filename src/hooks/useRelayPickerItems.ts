import { useDeferredValue, useMemo } from "react";
import type { ContextChip, ContextChipKind } from "@/lib/relay/chips";
import { buildRedactContext } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { searchWorkspaceItems } from "@/lib/relay/tools/workspaceRead";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { CollectionModel, RequestModel } from "@/types";

/** Kinds the search filters by; the open tab is offered separately, never searched. */
export type PickerKind = Exclude<ContextChipKind, "tab"> | "all";

export type PickerItem = ContextChip & {
  /** Method and redacted URL for a request, or the collection a tab lives in; absent otherwise. */
  detail?: string;
};

export type PickerItems = {
  items: PickerItem[];
  /** The tab in focus, offered as a pinned row; null when no tab is open. */
  currentTab: PickerItem | null;
  /** Matches before the cap, so the footer can tell the user to narrow down. */
  total: number;
  truncated: boolean;
};

const isChipKind = (kind: string): kind is Exclude<ContextChipKind, "tab"> =>
  kind === "request" ||
  kind === "chain" ||
  kind === "collection" ||
  kind === "environment";

/** The collection a saved request tab lives in; unsaved tabs have none. */
function tabBreadcrumb(
  requestId: string | null,
  requests: readonly RequestModel[],
  collections: readonly CollectionModel[],
): string | undefined {
  const request = requests.find((r) => r.id === requestId);
  return collections.find((c) => c.id === request?.collectionId)?.name;
}

/**
 * Workspace items for the picker, filtered by kind and query against the same
 * index the search tool uses. The query is deferred so typing stays responsive
 * while a large workspace is re-filtered.
 */
export function useRelayPickerItems(
  query: string,
  kind: PickerKind = "all",
): PickerItems {
  const collections = useCollectionsStore((s) => s.collections);
  const requests = useCollectionsStore((s) => s.requests);
  const environments = useEnvironmentsStore((s) => s.environments);
  const chains = useChainStore((s) => s.chains);
  const shareValues = useRelayStore((s) => s.shareValues);
  const activeTab = useTabsStore((s) =>
    s.tabs.find((tab) => tab.tabId === s.activeTabId),
  );
  const deferredQuery = useDeferredValue(query);

  // The store access object reads live state, so the snapshots above are the memo keys.
  const search = useMemo(() => {
    const { hits, total, truncated } = searchWorkspaceItems(
      createZustandStoreAccess(),
      {
        query: deferredQuery,
        kinds: kind === "all" ? undefined : [kind],
        redact: buildRedactContext(environments, shareValues),
      },
    );
    const items = hits.flatMap((hit) =>
      isChipKind(hit.kind)
        ? [{ kind: hit.kind, id: hit.id, label: hit.name, detail: hit.detail }]
        : [],
    );
    return { items, total, truncated };
  }, [
    deferredQuery,
    kind,
    collections,
    requests,
    environments,
    chains,
    shareValues,
  ]);

  const currentTab: PickerItem | null = activeTab
    ? {
        kind: "tab",
        id: activeTab.tabId,
        label: activeTab.name,
        detail: tabBreadcrumb(activeTab.requestId, requests, collections),
      }
    : null;
  return { ...search, currentTab };
}
