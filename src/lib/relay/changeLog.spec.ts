import { describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
import {
  captureTree,
  type ChangeLog,
  type ChangeOrigin,
  type ChangeSpec,
  type ChangeStorage,
  createChangeLog,
  createMemoryChangeStorage,
} from "./changeLog";
import { createMemoryWorkspaceWriter } from "./testing/changeLogTestKit";
import { createFakeStoreAccess } from "./storeAccess";

const request = (id: string, overrides: Partial<RequestModel> = {}): RequestModel => ({
  id,
  collectionId: "c1",
  folderId: null,
  name: `Request ${id}`,
  method: "GET",
  url: "https://api.test/a",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

function setup(storage?: ChangeStorage) {
  const fake = createFakeStoreAccess({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    requests: [request("r1")],
  });
  const writer = createMemoryWorkspaceWriter(fake.state);
  const log: ChangeLog = createChangeLog({
    store: fake.access,
    writer,
    storage: storage ?? createMemoryChangeStorage(),
  });
  let turn = 0;
  const origin = (turnId = `turn-${turn}`): ChangeOrigin => {
    turn += 1;
    return { threadId: "t1", turnId, toolCallId: `call-${turn}` };
  };
  /** Edits the request the way a tool would and returns the spec. */
  const editUrl = (id: string, url: string): ChangeSpec => {
    const before = fake.state.requests.find((r) => r.id === id) ?? null;
    return {
      entity: "request",
      entityId: id,
      summary: `Set URL to ${url}`,
      before,
      mutate: () => writer.put("request", { ...before, url, updatedAt: Date.now() }),
    };
  };
  const addRequest = (id: string): ChangeSpec => ({
    entity: "request",
    entityId: id,
    summary: `Created ${id}`,
    before: null,
    mutate: () => writer.put("request", request(id)),
  });
  return { ...fake, writer, log, origin, editUrl, addRequest };
}

const urlOf = (state: { requests: readonly RequestModel[] }, id: string) =>
  state.requests.find((r) => r.id === id)?.url;

describe("apply and undo", () => {
  it("restores exactly the captured prior state", async () => {
    const { state, log, origin, editUrl } = setup();
    const before = state.requests[0];
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    expect(applied.ok).toBe(true);
    expect(urlOf(state, "r1")).toBe("https://api.test/b");

    const undone = await log.undo((applied as { change: { id: string } }).change.id);
    expect(undone.ok).toBe(true);
    expect(state.requests[0]).toEqual(before);
  });

  it("removes an entity that did not exist before", async () => {
    const { state, log, origin, addRequest } = setup();
    const applied = await log.apply(origin(), addRequest("r2"));
    expect(state.requests.map((r) => r.id)).toEqual(["r1", "r2"]);
    await log.undo((applied as { change: { id: string } }).change.id);
    expect(state.requests.map((r) => r.id)).toEqual(["r1"]);
  });

  it("is not fooled by timestamps a store stamps on every write", async () => {
    const { log, origin, editUrl } = setup();
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    const id = (applied as { change: { id: string } }).change.id;
    expect((await log.undo(id)).ok).toBe(true);
  });

  it("blocks undo after a manual edit of the same entity", async () => {
    const { state, writer, log, origin, editUrl } = setup();
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    const id = (applied as { change: { id: string } }).change.id;
    writer.put("request", { ...state.requests[0], url: "https://manual.test" });

    expect(await log.undo(id)).toEqual({ ok: false, reason: "edited" });
    expect(urlOf(state, "r1")).toBe("https://manual.test");
    expect(log.getView(id)).toMatchObject({ status: "blocked", reason: "edited" });
  });

  it("reports an entity deleted after the change as removed", async () => {
    const { writer, log, origin, editUrl } = setup();
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    writer.remove("request", "r1");
    expect(await log.undo((applied as { change: { id: string } }).change.id)).toEqual({
      ok: false,
      reason: "removed",
    });
  });

  it("refuses to undo twice and to undo unknown changes", async () => {
    const { log, origin, editUrl } = setup();
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    const id = (applied as { change: { id: string } }).change.id;
    await log.undo(id);
    expect(await log.undo(id)).toEqual({ ok: false, reason: "already_undone" });
    expect(await log.undo("missing")).toEqual({ ok: false, reason: "not_found" });
    expect(log.getView(id)?.status).toBe("undone");
  });

  it("notifies subscribers when a change is applied or undone", async () => {
    const { log, origin, editUrl } = setup();
    const listener = vi.fn();
    const unsubscribe = log.subscribe(listener);
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    await log.undo((applied as { change: { id: string } }).change.id);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await log.apply(origin(), editUrl("r1", "https://api.test/c"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("loads a stored change that is not cached", async () => {
    const storage = createMemoryChangeStorage();
    const first = setup(storage);
    const applied = await first.log.apply(first.origin(), first.editUrl("r1", "https://api.test/b"));
    const id = (applied as { change: { id: string } }).change.id;

    const second = createChangeLog({ store: first.access, writer: first.writer, storage });
    expect(second.getView(id)).toBeNull();
    expect(await second.load(id)).toMatchObject({ id, status: "applied" });
    expect(second.getView(id)).not.toBeNull();
    expect(await second.load("missing")).toBeNull();
  });
});

describe("undoTurn", () => {
  it("reverts every change of the turn newest first", async () => {
    const { state, log, origin, addRequest, editUrl } = setup();
    const turn = "turn-a";
    await log.apply(origin(turn), editUrl("r1", "https://api.test/b"));
    await log.apply(origin(turn), addRequest("r2"));
    await log.apply(origin("other"), addRequest("r3"));

    const result = await log.undoTurn(turn);
    expect(result.blocked).toEqual([]);
    expect(result.undone).toHaveLength(2);
    expect(state.requests.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(urlOf(state, "r1")).toBe("https://api.test/a");
  });

  it("undoes dependent changes in reverse so the earlier ones still match", async () => {
    const { state, log, origin, editUrl } = setup();
    await log.apply(origin("t"), editUrl("r1", "https://api.test/b"));
    await log.apply(origin("t"), editUrl("r1", "https://api.test/c"));
    const result = await log.undoTurn("t");
    expect(result.blocked).toEqual([]);
    expect(urlOf(state, "r1")).toBe("https://api.test/a");
  });

  it("reports blocked changes instead of forcing them", async () => {
    const { state, writer, log, origin, editUrl, addRequest } = setup();
    await log.apply(origin("t"), editUrl("r1", "https://api.test/b"));
    const added = await log.apply(origin("t"), addRequest("r2"));
    writer.put("request", { ...state.requests[1], name: "Renamed by hand" });

    const result = await log.undoTurn("t");
    expect(result.undone).toHaveLength(1);
    expect(result.blocked).toEqual([
      { id: (added as { change: { id: string } }).change.id, reason: "edited" },
    ]);
    expect(state.requests.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("skips changes that are already undone", async () => {
    const { log, origin, addRequest } = setup();
    const applied = await log.apply(origin("t"), addRequest("r2"));
    await log.undo((applied as { change: { id: string } }).change.id);
    expect(await log.undoTurn("t")).toEqual({ undone: [], blocked: [] });
  });
});

describe("atomicity", () => {
  it("leaves the workspace unchanged when the log write fails", async () => {
    const failing: ChangeStorage = {
      ...createMemoryChangeStorage(),
      put: async () => {
        throw new Error("disk full");
      },
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { state, log, origin, editUrl, addRequest } = setup(failing);

    expect((await log.apply(origin(), editUrl("r1", "https://api.test/b"))).ok).toBe(false);
    expect(urlOf(state, "r1")).toBe("https://api.test/a");
    expect((await log.apply(origin(), addRequest("r2"))).ok).toBe(false);
    expect(state.requests.map((r) => r.id)).toEqual(["r1"]);
    spy.mockRestore();
  });

  it("restores the prior state when the write throws halfway", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { state, writer, log, origin } = setup();
    const before = state.requests[0];
    const result = await log.apply(origin(), {
      entity: "request",
      entityId: "r1",
      summary: "boom",
      before,
      mutate: () => {
        writer.put("request", { ...before, url: "https://half.test" });
        throw new Error("boom");
      },
    });
    expect(result).toEqual({ ok: false, error: "the change could not be applied" });
    expect(state.requests[0]).toEqual(before);
    spy.mockRestore();
  });
});

describe("other entities", () => {
  it("undoes a created tree (collection with contents) only while untouched", async () => {
    const { state, writer, access, log, origin } = setup();
    const created = await log.apply(origin("t"), {
      entity: "tree",
      entityId: "c2",
      summary: "Created Billing",
      before: null,
      mutate: () => {
        writer.put("collection", { id: "c2", name: "Billing", createdAt: 1, updatedAt: 1 });
        writer.put("request", request("r9", { collectionId: "c2" }));
      },
    });
    const id = (created as { change: { id: string } }).change.id;

    writer.put("request", request("r10", { collectionId: "c2" }));
    expect(await log.undo(id)).toEqual({ ok: false, reason: "edited" });
    writer.remove("request", "r10");

    expect((await log.undo(id)).ok).toBe(true);
    expect(state.collections.map((c) => c.id)).toEqual(["c1"]);
    expect(access.requests().map((r) => r.id)).toEqual(["r1"]);
  });

  it("restores a deleted tree with its children", async () => {
    const { state, writer, access, log, origin } = setup();
    writer.put("folder", { id: "f1", collectionId: "c1", name: "F", parentFolderId: null, order: 0 });
    writer.put("request", request("r5", { folderId: "f1" }));
    const snapshot = captureTree(access, "c1");
    expect(snapshot?.folders).toHaveLength(1);
    expect(snapshot?.requests.map((r) => r.id)).toEqual(["r1", "r5"]);

    const deleted = await log.apply(origin(), {
      entity: "tree",
      entityId: "c1",
      summary: "Deleted Orders",
      before: snapshot,
      mutate: () => writer.remove("collection", "c1"),
    });
    expect(state.requests).toEqual([]);
    await log.undo((deleted as { change: { id: string } }).change.id);
    expect(state.collections.map((c) => c.id)).toEqual(["c1"]);
    expect(state.folders.map((f) => f.id)).toEqual(["f1"]);
    expect(state.requests.map((r) => r.id).sort()).toEqual(["r1", "r5"]);
  });

  it("captures a folder subtree without the rest of the collection", () => {
    const { access, writer } = setup();
    writer.put("folder", { id: "f1", collectionId: "c1", name: "F", parentFolderId: null, order: 0 });
    writer.put("folder", { id: "f2", collectionId: "c1", name: "G", parentFolderId: "f1", order: 0 });
    writer.put("request", request("r6", { folderId: "f2" }));
    const tree = captureTree(access, "f1");
    expect(tree?.collection).toBeNull();
    expect(tree?.folders.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(tree?.requests.map((r) => r.id)).toEqual(["r6"]);
    expect(captureTree(access, "nope")).toBeNull();
  });

  it("undoes a batch with a single inverse", async () => {
    const { state, writer, log, origin } = setup();
    writer.put("request", request("r2"));
    const before = [...state.requests];
    const applied = await log.apply(origin(), {
      entity: "requests",
      entityId: "r1,r2",
      summary: "Updated 2",
      before,
      mutate: () => {
        for (const r of before) writer.put("request", { ...r, method: "POST" });
      },
    });
    expect(state.requests.every((r) => r.method === "POST")).toBe(true);
    await log.undo((applied as { change: { id: string } }).change.id);
    expect(state.requests.every((r) => r.method === "GET")).toBe(true);
  });

  it("restores the previous active environment, or none if it was deleted", async () => {
    const { state, writer, log, origin } = setup();
    writer.put("environment", { id: "e1", name: "Dev", variables: [], createdAt: 1, updatedAt: 1 });
    writer.put("environment", { id: "e2", name: "Prod", variables: [], createdAt: 1, updatedAt: 1 });
    writer.setActiveEnvironment("e1");

    const first = await log.apply(origin(), {
      entity: "activeEnvironment",
      entityId: "active",
      summary: "Switched",
      before: "e1",
      mutate: () => writer.setActiveEnvironment("e2"),
    });
    await log.undo((first as { change: { id: string } }).change.id);
    expect(state.activeEnvironmentId).toBe("e1");

    const second = await log.apply(origin(), {
      entity: "activeEnvironment",
      entityId: "active",
      summary: "Switched",
      before: "e1",
      mutate: () => writer.setActiveEnvironment("e2"),
    });
    writer.remove("environment", "e1");
    await log.undo((second as { change: { id: string } }).change.id);
    expect(state.activeEnvironmentId).toBeNull();
  });

  it("closes a tab it opened and returns to the previous one", async () => {
    const { state, writer, log, origin } = setup();
    const previous = writer.openRequest(request("r1"));
    writer.setActiveEnvironment(null);
    const opened = await log.apply(origin(), {
      entity: "tab",
      entityId: "r2",
      summary: "Opened",
      before: { openedForRequestId: "r2", activateTabId: previous },
      mutate: () => {
        writer.openRequest(request("r2"));
      },
    });
    expect(state.tabs.map((t) => t.tabId)).toEqual([previous, "tab-2"]);
    await log.undo((opened as { change: { id: string } }).change.id);
    expect(state.tabs.map((t) => t.tabId)).toEqual([previous]);
    expect(state.activeTabId).toBe(previous);
  });
});

describe("timing (NFR-3)", () => {
  it("applies and undoes in under 50ms", async () => {
    const { log, origin, editUrl } = setup();
    const startApply = performance.now();
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    const applyMs = performance.now() - startApply;
    const startUndo = performance.now();
    await log.undo((applied as { change: { id: string } }).change.id);
    const undoMs = performance.now() - startUndo;
    expect(applyMs).toBeLessThan(50);
    expect(undoMs).toBeLessThan(50);
  });
});
