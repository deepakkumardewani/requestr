import { beforeEach, describe, it, expect, vi } from "vitest";
import { useFolderExpandStore } from "@/stores/useFolderExpandStore";
import { useSettingsSectionStore } from "@/stores/useSettingsSectionStore";
import {
  createdTarget,
  openEntity,
  type OpenEntityDeps,
  pushRoute,
  routeForTarget,
} from "./openEntity";
import { createFakeStoreAccess } from "./storeAccess";
import {
  createRequest,
  createCollection,
  createEnvironment,
  createChain,
} from "./testing/entityTestData";

describe("openEntity", () => {
  it("opens a request and commits the change", async () => {
    const commit = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "My Request")],
    });

    const result = await openEntity("request", "req1", {
      store: access,
      writer: undefined,
      commit,
    });

    expect(result).toEqual({ ok: true });
    expect(commit).toHaveBeenCalledOnce();
    const spec = commit.mock.calls[0][0];
    expect(spec.entity).toBe("tab");
    expect(spec.entityId).toBe("req1");
  });

  it("records the request name in the change summary", async () => {
    const commit = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Test API Endpoint")],
    });

    await openEntity("request", "req1", {
      store: access,
      writer: undefined,
      commit,
    });

    const spec = commit.mock.calls[0][0];
    expect(spec.summary).toBe('Opened "Test API Endpoint"');
  });

  it("returns error when opening unknown request", async () => {
    const commit = vi.fn();
    const { access } = createFakeStoreAccess();

    const result = await openEntity("request", "unknown", {
      store: access,
      writer: undefined,
      commit,
    });

    expect(result).toEqual({
      ok: false,
      error: "request not found: unknown",
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("navigates to collection route without commit", async () => {
    const commit = vi.fn();
    const { access } = createFakeStoreAccess({
      collections: [createCollection("col1", "My Collection")],
    });

    const result = await openEntity("collection", "col1", {
      store: access,
      writer: undefined,
      commit,
    });

    expect(result).toEqual({
      ok: true,
      data: { href: "/app" },
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("navigates to environment route", async () => {
    const commit = vi.fn();
    const { access } = createFakeStoreAccess({
      environments: [createEnvironment("env1", "Production")],
    });

    const result = await openEntity("environment", "env1", {
      store: access,
      writer: undefined,
      commit,
    });

    expect(result).toEqual({
      ok: true,
      data: { href: "/environments" },
    });
  });

  it("navigates to chain route with id", async () => {
    const commit = vi.fn();
    const { access } = createFakeStoreAccess({
      chains: [createChain("ch1", "My Chain")],
    });

    const result = await openEntity("chain", "ch1", {
      store: access,
      writer: undefined,
      commit,
    });

    expect(result).toEqual({
      ok: true,
      data: { href: "/chain/ch1" },
    });
  });

  it("returns error when collection does not exist", async () => {
    const { access } = createFakeStoreAccess();

    const result = await openEntity("collection", "unknown", {
      store: access,
      writer: undefined,
      commit: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      error: "collection not found: unknown",
    });
  });

  it("returns error when environment does not exist", async () => {
    const { access } = createFakeStoreAccess();

    const result = await openEntity("environment", "unknown", {
      store: access,
      writer: undefined,
      commit: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      error: "environment not found: unknown",
    });
  });

  it("returns error when chain does not exist", async () => {
    const { access } = createFakeStoreAccess();

    const result = await openEntity("chain", "unknown", {
      store: access,
      writer: undefined,
      commit: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      error: "chain not found: unknown",
    });
  });

  it("sets openedForRequestId when tab not already open", async () => {
    const commit = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "New Request")],
    });

    await openEntity("request", "req1", {
      store: access,
      writer: undefined,
      commit,
    });

    const spec = commit.mock.calls[0][0];
    expect(spec.before.openedForRequestId).toBe("req1");
  });

  it("sets openedForRequestId to null when tab already exists", async () => {
    const openRequest = vi.fn();
    const writer = {
      tabs: () => [{ requestId: "req1", tabId: "tab1" }],
      activeTabId: () => "tab1",
      openRequest,
      put: vi.fn(),
      remove: vi.fn(),
      setActiveEnvironment: vi.fn(),
      closeTab: vi.fn(),
      activateTab: vi.fn(),
    };

    const commit = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Existing Request")],
    });

    await openEntity("request", "req1", {
      store: access,
      writer,
      commit,
    });

    const spec = commit.mock.calls[0][0];
    expect(spec.before.openedForRequestId).toBeNull();
  });

  it("captures activeTabId before change", async () => {
    const openRequest = vi.fn();
    const writer = {
      tabs: () => [],
      activeTabId: () => "active_tab_123",
      openRequest,
      put: vi.fn(),
      remove: vi.fn(),
      setActiveEnvironment: vi.fn(),
      closeTab: vi.fn(),
      activateTab: vi.fn(),
    };

    const commit = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Request")],
    });

    await openEntity("request", "req1", {
      store: access,
      writer,
      commit,
    });

    const spec = commit.mock.calls[0][0];
    expect(spec.before.activateTabId).toBe("active_tab_123");
  });

  it("sets activateTabId to null when no active tab", async () => {
    const commit = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Request")],
    });

    await openEntity("request", "req1", {
      store: access,
      writer: undefined,
      commit,
    });

    const spec = commit.mock.calls[0][0];
    expect(spec.before.activateTabId).toBeNull();
  });

  it("calls mutate function with writer.openRequest", async () => {
    const openRequest = vi.fn().mockReturnValue("new_tab_id");
    const writer = {
      tabs: () => [],
      activeTabId: () => null,
      openRequest,
      put: vi.fn(),
      remove: vi.fn(),
      setActiveEnvironment: vi.fn(),
      closeTab: vi.fn(),
      activateTab: vi.fn(),
    };

    const commit = vi.fn().mockImplementation(async (spec) => {
      spec.mutate();
      return { ok: true };
    });

    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Request")],
    });

    await openEntity("request", "req1", {
      store: access,
      writer,
      commit,
    });

    expect(openRequest).toHaveBeenCalledOnce();
    expect(openRequest.mock.calls[0][0].id).toBe("req1");
  });

  it("propagates commit failure", async () => {
    const commitError = new Error("Database write failed");
    const commit = vi.fn().mockRejectedValue(commitError);
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Request")],
    });

    await expect(
      openEntity("request", "req1", {
        store: access,
        writer: undefined,
        commit,
      })
    ).rejects.toThrow("Database write failed");
  });

  it("handles request without method", async () => {
    const commit = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "No Method Request")],
    });

    const result = await openEntity("request", "req1", {
      store: access,
      writer: undefined,
      commit,
    });

    expect(result.ok).toBe(true);
    const spec = commit.mock.calls[0][0];
    expect(spec.summary).toBe('Opened "No Method Request"');
  });

  it("differentiates between tab already open and first open", async () => {
    const openRequest1 = vi.fn();
    const openRequest2 = vi.fn();
    const writer1 = {
      tabs: () => [],
      activeTabId: () => null,
      openRequest: openRequest1,
      put: vi.fn(),
      remove: vi.fn(),
      setActiveEnvironment: vi.fn(),
      closeTab: vi.fn(),
      activateTab: vi.fn(),
    };
    const writer2 = {
      tabs: () => [{ requestId: "req1", tabId: "tab1" }],
      activeTabId: () => "tab1",
      openRequest: openRequest2,
      put: vi.fn(),
      remove: vi.fn(),
      setActiveEnvironment: vi.fn(),
      closeTab: vi.fn(),
      activateTab: vi.fn(),
    };

    const commit1 = vi.fn().mockResolvedValue({ ok: true });
    const commit2 = vi.fn().mockResolvedValue({ ok: true });
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Request")],
    });

    await openEntity("request", "req1", {
      store: access,
      writer: writer1,
      commit: commit1,
    });

    await openEntity("request", "req1", {
      store: access,
      writer: writer2,
      commit: commit2,
    });

    const spec1 = commit1.mock.calls[0][0];
    const spec2 = commit2.mock.calls[0][0];

    expect(spec1.before.openedForRequestId).toBe("req1");
    expect(spec2.before.openedForRequestId).toBeNull();
  });
});

describe("routeForTarget", () => {
  it("has no route for a request because it opens as a tab", () => {
    expect(routeForTarget({ kind: "request", id: "r1" })).toBeNull();
  });

  it("routes settings to its section as the hash", () => {
    expect(routeForTarget({ kind: "settings", id: "appearance" })).toBe(
      "/settings#appearance",
    );
  });

  it("routes settings without a section to the bare page", () => {
    expect(routeForTarget({ kind: "settings", id: "" })).toBe("/settings");
  });

  it.each([
    [{ kind: "collection", id: "c1" }, "/app"],
    [{ kind: "environment", id: "e1" }, "/environments"],
    [{ kind: "chain", id: "k1" }, "/chain/k1"],
  ] as const)("routes %o to %s", (target, href) => {
    expect(routeForTarget(target)).toBe(href);
  });
});

describe("pushRoute", () => {
  beforeEach(() => useSettingsSectionStore.getState().clear());

  it("records the settings section before navigating, since Next fires no hashchange on the same page", () => {
    const calls: string[] = [];
    const push = vi.fn((href: string) => {
      calls.push(`${href}|${useSettingsSectionStore.getState().requested}`);
    });
    pushRoute("/settings#proxy", push);
    expect(calls).toEqual(["/settings#proxy|proxy"]);
  });

  it.each(["/settings", "/settings#nonsense", "/environments", "/app#proxy"])(
    "requests no section for %s",
    (href) => {
      const push = vi.fn();
      pushRoute(href, push);
      expect(push).toHaveBeenCalledWith(href);
      expect(useSettingsSectionStore.getState().requested).toBeNull();
    },
  );
});

describe("createdTarget", () => {
  it.each([
    ["create_request", "request"],
    ["create_chain", "chain"],
    ["create_collection", "collection"],
    ["create_environment", "environment"],
  ] as const)("maps %s to a %s target using the first created id", (tool, kind) => {
    expect(createdTarget(tool, { createdIds: ["a", "b"] })).toEqual({
      kind,
      id: "a",
    });
  });

  it("is null for a tool that creates nothing", () => {
    expect(createdTarget("update_request", { createdIds: ["a"] })).toBeNull();
  });

  it.each([null, undefined, {}, { createdIds: [] }, { createdIds: [5] }, { createdIds: "a" }])(
    "is null for unusable data %o",
    (data) => {
      expect(createdTarget("create_request", data)).toBeNull();
    },
  );
});

describe("openEntity folder", () => {
  const folder = (id: string, parentFolderId: string | null) => ({
    id,
    collectionId: "c1",
    name: id,
    parentFolderId,
    order: 0,
  });
  const deps = (folders: ReturnType<typeof folder>[]): OpenEntityDeps => ({
    store: createFakeStoreAccess({ folders }).access,
    writer: undefined,
    commit: vi.fn(),
  });

  beforeEach(() => {
    useFolderExpandStore.setState({
      collapsedFolderIds: ["root", "mid", "leaf", "other"],
      openCollectionIds: [],
    });
  });

  it("opens the collection view and expands the folder and every parent", async () => {
    const out = await openEntity(
      "folder",
      "leaf",
      deps([folder("root", null), folder("mid", "root"), folder("leaf", "mid"), folder("other", null)]),
    );
    expect(out).toEqual({ ok: true, data: { href: "/app" } });
    expect(useFolderExpandStore.getState().collapsedFolderIds).toEqual(["other"]);
    expect(useFolderExpandStore.getState().openCollectionIds).toEqual(["c1"]);
  });

  it("stops at a parent that no longer exists", async () => {
    const out = await openEntity("folder", "leaf", deps([folder("leaf", "ghost")]));
    expect(out.ok).toBe(true);
    expect(useFolderExpandStore.getState().isExpanded("leaf")).toBe(true);
    expect(useFolderExpandStore.getState().isExpanded("root")).toBe(false);
  });

  it("fails for an unknown folder and leaves the tree alone", async () => {
    const out = await openEntity("folder", "nope", deps([folder("root", null)]));
    expect(out).toEqual({ ok: false, error: "folder not found: nope" });
    expect(useFolderExpandStore.getState().collapsedFolderIds).toHaveLength(4);
    expect(useFolderExpandStore.getState().openCollectionIds).toEqual([]);
  });
});
