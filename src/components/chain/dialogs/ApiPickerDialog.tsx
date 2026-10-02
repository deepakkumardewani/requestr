"use client";

import { FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { flattenPickerTree } from "@/lib/pickerTree";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HistoryEntry } from "@/types";
import type { AddApiIntent } from "@/types/chain";
import { HistoryList } from "./picker/HistoryList";
import { NewRequestPanel } from "./picker/NewRequestPanel";
import {
  PickerProvider,
  usePickerActions,
  usePickerExpanded,
  usePickerMethodFilters,
  usePickerQuery,
} from "./picker/PickerContext";
import {
  countMethodChips,
  PickerFilters,
  toMethodChip,
} from "./picker/PickerFilters";
import { PickerFooter } from "./picker/PickerFooter";
import { PickerNoResults, PickerSearchBar } from "./picker/PickerSearchBar";
import { PickerErrorBoundary, PickerSkeleton } from "./picker/PickerStates";
import { PickerTabs } from "./picker/PickerTabs";
import { PickerTree } from "./picker/PickerTree";
import { resolveOrigin, usePickerAdd } from "./picker/usePickerAdd";

type ApiPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  chainId: string;
  alreadyAddedIds: Set<string>;
  /**
   * Open intent for this dialog session. Its `pendingConnection` joins only the first node of the
   * confirmed add, and is discarded with the dialog if the user dismisses it.
   */
  intent?: AddApiIntent;
  /** Lets the canvas fit the freshly added nodes into view (the dialog sits outside React Flow). */
  onNodesAdded?: (nodeIds: string[]) => void;
  /** Selects and centers an already-added node; the dialog closes first. */
  onShowOnCanvas?: (nodeId: string) => void;
};

function EmptyState({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
        {icon}
      </div>
      {children}
    </div>
  );
}

function useMethodFilterState() {
  const methodFilters = usePickerMethodFilters();
  return useMemo(
    () => (methodFilters.size === 0 ? null : methodFilters),
    [methodFilters],
  );
}

/** Search + method chips shared by the Collections and History tabs. */
function PickerToolbar({
  resultCount,
  methods,
  expandAll,
}: {
  resultCount: number;
  methods: HistoryEntry["method"][];
  expandAll?: {
    canExpand: boolean;
    allExpanded: boolean;
    onToggle: () => void;
  };
}) {
  return (
    <div className="shrink-0">
      <PickerSearchBar resultCount={resultCount} />
      <PickerFilters
        counts={countMethodChips(methods)}
        canExpand={expandAll?.canExpand ?? false}
        allExpanded={expandAll?.allExpanded ?? false}
        onToggleExpandAll={expandAll?.onToggle ?? (() => {})}
      />
    </div>
  );
}

type CollectionsPanelProps = {
  inChainIds: ReadonlySet<string>;
  onAddIds: (requestIds: string[]) => void;
  onShowOnCanvas: (requestId: string) => void;
};

function CollectionsPanel({
  inChainIds,
  onAddIds,
  onShowOnCanvas,
}: CollectionsPanelProps) {
  const t = useTranslations("chain");
  const collections = useCollectionsStore((s) => s.collections);
  const folders = useCollectionsStore((s) => s.folders);
  const requests = useCollectionsStore((s) => s.requests);
  const hydrated = useCollectionsStore((s) => s.hydrated);
  const query = usePickerQuery();
  const expanded = usePickerExpanded();
  const methodFilters = useMethodFilterState();
  const { setExpanded } = usePickerActions();

  const searchRows = useMemo(
    () =>
      flattenPickerTree(collections, folders, requests, {
        expanded,
        filter: query,
      }),
    [collections, folders, requests, expanded, query],
  );
  const filteredRequests = useMemo(
    () =>
      methodFilters
        ? requests.filter((r) => methodFilters.has(toMethodChip(r.method)))
        : requests,
    [requests, methodFilters],
  );
  const rows = useMemo(
    () =>
      methodFilters
        ? flattenPickerTree(collections, folders, filteredRequests, {
            expanded,
            filter: query,
          })
        : searchRows,
    [
      methodFilters,
      collections,
      folders,
      filteredRequests,
      expanded,
      query,
      searchRows,
    ],
  );

  // Chip counts follow the search only: a collapsed tree has no item rows, so count requests directly.
  const chipMethods = useMemo(() => {
    if (!query.trim()) return requests.map((r) => r.method);
    return searchRows.flatMap((row) =>
      row.kind === "item" ? [row.item.method] : [],
    );
  }, [query, requests, searchRows]);
  const resultCount = useMemo(
    () => rows.filter((row) => row.kind === "item").length,
    [rows],
  );

  const expandableIds = useMemo(
    () => [
      ...collections
        .filter(
          (c) =>
            requests.some((r) => r.collectionId === c.id) ||
            folders.some((f) => f.collectionId === c.id),
        )
        .map((c) => c.id),
      ...folders.map((f) => f.id),
    ],
    [collections, folders, requests],
  );
  const allExpanded =
    expandableIds.length > 0 && expandableIds.every((id) => expanded.has(id));
  const toggleExpandAll = useCallback(
    () => setExpanded(allExpanded ? new Set() : new Set(expandableIds)),
    [allExpanded, expandableIds, setExpanded],
  );

  const renderBody = () => {
    if (!hydrated) return <PickerSkeleton />;
    if (collections.length === 0) {
      return (
        <EmptyState icon={<FolderOpen className="h-6 w-6 opacity-50" />}>
          <p className="text-sm">{t("apiPickerNoCollections")}</p>
        </EmptyState>
      );
    }
    if (rows.length === 0) return <PickerNoResults />;
    return (
      <PickerTree
        rows={rows}
        inChainIds={inChainIds}
        onAddIds={onAddIds}
        onShowOnCanvas={onShowOnCanvas}
        showRecents
      />
    );
  };

  return (
    <>
      <PickerToolbar
        resultCount={resultCount}
        methods={chipMethods}
        expandAll={{
          canExpand: expandableIds.length > 0,
          allExpanded,
          onToggle: toggleExpandAll,
        }}
      />
      {renderBody()}
    </>
  );
}

/** History rows are keyed by entry id, but the canvas node has its own generated id. */
function resolveNodeId(chainId: string, rowId: string): string {
  const block = useChainStore
    .getState()
    .chains[chainId]?.blocks.find(
      (b) => b.type === "history" && b.historyEntryId === rowId,
    );
  return block?.id ?? rowId;
}

const PANEL_CLASS = "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden";

export function ApiPickerDialog({
  open,
  onClose,
  chainId,
  alreadyAddedIds,
  intent,
  onNodesAdded,
  onShowOnCanvas,
}: ApiPickerDialogProps) {
  const t = useTranslations("chain");
  const pickerTab = useUIStore((s) => s.pickerTab);
  const setPickerTab = useUIStore((s) => s.setPickerTab);
  const hydrateCollections = useCollectionsStore((s) => s.hydrate);

  const addRequests = usePickerAdd({ chainId, intent, onClose, onNodesAdded });
  const handleAdd = useCallback(
    (requestIds: string[]) => {
      const { skipped } = addRequests(requestIds);
      if (skipped.length > 0) toast.info(t("apiPickerAlreadyInChain"));
    },
    [addRequests, t],
  );
  // Same placement the Collections/History add path derives, so a created request lands identically.
  const newRequestPlacement = useMemo(
    () => ({
      position: resolveOrigin(useChainStore.getState().chains[chainId], intent),
      connectFrom: intent?.pendingConnection,
    }),
    [chainId, intent],
  );
  const handleNodeAdded = useCallback(
    (nodeId: string) => onNodesAdded?.([nodeId]),
    [onNodesAdded],
  );
  const handleShowOnCanvas = useCallback(
    (rowId: string) => {
      onClose();
      onShowOnCanvas?.(resolveNodeId(chainId, rowId));
    },
    [chainId, onClose, onShowOnCanvas],
  );
  // The dialog's default would focus the tab strip; typing should start in search.
  const focusSearch = useCallback(
    () =>
      document.querySelector<HTMLElement>('[data-testid="picker-search"]') ??
      undefined,
    [],
  );

  return (
    <PickerProvider open={open}>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          data-testid="api-picker-dialog"
          initialFocus={focusSearch}
          className="flex h-[min(80vh,640px)] w-full max-w-full min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {t("apiPickerTitle")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("apiPickerDescription")}
            </DialogDescription>
          </DialogHeader>

          <PickerTabs value={pickerTab} onValueChange={setPickerTab}>
            {/* Only the active tab's tree may mount: while the outgoing panel lingers during the tab
                transition, two trees would fight over the shared active row id forever. */}
            <TabsContent value="collections" className={PANEL_CLASS}>
              {pickerTab === "collections" && (
                <PickerErrorBoundary onRetry={() => void hydrateCollections()}>
                  <CollectionsPanel
                    inChainIds={alreadyAddedIds}
                    onAddIds={handleAdd}
                    onShowOnCanvas={handleShowOnCanvas}
                  />
                </PickerErrorBoundary>
              )}
            </TabsContent>
            <TabsContent value="history" className={PANEL_CLASS}>
              {pickerTab === "history" && (
                <PickerErrorBoundary onRetry={() => void hydrateCollections()}>
                  <HistoryList
                    inChainIds={alreadyAddedIds}
                    onAddIds={handleAdd}
                    onShowOnCanvas={handleShowOnCanvas}
                  />
                </PickerErrorBoundary>
              )}
            </TabsContent>
            <TabsContent
              value="new"
              data-testid="picker-panel-new"
              className="mt-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
            >
              {pickerTab === "new" && (
                <NewRequestPanel
                  chainId={chainId}
                  onClose={onClose}
                  onNodeAdded={handleNodeAdded}
                  placement={newRequestPlacement}
                />
              )}
            </TabsContent>
            {pickerTab !== "new" && (
              <PickerFooter
                alreadyAddedIds={alreadyAddedIds}
                onCancel={onClose}
                onAdd={handleAdd}
              />
            )}
          </PickerTabs>
        </DialogContent>
      </Dialog>
    </PickerProvider>
  );
}
