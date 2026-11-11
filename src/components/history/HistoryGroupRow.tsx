"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { MethodBadge } from "@/components/common/MethodBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn, getRelativeTime } from "@/lib/utils";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { HistoryEntry } from "@/types";
import type { HistoryGroupSummaryRow } from "./groupHistory";
import { useRestoreHistoryEntry } from "./HistoryItem";

const DELETE_BUTTON_CLASSES =
  "mr-1 shrink-0 rounded-sm p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 transition-[color,background-color,opacity] duration-200";

type HistoryGroupRowProps = {
  group: HistoryGroupSummaryRow;
  expanded: boolean;
  onToggle: (groupId: string) => void;
};

/** Collapsed summary of repeated runs; clicking the row opens the latest run. */
export function HistoryGroupRow({
  group,
  expanded,
  onToggle,
}: HistoryGroupRowProps) {
  const { latest, count, method, url, id } = group;
  const restoreLatest = useRestoreHistoryEntry(latest);
  const runsLabel = `${count} runs`;

  return (
    <div
      className="group flex items-center rounded transition-colors hover:bg-muted"
      data-testid="history-group"
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Hide" : "Show"} ${runsLabel}`}
        data-testid="history-group-toggle"
        className="ml-1 flex shrink-0 items-center gap-0.5 rounded-sm p-1 text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-90",
          )}
        />
        <span
          className="font-mono text-[10px]"
          data-testid="history-group-count"
        >
          x {count}
        </span>
      </button>
      <button
        type="button"
        onClick={restoreLatest}
        data-testid="history-group-open"
        aria-label={`Open latest ${method} ${url}`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left"
      >
        <MethodBadge method={method} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs" data-testid="history-group-url">
            {url}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {getRelativeTime(latest.timestamp)}
          </p>
        </div>
        <StatusBadge status={latest.status} className="shrink-0 text-[10px]" />
      </button>
    </div>
  );
}

type HistoryRunItemProps = {
  entry: HistoryEntry;
};

/** One run inside an expanded group: restores its own request, deletes itself. */
export function HistoryRunItem({ entry }: HistoryRunItemProps) {
  const deleteEntry = useHistoryStore((s) => s.deleteEntry);
  const restore = useRestoreHistoryEntry(entry);

  return (
    <div className="group ml-6 flex items-center rounded transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={restore}
        data-testid="history-run"
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {getRelativeTime(entry.timestamp)}
        </span>
        <StatusBadge status={entry.status} className="shrink-0 text-[10px]" />
      </button>
      <button
        type="button"
        onClick={() => deleteEntry(entry.id)}
        data-testid="history-run-delete"
        className={DELETE_BUTTON_CLASSES}
        title="Delete this run"
        aria-label="Delete this run"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
