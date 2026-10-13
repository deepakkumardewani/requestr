/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import type { UIMessage } from "ai";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_MAX_THREADS,
  RELAY_THREAD_SAVE_DEBOUNCE_MS,
  RELAY_THREAD_TITLE_MAX_CHARS,
} from "./constants";
import type { RelayChangeRecord } from "./threadDb";

const WORKSPACE = "local";
const FOREIGN_WORKSPACE = "other-workspace";

type ThreadDb = typeof import("./threadDb");
type IdbModule = typeof import("@/lib/idb");

let clock = 0;

/** Fresh module graph over a fresh database, so cached connections never leak between tests. */
async function load(): Promise<{ db: ThreadDb; idb: IdbModule }> {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const db = await import("./threadDb");
  const idb = await import("@/lib/idb");
  return { db, idb };
}

function userMessage(text: string): UIMessage {
  return { id: `m-${text}`, role: "user", parts: [{ type: "text", text }] };
}

function change(id: string, threadId: string): RelayChangeRecord {
  return {
    id,
    threadId,
    turnId: "turn",
    toolCallId: "call",
    entity: "request",
    entityId: "r1",
    before: null,
    afterHash: "h",
    status: "applied",
  };
}

async function seedChanges(idb: IdbModule, rows: RelayChangeRecord[]) {
  const database = await idb.getDB();
  for (const row of rows) await database?.put("relay_changes", row);
}

async function changeIds(idb: IdbModule, threadId: string) {
  const database = await idb.getDB();
  const rows = await database?.getAllFromIndex(
    "relay_changes",
    "by-thread",
    threadId,
  );
  return rows?.map((row) => row.id).sort();
}

beforeEach(() => {
  clock = 1_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock++);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createThread / getThread", () => {
  it("creates an empty untitled thread in the workspace", async () => {
    const { db } = await load();

    const { thread, pruned } = await db.createThread({ workspaceId: WORKSPACE });

    expect(pruned).toBe(false);
    expect(thread).toMatchObject({
      title: "",
      workspaceId: WORKSPACE,
      messages: [],
      interruptedMessageId: null,
    });
    expect(thread.createdAt).toBe(thread.updatedAt);
    expect(await db.getThread(thread.id)).toEqual(thread);
  });

  it("honours a caller-supplied id and title", async () => {
    const { db } = await load();

    await db.createThread({ workspaceId: WORKSPACE, id: "fixed", title: "Hello" });

    expect(await db.getThread("fixed")).toMatchObject({ id: "fixed", title: "Hello" });
  });

  it("returns null for an unknown id", async () => {
    const { db } = await load();
    expect(await db.getThread("missing")).toBeNull();
  });
});

describe("listThreads / getLastActive (workspace isolation)", () => {
  it("lists only the requested workspace, newest first", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "old" });
    await db.createThread({ workspaceId: FOREIGN_WORKSPACE, id: "foreign" });
    await db.createThread({ workspaceId: WORKSPACE, id: "new" });

    const local = await db.listThreads(WORKSPACE);
    const foreign = await db.listThreads(FOREIGN_WORKSPACE);

    expect(local.map((t) => t.id)).toEqual(["new", "old"]);
    expect(foreign.map((t) => t.id)).toEqual(["foreign"]);
  });

  it("getLastActive returns the most recently updated thread of the workspace", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    await db.createThread({ workspaceId: WORKSPACE, id: "b" });
    await db.createThread({ workspaceId: FOREIGN_WORKSPACE, id: "z" });

    expect((await db.getLastActive(WORKSPACE))?.id).toBe("b");
  });

  it("getLastActive is null when the workspace has no threads", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: FOREIGN_WORKSPACE });

    expect(await db.getLastActive(WORKSPACE)).toBeNull();
  });
});

describe("searchThreads / renameThread", () => {
  it("searches titles case-insensitively and returns all for a blank query", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a", title: "Orders API" });
    await db.createThread({ workspaceId: WORKSPACE, id: "b", title: "Billing" });

    expect((await db.searchThreads(WORKSPACE, "  ORDERS ")).map((t) => t.id)).toEqual(["a"]);
    expect(await db.searchThreads(WORKSPACE, "nothing")).toEqual([]);
    expect(await db.searchThreads(WORKSPACE, "   ")).toHaveLength(2);
  });

  it("does not search other workspaces", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: FOREIGN_WORKSPACE, title: "Orders" });

    expect(await db.searchThreads(WORKSPACE, "orders")).toEqual([]);
  });

  it("renames with a trimmed, capped title and notifies subscribers", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a", title: "Old" });
    const listener = vi.fn();
    db.subscribeThreadChanges(listener);

    const renamed = await db.renameThread("a", `  ${"x".repeat(200)}  `);

    expect(renamed?.title).toBe("x".repeat(RELAY_THREAD_TITLE_MAX_CHARS));
    expect((await db.getThread("a"))?.title).toBe(renamed?.title);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("rejects a blank title and an unknown id without writing", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a", title: "Keep" });

    expect(await db.renameThread("a", "   ")).toBeNull();
    expect(await db.renameThread("missing", "Name")).toBeNull();
    expect((await db.getThread("a"))?.title).toBe("Keep");
  });

  it("stops notifying after unsubscribe", async () => {
    const { db } = await load();
    const listener = vi.fn();
    const unsubscribe = db.subscribeThreadChanges(listener);
    unsubscribe();

    await db.createThread({ workspaceId: WORKSPACE });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("deleteThread / restoreThread", () => {
  it("removes the thread together with its change rows", async () => {
    const { db, idb } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    await db.createThread({ workspaceId: WORKSPACE, id: "b" });
    await seedChanges(idb, [change("c1", "a"), change("c2", "a"), change("c3", "b")]);

    const snapshot = await db.deleteThread("a");

    expect(snapshot?.thread.id).toBe("a");
    expect(snapshot?.changes.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    expect(await db.getThread("a")).toBeNull();
    expect(await changeIds(idb, "a")).toEqual([]);
    expect(await changeIds(idb, "b")).toEqual(["c3"]);
  });

  it("returns null when deleting an unknown thread", async () => {
    const { db } = await load();
    expect(await db.deleteThread("missing")).toBeNull();
  });

  it("restores a deleted thread and its change rows (undo)", async () => {
    const { db, idb } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a", title: "Keep me" });
    await seedChanges(idb, [change("c1", "a")]);
    const snapshot = await db.deleteThread("a");

    const restored = await db.restoreThread(snapshot!);

    expect(restored.pruned).toBe(false);
    expect((await db.getThread("a"))?.title).toBe("Keep me");
    expect(await changeIds(idb, "a")).toEqual(["c1"]);
  });
});

describe("scheduleThreadSave", () => {
  const FIRST_ASK = "Create a request for orders";

  async function withTimers() {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    return load();
  }

  it("debounces: only the last patch within the quiet period is written", async () => {
    const { db } = await withTimers();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    db.scheduleThreadSave("a", { messages: [userMessage("first")], interruptedMessageId: null });
    db.scheduleThreadSave("a", { messages: [userMessage(FIRST_ASK)], interruptedMessageId: "x" });
    expect((await db.getThread("a"))?.messages).toEqual([]);

    await vi.advanceTimersByTimeAsync(RELAY_THREAD_SAVE_DEBOUNCE_MS);

    await vi.waitFor(async () => {
      const saved = await db.getThread("a");
      expect(saved?.messages).toEqual([userMessage(FIRST_ASK)]);
      expect(saved?.interruptedMessageId).toBe("x");
    });
  });

  it("names an untitled thread after the first ask and bumps updatedAt", async () => {
    const { db } = await withTimers();
    const { thread } = await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    db.scheduleThreadSave("a", { messages: [userMessage(FIRST_ASK)], interruptedMessageId: null });
    await db.flushThreadWrites();

    const saved = await db.getThread("a");
    expect(saved?.title).toBe(FIRST_ASK);
    expect(saved!.updatedAt).toBeGreaterThan(thread.updatedAt);
  });

  it("keeps a title the user already chose", async () => {
    const { db } = await withTimers();
    await db.createThread({ workspaceId: WORKSPACE, id: "a", title: "Mine" });

    db.scheduleThreadSave("a", { messages: [userMessage(FIRST_ASK)], interruptedMessageId: null });
    await db.flushThreadWrites();

    expect((await db.getThread("a"))?.title).toBe("Mine");
  });

  it("does not resurrect a thread deleted while a save was queued", async () => {
    const { db } = await withTimers();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    db.scheduleThreadSave("a", { messages: [userMessage("hi")], interruptedMessageId: null });

    await db.deleteThread("a");
    await vi.advanceTimersByTimeAsync(RELAY_THREAD_SAVE_DEBOUNCE_MS * 2);
    await db.flushThreadWrites();

    expect(await db.getThread("a")).toBeNull();
  });

  it("ignores a save for a thread that never existed", async () => {
    const { db } = await withTimers();

    db.scheduleThreadSave("ghost", { messages: [userMessage("hi")], interruptedMessageId: null });
    await db.flushThreadWrites();

    expect(await db.getThread("ghost")).toBeNull();
  });

  it("flushes queued saves when the page is hidden", async () => {
    const { db } = await withTimers();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    db.scheduleThreadSave("a", { messages: [userMessage("bye")], interruptedMessageId: null });

    window.dispatchEvent(new Event("pagehide"));

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toHaveLength(1),
    );
  });

  it("logs and survives a failing write instead of rejecting", async () => {
    const { db, idb } = await withTimers();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const database = await idb.getDB();
    vi.spyOn(database!, "transaction").mockImplementation(() => {
      throw new Error("quota");
    });

    db.scheduleThreadSave("a", { messages: [userMessage("hi")], interruptedMessageId: null });
    await db.flushThreadWrites();

    expect(warn).toHaveBeenCalledWith(
      "[relay] saving thread failed",
      expect.objectContaining({ threadId: "a" }),
    );
  });
});

describe("retention (FR-14)", () => {
  async function fillWorkspace(db: ThreadDb, count: number, workspaceId = WORKSPACE) {
    for (let i = 0; i < count; i++) {
      await db.createThread({ workspaceId, id: `${workspaceId}-${i}` });
    }
  }

  it("creating the 51st thread prunes exactly the oldest and its change rows", async () => {
    const { db, idb } = await load();
    await fillWorkspace(db, RELAY_MAX_THREADS);
    await seedChanges(idb, [change("old-1", `${WORKSPACE}-0`), change("keep-1", `${WORKSPACE}-1`)]);

    const { pruned } = await db.createThread({ workspaceId: WORKSPACE, id: "fifty-one" });

    const ids = (await db.listThreads(WORKSPACE)).map((t) => t.id);
    expect(pruned).toBe(true);
    expect(ids).toHaveLength(RELAY_MAX_THREADS);
    expect(ids).toContain("fifty-one");
    expect(ids).not.toContain(`${WORKSPACE}-0`);
    expect(ids).toContain(`${WORKSPACE}-1`);
    expect(await changeIds(idb, `${WORKSPACE}-0`)).toEqual([]);
    expect(await changeIds(idb, `${WORKSPACE}-1`)).toEqual(["keep-1"]);
  });

  it("does not prune at exactly the cap", async () => {
    const { db } = await load();

    await fillWorkspace(db, RELAY_MAX_THREADS - 1);
    const { pruned } = await db.createThread({ workspaceId: WORKSPACE });

    expect(pruned).toBe(false);
    expect(await db.listThreads(WORKSPACE)).toHaveLength(RELAY_MAX_THREADS);
  });

  it("does not count or prune another workspace's threads", async () => {
    const { db } = await load();
    await fillWorkspace(db, RELAY_MAX_THREADS - 1, FOREIGN_WORKSPACE);
    await fillWorkspace(db, RELAY_MAX_THREADS);

    await db.createThread({ workspaceId: WORKSPACE });

    expect(await db.listThreads(FOREIGN_WORKSPACE)).toHaveLength(RELAY_MAX_THREADS - 1);
  });

  it("deleting a thread still works at the cap", async () => {
    const { db } = await load();
    await fillWorkspace(db, RELAY_MAX_THREADS);

    await db.deleteThread(`${WORKSPACE}-10`);

    expect(await db.listThreads(WORKSPACE)).toHaveLength(RELAY_MAX_THREADS - 1);
  });

  it("an undo that would exceed the cap prunes the oldest, never the restored thread", async () => {
    const { db } = await load();
    await fillWorkspace(db, RELAY_MAX_THREADS);
    const snapshot = await db.deleteThread(`${WORKSPACE}-0`);
    await db.createThread({ workspaceId: WORKSPACE, id: "replacement" });

    const { pruned } = await db.restoreThread(snapshot!);

    const ids = (await db.listThreads(WORKSPACE)).map((t) => t.id);
    expect(pruned).toBe(true);
    expect(ids).toHaveLength(RELAY_MAX_THREADS);
    expect(ids).toContain(`${WORKSPACE}-0`);
  });

  it("clearAll empties both stores for the workspace only", async () => {
    const { db, idb } = await load();
    await fillWorkspace(db, 3);
    await db.createThread({ workspaceId: FOREIGN_WORKSPACE, id: "foreign" });
    await seedChanges(idb, [change("c1", `${WORKSPACE}-0`), change("c2", "foreign")]);

    const removed = await db.clearAll(WORKSPACE);

    expect(removed).toBe(3);
    expect(await db.listThreads(WORKSPACE)).toEqual([]);
    expect(await changeIds(idb, `${WORKSPACE}-0`)).toEqual([]);
    expect(await changeIds(idb, "foreign")).toEqual(["c2"]);
    expect((await db.getThread("foreign"))?.id).toBe("foreign");
  });

  it("clearAll on an empty workspace removes nothing and does not notify", async () => {
    const { db } = await load();
    const listener = vi.fn();
    db.subscribeThreadChanges(listener);

    expect(await db.clearAll(WORKSPACE)).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("deriveThreadTitle", () => {
  it("uses the first user message, collapsing whitespace and capping length", async () => {
    const { db } = await load();
    const long = "word ".repeat(40);

    expect(db.deriveThreadTitle([userMessage("  hello \n  there ")])).toBe("hello there");
    expect(db.deriveThreadTitle([userMessage(long)])).toHaveLength(RELAY_THREAD_TITLE_MAX_CHARS);
  });

  it("is empty when there is no user text", async () => {
    const { db } = await load();
    const assistant: UIMessage = { id: "a", role: "assistant", parts: [{ type: "text", text: "hi" }] };

    expect(db.deriveThreadTitle([])).toBe("");
    expect(db.deriveThreadTitle([assistant])).toBe("");
  });
});

describe("in-memory fallback when storage is unavailable", () => {
  it("keeps working, warns once, and stays in memory", async () => {
    vi.resetModules();
    vi.doMock("@/lib/idb", () => ({
      getDB: () => Promise.reject(new Error("blocked")),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = await import("./threadDb");

    await db.createThread({ workspaceId: WORKSPACE, id: "a", title: "Mem" });
    await db.createThread({ workspaceId: FOREIGN_WORKSPACE, id: "z" });
    db.scheduleThreadSave("a", { messages: [userMessage("hi")], interruptedMessageId: null });
    await db.flushThreadWrites();

    expect((await db.listThreads(WORKSPACE)).map((t) => t.id)).toEqual(["a"]);
    expect((await db.getThread("a"))?.messages).toHaveLength(1);
    expect((await db.deleteThread("a"))?.thread.id).toBe("a");
    expect(await db.getThread("a")).toBeNull();
    expect(await db.clearAll(WORKSPACE)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    vi.doUnmock("@/lib/idb");
  });

  it("falls back when there is no browser storage at all (getDB returns null)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/idb", () => ({ getDB: () => null }));
    const db = await import("./threadDb");

    const { thread } = await db.createThread({ workspaceId: WORKSPACE });

    expect((await db.getThread(thread.id))?.id).toBe(thread.id);
    vi.doUnmock("@/lib/idb");
  });
});
