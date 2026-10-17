import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { createRegistry, executeTool } from "./registry";
import { smartTools } from "./smart";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const registry = createRegistry(smartTools);

const request = (id: string, over: object = {}) => ({
  id,
  collectionId: "c1",
  folderId: null,
  name: `Req ${id}`,
  method: "GET",
  url: "https://api.test/orders",
  params: [],
  headers: [{ id: "h1", key: "Accept", value: "application/json", enabled: true }],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const response = (over: object = {}) => ({
  status: 200,
  statusText: "OK",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ id: 1, name: "a" }),
  duration: 10,
  size: 10,
  url: "https://api.test/orders",
  method: "GET",
  timestamp: 1,
  ...over,
});

const historyEntry = (requestId: string, timestamp: number, res: object) => ({
  id: `e${timestamp}`,
  method: "GET",
  url: "https://api.test/orders",
  status: 200,
  duration: 1,
  size: 1,
  timestamp,
  request: { type: "http", requestId },
  response: res,
});

function setup(seed: object = {}) {
  const fake = createFakeWriteContext({
    collections: [
      { id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 },
      { id: "c2", name: "Empty", createdAt: 1, updatedAt: 1 },
    ],
    requests: [
      request("r1", {
        headers: [{ id: "h", key: "Authorization", value: "Bearer secret-token-123", enabled: true }],
      }),
      request("r2", { collectionId: "c1", method: "POST", name: "Create" }),
    ],
    ...seed,
  } as never);
  const run = (name: string, input: unknown) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
  return { ...fake, run };
}

const httpTab = (over: object = {}) => ({
  type: "http",
  tabId: "t1",
  requestId: "r1",
  name: "Req r1",
  assertions: [],
  ...over,
});

const tabs = () => useTabsStore.getState().tabs as unknown as Array<Record<string, unknown>>;

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useHistoryStore.setState({ entries: [] });
});

describe("import_curl", () => {
  const curl =
    "curl -X POST 'https://api.test/items?api_key=abcdef123456' -H 'Authorization: Bearer abc123def456' -H 'Content-Type: application/json' -d '{\"a\":1}'";

  it("[success] creates the request with secrets templated and lists needsValue", async () => {
    const { run, state } = setup();
    const out = (await run("import_curl", { curl, collectionId: "c2" })) as {
      ok: boolean;
      data: { needsValue: string[] };
    };
    expect(out.ok).toBe(true);
    const created = state.requests.at(-1)!;
    expect(created.collectionId).toBe("c2");
    expect(created.method).toBe("POST");
    expect(created.name).toBe("POST api.test/items");
    expect(created.url).toBe("https://api.test/items?api_key={{api_key}}");
    expect(created.body).toMatchObject({ type: "json", content: '{"a":1}' });
    expect(out.data.needsValue).toEqual(["Authorization", "api_key"]);
    expect(JSON.stringify(created)).not.toContain("abc123def456");
  });

  it("[success] uses the first collection and maps basic auth and text bodies", async () => {
    const { run, state } = setup();
    const out = await run("import_curl", {
      curl: "curl -u bob:hunter2 -d 'plain' https://api.test/x",
      collectionId: null,
    });
    expect(out.ok).toBe(true);
    const created = state.requests.at(-1)!;
    expect(created.collectionId).toBe("c1");
    expect(created.auth).toMatchObject({ type: "basic", username: "bob" });
    expect(created.body).toMatchObject({ type: "text", content: "plain" });
  });

  it("[success] a bare GET has no body or auth", async () => {
    const { run, state } = setup();
    expect((await run("import_curl", { curl: "curl https://api.test/ping", collectionId: null })).ok).toBe(true);
    expect(state.requests.at(-1)).toMatchObject({ method: "GET", auth: { type: "none" } });
  });

  it("[success][undo] undo removes the imported request", async () => {
    const { run, state, log } = setup();
    const out = (await run("import_curl", { curl, collectionId: "c1" })) as { data: { changeId: string } };
    expect(state.requests).toHaveLength(3);
    await log.undo(out.data.changeId);
    expect(state.requests).toHaveLength(2);
  });

  it("[invalid] returns the parse error and creates nothing", async () => {
    const { run, state } = setup();
    const out = await run("import_curl", { curl: "wget https://x.test", collectionId: null });
    expect(out.ok).toBe(false);
    expect(state.requests).toHaveLength(2);
  });

  it("[invalid] asks for a collection when none exists", async () => {
    const { run } = setup({ collections: [] });
    const out = (await run("import_curl", { curl: "curl https://a.test", collectionId: null })) as { error: string };
    expect(out.error).toBe("create a collection first, then import the curl");
  });

  it("[invalid] surfaces the request writer failure for an unknown collection", async () => {
    const { run, state } = setup();
    const out = await run("import_curl", { curl: "curl https://a.test", collectionId: "nope" });
    expect(out.ok).toBe(false);
    expect(state.requests).toHaveLength(2);
  });
});

describe("export_curl", () => {
  it("[success] returns curl with the secret redacted", async () => {
    const { run } = setup();
    const out = (await run("export_curl", { requestId: "r1" })) as {
      ok: boolean;
      data: { name: string; curl: string };
    };
    expect(out.ok).toBe(true);
    expect(out.data.name).toBe("Req r1");
    expect(out.data.curl).toContain("https://api.test/orders");
    expect(out.data.curl).toContain("[redacted]");
    expect(out.data.curl).not.toContain("secret-token-123");
  });

  it("[invalid] reports an unknown request", async () => {
    const { run } = setup();
    expect(await run("export_curl", { requestId: "zzz" })).toEqual({
      ok: false,
      error: "request not found: zzz",
    });
  });
});

describe("diff_responses", () => {
  const seedHistory = () =>
    useHistoryStore.setState({
      entries: [
        historyEntry("r1", 1, response({ status: 200, body: '{"id":1,"name":"a"}' })),
        historyEntry("r1", 3, response({ status: 500, body: '{"id":1,"name":"b"}' })),
        historyEntry("other", 5, response({ status: 404 })),
      ] as never,
    });

  it("[success] reports status and body differences, newest first", async () => {
    seedHistory();
    const { run } = setup();
    const out = (await run("diff_responses", { requestId: "r1", a: 0, b: 1 })) as {
      ok: boolean;
      data: { identical: boolean; status: unknown; body: Array<{ path: string; change: string }> };
    };
    expect(out.ok).toBe(true);
    expect(out.data.identical).toBe(false);
    expect(out.data.status).toEqual({ a: 500, b: 200 });
    expect(out.data.body).toEqual([{ path: "$.name", change: "changed", a: "b", b: "a" }]);
  });

  it("[success] identical responses report no differences", async () => {
    seedHistory();
    const { run } = setup();
    const out = (await run("diff_responses", { requestId: "r1", a: 1, b: 1 })) as {
      data: { identical: boolean; status: unknown; body: unknown[] };
    };
    expect(out.data).toMatchObject({ identical: true, status: null, body: [] });
  });

  it("[invalid] returns a structured error for an unknown index", async () => {
    seedHistory();
    const { run } = setup();
    expect(await run("diff_responses", { requestId: "r1", a: 0, b: 2 })).toEqual({
      ok: false,
      error: "no stored response at position 2: this request has 2",
    });
  });

  it("[invalid] errors when the request has no stored responses", async () => {
    const { run } = setup();
    const out = (await run("diff_responses", { requestId: "r1", a: 0, b: 0 })) as { error: string };
    expect(out.error).toBe("no stored response at position 0: this request has 0");
  });
});

describe("generate_tests", () => {
  const withResponse = () =>
    setup({
      tabs: [{ tabId: "t1", requestId: "r1" }],
      activeTabId: "t1",
      responses: { t1: response() },
    });

  it("[success] adds assertions to the open tab", async () => {
    useTabsStore.setState({ tabs: [httpTab()] as never, activeTabId: "t1" });
    const { run } = withResponse();
    const out = (await run("generate_tests", { requestId: "r1" })) as {
      ok: boolean;
      data: { added: number };
    };
    expect(out.ok).toBe(true);
    expect(out.data.added).toBe(4);
    const sources = (tabs()[0].assertions as Array<{ source: string }>).map((a) => a.source);
    expect(sources).toEqual(["status", "header", "jsonpath", "jsonpath"]);
  });

  it("[success][undo] undo restores the previous tests", async () => {
    const prior = { id: "x", source: "status", operator: "eq", expectedValue: "201", enabled: true };
    useTabsStore.setState({ tabs: [httpTab({ assertions: [prior] })] as never, activeTabId: "t1" });
    const { run, log } = withResponse();
    const out = (await run("generate_tests", { requestId: "r1" })) as { data: { changeId: string } };
    expect(tabs()[0].assertions).toHaveLength(5);
    await log.undo(out.data.changeId);
    expect(tabs()[0].assertions).toEqual([prior]);
  });

  it("[success] writes to the active tab and skips assertions it already has", async () => {
    const existing = [
      { id: "a", source: "status", operator: "eq", expectedValue: "200", enabled: true },
      { id: "b", source: "header", sourcePath: "content-type", operator: "contains", expectedValue: "application/json", enabled: true },
      { id: "c", source: "jsonpath", sourcePath: "$.id", operator: "exists", enabled: true },
    ];
    const { run } = withResponse();
    useTabsStore.setState({
      tabs: [httpTab({ tabId: "t0" }), httpTab({ tabId: "t1", assertions: existing })] as never,
      activeTabId: "t1",
    });
    const out = await run("generate_tests", { requestId: "r1" });
    expect(out).toMatchObject({ ok: true, data: { added: 1 } });
    expect(tabs()[0].assertions).toEqual([]);
    expect(tabs()[1].assertions).toHaveLength(4);
  });

  it("[success] falls back to the first matching tab and treats missing assertions as empty", async () => {
    useTabsStore.setState({
      tabs: [httpTab({ assertions: undefined })] as never,
      activeTabId: "other",
    });
    const { run } = withResponse();
    expect((await run("generate_tests", { requestId: "r1" })).ok).toBe(true);
    expect((tabs()[0].assertions as unknown[]).length).toBe(4);
  });

  it("[invalid] requires the request to be open in an http tab", async () => {
    useTabsStore.setState({
      tabs: [httpTab({ type: "graphql" }), httpTab({ tabId: "t2", requestId: "zz" })] as never,
    });
    const { run } = withResponse();
    expect(await run("generate_tests", { requestId: "r1" })).toEqual({
      ok: false,
      error: "open the request in a tab first (use open_item)",
    });
  });

  it("[invalid] requires a response", async () => {
    useTabsStore.setState({ tabs: [httpTab()] as never, activeTabId: "t1" });
    const { run } = setup();
    expect(await run("generate_tests", { requestId: "r1" })).toEqual({
      ok: false,
      error: "this request has no response yet: send it first",
    });
  });

  it("[invalid] refuses when every assertion already exists", async () => {
    useTabsStore.setState({ tabs: [httpTab()] as never, activeTabId: "t1" });
    const { run } = withResponse();
    expect((await run("generate_tests", { requestId: "r1" })).ok).toBe(true);
    expect(await run("generate_tests", { requestId: "r1" })).toEqual({
      ok: false,
      error: "the request already has these assertions",
    });
  });
});

describe("generate_docs", () => {
  it("[success] returns markdown for the collection without changing it", async () => {
    const { run, state } = setup();
    const before = JSON.stringify(state);
    const out = (await run("generate_docs", { collectionId: "c1" })) as {
      ok: boolean;
      data: { markdown: string };
    };
    expect(out.ok).toBe(true);
    expect(out.data.markdown).toContain("Orders");
    expect(out.data.markdown).toContain("https://api.test/orders");
    expect(out.data.markdown).not.toContain("secret-token-123");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("[invalid] reports an unknown collection", async () => {
    const { run } = setup();
    expect(await run("generate_docs", { collectionId: "nope" })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
  });
});

describe("smart tool kinds", () => {
  it("registers each tool with its kind", () => {
    expect(smartTools.map((t) => [t.name, registry.get(t.name)?.kind])).toEqual([
      ["import_curl", "auto"],
      ["export_curl", "read"],
      ["diff_responses", "read"],
      ["generate_tests", "auto"],
      ["generate_docs", "read"],
    ]);
  });
});
