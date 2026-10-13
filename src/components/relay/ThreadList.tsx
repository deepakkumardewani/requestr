"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { PencilIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RELAY_THREAD_TITLE_MAX_CHARS,
  RELAY_TOUCH_TARGET_STYLE,
  RELAY_UNDO_TOAST_MS,
  RELAY_VIRTUALIZE_THRESHOLD,
  RELAY_WORKSPACE_ID,
} from "@/lib/relay/constants";
import {
  deleteThread,
  type RelayThread,
  renameThread,
  restoreThread,
  searchThreads,
  subscribeThreadChanges,
} from "@/lib/relay/threadDb";
import { useRelayStore } from "@/stores/useRelayStore";

type ThreadGroupKey = "groupToday" | "groupYesterday" | "groupEarlier";

type ThreadGroup = { key: ThreadGroupKey; threads: RelayThread[] };

const SKELETON_ROWS = 3;
const GROUP_ORDER: ThreadGroupKey[] = [
  "groupToday",
  "groupYesterday",
  "groupEarlier",
];
const MS_PER_DAY = 86_400_000;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Buckets newest-first threads by local calendar day; empty buckets are dropped. */
export function groupThreads(
  threads: RelayThread[],
  now: number = Date.now(),
): ThreadGroup[] {
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(todayStart - MS_PER_DAY / 2);
  const buckets: Record<ThreadGroupKey, RelayThread[]> = {
    groupToday: [],
    groupYesterday: [],
    groupEarlier: [],
  };
  for (const thread of threads) {
    if (thread.updatedAt >= todayStart) buckets.groupToday.push(thread);
    else if (thread.updatedAt >= yesterdayStart)
      buckets.groupYesterday.push(thread);
    else buckets.groupEarlier.push(thread);
  }
  return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    threads: buckets[key],
  }));
}

type ThreadRowProps = {
  thread: RelayThread;
  title: string;
  active: boolean;
  touchTargets: boolean;
  onSelect: (thread: RelayThread) => void;
  onDelete: (thread: RelayThread) => void;
};

function ThreadRow({
  thread,
  title,
  active,
  touchTargets,
  onSelect,
  onDelete,
}: ThreadRowProps) {
  const t = useTranslations("relay");
  const [editing, setEditing] = useState(false);
  // Enter and the blur it triggers must commit once, not twice.
  const settledRef = useRef(false);
  const touchStyle = touchTargets ? RELAY_TOUCH_TARGET_STYLE : undefined;

  const finishRename = (value: string | null) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setEditing(false);
    if (value === null) return;
    renameThread(thread.id, value).catch((error: unknown) => {
      console.error("[relay] renaming the thread failed", {
        threadId: thread.id,
        error,
      });
    });
  };

  if (editing) {
    return (
      <li className="px-2 py-1" data-testid="relay-thread-item">
        <Input
          autoFocus
          aria-label={t("threads.renameLabel")}
          data-testid="relay-thread-rename-input"
          defaultValue={thread.title}
          maxLength={RELAY_THREAD_TITLE_MAX_CHARS}
          onKeyDown={(event) => {
            if (event.key === "Enter") finishRename(event.currentTarget.value);
            if (event.key === "Escape") {
              // Keep Escape from also closing the whole thread list.
              event.stopPropagation();
              finishRename(null);
            }
          }}
          onBlur={(event) => finishRename(event.currentTarget.value)}
        />
      </li>
    );
  }

  return (
    <li
      className="group/thread flex items-center gap-1 rounded-md pr-1 hover:bg-muted focus-within:bg-muted data-[active=true]:bg-muted"
      data-active={active}
      data-testid="relay-thread-item"
      data-thread-id={thread.id}
    >
      <button
        type="button"
        className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={touchStyle}
        aria-current={active ? "true" : undefined}
        data-testid="relay-thread-select"
        onClick={() => onSelect(thread)}
      >
        {title}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("threads.rename", { title })}
        data-testid="relay-thread-rename"
        style={touchStyle}
        onClick={() => {
          settledRef.current = false;
          setEditing(true);
        }}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("threads.delete", { title })}
        data-testid="relay-thread-delete"
        style={touchStyle}
        onClick={() => onDelete(thread)}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}

type ListRow =
  | { kind: "header"; key: ThreadGroupKey }
  | { kind: "thread"; thread: RelayThread };

const ESTIMATED_HEADER_PX = 24;
const ESTIMATED_THREAD_PX = 36;
const VIRTUAL_OVERSCAN = 8;

function flattenGroups(groups: ThreadGroup[]): ListRow[] {
  return groups.flatMap((group) => [
    { kind: "header" as const, key: group.key },
    ...group.threads.map((thread) => ({ kind: "thread" as const, thread })),
  ]);
}

type VirtualThreadRowsProps = {
  rows: ListRow[];
  scrollRef: RefObject<HTMLDivElement | null>;
  renderHeader: (key: ThreadGroupKey) => ReactNode;
  renderThread: (thread: RelayThread) => ReactNode;
};

/** Windowed rows for a long history; group headers become rows of their own. */
function VirtualThreadRows({
  rows,
  scrollRef,
  renderHeader,
  renderThread,
}: VirtualThreadRowsProps) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      rows[index].kind === "header" ? ESTIMATED_HEADER_PX : ESTIMATED_THREAD_PX,
    getItemKey: (index) => {
      const row = rows[index];
      return row.kind === "header" ? row.key : row.thread.id;
    },
    overscan: VIRTUAL_OVERSCAN,
  });
  return (
    <div
      className="relative w-full"
      data-testid="relay-threads-virtual"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index];
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {row.kind === "header" ? (
              renderHeader(row.key)
            ) : (
              <ul>{renderThread(row.thread)}</ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

type ThreadListProps = {
  /** Called after a thread is chosen so the host can close the list. */
  onSelected: () => void;
  touchTargets?: boolean;
};

export function ThreadList({
  onSelected,
  touchTargets = false,
}: ThreadListProps) {
  const t = useTranslations("relay");
  const activeThreadId = useRelayStore((state) => state.activeThreadId);
  const [query, setQuery] = useState("");
  // null until the first read settles, so the skeleton shows only while loading.
  const [threads, setThreads] = useState<RelayThread[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RelayThread | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      searchThreads(RELAY_WORKSPACE_ID, query)
        .then((found) => {
          if (!cancelled) setThreads(found);
        })
        .catch((error: unknown) => {
          console.error("[relay] listing threads failed", { error });
          if (!cancelled) setThreads([]);
        });
    };
    load();
    const unsubscribe = subscribeThreadChanges(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [query]);

  const untitled = t("threads.untitled");
  const titleOf = useCallback(
    (thread: RelayThread) => thread.title || untitled,
    [untitled],
  );

  const handleSelect = (thread: RelayThread) => {
    useRelayStore.getState().setActiveThreadId(thread.id);
    onSelected();
  };

  const undoDelete = async (
    snapshot: NonNullable<Awaited<ReturnType<typeof deleteThread>>>,
    wasActive: boolean,
  ) => {
    await restoreThread(snapshot);
    if (wasActive)
      useRelayStore.getState().setActiveThreadId(snapshot.thread.id);
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const wasActive = useRelayStore.getState().activeThreadId === target.id;
    try {
      const snapshot = await deleteThread(target.id);
      if (!snapshot) return;
      if (wasActive) useRelayStore.getState().setActiveThreadId(null);
      toast(t("threads.deletedToast"), {
        duration: RELAY_UNDO_TOAST_MS,
        action: {
          label: t("threads.undo"),
          onClick: () => {
            undoDelete(snapshot, wasActive).catch((error: unknown) => {
              console.error("[relay] undoing the delete failed", {
                threadId: target.id,
                error,
              });
            });
          },
        },
      });
    } catch (error) {
      console.error("[relay] deleting the thread failed", {
        threadId: target.id,
        error,
      });
    }
  };

  const groups = threads ? groupThreads(threads) : [];
  const virtualize = (threads?.length ?? 0) > RELAY_VIRTUALIZE_THRESHOLD;

  const renderHeader = (key: ThreadGroupKey) => (
    <h3 className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">
      {t(`threads.${key}`)}
    </h3>
  );
  const renderThread = (thread: RelayThread) => (
    <ThreadRow
      key={thread.id}
      thread={thread}
      title={titleOf(thread)}
      active={thread.id === activeThreadId}
      touchTargets={touchTargets}
      onSelect={handleSelect}
      onDelete={setPendingDelete}
    />
  );

  return (
    <div
      className="flex max-h-80 flex-col gap-2 p-2"
      data-testid="relay-threads"
    >
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          className="pl-7"
          aria-label={t("threads.searchLabel")}
          placeholder={t("threads.searchPlaceholder")}
          data-testid="relay-thread-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {threads === null ? (
          <div
            className="flex flex-col gap-1"
            role="status"
            aria-label={t("threads.loading")}
            data-testid="relay-threads-loading"
          >
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                key={index}
                className="h-8 w-full"
              />
            ))}
          </div>
        ) : null}

        {threads !== null && threads.length === 0 ? (
          <p
            className="px-2 py-3 text-sm text-muted-foreground"
            data-testid="relay-threads-empty"
          >
            {query.trim() ? t("threads.noResults") : t("threads.empty")}
          </p>
        ) : null}

        {virtualize ? (
          <VirtualThreadRows
            rows={flattenGroups(groups)}
            scrollRef={scrollRef}
            renderHeader={renderHeader}
            renderThread={renderThread}
          />
        ) : (
          groups.map((group) => (
            <section key={group.key} data-testid="relay-thread-group">
              {renderHeader(group.key)}
              <ul className="flex flex-col">
                {group.threads.map(renderThread)}
              </ul>
            </section>
          ))
        )}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent data-testid="relay-thread-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("threads.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("threads.deleteDescription", {
                title: pendingDelete ? titleOf(pendingDelete) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("threads.deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="relay-thread-delete-confirm"
              onClick={confirmDelete}
            >
              {t("threads.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
