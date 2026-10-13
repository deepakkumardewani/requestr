import { afterEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type {
  HistoryEntry,
  HttpTab,
  RequestModel,
  ResponseData,
} from "@/types";
import {
  createFakeStoreAccess,
  createZustandStoreAccess,
  hashEntity,
} from "./storeAccess";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const request = (id: string): RequestModel => ({
  id,
  collectionId: "c1",
  name: id,
  method: "GET",
  url: "https://a.test",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 0,
  updatedAt: 0,
});

const response = (status: number): ResponseData => ({
  status,
  statusText: "",
  headers: {},
  body: "",
  duration: 1,
  size: 0,
  url: "https://a.test",
  method: "GET",
  timestamp: 0,
});

const tab = (tabId: string, requestId: string | null): HttpTab => ({
  tabId,
  requestId,
  name: tabId,
  isDirty: false,
  type: "http",
  url: "",
  headers: [],
  method: "GET",
  params: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
});

const historyEntry = (requestId: string, status: number, timestamp: number): HistoryEntry => ({
  id: `h${timestamp}`,
  method: "GET",
  url: "",
  status,
  duration: 1,
  size: 0,
  timestamp,
  request: tab("t", requestId),
  response: response(status),
});

describe("hashEntity", () => {
  it("is stable for equal data regardless of key order", () => {
    expect(hashEntity({ a: 1, b: { c: [1, 2], d: "x" } })).toBe(
      hashEntity({ b: { d: "x", c: [1, 2] }, a: 1 }),
    );
  });

  it("changes when the data changes and ignores undefined fields", () => {
    expect(hashEntity({ a: 1 })).not.toBe(hashEntity({ a: 2 }));
    expect(hashEntity({ a: 1, b: undefined })).toBe(hashEntity({ a: 1 }));
    expect(hashEntity(undefined)).toBe(hashEntity(undefined));
  });

  it("returns fixed-width hex", () => {
    expect(hashEntity("x")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("fake store access", () => {
  it("runs without Zustand and reflects mutations live in exists()", () => {
    const { access, state } = createFakeStoreAccess({ requests: [request("r1")] });
    expect(access.exists("request", "r1")).toBe(true);
    expect(access.exists("request", "nope")).toBe(false);
    expect(access.exists("collection", "r1")).toBe(false);
    state.requests = [];
    expect(access.exists("request", "r1")).toBe(false);
  });

  it("checks every entity kind", () => {
    const { access } = createFakeStoreAccess({
      collections: [{ id: "c", name: "C", createdAt: 0, updatedAt: 0 }],
      folders: [{ id: "f", collectionId: "c", name: "F", parentFolderId: null, order: 0 }],
      environments: [{ id: "e", name: "E", variables: [], createdAt: 0, updatedAt: 0 }],
    });
    expect(access.exists("collection", "c")).toBe(true);
    expect(access.exists("folder", "f")).toBe(true);
    expect(access.exists("environment", "e")).toBe(true);
    expect(access.exists("chain", "x")).toBe(false);
  });

  it("finds the active tab", () => {
    const { access } = createFakeStoreAccess({
      tabs: [tab("t1", "r1"), tab("t2", "r2")],
      activeTabId: "t2",
    });
    expect(access.activeTab()?.tabId).toBe("t2");
    expect(createFakeStoreAccess().access.activeTab()).toBeNull();
  });

  it("prefers the active tab's response, then any tab, then history", () => {
    const { access, state } = createFakeStoreAccess({
      tabs: [tab("t1", "r1"), tab("t2", "r1")],
      activeTabId: "t2",
      responses: { t1: response(200), t2: response(401) },
    });
    expect(access.lastResponseFor("r1")?.status).toBe(401);
    state.responses = { t1: response(200), t2: null };
    expect(access.lastResponseFor("r1")?.status).toBe(200);
    state.responses = {};
    state.history = [historyEntry("r1", 500, 1), historyEntry("r1", 404, 9)];
    expect(access.lastResponseFor("r1")?.status).toBe(404);
    expect(access.lastResponseFor("other")).toBeNull();
  });

  it("exposes chain data and active environment", () => {
    const { access } = createFakeStoreAccess({
      activeEnvironmentId: "e1",
      chainRunState: { ch: {} },
    });
    expect(access.activeEnvironmentId()).toBe("e1");
    expect(access.chainRunState("ch")).toEqual({});
    expect(access.chainRunState("zz")).toBeUndefined();
    expect(access.chains()).toEqual([]);
    expect(access.hash({ a: 1 })).toBe(hashEntity({ a: 1 }));
  });
});

describe("zustand store access", () => {
  afterEach(() => {
    useCollectionsStore.setState({ collections: [], folders: [], requests: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useTabsStore.setState({ tabs: [], activeTabId: null });
    useResponseStore.setState({ responses: {} });
    useHistoryStore.setState({ entries: [] });
  });

  it("reflects live store state", () => {
    const access = createZustandStoreAccess();
    expect(access.exists("request", "r9")).toBe(false);
    useCollectionsStore.setState({ requests: [request("r9")] });
    expect(access.exists("request", "r9")).toBe(true);
    expect(access.requests()).toHaveLength(1);
  });

  it("reads environments, tabs, responses and history", () => {
    const access = createZustandStoreAccess();
    useEnvironmentsStore.setState({
      environments: [{ id: "e", name: "E", variables: [], createdAt: 0, updatedAt: 0 }],
      activeEnvId: "e",
    });
    useTabsStore.setState({ tabs: [tab("t1", "r1")], activeTabId: "t1" });
    useResponseStore.setState({ responses: { t1: response(401) } });
    expect(access.activeEnvironmentId()).toBe("e");
    expect(access.environments()).toHaveLength(1);
    expect(access.activeTab()?.tabId).toBe("t1");
    expect(access.lastResponseFor("r1")?.status).toBe(401);
    useResponseStore.setState({ responses: {} });
    useHistoryStore.setState({ entries: [historyEntry("r1", 418, 5)] });
    expect(access.lastResponseFor("r1")?.status).toBe(418);
    expect(access.chains()).toEqual([]);
    expect(access.chainRunState("none")).toBeUndefined();
  });
});
