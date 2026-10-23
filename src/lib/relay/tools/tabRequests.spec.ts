import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { RELAY_MESSAGE_LOG_CAP } from "../constants";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { TAB_REQUEST_API_KEY, TAB_REQUEST_AUTH_TOKEN } from "../redact.corpus";
import { createFakeStoreAccess } from "../storeAccess";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { createRegistry, executeTool } from "./registry";
import { tabRequestTools } from "./tabRequests";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const registry = createRegistry(tabRequestTools);
const fake = createFakeWriteContext();
const store = createFakeStoreAccess().access;

const run = (name: string, input: unknown) =>
  executeTool(registry, name, input, {
    store,
    redact: DEFAULT_REDACT_CONTEXT,
    write: fake.write,
  });

const tabs = () => useTabsStore.getState().tabs;
const noAuth = { type: "none", token: null, username: null, password: null, keyName: null, keyValue: null, addTo: null };

const graphql = (over: Record<string, unknown> = {}) => ({
  name: "  Users  ",
  url: " https://api.test/graphql ",
  query: "{ users { id } }",
  variables: null,
  operationName: null,
  headers: null,
  auth: null,
  ...over,
});

const update = (tabId: string, kind: string, over: Record<string, unknown> = {}) => ({
  tabId,
  kind,
  name: null,
  url: null,
  headers: null,
  query: null,
  variables: null,
  operationName: null,
  auth: null,
  draft: null,
  eventName: null,
  ...over,
});

const idOf = (out: unknown) => (out as { data: { tabId: string } }).data.tabId;
const errorOf = (out: unknown) => (out as { error: string }).error;

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: null });
});

describe("create_graphql_request", () => {
  it("[success] opens a trimmed graphql tab with defaults and reports its tabId", async () => {
    const out = await run("create_graphql_request", graphql());
    expect(out).toMatchObject({ ok: true });
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toMatchObject({
      type: "graphql",
      name: "Users",
      url: "https://api.test/graphql",
      variables: "{}",
      operationName: "",
      auth: { type: "none" },
      headers: [],
    });
    expect(idOf(out)).toBe(tabs()[0].tabId);
  });

  it("keeps headers, variables and operationName, and maps bearer auth", async () => {
    await run(
      "create_graphql_request",
      graphql({
        variables: ' {"first":5} ',
        operationName: "Users",
        headers: [{ key: "X-Trace", value: "abc", enabled: true }],
        auth: { ...noAuth, type: "bearer", token: "{{TOKEN}}" },
      }),
    );
    expect(tabs()[0]).toMatchObject({
      variables: '{"first":5}',
      operationName: "Users",
      headers: [{ key: "X-Trace", value: "abc", enabled: true }],
      auth: { type: "bearer", token: "{{TOKEN}}" },
    });
  });

  it("[invalid] refuses a literal secret in the auth and opens nothing", async () => {
    const out = await run(
      "create_graphql_request",
      graphql({ auth: { ...noAuth, type: "bearer", token: TAB_REQUEST_AUTH_TOKEN } }),
    );
    expect(out).toMatchObject({ ok: false });
    expect(errorOf(out)).toContain("literal secret");
    expect(tabs()).toHaveLength(0);
  });

  it("refuses a control character in the url", async () => {
    const out = await run("create_graphql_request", graphql({ url: "https://a.test/\nx" }));
    expect(out).toMatchObject({ ok: false });
    expect(tabs()).toHaveLength(0);
  });

  it("[success][undo] undo removes the opened tab", async () => {
    const out = await run("create_graphql_request", graphql());
    const { changeId } = (out as { data: { changeId: string } }).data;
    expect(await fake.log.undo(changeId)).toMatchObject({ ok: true });
    expect(tabs()).toHaveLength(0);
  });
});

describe("create_websocket_request and create_socketio_request", () => {
  it("[success] opens a websocket tab with an empty draft by default", async () => {
    await run("create_websocket_request", { name: "Live", url: "wss://api.test/ws", headers: null, draft: null });
    expect(tabs()[0]).toMatchObject({ type: "websocket", url: "wss://api.test/ws", draft: "", headers: [] });
  });

  it("[success] opens a socket.io tab with the given event name and draft", async () => {
    await run("create_socketio_request", {
      name: "Chat",
      url: "https://api.test",
      headers: [{ key: "X-Room", value: "1", enabled: false }],
      draft: '{"a":1}',
      eventName: "ping",
    });
    expect(tabs()[0]).toMatchObject({
      type: "socketio",
      eventName: "ping",
      draft: '{"a":1}',
      headers: [{ key: "X-Room", value: "1", enabled: false }],
    });
  });

  it("[invalid] refuses a literal secret header on socket.io", async () => {
    const out = await run("create_socketio_request", {
      name: "Chat",
      url: "https://api.test",
      headers: [{ key: "X-Api-Key", value: TAB_REQUEST_API_KEY, enabled: true }],
      draft: null,
      eventName: null,
    });
    expect(out).toMatchObject({ ok: false });
    expect(tabs()).toHaveLength(0);
  });

  it("[invalid] refuses a non-ws url on websocket create", async () => {
    const out = await run("create_websocket_request", {
      name: "W",
      url: "https://api.test/not-ws",
      headers: null,
      draft: null,
    });
    expect(out).toMatchObject({ ok: false });
    expect(tabs()).toHaveLength(0);
  });

  it("[success][undo] undo removes the opened websocket tab", async () => {
    const out = await run("create_websocket_request", {
      name: "W",
      url: "wss://api.test/ws",
      headers: null,
      draft: null,
    });
    const { changeId } = (out as { data: { changeId: string } }).data;
    expect(await fake.log.undo(changeId)).toMatchObject({ ok: true });
    expect(tabs()).toHaveLength(0);
  });

  it("[success][undo] undo removes the opened socket.io tab", async () => {
    const out = await run("create_socketio_request", {
      name: "Chat",
      url: "https://api.test",
      headers: null,
      draft: null,
      eventName: null,
    });
    const { changeId } = (out as { data: { changeId: string } }).data;
    expect(await fake.log.undo(changeId)).toMatchObject({ ok: true });
    expect(tabs()).toHaveLength(0);
  });
});

describe("update_tab_request", () => {
  const openGraphql = async () => idOf(await run("create_graphql_request", graphql()));

  it("[success][undo] changes every supplied graphql field and undo restores the old ones", async () => {
    const tabId = await openGraphql();
    const out = await run(
      "update_tab_request",
      update(tabId, "graphql", {
        name: " Renamed ",
        url: "https://api.test/v2",
        headers: [{ key: "X-A", value: "1", enabled: true }],
        query: "{ me { id } }",
        variables: '{"a":2}',
        operationName: "Me",
        auth: { ...noAuth, type: "bearer", token: "{{T}}" },
      }),
    );
    expect(tabs()[0]).toMatchObject({
      name: "Renamed",
      url: "https://api.test/v2",
      headers: [{ key: "X-A", value: "1", enabled: true }],
      query: "{ me { id } }",
      variables: '{"a":2}',
      operationName: "Me",
      auth: { type: "bearer", token: "{{T}}" },
    });
    const { changeId } = (out as { data: { changeId: string } }).data;
    expect(await fake.log.undo(changeId)).toMatchObject({ ok: true });
    expect(tabs()[0]).toMatchObject({ name: "Users", url: "https://api.test/graphql", query: "{ users { id } }" });
  });

  it("[invalid] fails when nothing is supplied", async () => {
    const tabId = await openGraphql();
    const out = await run("update_tab_request", update(tabId, "graphql"));
    expect(out).toMatchObject({ ok: false });
    expect(errorOf(out)).toContain("nothing to change");
  });

  it("fails for an unknown tab", async () => {
    const out = await run("update_tab_request", update("gone", "graphql", { name: "x" }));
    expect(errorOf(out)).toContain("tab not found");
  });

  it("points an HTTP tab to update_request", async () => {
    useTabsStore.getState().openTab({ type: "http" });
    const out = await run("update_tab_request", update(tabs()[0].tabId, "graphql", { name: "x" }));
    expect(errorOf(out)).toContain("update_request");
  });

  it("fails when the kind does not match the tab", async () => {
    const tabId = await openGraphql();
    const out = await run("update_tab_request", update(tabId, "websocket", { draft: "x" }));
    expect(errorOf(out)).toContain("is a graphql tab, not websocket");
  });

  it("rejects an empty name and leaves the tab unchanged", async () => {
    const tabId = await openGraphql();
    const before = tabs()[0];
    const out = await run("update_tab_request", update(tabId, "graphql", { name: "   " }));
    expect(errorOf(out)).toContain("name must not be empty");
    expect(tabs()[0]).toBe(before);
  });

  it("rejects a literal secret auth and leaves the tab unchanged", async () => {
    const tabId = await openGraphql();
    const before = tabs()[0];
    const out = await run(
      "update_tab_request",
      update(tabId, "graphql", { auth: { ...noAuth, type: "bearer", token: TAB_REQUEST_AUTH_TOKEN } }),
    );
    expect(out).toMatchObject({ ok: false });
    expect(tabs()[0]).toBe(before);
  });

  it("rejects a non-ws url on a websocket tab", async () => {
    const tabId = idOf(await run("create_websocket_request", { name: "W", url: "wss://a.test", headers: null, draft: null }));
    const out = await run("update_tab_request", update(tabId, "websocket", { url: "ftp://a.test" }));
    expect(out).toMatchObject({ ok: false });
    expect(tabs()[0]).toMatchObject({ url: "wss://a.test" });
  });
});

describe("get_tab_request", () => {
  it("[success] returns a graphql tab with secrets redacted", async () => {
    const created = await run(
      "create_graphql_request",
      graphql({
        query: `{ a(token: "${TAB_REQUEST_AUTH_TOKEN}") }`,
        headers: [{ key: "X-Trace", value: "abc", enabled: true }],
        auth: { ...noAuth, type: "bearer", token: "{{TOKEN}}" },
        operationName: "A",
      }),
    );
    useTabsStore.getState().updateTabState(idOf(created), {
      auth: { type: "bearer", token: TAB_REQUEST_AUTH_TOKEN },
      variables: `{"apiKey":"${TAB_REQUEST_API_KEY}"}`,
    });
    const out = await run("get_tab_request", { tabId: idOf(created) });
    expect(out).toMatchObject({ ok: true, data: { kind: "graphql", name: "Users", operationName: "A" } });
    const text = JSON.stringify(out);
    expect(text).not.toContain(TAB_REQUEST_AUTH_TOKEN);
    expect(text).not.toContain(TAB_REQUEST_API_KEY);
  });

  it("returns a socket.io tab with its event name and default event when absent", async () => {
    const created = await run("create_socketio_request", { name: "C", url: "https://a.test", headers: null, draft: "x", eventName: "ping" });
    const tabId = idOf(created);
    const first = await run("get_tab_request", { tabId });
    expect(first).toMatchObject({ ok: true, data: { kind: "socketio", eventName: "ping", draft: "x", totalMessages: 0, untrusted: true } });
    useTabsStore.getState().updateTabState(tabId, { eventName: undefined, draft: undefined });
    const second = await run("get_tab_request", { tabId });
    expect(second).toMatchObject({ data: { eventName: "message", draft: "" } });
  });

  it("omits eventName for websocket and caps the log at the most recent messages", async () => {
    const created = await run("create_websocket_request", { name: "W", url: "wss://a.test", headers: null, draft: null });
    const tabId = idOf(created);
    const messageLog = Array.from({ length: RELAY_MESSAGE_LOG_CAP + 3 }, (_, i) => ({
      id: `m${i}`,
      direction: i % 2 ? ("sent" as const) : ("received" as const),
      data: `msg ${i}`,
      timestamp: i,
    }));
    useTabsStore.getState().updateTabState(tabId, { messageLog });
    const out = (await run("get_tab_request", { tabId })) as {
      data: { messages: { data: string; timestamp: number; direction: string }[]; totalMessages: number; eventName?: string };
    };
    expect(out.data.eventName).toBeUndefined();
    expect(out.data.totalMessages).toBe(23);
    expect(out.data.messages).toHaveLength(RELAY_MESSAGE_LOG_CAP);
    expect(out.data.messages[0]).toEqual({ direction: "sent", data: "msg 3", timestamp: 3 });
    expect(out.data.messages[RELAY_MESSAGE_LOG_CAP - 1].data).toBe("msg 22");
  });

  it("[invalid] fails for a missing tab and for an HTTP tab", async () => {
    expect(errorOf(await run("get_tab_request", { tabId: "gone" }))).toContain("tab not found");
    useTabsStore.getState().openTab({ type: "http" });
    expect(errorOf(await run("get_tab_request", { tabId: tabs()[0].tabId }))).toContain("get_request");
  });
});
