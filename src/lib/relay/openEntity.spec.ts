import { describe, it, expect, vi } from "vitest";
import { openEntity, type OpenEntityDeps } from "./openEntity";
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
