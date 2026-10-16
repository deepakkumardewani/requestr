import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { RELAY_MESSAGE_LOG_CAP } from "../constants";
import { DEFAULT_REDACT_CONTEXT, REDACTED } from "../redact";
import { TAB_REQUEST_CORPUS, TAB_REQUEST_AUTH_TOKEN } from "../redact.corpus";
import { createFakeStoreAccess } from "../storeAccess";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { MAX_TOOL_RESULT_CHARS } from "../tokenBudget";
import {
  createRegistry,
  executeTool,
  previewConfirmation,
  relayToolRegistry,
  serializeResult,
  type AnyToolImpl,
} from "./registry";
import { RELAY_TOOL_SCHEMAS } from "./schemas";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { access: store } = createFakeStoreAccess({
  requests: [
    {
      id: "r1",
      collectionId: "c1",
      name: "R",
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
    },
  ],
});
const context = { store, redact: DEFAULT_REDACT_CONTEXT };

describe("executeTool", () => {
  it("rejects unknown tools without throwing", async () => {
    expect(await executeTool(relayToolRegistry, "nope", {}, context)).toEqual({
      ok: false,
      error: "unknown tool: nope",
    });
  });

  it("reports invalid input", async () => {
    const out = await executeTool(relayToolRegistry, "get_request", {}, context);
    expect(out).toMatchObject({ ok: false });
    expect((out as { error: string }).error).toContain("invalid input");
  });

  it("rechecks ids against live state", async () => {
    const out = await executeTool(relayToolRegistry, "get_request", { requestId: "gone" }, context);
    expect(out).toEqual({ ok: false, error: "request not found: gone" });
  });

  it("runs a valid tool", async () => {
    const out = await executeTool(relayToolRegistry, "get_request", { requestId: "r1" }, context);
    expect(out.ok).toBe(true);
  });

  it("turns a thrown run into a failure outcome", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom: AnyToolImpl = {
      name: "get_workspace_summary",
      run: () => {
        throw new Error("kaboom");
      },
    };
    const out = await executeTool(createRegistry([boom]), "get_workspace_summary", {}, context);
    expect(out).toEqual({ ok: false, error: "the tool failed unexpectedly" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reports a known tool that is not registered as unknown", async () => {
    const out = await executeTool(createRegistry([]), "get_request", { requestId: "r1" }, context);
    expect(out).toMatchObject({ ok: false });
  });
});

describe("serializeResult", () => {
  it("redacts secrets in the data", () => {
    const out = serializeResult(
      { ok: true, data: { password: "hunter2-long", note: "Bearer abcdef123456" } },
      DEFAULT_REDACT_CONTEXT,
    );
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(JSON.stringify(out)).not.toContain("abcdef123456");
    expect(JSON.stringify(out)).toContain(REDACTED);
  });

  it("caps oversized results", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`k${i}`, "v".repeat(300)]),
    );
    const out = serializeResult({ ok: true, data: wide }, DEFAULT_REDACT_CONTEXT);
    expect(out).toMatchObject({ truncated: true });
    expect((out as unknown as { preview: string }).preview.length).toBeLessThanOrEqual(
      MAX_TOOL_RESULT_CHARS + 3,
    );
  });
});

describe("relayToolRegistry", () => {
  it("registers every schema exactly once with its schema and kind", () => {
    const schemaNames = Object.keys(RELAY_TOOL_SCHEMAS).sort();
    expect([...relayToolRegistry.keys()].sort()).toEqual(schemaNames);
    for (const [name, tool] of relayToolRegistry) {
      const definition = RELAY_TOOL_SCHEMAS[name as keyof typeof RELAY_TOOL_SCHEMAS];
      expect(tool.schema).toBe(definition.inputSchema);
      expect(tool.kind).toBe(definition.kind);
    }
  });

  it("fails a write tool cleanly when no write context is available", async () => {
    const out = await executeTool(
      relayToolRegistry,
      "set_active_environment",
      { environmentId: "e1" },
      context,
    );
    expect(out.ok).toBe(false);
  });

  it("gives every registered tool a kind, including the tab and bulk-delete tools", () => {
    const kinds = ["read", "auto", "confirm", "ui"];
    for (const tool of relayToolRegistry.values()) {
      expect(kinds).toContain(tool.kind);
    }
    expect(relayToolRegistry.get("close_tab")?.kind).toBe("auto");
    expect(relayToolRegistry.get("close_all_tabs")?.kind).toBe("auto");
    expect(relayToolRegistry.get("delete_requests")?.kind).toBe("confirm");
    expect(relayToolRegistry.get("delete_requests_in_collection")?.kind).toBe("confirm");
  });

  it("redacts secrets in the result of a tab tool", async () => {
    const out = await executeTool(
      relayToolRegistry,
      "close_tab",
      { tabId: "Bearer sk-live-abcdefghijklmnopqrstuvwxyz0123456789" },
      context,
    );
    expect(out).toMatchObject({ ok: false });
    expect(JSON.stringify(out)).not.toContain("abcdefghijklmnopqrstuvwxyz0123456789");
  });

  it("gives no confirmation card for a tool name it does not know", () => {
    expect(previewConfirmation(relayToolRegistry, "nope", {}, store)).toBeNull();
  });
});

describe("tab-only request tools", () => {
  const fake = createFakeWriteContext();
  const run = (name: string, input: unknown) =>
    executeTool(relayToolRegistry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
  const tabs = () => useTabsStore.getState().tabs;

  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  it("declares each tool with the right kind", () => {
    for (const name of ["create_graphql_request", "create_websocket_request", "create_socketio_request", "update_tab_request"]) {
      expect(relayToolRegistry.get(name)?.kind).toBe("auto");
    }
    expect(relayToolRegistry.get("get_tab_request")?.kind).toBe("read");
  });

  it("[success][undo] opens a GraphQL tab with query, variables and operation name, and undo closes it", async () => {
    const out = await run("create_graphql_request", {
      name: "Users",
      url: "https://api.test/graphql",
      query: "query Users { users { id } }",
      variables: '{"first":5}',
      operationName: "Users",
      headers: null,
      auth: null,
    });
    expect(out).toMatchObject({ ok: true });
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toMatchObject({ type: "graphql", query: "query Users { users { id } }", variables: '{"first":5}', operationName: "Users" });
    const { changeId } = (out as { data: { changeId: string } }).data;
    expect(await fake.log.undo(changeId)).toMatchObject({ ok: true });
    expect(tabs()).toHaveLength(0);
  });

  it("[success][undo] opens WebSocket and Socket.IO tabs with their draft and never connects", async () => {
    const ws = await run("create_websocket_request", { name: "Live", url: "wss://api.test/ws", headers: null, draft: "hello" });
    const sio = await run("create_socketio_request", { name: "Chat", url: "https://api.test", headers: null, draft: "{}", eventName: null });
    expect(tabs()[0]).toMatchObject({ type: "websocket", draft: "hello", messageLog: [] });
    expect(tabs()[1]).toMatchObject({ type: "socketio", eventName: "message", draft: "{}" });
    for (const out of [ws, sio]) {
      const { changeId } = (out as { data: { changeId: string } }).data;
      expect(await fake.log.undo(changeId)).toMatchObject({ ok: true });
    }
    expect(tabs()).toHaveLength(0);
  });

  it("[invalid] rejects bad variables JSON and non-ws urls before opening anything", async () => {
    const graphql = await run("create_graphql_request", {
      name: "G", url: "https://api.test", query: "{ a }", variables: "{oops", operationName: null, headers: null, auth: null,
    });
    const socket = await run("create_websocket_request", { name: "W", url: "https://api.test", headers: null, draft: null });
    expect(graphql).toMatchObject({ ok: false });
    expect((graphql as { error: string }).error).toContain("variables");
    expect((socket as { error: string }).error).toContain("ws://");
    const sio = await run("create_socketio_request", { name: "S", url: "ftp://api.test", headers: null, draft: null, eventName: null });
    expect(sio).toMatchObject({ ok: false });
    expect(tabs()).toHaveLength(0);
  });

  it("[invalid] refuses literal secrets in headers", async () => {
    const out = await run("create_websocket_request", {
      name: "W", url: "wss://api.test",
      headers: [{ key: "Authorization", value: `Bearer ${TAB_REQUEST_AUTH_TOKEN}`, enabled: true }],
      draft: null,
    });
    expect(out).toMatchObject({ ok: false });
    expect(tabs()).toHaveLength(0);
  });

  it("[success][undo] changes only the given fields and undo restores them", async () => {
    const created = await run("create_socketio_request", { name: "Chat", url: "https://api.test", headers: null, draft: "a", eventName: "ping" });
    const tabId = (created as { data: { tabId: string } }).data.tabId;
    const patch = { tabId, kind: "socketio", name: null, url: null, headers: null, query: null, variables: null, operationName: null, auth: null, draft: "b", eventName: null };
    const out = await run("update_tab_request", patch);
    expect(tabs()[0]).toMatchObject({ draft: "b", eventName: "ping", url: "https://api.test" });
    expect(await fake.log.undo((out as { data: { changeId: string } }).data.changeId)).toMatchObject({ ok: true });
    expect(tabs()[0]).toMatchObject({ draft: "a", eventName: "ping" });
  });

  it("[invalid] leaves the tab unchanged when update_tab_request gets invalid variables", async () => {
    await run("create_graphql_request", { name: "G", url: "https://api.test", query: "{ a }", variables: null, operationName: null, headers: null, auth: null });
    const before = tabs()[0];
    const out = await run("update_tab_request", {
      tabId: before.tabId, kind: "graphql", name: null, url: null, headers: null, query: null, variables: "not json", operationName: null, auth: null, draft: null, eventName: null,
    });
    expect(out).toMatchObject({ ok: false });
    expect(tabs()[0]).toBe(before);
  });

  it("[success] returns redacted tab data with at most the last messages of the log", async () => {
    const created = await run("create_websocket_request", { name: "Live", url: "wss://api.test", headers: null, draft: null });
    const tabId = (created as { data: { tabId: string } }).data.tabId;
    const messageLog = Array.from({ length: RELAY_MESSAGE_LOG_CAP + 5 }, (_, i) => ({
      id: `m${i}`, direction: "received" as const, data: i === RELAY_MESSAGE_LOG_CAP + 4 ? TAB_REQUEST_CORPUS[2].secret : `msg ${i}`, timestamp: i,
    }));
    useTabsStore.getState().updateTabState(tabId, { messageLog });
    const out = await run("get_tab_request", { tabId });
    const data = (out as { data: { messages: unknown[]; totalMessages: number } }).data;
    expect(data.messages).toHaveLength(RELAY_MESSAGE_LOG_CAP);
    expect(data.totalMessages).toBe(RELAY_MESSAGE_LOG_CAP + 5);
    expect(JSON.stringify(out)).not.toContain(TAB_REQUEST_CORPUS[2].secret);
  });

  it("[invalid] fails clearly for a missing tab and for an HTTP tab", async () => {
    expect(await run("get_tab_request", { tabId: "gone" })).toMatchObject({ ok: false });
    useTabsStore.getState().openTab({ type: "http" });
    const httpId = tabs()[0].tabId;
    expect(await run("get_tab_request", { tabId: httpId })).toMatchObject({ ok: false });
  });
});
