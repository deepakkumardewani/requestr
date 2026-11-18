"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { MethodBadge } from "@/components/common/MethodBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn, formatDuration, getRelativeTime } from "@/lib/utils";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { HistoryEntry } from "@/types";
import type { HistoryGroupSummaryRow } from "./groupHistory";
import { useRestoreHistoryEntry } from "./HistoryItem";
import { HistoryUrlText } from "./HistoryUrlText";

// Same box as HistoryItem's delete button so status badges align across row kinds.
const TRAILING_BUTTON_BASE =
  "mr-1 shrink-0 rounded-sm p-1.5 text-muted-foreground transition-[color,background-color,opacity] duration-200";
const TRAILING_BUTTON_CLASSES = `${TRAILING_BUTTON_BASE} hover:bg-foreground/10 hover:text-foreground`;
const DELETE_BUTTON_CLASSES = `${TRAILING_BUTTON_BASE} opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100`;

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
        onClick={restoreLatest}
        data-testid="history-group-open"
        aria-label={`Open latest ${method} ${url}`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left"
      >
        <MethodBadge method={method} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <HistoryUrlText url={url} data-testid="history-group-url" />
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">
              {getRelativeTime(latest.timestamp)}
            </span>
            <span
              className="shrink-0 rounded-sm bg-muted-foreground/15 px-1 font-mono text-[10px] leading-4 text-foreground/80"
              data-testid="history-group-count"
            >
              x {count}
            </span>
          </p>
        </div>
        <StatusBadge status={latest.status} className="shrink-0 text-[10px]" />
      </button>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Hide" : "Show"} ${runsLabel}`}
        data-testid="history-group-toggle"
        className={TRAILING_BUTTON_CLASSES}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>
    </div>
  );
}

const RUN_CLOCK_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

/** Runs in a group share a day, so the clock time is what tells them apart. */
function formatRunClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], RUN_CLOCK_FORMAT);
}

type HistoryRunItemProps = {
  entry: HistoryEntry;
};

/** One run inside an expanded group: restores its own request, deletes itself. */
export function HistoryRunItem({ entry }: HistoryRunItemProps) {
  const deleteEntry = useHistoryStore((s) => s.deleteEntry);
  const restore = useRestoreHistoryEntry(entry);

  return (
    <div className="group ml-5 flex items-center rounded-r border-l border-border transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={restore}
        data-testid="history-run"
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-3 pr-2 text-left"
      >
        <span
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
          data-testid="history-run-meta"
        >
          <span className="text-foreground/80">
            {formatRunClock(entry.timestamp)}
          </span>
          {` · ${formatDuration(entry.duration)}`}
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
