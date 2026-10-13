import type { UIMessage } from "ai";
import type { IDBPDatabase } from "idb";
import { getDB, type RequestlyDB } from "@/lib/idb";
import {
  RELAY_MAX_THREADS,
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
  const pruned = await pruneOldest(b, thread);
  emitChange();
  return { thread, pruned };
}

export async function getThread(id: string): Promise<RelayThread | null> {
  return (await (await backend()).getThread(id)) ?? null;
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

const pendingSaves = new Map<
  string,
  { patch: ThreadPatch; timer: ReturnType<typeof setTimeout> }
>();

async function flushSave(id: string): Promise<void> {
  const entry = pendingSaves.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingSaves.delete(id);
  try {
    const updated = await (await backend()).updateThread(id, (thread) => ({
      ...thread,
      ...entry.patch,
      title: thread.title || deriveThreadTitle(entry.patch.messages),
      updatedAt: Date.now(),
    }));
    if (updated) emitChange();
  } catch (error) {
    console.warn("[relay] saving thread failed", { threadId: id, error });
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

/**
 * Queues a debounced write of a finished turn onto an existing thread. A
 * thread deleted in the meantime is not resurrected. The first ask names an
 * untitled thread; an existing title (including a user rename) is kept.
 */
export function scheduleThreadSave(id: string, patch: ThreadPatch): void {
  flushOnPageHide();
  const queued = pendingSaves.get(id);
  if (queued) clearTimeout(queued.timer);
  pendingSaves.set(id, {
    patch,
    timer: setTimeout(() => void flushSave(id), RELAY_THREAD_SAVE_DEBOUNCE_MS),
  });
}

/** Removes the thread with its change rows; the snapshot lets the caller undo. */
export async function deleteThread(id: string): Promise<ThreadSnapshot | null> {
  const queued = pendingSaves.get(id);
  if (queued) clearTimeout(queued.timer);
  pendingSaves.delete(id);
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
