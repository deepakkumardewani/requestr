// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import {
  WRITE_UNAVAILABLE,
  commitChange,
  createChangeLog,
  createMemoryChangeStorage,
  createZustandWorkspaceWriter,
  getRelayChangeLog,
  isSettingsGroup,
  readSettingsGroup,
  snapshotTabRequest,
  writeSettingsGroup,
  type ChangeLog,
  type ChangeSpec,
  type ChangeStorage,
  type StoredChange,
} from "./changeLog";
import { createFakeStoreAccess, createZustandStoreAccess } from "./storeAccess";
import { createMemoryWorkspaceWriter } from "./testing/changeLogTestKit";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn().mockRejectedValue(new Error("no idb in tests")),
}));
vi.mock("@/lib/hub", () => ({
  announceSlugChange: vi.fn(),
  unmarkSlugImported: vi.fn(),
}));

const origin = { threadId: "t", turnId: "u", toolCallId: "c" };

function liveLog(storage: ChangeStorage = createMemoryChangeStorage()) {
  return createChangeLog({
    store: createZustandStoreAccess(),
    writer: createZustandWorkspaceWriter(),
    storage,
  });
}

describe("settings groups through the change log", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      locale: "en",
      proxyUrl: "",
      sslVerify: true,
      followRedirects: true,
      globalBaseUrl: "",
      globalHeaders: [],
    });
    useRelayStore.setState({ shareValues: false, enabled: true });
  });

  it("recognises only real group ids", () => {
    expect(isSettingsGroup("proxy")).toBe(true);
    expect(isSettingsGroup("toString")).toBe(false);
  });

  it("writes and restores each settings group", () => {
    writeSettingsGroup("language", { locale: "fr" });
    expect(readSettingsGroup("language")).toEqual({ locale: "fr" });

    writeSettingsGroup("proxy", {
      proxyUrl: "http://p:1",
      sslVerify: false,
      followRedirects: false,
    });
    expect(readSettingsGroup("proxy")).toEqual({
      proxyUrl: "http://p:1",
      sslVerify: false,
      followRedirects: false,
    });

    writeSettingsGroup("global", {
      globalBaseUrl: "https://g.test",
      globalHeaders: [],
    });
    expect(readSettingsGroup("global")).toEqual({
      globalBaseUrl: "https://g.test",
      globalHeaders: [],
    });
  });

  it("stores the theme and removes the key when restoring null", () => {
    expect(readSettingsGroup("appearance")).toEqual({ theme: null });
    writeSettingsGroup("appearance", { theme: "dark" });
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(readSettingsGroup("appearance")).toEqual({ theme: "dark" });
    writeSettingsGroup("appearance", { theme: null });
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("undoes a proxy change and refuses an unknown group", async () => {
    const log = liveLog();
    const before = readSettingsGroup("proxy");
    const applied = await log.apply(origin, {
      entity: "settings",
      entityId: "proxy",
      summary: "Set proxy",
      before,
      mutate: () => writeSettingsGroup("proxy", { ...before, proxyUrl: "http://x" }),
    });
    expect(applied.ok).toBe(true);
    const id = (applied as { change: { id: string } }).change.id;
    expect((await log.undo(id)).ok).toBe(true);
    expect(useSettingsStore.getState().proxyUrl).toBe("");
  });

  it("blocks undo with edited when the group changed afterwards", async () => {
    const log = liveLog();
    const before = readSettingsGroup("language");
    const applied = await log.apply(origin, {
      entity: "settings",
      entityId: "language",
      summary: "Set language",
      before,
      mutate: () => writeSettingsGroup("language", { locale: "de" }),
    });
    writeSettingsGroup("language", { locale: "es" });
    const id = (applied as { change: { id: string } }).change.id;
    expect(await log.undo(id)).toEqual({ ok: false, reason: "edited" });
    expect(log.getView(id)?.status).toBe("blocked");
  });

  it("reads a missing settings group as removed", async () => {
    const storage = createMemoryChangeStorage();
    const log = liveLog(storage);
    await storage.put({
      id: "s1",
      threadId: "t",
      turnId: "u",
      toolCallId: "c",
      entity: "settings",
      entityId: "nope",
      status: "applied",
      before: {},
      afterHash: "x",
      summary: "?",
      after: null,
    } as unknown as StoredChange);
    expect(await log.undo("s1")).toEqual({ ok: false, reason: "removed" });
  });
});

describe("tab request adapter", () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  it("snapshots only Relay-editable fields and null for a missing tab", () => {
    expect(snapshotTabRequest(undefined)).toBeNull();
    const tab = {
      tabId: "t1",
      type: "graphql",
      name: "G",
      url: "u",
      headers: [],
      query: "q",
      variables: "{}",
      operationName: "op",
      auth: { type: "none" },
      isDirty: true,
    } as never;
    expect(snapshotTabRequest(tab)).toEqual({
      name: "G",
      url: "u",
      headers: [],
      query: "q",
      variables: "{}",
      operationName: "op",
      auth: { type: "none" },
    });
  });

  it("restores a prior snapshot and closes a tab Relay opened", async () => {
    useTabsStore.getState().openTab({
      type: "websocket",
      name: "WS",
      url: "ws://a",
      headers: [],
      draft: "one",
    } as never);
    const tabId = useTabsStore.getState().tabs[0].tabId;
    const log = liveLog();
    const before = snapshotTabRequest(useTabsStore.getState().tabs[0]);
    const edit = await log.apply(origin, {
      entity: "tabRequest",
      entityId: tabId,
      summary: "Edit ws",
      before,
      mutate: () =>
        useTabsStore.getState().updateTabState(tabId, { url: "ws://b" } as never),
    });
    const editId = (edit as { change: { id: string } }).change.id;
    expect((await log.undo(editId)).ok).toBe(true);
    expect(snapshotTabRequest(useTabsStore.getState().tabs[0])).toMatchObject({
      url: "ws://a",
    });

    const opened = await log.apply(origin, {
      entity: "tabRequest",
      entityId: tabId,
      summary: "Opened",
      before: null,
      mutate: () => undefined,
    });
    const openedId = (opened as { change: { id: string } }).change.id;
    expect((await log.undo(openedId)).ok).toBe(true);
    expect(useTabsStore.getState().tabs).toEqual([]);
  });

  it("does nothing when the tab Relay opened is already gone", async () => {
    const storage = createMemoryChangeStorage();
    const log = liveLog(storage);
    const applied = await log.apply(origin, {
      entity: "tabRequest",
      entityId: "ghost",
      summary: "Opened",
      before: null,
      mutate: () => undefined,
    });
    const id = (applied as { change: { id: string } }).change.id;
    expect((await log.undo(id)).ok).toBe(true);
    expect(useTabsStore.getState().tabs).toEqual([]);
  });
});

describe("log behaviour", () => {
  const request = {
    id: "r1",
    collectionId: "c1",
    folderId: null,
    name: "R",
    method: "GET" as const,
    url: "https://a.test",
    params: [],
    headers: [],
    auth: { type: "none" as const },
    body: { type: "none" as const, content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
  };

  function fakeLog(storage?: ChangeStorage) {
    const fake = createFakeStoreAccess({
      collections: [{ id: "c1", name: "C", createdAt: 1, updatedAt: 1 }],
      requests: [request],
    });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const log: ChangeLog = createChangeLog({
      store: fake.access,
      writer,
      storage: storage ?? createMemoryChangeStorage(),
    });
    return { log, writer, fake };
  }

  it("restores the prior state and reports failure when mutate throws", async () => {
    const { log, writer, fake } = fakeLog();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await log.apply(origin, {
      entity: "request",
      entityId: "r1",
      summary: "Edit",
      before: request,
      mutate: () => {
        writer.put("request", { ...request, url: "https://changed" });
        throw new Error("boom");
      },
    });
    expect(result.ok).toBe(false);
    expect(fake.state.requests[0].url).toBe("https://a.test");
    spy.mockRestore();
  });

  it("survives a rollback that itself fails", async () => {
    const { log } = fakeLog();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bad: ChangeSpec = {
      entity: "tab",
      entityId: "r1",
      summary: "bad",
      before: undefined,
      mutate: () => {
        throw new Error("boom");
      },
    };
    expect((await log.apply(origin, bad)).ok).toBe(false);
    expect(spy).toHaveBeenCalledWith(
      "[relay] rolling back a failed change failed",
      expect.objectContaining({ entity: "tab" }),
    );
    spy.mockRestore();
  });

  it("reports failed when restoring throws during undo", async () => {
    const { log, writer } = fakeLog();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const applied = await log.apply(origin, {
      entity: "request",
      entityId: "r1",
      summary: "Edit",
      before: request,
      mutate: () => writer.put("request", { ...request, url: "https://b.test" }),
    });
    vi.spyOn(writer, "put").mockImplementation(() => {
      throw new Error("disk");
    });
    const id = (applied as { change: { id: string } }).change.id;
    expect(await log.undo(id)).toEqual({ ok: false, reason: "failed" });
    spy.mockRestore();
  });

  it("returns not_found for an unknown id and for an unknown entity", async () => {
    const storage = createMemoryChangeStorage();
    const { log } = fakeLog(storage);
    expect(await log.undo("missing")).toEqual({ ok: false, reason: "not_found" });
    await storage.put({
      id: "x",
      entity: "bogus",
      entityId: "1",
      status: "applied",
    } as unknown as StoredChange);
    expect(await log.undo("x")).toEqual({ ok: false, reason: "not_found" });
  });

  it("keeps working when saving the status fails", async () => {
    const memory = createMemoryChangeStorage();
    let failPuts = false;
    const storage: ChangeStorage = {
      ...memory,
      put: async (record) => {
        if (failPuts) throw new Error("full");
        await memory.put(record);
      },
    };
    const { log, writer } = fakeLog(storage);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const applied = await log.apply(origin, {
      entity: "request",
      entityId: "r1",
      summary: "Edit",
      before: request,
      mutate: () => writer.put("request", { ...request, url: "https://b.test" }),
    });
    failPuts = true;
    const id = (applied as { change: { id: string } }).change.id;
    expect((await log.undo(id)).ok).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("undoes a turn newest first and reports blocked changes", async () => {
    const { log, writer, fake } = fakeLog();
    const edit = (url: string): ChangeSpec => ({
      entity: "request",
      entityId: "r1",
      summary: url,
      before: fake.state.requests[0],
      mutate: () => writer.put("request", { ...fake.state.requests[0], url }),
    });
    const turn = { ...origin, turnId: "turn-A" };
    const first = await log.apply(turn, edit("https://1.test"));
    await log.apply(turn, edit("https://2.test"));
    const result = await log.undoTurn("turn-A");
    expect(result.undone).toHaveLength(2);
    expect(fake.state.requests[0].url).toBe("https://a.test");

    const again = await log.undoTurn("turn-A");
    expect(again).toEqual({ undone: [], blocked: [] });
    expect((first as { ok: boolean }).ok).toBe(true);
  });

  it("loads a stored change and notifies subscribers until they unsubscribe", async () => {
    const storage = createMemoryChangeStorage();
    const { log, writer } = fakeLog(storage);
    const listener = vi.fn();
    const off = log.subscribe(listener);
    const applied = await log.apply(origin, {
      entity: "request",
      entityId: "r1",
      summary: "Edit",
      before: request,
      mutate: () => writer.put("request", { ...request, url: "https://b.test" }),
    });
    expect(listener).toHaveBeenCalled();
    off();
    const calls = listener.mock.calls.length;
    const id = (applied as { change: { id: string } }).change.id;
    await log.undo(id);
    expect(listener).toHaveBeenCalledTimes(calls);

    const fresh = fakeLog(storage).log;
    expect((await fresh.load(id))?.id).toBe(id);
    expect(await fresh.load("none")).toBeNull();
    expect(fresh.getView(id)?.id).toBe(id);
  });
});

describe("default change storage", () => {
  it("falls back to memory for the session when IndexedDB is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fake = createFakeStoreAccess({ requests: [] });
    const writer = createMemoryWorkspaceWriter(fake.state);
    const log = createChangeLog({ store: fake.access, writer });
    const applied = await log.apply(origin, {
      entity: "activeEnvironment",
      entityId: "env",
      summary: "Switch",
      before: null,
      mutate: () => undefined,
    });
    const id = (applied as { change: { id: string } }).change.id;
    expect(warn).toHaveBeenCalledTimes(1);
    expect((await log.undo(id)).ok).toBe(true);
    expect((await log.undoTurn("u")).undone).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("commitChange", () => {
  it("fails without a write context", async () => {
    expect(await commitChange(undefined, {} as ChangeSpec)).toEqual({
      ok: false,
      error: WRITE_UNAVAILABLE,
    });
  });

  it("passes the log failure through", async () => {
    const log = { apply: vi.fn().mockResolvedValue({ ok: false, error: "nope" }) };
    const out = await commitChange(
      { log, origin } as never,
      {} as ChangeSpec,
    );
    expect(out).toEqual({ ok: false, error: "nope" });
  });

  it("returns ids and summary only, plus extra data", async () => {
    const change = {
      id: "i",
      turnId: "u",
      entity: "request",
      entityId: "r1",
      summary: "done",
      before: { secret: 1 },
    };
    const log = { apply: vi.fn().mockResolvedValue({ ok: true, change }) };
    const out = await commitChange(
      { log, origin } as never,
      {} as ChangeSpec,
      { extra: 1 },
    );
    expect(out).toEqual({
      ok: true,
      data: {
        changeId: "i",
        turnId: "u",
        entity: "request",
        entityId: "r1",
        summary: "done",
        extra: 1,
      },
    });
  });
});

describe("production wiring", () => {
  const base = {
    id: "c1",
    name: "Orders",
    createdAt: 1,
    updatedAt: 1,
  };

  beforeEach(() => {
    useCollectionsStore.setState({ collections: [], folders: [], requests: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  });

  it("shares one app-wide log", () => {
    expect(getRelayChangeLog()).toBe(getRelayChangeLog());
  });

  it("puts and removes collections, folders and requests", () => {
    const writer = createZustandWorkspaceWriter();
    writer.put("collection", base);
    writer.put("collection", { ...base, name: "Renamed" });
    expect(useCollectionsStore.getState().collections.map((c) => c.name)).toEqual([
      "Renamed",
    ]);

    const folder = {
      id: "f1",
      collectionId: "c1",
      parentFolderId: null,
      name: "F",
      createdAt: 1,
      updatedAt: 1,
    };
    writer.put("folder", folder);
    expect(useCollectionsStore.getState().folders).toHaveLength(1);

    writer.remove("folder", "f1");
    expect(useCollectionsStore.getState().folders).toHaveLength(0);
    writer.remove("collection", "c1");
    expect(useCollectionsStore.getState().collections).toHaveLength(0);
  });

  it("updates an existing environment instead of importing a duplicate", () => {
    const writer = createZustandWorkspaceWriter();
    const env = { ...base, id: "e1", variables: [] };
    writer.put("environment", env);
    writer.put("environment", { ...env, name: "Prod" });
    const envs = useEnvironmentsStore.getState().environments;
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe("Prod");
  });

  it("activates a tab only when it still exists", () => {
    const writer = createZustandWorkspaceWriter();
    const req = {
      id: "r1",
      collectionId: "c1",
      folderId: null,
      name: "R",
      method: "GET" as const,
      url: "u",
      params: [],
      headers: [],
      auth: { type: "none" as const },
      body: { type: "none" as const, content: "" },
      preScript: "",
      postScript: "",
      createdAt: 1,
      updatedAt: 1,
    };
    useTabsStore.setState({ tabs: [], activeTabId: null });
    const a = writer.openRequest(req);
    const b = writer.openRequest({ ...req, id: "r2" });
    writer.activateTab(a);
    expect(writer.activeTabId()).toBe(a);
    expect(b).not.toBe(a);
  });
});
