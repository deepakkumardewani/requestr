"use client";

import { EmptyState } from "@/components/common/EmptyState";
import { SampleRequestCards } from "@/components/common/SampleRequestCards";
import { ScrollArea } from "@/components/ui/scroll-area";
import { healthKey } from "@/lib/healthMonitor";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import { HistoryActionsMenu } from "./HistoryActionsMenu";
import { HistoryItem } from "./HistoryItem";

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

  const filtered = activeFilter
    ? entries.filter((e) => {
        const term = activeFilter.toLowerCase();
        // Support both free-text search and normalised health key matching
        return (
          e.url.toLowerCase().includes(term) ||
          e.method.toLowerCase().includes(term) ||
          healthKey(e.method, e.url).toLowerCase().includes(term)
        );
      })
    : entries;

  const displayed = compact ? filtered.slice(0, 20) : filtered;

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
      {displayed.length === 0 ? (
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
        <ScrollArea className="h-full">
          <div className="space-y-0.5 px-1 py-1">
            {displayed.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
