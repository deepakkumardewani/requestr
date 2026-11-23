import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeStorage } from "@/lib/analytics/dedupe";
import {
  FEEDBACK_STATE_STORAGE_KEY,
  readFeedbackState,
} from "@/lib/feedback/feedbackState";
import { unmarkSlugImported } from "@/lib/hub";
import type { RequestModel } from "@/types";
import {
  captureTree,
  type ChangeLog,
  type ChangeOrigin,
  type ChangeSpec,
  type ChangeStorage,
  createChangeLog,
  createMemoryChangeStorage,
  createZustandWorkspaceWriter,
  getRelayChangeLog,
  isSettingsGroup,
  readSettingsGroup,
  snapshotTabRequest,
  undoStatusOf,
  writeSettingsGroup,
} from "./changeLog";
import { createMemoryWorkspaceWriter } from "./testing/changeLogTestKit";
import { createFakeStoreAccess, createZustandStoreAccess } from "./storeAccess";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useChainStore } from "@/stores/useChainStore";

vi.mock("@/lib/hub", () => ({
  announceSlugChange: vi.fn(),
  unmarkSlugImported: vi.fn(),
}));

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

describe("feedback counter", () => {
  const relayActions = () => readFeedbackState().counters.relayActions;

  beforeEach(() => safeStorage.remove(FEEDBACK_STATE_STORAGE_KEY));

  it("increments once per applied change", async () => {
    const { log, origin, editUrl, addRequest } = setup();
    await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    expect(relayActions()).toBe(1);
    await log.apply(origin(), addRequest("r2"));
    expect(relayActions()).toBe(2);
  });

  it("does not increment when the log write fails", async () => {
    const failing: ChangeStorage = {
      ...createMemoryChangeStorage(),
      put: async () => {
        throw new Error("disk full");
      },
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { log, origin, editUrl } = setup(failing);
    expect((await log.apply(origin(), editUrl("r1", "https://api.test/b"))).ok).toBe(false);
    expect(relayActions()).toBe(0);
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

describe("tree import undo after reload", () => {
  it("undoes and unmarks the provider when storage returns rows in another order", async () => {
    const { state, writer, log, origin } = setup();
    const created = await log.apply(origin(), {
      entity: "tree",
      entityId: "c2",
      summary: "Imported Stripe",
      before: null,
      hubSlug: "stripe",
      mutate: () => {
        writer.put("collection", { id: "c2", name: "Stripe", createdAt: 1, updatedAt: 1 });
        for (const id of ["r-a", "r-b", "r-c"]) {
          writer.put("request", request(id, { collectionId: "c2" }));
        }
      },
    });
    const id = (created as { change: { id: string } }).change.id;

    // A reload reads rows back in a different order than they were written.
    (state.requests as RequestModel[]).reverse();

    expect((await log.undo(id)).ok).toBe(true);
    expect(unmarkSlugImported).toHaveBeenCalledWith("stripe");
    expect(state.collections.map((c) => c.id)).toEqual(["c1"]);
  });
});

const idOf = (applied: unknown) => (applied as { change: { id: string } }).change.id;

const environment = (id: string, name: string) => ({ id, name, variables: [], createdAt: 1, updatedAt: 1 });

const collectionChain = (collectionId: string) => ({
  id: collectionId,
  scope: "collection" as const,
  collectionId,
  schemaVersion: 5 as const,
  name: "Orders chain",
  createdAt: 1,
  blocks: [],
  nodeIds: ["r1"],
  edges: [],
  nodePositions: { r1: { x: 0, y: 0 } },
});

/** Wraps a writer so chosen puts throw, to prove a failed undo leaves nothing half done. */
function failingWriter(
  inner: ReturnType<typeof createMemoryWorkspaceWriter>,
  failOn: { kind: string; armed: boolean },
) {
  return {
    ...inner,
    put(kind: Parameters<typeof inner.put>[0], entity: unknown) {
      if (failOn.armed && kind === failOn.kind) throw new Error("disk full");
      inner.put(kind, entity);
    },
  };
}

describe("undo contract (HH-UNDO)", () => {
  it("reports each outcome as ok, conflict, unavailable or already-undone", async () => {
    const { writer, log, origin, editUrl, state } = setup();
    const applied = await log.apply(origin(), editUrl("r1", "https://api.test/b"));
    const id = idOf(applied);
    const first = await log.undo(id);
    const second = await log.undo(id);
    expect([undoStatusOf(first), undoStatusOf(second)]).toEqual(["ok", "already-undone"]);
    expect(urlOf(state, "r1")).toBe("https://api.test/a");

    const edited = await log.apply(origin(), editUrl("r1", "https://api.test/c"));
    writer.put("request", { ...state.requests[0], url: "https://manual.test" });
    expect(undoStatusOf(await log.undo(idOf(edited)))).toBe("conflict");

    const removed = await log.apply(origin(), editUrl("r1", "https://api.test/d"));
    writer.remove("request", "r1");
    expect(undoStatusOf(await log.undo(idOf(removed)))).toBe("conflict");

    expect(undoStatusOf(await log.undo("unknown-change"))).toBe("unavailable");
  });

  it("a second undo of a collection delete is a no-op that leaves the restored tree alone", async () => {
    const { state, writer, log, origin } = setup();
    const before = captureTree(createFakeStoreAccess(state).access, "c1");
    const applied = await log.apply(origin(), {
      entity: "tree",
      entityId: "c1",
      summary: "Deleted collection",
      before,
      mutate: () => writer.remove("collection", "c1"),
    });
    const id = idOf(applied);
    expect((await log.undo(id)).ok).toBe(true);
    const restored = structuredClone(state);
    expect(await log.undo(id)).toEqual({ ok: false, reason: "already_undone" });
    expect(state).toEqual(restored);
  });

  it("a throwing undo leaves the store exactly as the delete left it and stays retryable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      folders: [{ id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 }],
      requests: [request("r1"), request("r2", { folderId: "f1" })],
      chains: [collectionChain("c1")],
    });
    const inner = createMemoryWorkspaceWriter(fake.state);
    const failOn = { kind: "request", armed: false };
    const log = createChangeLog({
      store: fake.access,
      writer: failingWriter(inner, failOn),
      storage: createMemoryChangeStorage(),
    });
    const before = captureTree(fake.access, "c1");
    const applied = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k1" },
      {
        entity: "tree",
        entityId: "c1",
        summary: "Deleted collection",
        before,
        mutate: () => inner.remove("collection", "c1"),
      },
    );
    const id = idOf(applied);
    const afterDelete = structuredClone(fake.state);
    expect(afterDelete.collections).toEqual([]);

    failOn.armed = true;
    const failed = await log.undo(id);
    expect(failed).toEqual({ ok: false, reason: "failed" });
    expect(undoStatusOf(failed)).toBe("unavailable");
    expect(fake.state).toEqual(afterDelete);
    expect(log.getView(id)?.status).toBe("applied");
    expect(error).toHaveBeenCalled();

    failOn.armed = false;
    expect((await log.undo(id)).ok).toBe(true);
    expect(fake.state.collections.map((c) => c.id)).toEqual(["c1"]);
    expect(fake.state.chains.map((c) => c.id)).toEqual(["c1"]);
    error.mockRestore();
  });

  it("says Undo is unavailable, not missing, once rows can no longer be read back (L-15)", async () => {
    const fake = createFakeStoreAccess({ requests: [request("r1")] });
    const memory = createMemoryChangeStorage();
    let persistent = true;
    const storage: ChangeStorage = {
      ...memory,
      persistent: () => persistent,
    };
    const log = createChangeLog({
      store: fake.access,
      writer: createMemoryWorkspaceWriter(fake.state),
      storage,
    });
    persistent = false;
    const result = await log.undo("0000000000000-000001-abcd1234");
    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(undoStatusOf(result)).toBe("unavailable");

    persistent = true;
    expect(await log.undo("0000000000000-000001-abcd1234")).toEqual({ ok: false, reason: "not_found" });
  });

  it("reopens the tabs a request delete closed when Undo brings the request back (L-14)", async () => {
    const { state, writer, log, origin } = setup();
    writer.openRequest(request("r1"));
    const before = [state.requests[0]];
    const applied = await log.apply(origin(), {
      entity: "requests",
      entityId: "r1",
      summary: "Deleted",
      before,
      mutate: () => writer.remove("request", "r1"),
    });
    expect(state.tabs).toEqual([]);
    expect(log.getView(idOf(applied))?.closedTabs).toEqual([{ tabId: "tab-1", requestId: "r1" }]);
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    expect(state.tabs.map((t) => t.requestId)).toEqual(["r1"]);
  });
});

describe("collection chain capture (HH-H09)", () => {
  it("captures the collection's chain and puts it back with the collection", async () => {
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      requests: [request("r1")],
      chains: [collectionChain("c1"), { ...collectionChain("other"), scope: "standalone" as const, collectionId: undefined }],
    });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const log = createChangeLog({ store: fake.access, writer, storage: createMemoryChangeStorage() });
    const tree = captureTree(fake.access, "c1");
    expect(tree?.chain?.id).toBe("c1");

    const before = structuredClone(fake.state);
    const applied = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k1" },
      {
        entity: "tree",
        entityId: "c1",
        summary: "Deleted collection",
        before: tree,
        mutate: () => writer.remove("collection", "c1"),
      },
    );
    expect(fake.state.chains.map((c) => c.id)).toEqual(["other"]);
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    expect(fake.state.chains.map((c) => c.id).sort()).toEqual(["c1", "other"]);
    expect(fake.state.chains.find((c) => c.id === "c1")).toEqual(before.chains[0]);
  });

  it("captures no chain for a collection without one, and none for a folder", () => {
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      folders: [{ id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 }],
    });
    expect(captureTree(fake.access, "c1")?.chain).toBeNull();
    expect(captureTree(fake.access, "f1")).not.toHaveProperty("chain");
  });

  it("does not count a chain the store created later as an edit of the tree", async () => {
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      requests: [request("r1")],
    });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const log = createChangeLog({ store: fake.access, writer, storage: createMemoryChangeStorage() });
    const tree = captureTree(fake.access, "c1");
    const applied = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k1" },
      {
        entity: "tree",
        entityId: "c1",
        summary: "Deleted collection",
        before: tree,
        mutate: () => writer.remove("collection", "c1"),
      },
    );
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    // The chain store creates the chain lazily after the restore; a second change must not read as an edit.
    fake.state.chains = [collectionChain("c1")];
    const again = await log.apply(
      { threadId: "t1", turnId: "u2", toolCallId: "k2" },
      {
        entity: "tree",
        entityId: "c1",
        summary: "Deleted collection",
        before: captureTree(fake.access, "c1"),
        mutate: () => writer.remove("collection", "c1"),
      },
    );
    expect((await log.undo(idOf(again))).ok).toBe(true);
  });

  it("undoes a deleted chain whose collection is gone only through its own change", async () => {
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      chains: [collectionChain("c1")],
    });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const log = createChangeLog({ store: fake.access, writer, storage: createMemoryChangeStorage() });
    const chain = fake.state.chains[0];
    const applied = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k1" },
      {
        entity: "chain",
        entityId: "c1",
        summary: "Deleted chain",
        before: chain,
        mutate: () => writer.remove("chain", "c1"),
      },
    );
    expect(fake.state.chains).toEqual([]);
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    expect(fake.state.chains).toEqual([chain]);
  });

  it("a failing chain restore puts the collection back to its deleted state", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      chains: [collectionChain("c1")],
    });
    const inner = createMemoryWorkspaceWriter(fake.state);
    const failOn = { kind: "chain", armed: false };
    const log = createChangeLog({
      store: fake.access,
      writer: failingWriter(inner, failOn),
      storage: createMemoryChangeStorage(),
    });
    const applied = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k1" },
      {
        entity: "tree",
        entityId: "c1",
        summary: "Deleted collection",
        before: captureTree(fake.access, "c1"),
        mutate: () => inner.remove("collection", "c1"),
      },
    );
    failOn.armed = true;
    expect(await log.undo(idOf(applied))).toEqual({ ok: false, reason: "failed" });
    expect(fake.state.collections).toEqual([]);
    expect(fake.state.chains).toEqual([]);
    error.mockRestore();
  });
});

describe("active environment survives Undo (HH-M13, L-09)", () => {
  const seedEnvs = () => {
    const fake = createFakeStoreAccess({
      environments: [environment("e1", "Staging"), environment("e2", "Production")],
      activeEnvironmentId: "e1",
    });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const log = createChangeLog({ store: fake.access, writer, storage: createMemoryChangeStorage() });
    return { ...fake, writer, log };
  };
  const origin: ChangeOrigin = { threadId: "t1", turnId: "u1", toolCallId: "k1" };

  it("makes a deleted active environment active again", async () => {
    const { state, writer, log } = seedEnvs();
    const applied = await log.apply(origin, {
      entity: "environment",
      entityId: "e1",
      summary: "Deleted",
      before: state.environments[0],
      mutate: () => writer.remove("environment", "e1"),
    });
    expect(state.activeEnvironmentId).toBeNull();
    expect(log.getView(idOf(applied))?.wasActive).toBe(true);
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    expect(state.activeEnvironmentId).toBe("e1");
  });

  it("leaves the selection alone when the deleted environment was not the active one", async () => {
    const { state, writer, log } = seedEnvs();
    const applied = await log.apply(origin, {
      entity: "environment",
      entityId: "e2",
      summary: "Deleted",
      before: state.environments[1],
      mutate: () => writer.remove("environment", "e2"),
    });
    expect(log.getView(idOf(applied))?.wasActive).toBeUndefined();
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    expect(state.activeEnvironmentId).toBe("e1");
  });

  it("restores the only environment as active after it was deleted", async () => {
    const fake = createFakeStoreAccess({
      environments: [environment("e1", "Only")],
      activeEnvironmentId: "e1",
    });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const log = createChangeLog({ store: fake.access, writer, storage: createMemoryChangeStorage() });
    const applied = await log.apply(origin, {
      entity: "environment",
      entityId: "e1",
      summary: "Deleted",
      before: fake.state.environments[0],
      mutate: () => writer.remove("environment", "e1"),
    });
    expect(fake.state.environments).toEqual([]);
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    expect(fake.state.environments.map((e) => e.id)).toEqual(["e1"]);
    expect(fake.state.activeEnvironmentId).toBe("e1");
  });

  it("keeps the stated action on an active-environment change", async () => {
    const { log, writer } = seedEnvs();
    const applied = await log.apply(origin, {
      entity: "activeEnvironment",
      entityId: "e2",
      action: "updated",
      summary: "Switched",
      before: null,
      mutate: () => writer.setActiveEnvironment("e2"),
    });
    expect(log.getView(idOf(applied))?.action).toBe("updated");
  });

  it("a failing environment restore leaves it deleted and not active", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = createFakeStoreAccess({
      environments: [environment("e1", "Staging")],
      activeEnvironmentId: "e1",
    });
    const inner = createMemoryWorkspaceWriter(fake.state);
    const log = createChangeLog({
      store: fake.access,
      writer: {
        ...inner,
        setActiveEnvironment() {
          throw new Error("cannot select");
        },
      },
      storage: createMemoryChangeStorage(),
    });
    const applied = await log.apply(origin, {
      entity: "environment",
      entityId: "e1",
      summary: "Deleted",
      before: fake.state.environments[0],
      mutate: () => inner.remove("environment", "e1"),
    });
    expect(await log.undo(idOf(applied))).toEqual({ ok: false, reason: "failed" });
    expect(fake.state.environments).toEqual([]);
    expect(fake.state.activeEnvironmentId).toBeNull();
    error.mockRestore();
  });

  it("undoes a legacy environment delete that recorded no wasActive", async () => {
    const fake = createFakeStoreAccess({ environments: [], activeEnvironmentId: null });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const storage = createMemoryChangeStorage();
    const log = createChangeLog({ store: fake.access, writer, storage });
    await storage.put({
      id: "legacy-1",
      threadId: "t1",
      turnId: "u1",
      toolCallId: "k1",
      entity: "environment",
      entityId: "e1",
      before: environment("e1", "Old"),
      afterHash: fake.access.hash(null),
      status: "applied",
      summary: "Deleted environment",
      after: null,
    });
    expect((await log.undo("legacy-1")).ok).toBe(true);
    expect(fake.state.environments.map((e) => e.id)).toEqual(["e1"]);
    expect(fake.state.activeEnvironmentId).toBeNull();
  });

  it("undoes a legacy collection delete whose snapshot has no chain field", async () => {
    const fake = createFakeStoreAccess({ collections: [], requests: [] });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const storage = createMemoryChangeStorage();
    const log = createChangeLog({ store: fake.access, writer, storage });
    await storage.put({
      id: "legacy-2",
      threadId: "t1",
      turnId: "u1",
      toolCallId: "k1",
      entity: "tree",
      entityId: "c1",
      before: {
        collection: { id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 },
        folders: [],
        requests: [request("r1")],
      },
      afterHash: fake.access.hash(null),
      status: "applied",
      summary: "Deleted collection",
      after: null,
    });
    expect((await log.undo("legacy-2")).ok).toBe(true);
    expect(fake.state.collections.map((c) => c.id)).toEqual(["c1"]);
    expect(fake.state.requests.map((r) => r.id)).toEqual(["r1"]);
    expect(fake.state.chains).toEqual([]);
  });
});

describe("backup import undo (HH-M11)", () => {
  const origin: ChangeOrigin = { threadId: "t1", turnId: "u1", toolCallId: "k1" };

  /** An import that added c9 with r9 and overwrote r1 (same id, new content). */
  function importedBackup(armedFailure?: { armed: boolean }) {
    const original = request("r1", { name: "Original" });
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      requests: [original],
    });
    const inner = createMemoryWorkspaceWriter(fake.state);
    // One transient failure: the put that restores the overwritten request throws once.
    const writer: typeof inner = armedFailure
      ? {
          ...inner,
          put(kind, entity) {
            if (armedFailure.armed && kind === "request") {
              armedFailure.armed = false;
              throw new Error("disk full");
            }
            inner.put(kind, entity);
          },
        }
      : inner;
    const log = createChangeLog({ store: fake.access, writer, storage: createMemoryChangeStorage() });
    const before = {
      added: [
        { kind: "request" as const, id: "r9" },
        { kind: "collection" as const, id: "c9" },
      ],
      overwritten: [{ kind: "request" as const, record: original }],
    };
    return { fake, inner, log, before, original };
  }

  const runImport = (ctx: ReturnType<typeof importedBackup>) =>
    ctx.log.apply(origin, {
      entity: "backup",
      entityId: "k1",
      action: "created",
      summary: "Merged the backup",
      before: ctx.before,
      mutate: () => {
        ctx.inner.put("collection", { id: "c9", name: "Imported", createdAt: 1, updatedAt: 1 });
        ctx.inner.put("request", request("r9", { collectionId: "c9" }));
        ctx.inner.put("request", { ...ctx.original, name: "From backup" });
      },
    });

  it("removes exactly what the import added and puts back what it overwrote", async () => {
    const ctx = importedBackup();
    const applied = await runImport(ctx);
    expect(ctx.fake.state.requests.map((r) => r.name).sort()).toEqual(["From backup", "Request r9"]);

    expect((await ctx.log.undo(idOf(applied))).ok).toBe(true);
    expect(ctx.fake.state.collections.map((c) => c.id)).toEqual(["c1"]);
    expect(ctx.fake.state.requests).toEqual([ctx.original]);
  });

  it("is blocked as edited when an imported entity was changed afterwards", async () => {
    const ctx = importedBackup();
    const applied = await runImport(ctx);
    ctx.inner.put("request", { ...request("r9", { collectionId: "c9" }), name: "Edited by hand" });
    expect(await ctx.log.undo(idOf(applied))).toEqual({ ok: false, reason: "edited" });
    expect(ctx.fake.state.collections.map((c) => c.id).sort()).toEqual(["c1", "c9"]);
  });

  it("puts the import back as it was when the undo throws halfway", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = { armed: false };
    const ctx = importedBackup(failure);
    const applied = await runImport(ctx);
    const afterImport = structuredClone(ctx.fake.state);
    failure.armed = true;
    expect(await ctx.log.undo(idOf(applied))).toEqual({ ok: false, reason: "failed" });
    expect(ctx.fake.state.collections).toEqual(afterImport.collections);
    expect(ctx.fake.state.requests.map((r) => r.id).sort()).toEqual(["r1", "r9"]);
    expect(ctx.fake.state.requests.find((r) => r.id === "r1")?.name).toBe("From backup");
    // The retry works once the failure is gone, so nothing was left half done.
    expect((await ctx.log.undo(idOf(applied))).ok).toBe(true);
    expect(ctx.fake.state.requests).toEqual([ctx.original]);
    error.mockRestore();
  });
});

describe("turns, reloads and storage", () => {
  it("moves changes to another turn so one Undo all covers them, skipping unknown and same-turn ones", async () => {
    const { log, origin, editUrl, addRequest } = setup();
    const a = idOf(await log.apply(origin("turn-a"), editUrl("r1", "https://api.test/b")));
    const b = idOf(await log.apply(origin("turn-b"), addRequest("r2")));
    await log.rekey([a, b, "unknown"], "turn-b");
    expect(log.getView(a)?.turnId).toBe("turn-b");
    const result = await log.undoTurn("turn-b");
    expect(result.undone).toEqual([b, a]);
    expect(result.blocked).toEqual([]);
  });

  it("keeps working when moving a change to another turn cannot be saved", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const memory = createMemoryChangeStorage();
    let failPuts = false;
    const storage: ChangeStorage = {
      ...memory,
      put: async (record) => {
        if (failPuts) throw new Error("quota");
        await memory.put(record);
      },
    };
    const { log, origin, editUrl } = setup(storage);
    const id = idOf(await log.apply(origin("turn-a"), editUrl("r1", "https://api.test/b")));
    failPuts = true;
    await log.rekey([id], "turn-b");
    expect(log.getView(id)?.turnId).toBe("turn-a");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("loads a stored change once and serves it from the cache after", async () => {
    const storage = createMemoryChangeStorage();
    const first = setup(storage);
    const id = idOf(await first.log.apply(first.origin("turn-a"), first.editUrl("r1", "https://api.test/b")));
    const fresh = setup(storage).log;
    const loaded = await fresh.load(id);
    expect(loaded?.summary).toBe("Set URL to https://api.test/b");
    expect(await fresh.load(id)).toBe(loaded);
  });

  it("answers unavailable, not missing, with no IndexedDB behind the default storage (L-15)", async () => {
    const fake = createFakeStoreAccess({ requests: [request("r1")] });
    const log = createChangeLog({ store: fake.access, writer: createMemoryWorkspaceWriter(fake.state) });
    const applied = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k1" },
      {
        entity: "request",
        entityId: "r1",
        summary: "Set URL",
        before: fake.state.requests[0],
        mutate: () => (fake.state.requests as RequestModel[]).splice(0, 1, { ...fake.state.requests[0], url: "https://api.test/z" }),
      },
    );
    expect((await log.undo(idOf(applied))).ok).toBe(true);
    expect(await log.undo("0000000000000-000009-deadbeef")).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("tab and settings adapters in a node test", () => {
  it("restores a tab-only edit, isDirty included, and closes a tab Relay opened", async () => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
    useTabsStore.getState().openTab({
      type: "http",
      requestId: "r1",
      name: "List",
      method: "GET",
      url: "https://api.test/a",
      isDirty: false,
      assertions: [],
    } as never);
    const tabId = useTabsStore.getState().tabs[0].tabId;
    const log = createChangeLog({
      store: createZustandStoreAccess(),
      writer: createZustandWorkspaceWriter(),
      storage: createMemoryChangeStorage(),
    });
    const edit = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k1" },
      {
        entity: "tabRequest",
        entityId: tabId,
        summary: "Added assertion",
        before: snapshotTabRequest(useTabsStore.getState().tabs[0]),
        mutate: () =>
          useTabsStore
            .getState()
            .updateTabState(tabId, { assertions: [{ id: "a1" }], isDirty: true } as never),
      },
    );
    expect((await log.undo(idOf(edit))).ok).toBe(true);
    expect(useTabsStore.getState().tabs[0]).toMatchObject({ isDirty: false, assertions: [] });

    const opened = await log.apply(
      { threadId: "t1", turnId: "u1", toolCallId: "k2" },
      { entity: "tabRequest", entityId: tabId, summary: "Opened", before: null, mutate: () => undefined },
    );
    expect((await log.undo(idOf(opened))).ok).toBe(true);
    expect(useTabsStore.getState().tabs).toEqual([]);
  });

  it("writes and restores the language, proxy, global and relay groups", async () => {
    useSettingsStore.setState({ locale: "en", proxyUrl: "", sslVerify: true, followRedirects: true, globalBaseUrl: "", globalHeaders: [] });
    useRelayStore.setState({ shareValues: false, enabled: true });
    writeSettingsGroup("language", { locale: "fr" });
    writeSettingsGroup("proxy", { proxyUrl: "http://p", sslVerify: false, followRedirects: false });
    writeSettingsGroup("global", { globalBaseUrl: "https://g.test", globalHeaders: [] });
    writeSettingsGroup("relay", { shareValues: true, enabled: false });
    expect(readSettingsGroup("language")).toEqual({ locale: "fr" });
    expect(readSettingsGroup("proxy")).toEqual({ proxyUrl: "http://p", sslVerify: false, followRedirects: false });
    expect(readSettingsGroup("global")).toEqual({ globalBaseUrl: "https://g.test", globalHeaders: [] });
    expect(readSettingsGroup("relay")).toEqual({ shareValues: true, enabled: false });
    expect(isSettingsGroup("relay")).toBe(true);
    expect(isSettingsGroup("constructor")).toBe(false);
  });
});

describe("live Zustand writer", () => {
  const collection = { id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 };
  const folder = { id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 };
  const environment = { id: "e1", name: "Dev", variables: [], createdAt: 1, updatedAt: 1 };
  const chain = {
    id: "ch1",
    scope: "standalone" as const,
    schemaVersion: 5,
    name: "Chain",
    createdAt: 1,
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
  };

  it("puts and removes every entity kind through the stores", () => {
    useCollectionsStore.setState({ collections: [], folders: [], requests: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useChainStore.setState({ chains: {} } as never);
    const writer = createZustandWorkspaceWriter();

    writer.put("collection", collection as never);
    writer.put("folder", folder as never);
    writer.put("request", request("r1") as never);
    writer.put("request", request("r1", { name: "Renamed" }) as never);
    writer.put("environment", environment as never);
    writer.put("environment", { ...environment, name: "Prod" } as never);
    writer.put("chain", chain as never);
    writer.put("chain", { ...chain, name: "Chain 2" } as never);

    expect(useCollectionsStore.getState().requests.map((r) => r.name)).toEqual(["Renamed"]);
    expect(useCollectionsStore.getState().folders.map((f) => f.id)).toEqual(["f1"]);
    expect(useEnvironmentsStore.getState().environments.map((e) => e.name)).toEqual(["Prod"]);
    expect(useChainStore.getState().chains.ch1.name).toBe("Chain 2");

    writer.remove("request", "r1");
    writer.remove("folder", "f1");
    writer.remove("collection", "c1");
    writer.remove("environment", "e1");
    writer.remove("chain", "ch1");
    expect(useCollectionsStore.getState().requests).toEqual([]);
    expect(useCollectionsStore.getState().folders).toEqual([]);
    expect(useCollectionsStore.getState().collections).toEqual([]);
    expect(useEnvironmentsStore.getState().environments).toEqual([]);
    expect(useChainStore.getState().chains.ch1).toBeUndefined();
  });

  it("opens, reuses, activates and closes request tabs", () => {
    useTabsStore.setState({ tabs: [], activeTabId: null } as never);
    const saved = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
      removeItem: (key: string) => void saved.delete(key),
    });
    const writer = createZustandWorkspaceWriter();
    const tabId = writer.openRequest(request("r1") as never);
    expect(writer.openRequest(request("r1") as never)).toBe(tabId);
    expect(writer.tabs()).toEqual([{ tabId, requestId: "r1" }]);
    writer.activateTab(tabId);
    expect(writer.activeTabId()).toBe(tabId);
    writer.setActiveEnvironment(null);
    expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
    writer.closeTab(tabId);
    expect(writer.tabs()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("shares one app-wide change log", () => {
    expect(getRelayChangeLog()).toBe(getRelayChangeLog());
  });
});
