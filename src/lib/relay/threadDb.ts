import type { UIMessage } from "ai";
import type { IDBPDatabase } from "idb";
import { getDB, type RequestlyDB } from "@/lib/idb";
import {
  RELAY_MAX_THREADS,
  RELAY_PARTIAL_SAVE_MS,
  RELAY_SAVE_FAILURE_LIMIT,
  RELAY_SAVE_RETRY_MS,
  RELAY_THREAD_SAVE_DEBOUNCE_MS,
  RELAY_THREAD_TITLE_MAX_CHARS,
} from "./constants";

/** One conversation. Its change-log rows link back through `relay_changes.threadId`. */
export type RelayThread = {
  id: string;
  /** Empty until the first ask names it; the UI shows a localized placeholder. */
  title: string;
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
  /** Assistant message cut short by an error or lost connection (FR-71). */
  interruptedMessageId: string | null;
  /**
   * Calls the user approved that had started when the thread was last saved.
   * Absent on threads written before this field existed. A call still listed
   * at restore may or may not have applied (HH-M22).
   */
  runningToolCalls?: string[];
};

export type RelayChangeStatus = "applied" | "undone" | "blocked";

export type RelayChangeRecord = {
  id: string;
  threadId: string;
  turnId: string;
  toolCallId: string;
  entity: string;
  entityId: string;
  before: unknown;
  afterHash: string;
  status: RelayChangeStatus;
};

/** Everything removed with a thread, kept so a delete can be undone. */
export type ThreadSnapshot = {
  thread: RelayThread;
  changes: RelayChangeRecord[];
};

export type CreateThreadResult = {
  thread: RelayThread;
  /** True when creating this thread pruned the oldest one (FR-14). */
  pruned: boolean;
};

export type CreateThreadInput = {
  workspaceId: string;
  id?: string;
  title?: string;
};

/** What a finished turn changes on an existing thread. */
export type ThreadPatch = {
  messages: UIMessage[];
  interruptedMessageId: string | null;
};

/** Storage primitives; the public API below is written once on top of them. */
type ThreadBackend = {
  getThread: (id: string) => Promise<RelayThread | undefined>;
  putThread: (thread: RelayThread) => Promise<void>;
  /** Read-modify-write in one transaction so a concurrent delete cannot be undone by it. */
  updateThread: (
    id: string,
    mutate: (thread: RelayThread) => RelayThread,
  ) => Promise<RelayThread | null>;
  /** Newest first. */
  listThreads: (workspaceId: string) => Promise<RelayThread[]>;
  removeThread: (id: string) => Promise<ThreadSnapshot | null>;
  insertSnapshot: (snapshot: ThreadSnapshot) => Promise<void>;
};

function idbBackend(db: IDBPDatabase<RequestlyDB>): ThreadBackend {
  return {
    getThread: (id) => db.get("relay_threads", id),

    async putThread(thread) {
      await db.put("relay_threads", thread);
    },

    async updateThread(id, mutate) {
      const tx = db.transaction("relay_threads", "readwrite");
      const current = await tx.store.get(id);
      if (!current) {
        await tx.done;
        return null;
      }
      const next = mutate(current);
      await tx.store.put(next);
      await tx.done;
      return next;
    },

    async listThreads(workspaceId) {
      const range = IDBKeyRange.bound(
        [workspaceId, 0],
        [workspaceId, Infinity],
      );
      const rows = await db.getAllFromIndex(
        "relay_threads",
        "by-workspace",
        range,
      );
      return rows.reverse();
    },

    async removeThread(id) {
      const tx = db.transaction(
        ["relay_threads", "relay_changes"],
        "readwrite",
      );
      const threads = tx.objectStore("relay_threads");
      const changeRows = tx.objectStore("relay_changes");
      const thread = await threads.get(id);
      if (!thread) {
        await tx.done;
        return null;
      }
      const changes = await changeRows.index("by-thread").getAll(id);
      await Promise.all([
        threads.delete(id),
        ...changes.map((change) => changeRows.delete(change.id)),
      ]);
      await tx.done;
      return { thread, changes };
    },

    async insertSnapshot({ thread, changes }) {
      const tx = db.transaction(
        ["relay_threads", "relay_changes"],
        "readwrite",
      );
      await Promise.all([
        tx.objectStore("relay_threads").put(thread),
        ...changes.map((change) => tx.objectStore("relay_changes").put(change)),
      ]);
      await tx.done;
    },
  };
}

function memoryBackend(): ThreadBackend {
  const threads = new Map<string, RelayThread>();
  const changes = new Map<string, RelayChangeRecord[]>();

  return {
    getThread: async (id) => threads.get(id),

    async putThread(thread) {
      threads.set(thread.id, thread);
    },

    async updateThread(id, mutate) {
      const current = threads.get(id);
      if (!current) return null;
      const next = mutate(current);
      threads.set(id, next);
      return next;
    },

    async listThreads(workspaceId) {
      return [...threads.values()]
        .filter((thread) => thread.workspaceId === workspaceId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async removeThread(id) {
      const thread = threads.get(id);
      if (!thread) return null;
      const removedChanges = changes.get(id) ?? [];
      threads.delete(id);
      changes.delete(id);
      return { thread, changes: removedChanges };
    },

    async insertSnapshot({ thread, changes: rows }) {
      threads.set(thread.id, thread);
      changes.set(thread.id, rows);
    },
  };
}

const fallback = memoryBackend();
/** Sticky: once storage failed, stay in memory so a session never splits across two stores. */
let useFallback = false;

async function backend(): Promise<ThreadBackend> {
  if (useFallback) return fallback;
  try {
    const opening = getDB();
    if (opening) return idbBackend(await opening);
  } catch (error) {
    console.warn(
      "[relay] thread storage unavailable, keeping threads in memory",
      {
        error,
      },
    );
  }
  useFallback = true;
  return fallback;
}

const listeners = new Set<() => void>();

/**
 * The `updatedAt` this tab last read or wrote per thread. A stored value newer
 * than this means another tab saved in between, and this tab's older copy must
 * not overwrite it (HH-L16).
 */
const knownUpdatedAt = new Map<string, number>();

/** Notifies after any thread write so open lists and the header title refresh. */
export function subscribeThreadChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

export function newThreadId(): string {
  return crypto.randomUUID();
}

/** Names a thread after its first ask: whitespace collapsed, capped in length. */
export function deriveThreadTitle(messages: UIMessage[]): string {
  const firstAsk = messages.find((message) => message.role === "user");
  const text = (firstAsk?.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, RELAY_THREAD_TITLE_MAX_CHARS);
}

/** Keeps the newest threads and removes the rest, never the one just written. */
async function pruneOldest(
  b: ThreadBackend,
  keep: RelayThread,
): Promise<boolean> {
  const others = (await b.listThreads(keep.workspaceId)).filter(
    (thread) => thread.id !== keep.id,
  );
  const excess = others.slice(RELAY_MAX_THREADS - 1);
  await Promise.all(excess.map((thread) => b.removeThread(thread.id)));
  return excess.length > 0;
}

export async function createThread(
  input: CreateThreadInput,
): Promise<CreateThreadResult> {
  const now = Date.now();
  const thread: RelayThread = {
    id: input.id ?? newThreadId(),
    title: input.title ?? "",
    workspaceId: input.workspaceId,
    createdAt: now,
    updatedAt: now,
    messages: [],
    interruptedMessageId: null,
  };
  const b = await backend();
  await b.putThread(thread);
  knownUpdatedAt.set(thread.id, thread.updatedAt);
  const pruned = await pruneOldest(b, thread);
  emitChange();
  return { thread, pruned };
}

export async function getThread(id: string): Promise<RelayThread | null> {
  const thread = (await (await backend()).getThread(id)) ?? null;
  if (thread) knownUpdatedAt.set(id, thread.updatedAt);
  return thread;
}

/** Threads of one workspace, newest first; other workspaces are never visible (FR-10). */
export async function listThreads(workspaceId: string): Promise<RelayThread[]> {
  return (await backend()).listThreads(workspaceId);
}

export async function searchThreads(
  workspaceId: string,
  query: string,
): Promise<RelayThread[]> {
  const needle = query.trim().toLowerCase();
  const threads = await listThreads(workspaceId);
  if (!needle) return threads;
  return threads.filter((thread) =>
    thread.title.toLowerCase().includes(needle),
  );
}

export async function getLastActive(
  workspaceId: string,
): Promise<RelayThread | null> {
  return (await listThreads(workspaceId))[0] ?? null;
}

/** Returns null for an unknown id or a title that is blank after trimming. */
export async function renameThread(
  id: string,
  title: string,
): Promise<RelayThread | null> {
  const next = title.trim().slice(0, RELAY_THREAD_TITLE_MAX_CHARS);
  if (!next) return null;
  const updated = await (await backend()).updateThread(id, (thread) => ({
    ...thread,
    title: next,
  }));
  if (updated) emitChange();
  return updated;
}

type PendingSave = {
  patch: ThreadPatch;
  timer: ReturnType<typeof setTimeout>;
};

const pendingSaves = new Map<string, PendingSave>();
const saveFailures = new Map<string, number>();

type SaveStateListener = (threadId: string, notSaved: boolean) => void;
const saveStateListeners = new Set<SaveStateListener>();

/** Tells the UI when a thread has failed to save repeatedly, and when it recovers. */
export function subscribeSaveState(listener: SaveStateListener): () => void {
  saveStateListeners.add(listener);
  return () => {
    saveStateListeners.delete(listener);
  };
}

function reportSaveState(threadId: string, notSaved: boolean): void {
  for (const listener of saveStateListeners) listener(threadId, notSaved);
}

/** Keeps a failed save queued so the next flush retries it; a newer patch wins. */
function requeueFailedSave(id: string, entry: PendingSave): void {
  const failures = (saveFailures.get(id) ?? 0) + 1;
  saveFailures.set(id, failures);
  if (failures === RELAY_SAVE_FAILURE_LIMIT) reportSaveState(id, true);
  if (pendingSaves.has(id)) return;
  pendingSaves.set(id, {
    ...entry,
    timer: setTimeout(() => void flushSave(id), RELAY_SAVE_RETRY_MS),
  });
}

function recordSaved(id: string): void {
  const hadFailed = (saveFailures.get(id) ?? 0) >= RELAY_SAVE_FAILURE_LIMIT;
  saveFailures.delete(id);
  if (hadFailed) reportSaveState(id, false);
}

async function flushSave(id: string): Promise<void> {
  const entry = pendingSaves.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingSaves.delete(id);
  let stale = false;
  try {
    const updated = await (await backend()).updateThread(id, (thread) => {
      const known = knownUpdatedAt.get(id);
      if (known !== undefined && thread.updatedAt > known) {
        stale = true;
        return thread;
      }
      return {
        ...thread,
        ...entry.patch,
        title: thread.title || deriveThreadTitle(entry.patch.messages),
        updatedAt: Math.max(Date.now(), thread.updatedAt + 1),
      };
    });
    if (stale) {
      console.warn("[relay] another tab saved this thread; not overwriting", {
        threadId: id,
      });
      // Retrying cannot help: the copy on disk is newer than this tab's.
      reportSaveState(id, true);
      return;
    }
    if (updated) {
      knownUpdatedAt.set(id, updated.updatedAt);
      recordSaved(id);
      emitChange();
    }
  } catch (error) {
    console.warn("[relay] saving thread failed", { threadId: id, error });
    requeueFailedSave(id, entry);
  }
}

/** Writes every queued save now (used before the page unloads and before reads that need them). */
export async function flushThreadWrites(): Promise<void> {
  await Promise.all([...pendingSaves.keys()].map(flushSave));
}

let unloadFlushRegistered = false;

function flushOnPageHide(): void {
  if (unloadFlushRegistered || typeof window === "undefined") return;
  unloadFlushRegistered = true;
  window.addEventListener("pagehide", () => void flushThreadWrites());
}

type ScheduleOptions = {
  /** Save at most once per `RELAY_PARTIAL_SAVE_MS` while a reply streams. */
  throttle?: boolean;
};

/**
 * Queues a write onto an existing thread. A thread deleted in the meantime is
 * not resurrected. The first ask names an untitled thread; an existing title
 * (including a user rename) is kept. A finished turn is debounced; a reply
 * still streaming is throttled so a long answer is never lost whole (HH-M21).
 */
export function scheduleThreadSave(
  id: string,
  patch: ThreadPatch,
  { throttle = false }: ScheduleOptions = {},
): void {
  flushOnPageHide();
  const queued = pendingSaves.get(id);
  if (queued && throttle) {
    queued.patch = patch;
    return;
  }
  if (queued) clearTimeout(queued.timer);
  pendingSaves.set(id, {
    patch,
    timer: setTimeout(
      () => void flushSave(id),
      throttle ? RELAY_PARTIAL_SAVE_MS : RELAY_THREAD_SAVE_DEBOUNCE_MS,
    ),
  });
}

/** Patches one stored thread after flushing its queued save; false when it no longer exists. */
async function patchStoredThread(
  id: string,
  mutate: (thread: RelayThread) => RelayThread,
): Promise<boolean> {
  await flushSave(id);
  try {
    const updated = await (await backend()).updateThread(id, mutate);
    return updated !== null;
  } catch (error) {
    console.warn("[relay] updating a stored thread failed", {
      threadId: id,
      error,
    });
    return false;
  }
}

/** Records, before a tool starts, that it may apply even if the tab closes mid-call (HH-M22). */
export async function markToolRunning(
  threadId: string,
  toolCallId: string,
): Promise<void> {
  await patchStoredThread(threadId, (thread) => ({
    ...thread,
    runningToolCalls: [
      ...new Set([...(thread.runningToolCalls ?? []), toolCallId]),
    ],
  }));
}

export async function clearToolRunning(
  threadId: string,
  toolCallId: string,
): Promise<void> {
  await patchStoredThread(threadId, (thread) =>
    thread.runningToolCalls?.includes(toolCallId)
      ? {
          ...thread,
          runningToolCalls: thread.runningToolCalls.filter(
            (id) => id !== toolCallId,
          ),
        }
      : thread,
  );
}

/**
 * Writes a tool's result into a thread that is not on screen any more (the
 * user switched away mid-run), so the model finds it when the thread reopens.
 * Returns false when the thread was deleted: the output has nowhere to go.
 */
export async function settleStoredToolOutput(
  threadId: string,
  toolCallId: string,
  output: unknown,
): Promise<boolean> {
  return patchStoredThread(threadId, (thread) => ({
    ...thread,
    messages: thread.messages.map((message) => ({
      ...message,
      parts: message.parts.map((part) =>
        "toolCallId" in part && part.toolCallId === toolCallId
          ? ({ ...part, state: "output-available", output } as typeof part)
          : part,
      ),
    })),
  }));
}

/** Removes the thread with its change rows; the snapshot lets the caller undo. */
export async function deleteThread(id: string): Promise<ThreadSnapshot | null> {
  const queued = pendingSaves.get(id);
  if (queued) clearTimeout(queued.timer);
  pendingSaves.delete(id);
  saveFailures.delete(id);
  knownUpdatedAt.delete(id);
  const snapshot = await (await backend()).removeThread(id);
  if (snapshot) emitChange();
  return snapshot;
}

/** Puts a deleted thread back (undo); counts toward the retention cap like any new thread. */
export async function restoreThread(
  snapshot: ThreadSnapshot,
): Promise<CreateThreadResult> {
  const b = await backend();
  await b.insertSnapshot(snapshot);
  const pruned = await pruneOldest(b, snapshot.thread);
  emitChange();
  return { thread: snapshot.thread, pruned };
}

/** Wipes a workspace's threads and their change rows; returns how many threads went. */
export async function clearAll(workspaceId: string): Promise<number> {
  const b = await backend();
  const threads = await b.listThreads(workspaceId);
  for (const thread of threads) {
    const queued = pendingSaves.get(thread.id);
    if (queued) clearTimeout(queued.timer);
    pendingSaves.delete(thread.id);
  }
  await Promise.all(threads.map((thread) => b.removeThread(thread.id)));
  if (threads.length > 0) emitChange();
  return threads.length;
}
