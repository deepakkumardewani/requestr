"use client";

import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
} from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { SampleRequestCards } from "@/components/common/SampleRequestCards";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  COMPACT_GROUP_LIMIT,
  groupHistoryByDay,
  type HistoryRow,
  limitGroups,
  toVisibleRows,
} from "./groupHistory";
import { HistoryActionsMenu } from "./HistoryActionsMenu";
import { HistoryDayHeader } from "./HistoryDayHeader";
import { HistoryGroupRow, HistoryRunItem } from "./HistoryGroupRow";
import { HistoryItem } from "./HistoryItem";

const ESTIMATED_ROW_HEIGHT = 44;
const OVERSCAN_ROWS = 8;
/** Keeps a compact list from growing past the panel it is embedded in. */
const COMPACT_MAX_HEIGHT_CLASS = "max-h-80";

type HistoryListProps = {
  compact?: boolean;
  /** When provided, overrides the internal filter input (e.g. main sidebar search bar). */
  filter?: string;
};

export function HistoryList({ compact = false, filter }: HistoryListProps) {
  const entries = useHistoryStore((s) => s.entries);
  const { historyFilter } = useUIStore();

  // External filter takes priority over the internal UIStore filter
  const activeFilter = filter ?? historyFilter ?? "";

  // Expansion is ephemeral UI state; the sidebar does not remount between tab
  // switches, so a Zustand store is not needed (see PLAN.md, History UX decisions).
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(groupId)) next.add(groupId);
      return next;
    });
  }, []);

  const rows = useMemo(() => {
    const grouped = groupHistoryByDay(entries, {
      now: Date.now(),
      filter: activeFilter,
    });
    return compact ? limitGroups(grouped, COMPACT_GROUP_LIMIT) : grouped;
  }, [entries, activeFilter, compact]);
  const visibleRows = useMemo(
    () => toVisibleRows(rows, expandedIds),
    [rows, expandedIds],
  );

  return (
    <div
      data-testid="history-list"
      className={`flex flex-col ${compact ? "" : "h-full"}`}
    >
      {/* Actions stay reachable with an empty history so Export can still produce a file */}
      {!compact && (
        <div className="flex items-center justify-end border-b px-2 py-1">
          <HistoryActionsMenu />
        </div>
      )}
      {visibleRows.length === 0 ? (
        activeFilter ? (
          <EmptyState
            title="No matches"
            description="Try a different search"
            className="py-4"
          />
        ) : (
          <div className="flex flex-col gap-4 px-3 py-6">
            <EmptyState
              title="No requests sent yet"
              description="Your history appears here as you work"
              className="py-0"
            />
            <SampleRequestCards />
          </div>
        )
      ) : (
        <VirtualRows
          rows={visibleRows}
          expandedIds={expandedIds}
          onToggle={toggleGroup}
          compact={compact}
        />
      )}
    </div>
  );
}

type VirtualRowsProps = {
  rows: HistoryRow[];
  expandedIds: ReadonlySet<string>;
  onToggle: (groupId: string) => void;
  compact: boolean;
};

function renderRow(
  row: HistoryRow,
  expandedIds: ReadonlySet<string>,
  onToggle: (groupId: string) => void,
) {
  if (row.kind === "header") return <HistoryDayHeader label={row.label} />;
  if (row.kind === "group") {
    return (
      <HistoryGroupRow
        group={row}
        expanded={expandedIds.has(row.id)}
        onToggle={onToggle}
      />
    );
  }
  return row.groupId === null ? (
    <HistoryItem entry={row.entry} />
  ) : (
    <HistoryRunItem entry={row.entry} />
  );
}

/** Windowed rows; the day header of the visible range stays pinned at the top. */
function VirtualRows({
  rows,
  expandedIds,
  onToggle,
  compact,
}: VirtualRowsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeStickyIndexRef = useRef(-1);

  const headerIndexes = useMemo(
    () => rows.flatMap((row, index) => (row.kind === "header" ? [index] : [])),
    [rows],
  );

  const rangeExtractor = useCallback(
    (range: Range) => {
      const sticky = headerIndexes.findLast((i) => i <= range.startIndex);
      activeStickyIndexRef.current = sticky ?? -1;
      const indexes = new Set(defaultRangeExtractor(range));
      if (sticky !== undefined) indexes.add(sticky);
      return [...indexes].sort((a, b) => a - b);
    },
    [headerIndexes],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    getItemKey: (index) => rows[index].id,
    rangeExtractor,
  });

  return (
    <div
      ref={scrollRef}
      data-testid="history-scroll"
      className={`min-h-0 overflow-y-auto overflow-x-hidden px-1 py-1 ${
        compact ? COMPACT_MAX_HEIGHT_CLASS : "flex-1"
      }`}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const isSticky = item.index === activeStickyIndexRef.current;
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="left-0 top-0 w-full"
              style={
                isSticky
                  ? { position: "sticky", zIndex: 10 }
                  : {
                      position: "absolute",
                      transform: `translateY(${item.start}px)`,
                    }
              }
            >
              {renderRow(rows[item.index], expandedIds, onToggle)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
