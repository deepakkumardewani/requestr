/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import type { UIMessage } from "ai";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_PARTIAL_SAVE_MS,
  RELAY_SAVE_RETRY_MS,
  RELAY_THREAD_SAVE_DEBOUNCE_MS,
} from "./constants";
import type { RelayChangeRecord } from "./threadDb";

const WORKSPACE = "local";

type ThreadDb = typeof import("./threadDb");
type IdbModule = typeof import("@/lib/idb");

let clock = 0;

/** Fresh module graph over a fresh database, so module-level queues never leak between tests. */
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

function toolMessage(toolCallId: string, state: string): UIMessage {
  return {
    id: `a-${toolCallId}`,
    role: "assistant",
    parts: [
      { type: "text", text: "working" },
      { type: "tool-update_request", toolCallId, state, input: {} },
    ] as UIMessage["parts"],
  };
}

function patch(text: string, interruptedMessageId: string | null = null) {
  return { messages: [userMessage(text)], interruptedMessageId };
}

function changeRow(id: string, threadId: string): RelayChangeRecord {
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

beforeEach(() => {
  clock = 1_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock++);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("throttled partial save (HH-M21)", () => {
  it("writes a streaming reply after the partial interval, not before", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    db.scheduleThreadSave("a", patch("partial"), { throttle: true });
    await vi.advanceTimersByTimeAsync(RELAY_PARTIAL_SAVE_MS - 1);
    expect((await db.getThread("a"))?.messages).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toEqual([
        userMessage("partial"),
      ]),
    );
  });

  it("keeps the newest chunk but does not postpone the write", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    db.scheduleThreadSave("a", patch("one"), { throttle: true });
    await vi.advanceTimersByTimeAsync(RELAY_PARTIAL_SAVE_MS - 500);
    db.scheduleThreadSave("a", patch("two"), { throttle: true });
    await vi.advanceTimersByTimeAsync(500);

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toEqual([userMessage("two")]),
    );
  });

  it("persists the interrupted marker so a reload can show the partial as Interrupted", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    db.scheduleThreadSave("a", patch("partial", "m-partial"), {
      throttle: true,
    });
    await vi.advanceTimersByTimeAsync(RELAY_PARTIAL_SAVE_MS);

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.interruptedMessageId).toBe(
        "m-partial",
      ),
    );
  });

  it("a finished turn replaces a queued throttled save with a debounced one", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    db.scheduleThreadSave("a", patch("partial"), { throttle: true });
    db.scheduleThreadSave("a", patch("final"));
    await vi.advanceTimersByTimeAsync(RELAY_THREAD_SAVE_DEBOUNCE_MS);

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toEqual([
        userMessage("final"),
      ]),
    );
  });
});

describe("flush on pagehide and thread switch", () => {
  it("pagehide writes a throttled partial that was still waiting", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    db.scheduleThreadSave("a", patch("streaming"), { throttle: true });

    window.dispatchEvent(new Event("pagehide"));

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toEqual([
        userMessage("streaming"),
      ]),
    );
  });

  it("registers a single pagehide listener however many saves are queued", async () => {
    const { db } = await load();
    const add = vi.spyOn(window, "addEventListener");
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    db.scheduleThreadSave("a", patch("one"));
    db.scheduleThreadSave("a", patch("two"));

    expect(add.mock.calls.filter(([type]) => type === "pagehide")).toHaveLength(
      1,
    );
  });

  it("flushThreadWrites saves every queued thread at once, before any timer fires", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    await db.createThread({ workspaceId: WORKSPACE, id: "b" });
    db.scheduleThreadSave("a", patch("for a"), { throttle: true });
    db.scheduleThreadSave("b", patch("for b"));

    await db.flushThreadWrites();

    expect((await db.getThread("a"))?.messages).toEqual([userMessage("for a")]);
    expect((await db.getThread("b"))?.messages).toEqual([userMessage("for b")]);
  });

  it("a flushed save is not written a second time when its timer fires", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    db.scheduleThreadSave("a", patch("once"));
    await db.flushThreadWrites();
    const first = (await db.getThread("a"))!.updatedAt;

    await vi.advanceTimersByTimeAsync(RELAY_THREAD_SAVE_DEBOUNCE_MS * 2);

    expect((await db.getThread("a"))?.updatedAt).toBe(first);
  });
});

describe("failed saves (L-26)", () => {
  async function failingWrites(db: ThreadDb, idb: IdbModule) {
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    const database = await idb.getDB();
    return vi.spyOn(database!, "transaction").mockImplementation(() => {
      throw new Error("quota");
    });
  }

  it("keeps the pending entry and retries it on a timer", async () => {
    const { db, idb } = await load();
    const failing = await failingWrites(db, idb);
    db.scheduleThreadSave("a", patch("keep me"));

    await db.flushThreadWrites();
    failing.mockRestore();
    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS);

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toEqual([
        userMessage("keep me"),
      ]),
    );
  });

  it("reports not saved only on the third consecutive failure", async () => {
    const { db, idb } = await load();
    const states: Array<[string, boolean]> = [];
    db.subscribeSaveState((id, notSaved) => states.push([id, notSaved]));
    await failingWrites(db, idb);
    db.scheduleThreadSave("a", patch("x"));

    await db.flushThreadWrites();
    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS);
    expect(states).toEqual([]);

    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS);
    expect(states).toEqual([["a", true]]);
  });

  it("reports recovery once a save finally lands", async () => {
    const { db, idb } = await load();
    const states: Array<[string, boolean]> = [];
    db.subscribeSaveState((id, notSaved) => states.push([id, notSaved]));
    const failing = await failingWrites(db, idb);
    db.scheduleThreadSave("a", patch("x"));
    await db.flushThreadWrites();
    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS * 2);
    failing.mockRestore();

    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS);

    await vi.waitFor(() =>
      expect(states).toEqual([
        ["a", true],
        ["a", false],
      ]),
    );
  });

  it("does not announce recovery after a failure streak shorter than the limit", async () => {
    const { db, idb } = await load();
    const states: Array<[string, boolean]> = [];
    db.subscribeSaveState((id, notSaved) => states.push([id, notSaved]));
    const failing = await failingWrites(db, idb);
    db.scheduleThreadSave("a", patch("x"));
    await db.flushThreadWrites();
    failing.mockRestore();

    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS);

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toHaveLength(1),
    );
    expect(states).toEqual([]);
  });

  it("a newer patch queued during a failing write wins over the failed one", async () => {
    const { db, idb } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    const database = await idb.getDB();
    const failing = vi
      .spyOn(database!, "transaction")
      .mockImplementation(() => {
        db.scheduleThreadSave("a", patch("newer"));
        throw new Error("quota");
      });
    db.scheduleThreadSave("a", patch("older"));

    await db.flushThreadWrites();
    failing.mockRestore();
    await vi.advanceTimersByTimeAsync(RELAY_THREAD_SAVE_DEBOUNCE_MS);

    await vi.waitFor(async () =>
      expect((await db.getThread("a"))?.messages).toEqual([
        userMessage("newer"),
      ]),
    );
  });

  it("stops unsubscribed listeners from hearing about failures", async () => {
    const { db, idb } = await load();
    const listener = vi.fn();
    const unsubscribe = db.subscribeSaveState(listener);
    unsubscribe();
    await failingWrites(db, idb);
    db.scheduleThreadSave("a", patch("x"));

    await db.flushThreadWrites();
    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS * 2);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("stale write from another tab (L-16)", () => {
  async function otherTabSaves(idb: IdbModule, id: string, text: string) {
    const database = await idb.getDB();
    const stored = await database!.get("relay_threads", id);
    await database!.put("relay_threads", {
      ...stored!,
      messages: [userMessage(text)],
      updatedAt: stored!.updatedAt + 10_000,
    });
  }

  it("rejects a write when the stored copy is newer than the one this tab read", async () => {
    const { db, idb } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    await otherTabSaves(idb, "a", "from the other tab");
    db.scheduleThreadSave("a", patch("from this tab"));

    await db.flushThreadWrites();

    expect((await db.getThread("a"))?.messages).toEqual([
      userMessage("from the other tab"),
    ]);
  });

  it("tells the UI the thread is not saved and does not retry", async () => {
    const { db, idb } = await load();
    const states: Array<[string, boolean]> = [];
    db.subscribeSaveState((id, notSaved) => states.push([id, notSaved]));
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    await otherTabSaves(idb, "a", "from the other tab");
    db.scheduleThreadSave("a", patch("from this tab"));

    await db.flushThreadWrites();
    await vi.advanceTimersByTimeAsync(RELAY_SAVE_RETRY_MS * 3);

    expect(states).toEqual([["a", true]]);
    expect(console.warn).toHaveBeenCalledWith(
      "[relay] another tab saved this thread; not overwriting",
      { threadId: "a" },
    );
  });

  it("accepts the write once this tab has re-read the newer copy", async () => {
    const { db, idb } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    await otherTabSaves(idb, "a", "from the other tab");
    await db.getThread("a");
    db.scheduleThreadSave("a", patch("from this tab"));

    await db.flushThreadWrites();

    expect((await db.getThread("a"))?.messages).toEqual([
      userMessage("from this tab"),
    ]);
  });

  it("a thread this tab never read or created is still saved", async () => {
    const { db, idb } = await load();
    const database = await idb.getDB();
    await database!.put("relay_threads", {
      id: "foreign",
      title: "",
      workspaceId: WORKSPACE,
      createdAt: 1,
      updatedAt: 5,
      messages: [],
      interruptedMessageId: null,
    });
    db.scheduleThreadSave("foreign", patch("hello"));

    await db.flushThreadWrites();

    expect((await db.getThread("foreign"))?.messages).toEqual([
      userMessage("hello"),
    ]);
  });
});

describe("running tool markers (HH-M22)", () => {
  it("records a started call, once, on the stored thread", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });

    await db.markToolRunning("a", "call-1");
    await db.markToolRunning("a", "call-1");
    await db.markToolRunning("a", "call-2");

    expect((await db.getThread("a"))?.runningToolCalls).toEqual([
      "call-1",
      "call-2",
    ]);
  });

  it("clears only the finished call", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    await db.markToolRunning("a", "call-1");
    await db.markToolRunning("a", "call-2");

    await db.clearToolRunning("a", "call-1");

    expect((await db.getThread("a"))?.runningToolCalls).toEqual(["call-2"]);
  });

  it("leaves a legacy thread without the field untouched when clearing", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "legacy" });

    await db.clearToolRunning("legacy", "call-1");

    expect(
      (await db.getThread("legacy"))?.runningToolCalls,
    ).toBeUndefined();
  });

  it("starts the list on a legacy thread that had none", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "legacy" });

    await db.markToolRunning("legacy", "call-1");

    expect((await db.getThread("legacy"))?.runningToolCalls).toEqual([
      "call-1",
    ]);
  });

  it("writes the queued turn first so the marker lands on the latest messages", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    db.scheduleThreadSave("a", patch("queued"));

    await db.markToolRunning("a", "call-1");

    const stored = await db.getThread("a");
    expect(stored?.messages).toEqual([userMessage("queued")]);
    expect(stored?.runningToolCalls).toEqual(["call-1"]);
  });

  it("does nothing for a thread that was deleted", async () => {
    const { db } = await load();

    await db.markToolRunning("gone", "call-1");

    expect(await db.getThread("gone")).toBeNull();
  });
});

describe("settleStoredToolOutput (L-03)", () => {
  it("writes the result into the matching call and leaves other parts alone", async () => {
    const { db } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    db.scheduleThreadSave("a", {
      messages: [
        userMessage("go"),
        toolMessage("call-1", "input-available"),
        toolMessage("call-2", "input-available"),
      ],
      interruptedMessageId: null,
    });

    const settled = await db.settleStoredToolOutput("a", "call-1", {
      ok: true,
    });

    const messages = (await db.getThread("a"))!.messages;
    expect(settled).toBe(true);
    expect(messages[1].parts[1]).toMatchObject({
      toolCallId: "call-1",
      state: "output-available",
      output: { ok: true },
    });
    expect(messages[2].parts[1]).toMatchObject({
      toolCallId: "call-2",
      state: "input-available",
    });
    expect(messages[0].parts).toEqual([{ type: "text", text: "go" }]);
  });

  it("returns false when the thread was deleted", async () => {
    const { db } = await load();

    expect(await db.settleStoredToolOutput("gone", "call-1", {})).toBe(false);
  });

  it("returns false and logs when the update cannot be written", async () => {
    const { db, idb } = await load();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    const database = await idb.getDB();
    vi.spyOn(database!, "transaction").mockImplementation(() => {
      throw new Error("quota");
    });

    const settled = await db.settleStoredToolOutput("a", "call-1", {});

    expect(settled).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      "[relay] updating a stored thread failed",
      expect.objectContaining({ threadId: "a" }),
    );
  });
});

describe("in-memory backend", () => {
  async function loadMemory(): Promise<ThreadDb> {
    vi.resetModules();
    vi.doMock("@/lib/idb", () => ({ getDB: () => null }));
    const db = await import("./threadDb");
    vi.doUnmock("@/lib/idb");
    return db;
  }

  it("round-trips markers, settled output and renames without storage", async () => {
    const db = await loadMemory();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    db.scheduleThreadSave("a", {
      messages: [toolMessage("call-1", "input-available")],
      interruptedMessageId: null,
    });

    await db.markToolRunning("a", "call-1");
    await db.settleStoredToolOutput("a", "call-1", { ok: true });
    await db.renameThread("a", "Renamed");

    const stored = await db.getThread("a");
    expect(stored?.title).toBe("Renamed");
    expect(stored?.runningToolCalls).toEqual(["call-1"]);
    expect(stored?.messages[0].parts[1]).toMatchObject({
      state: "output-available",
    });
    expect(await db.renameThread("missing", "x")).toBeNull();
  });

  it("restores a deleted thread with its change rows", async () => {
    const db = await loadMemory();
    await db.createThread({ workspaceId: WORKSPACE, id: "a" });
    const snapshot = await db.deleteThread("a");
    expect(snapshot?.thread.id).toBe("a");

    await db.restoreThread({
      thread: snapshot!.thread,
      changes: [changeRow("c1", "a")],
    });
    const again = await db.deleteThread("a");

    expect(again?.changes.map((c) => c.id)).toEqual(["c1"]);
  });
});
