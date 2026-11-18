"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MethodBadge } from "@/components/common/MethodBadge";
import { Badge } from "@/components/ui/badge";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import {
  type PickerNavKey,
  type PickerNavKeyName,
  pickerNavReducer,
} from "@/lib/pickerNav";
import { selectRecentRequestIds } from "@/lib/pickerRecents";
import { pickerStickyHeader } from "@/lib/pickerStickyHeader";
import type {
  PickerHeaderRow,
  PickerListItem,
  PickerRow as PickerRowModel,
} from "@/lib/pickerTree";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import {
  useIsPickerRowSelected,
  usePickerActions,
  usePickerActiveRowId,
  usePickerExpanded,
  usePickerMethodFilters,
  usePickerQuery,
  usePickerStore,
} from "./PickerContext";
import { getPickerRowDomId, PICKER_ROW_HEIGHT, PickerRow } from "./PickerRow";

const OVERSCAN_ROWS = 8;

const HANDLED_KEYS: ReadonlySet<string> = new Set<PickerNavKeyName>([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Enter",
  " ",
]);

const isNavKey = (event: KeyboardEvent): boolean =>
  HANDLED_KEYS.has(event.key) ||
  (event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey));

/** Header ids are `${headerType}:${entityId}`; context `expanded` stores the bare entity id. */
const toEntityId = (header: PickerHeaderRow) =>
  header.id.slice(header.headerType.length + 1);

type PickerTreeProps = {
  /** Visible flattened rows, already narrowed by search and method filters. */
  rows: ReadonlyArray<PickerRowModel<PickerListItem>>;
  /** Request ids already on the canvas: focusable, never selectable. */
  inChainIds: ReadonlySet<string>;
  /** Enter on a lone active row with an empty selection adds it immediately (D2). */
  onAddIds: (requestIds: string[]) => void;
  onShowOnCanvas: (requestId: string) => void;
  /** Collections tab only: pins a "Recent" group above the tree while nothing is filtered. */
  showRecents?: boolean;
};

function RecentItem({ id, inChain }: { id: string; inChain: boolean }) {
  const t = useTranslations("chain");
  const request = useCollectionsStore((s) =>
    s.requests.find((r) => r.id === id),
  );
  const selected = useIsPickerRowSelected(id);
  const { toggleSelected } = usePickerActions();
  if (!request) return null;
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        disabled={inChain}
        data-testid={`picker-recent-${id}`}
        onClick={() => toggleSelected(id)}
        className="flex h-8 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 aria-pressed:bg-accent"
      >
        <MethodBadge method={request.method} />
        <span className="min-w-0 flex-1 truncate">{request.name}</span>
        {inChain && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("apiPickerInChain")}
          </span>
        )}
      </button>
    </li>
  );
}

/** Hidden while searching/filtering and when there is nothing recent (PICKER-19). */
function RecentGroup({ inChainIds }: { inChainIds: ReadonlySet<string> }) {
  const t = useTranslations("chain");
  const history = useHistoryStore((s) => s.entries);
  const requests = useCollectionsStore((s) => s.requests);
  const query = usePickerQuery();
  const methodFilters = usePickerMethodFilters();
  const ids = useMemo(
    () => selectRecentRequestIds(history, requests),
    [history, requests],
  );
  if (query.trim() || methodFilters.size > 0 || ids.length === 0) return null;
  return (
    <section
      aria-label={t("apiPickerRecent")}
      data-testid="picker-recent"
      className="shrink-0 border-b px-2 py-1"
    >
      <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground">
        {t("apiPickerRecent")}
      </h3>
      <ul>
        {ids.map((id) => (
          <RecentItem key={id} id={id} inChain={inChainIds.has(id)} />
        ))}
      </ul>
    </section>
  );
}

/** Pinned copy of the current collection header; decorative (the real row owns the a11y id). */
function StickyHeader({ header }: { header: PickerHeaderRow }) {
  const { toggleExpanded } = usePickerActions();
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      data-testid="picker-sticky-header"
      style={{ height: PICKER_ROW_HEIGHT }}
      onClick={() => toggleExpanded(toEntityId(header))}
      className="pointer-events-auto flex w-full min-w-0 items-center gap-2 border-b bg-background px-2 text-left text-[13px] font-semibold shadow-sm"
    >
      <ChevronRight className="h-4 w-4 shrink-0 rotate-90 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{header.label}</span>
      <Badge variant="secondary" className="shrink-0 tabular-nums">
        {header.count.visible}/{header.count.total}
      </Badge>
    </button>
  );
}

/**
 * Virtualized, keyboard-driven tree. DOM focus stays on the container; the active row is exposed via
 * `aria-activedescendant`, and all key semantics live in the pure `pickerNavReducer`.
 */
export function PickerTree({
  rows,
  inChainIds,
  onAddIds,
  onShowOnCanvas,
  showRecents = false,
}: PickerTreeProps) {
  const t = useTranslations("chain");
  const store = usePickerStore();
  const actions = usePickerActions();
  const activeId = usePickerActiveRowId();
  const expanded = usePickerExpanded();
  const query = usePickerQuery();
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PICKER_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    getItemKey: (index) => rows[index]?.id ?? index,
  });

  // The active row must always be one the user can see in the list.
  useEffect(() => {
    if (rows.length === 0) return;
    if (!activeId || !rows.some((row) => row.id === activeId)) {
      actions.setActiveRowId(rows[0].id);
    }
  }, [rows, activeId, actions]);

  const activeIndex = useMemo(
    () => rows.findIndex((row) => row.id === activeId),
    [rows, activeId],
  );
  useEffect(() => {
    if (activeIndex >= 0) virtualizer.scrollToIndex(activeIndex);
  }, [activeIndex, virtualizer]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      // Esc clears the search first even when focus sits in the list; only then does it close the dialog (PICKER-8).
      if (event.key === "Escape" && query !== "") {
        event.preventDefault();
        event.stopPropagation();
        actions.setQuery("");
        return;
      }
      if (!isNavKey(event)) return;
      event.preventDefault();
      const state = store.getState();
      const { state: next, effect } = pickerNavReducer(
        {
          rows,
          activeId: state.activeRowId,
          expanded: state.expanded,
          selectedIds: state.selectedIds,
          inChainIds,
          anchorId: anchorRef.current,
        },
        {
          key:
            event.key.toLowerCase() === "a"
              ? "a"
              : (event.key as PickerNavKeyName),
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
        } satisfies PickerNavKey,
      );
      anchorRef.current = next.anchorId;
      if (next.activeId !== state.activeRowId)
        actions.setActiveRowId(next.activeId);
      if (next.expanded !== state.expanded) actions.setExpanded(next.expanded);
      if (next.selectedIds !== state.selectedIds) {
        actions.selectMany([...next.selectedIds]);
        actions.deselect(
          [...state.selectedIds].filter((id) => !next.selectedIds.has(id)),
        );
      }
      if (effect?.type === "add") onAddIds(effect.ids);
      if (effect?.type === "in-chain")
        setAnnouncement(t("apiPickerAlreadyInChain"));
      if (effect?.type === "cap-reached") {
        setAnnouncement(
          t("apiPickerSelectionCap", { max: PICKER_SELECTION_CAP }),
        );
      }
    },
    [rows, inChainIds, store, actions, onAddIds, query, t],
  );

  const firstVisibleIndex = Math.max(
    0,
    Math.floor((virtualizer.scrollOffset ?? 0) / PICKER_ROW_HEIGHT),
  );
  const sticky = pickerStickyHeader(firstVisibleIndex, rows);

  return (
    <>
      {showRecents && <RecentGroup inChainIds={inChainIds} />}
      <div
        ref={scrollRef}
        role="tree"
        tabIndex={0}
        aria-multiselectable
        aria-label={t("apiPickerTitle")}
        aria-activedescendant={
          activeId ? getPickerRowDomId(activeId) : undefined
        }
        data-testid="picker-tree"
        data-expanded-count={expanded.size}
        onKeyDown={handleKeyDown}
        className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        {/* Zero-height sticky wrapper: the overlay never shifts or transforms the absolutely placed rows. */}
        <div className="pointer-events-none sticky top-0 z-10 h-0 min-w-0">
          {sticky && <StickyHeader header={sticky} />}
        </div>
        <div
          className="relative w-full min-w-0"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 w-full min-w-0"
                style={{
                  height: PICKER_ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <PickerRow
                  row={row}
                  inChain={row.kind === "item" && inChainIds.has(row.id)}
                  onShowOnCanvas={onShowOnCanvas}
                />
              </div>
            );
          })}
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>
    </>
  );
}
