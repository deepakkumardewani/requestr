import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import {
  APPROVAL_REQUIRED,
  createRegistry,
  executeTool,
  grantApproval,
  previewConfirmation,
} from "./registry";
import { requestWriteTools, secretPairProblem } from "./requestWrite";
import { readTools } from "./workspaceRead";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const registry = createRegistry(requestWriteTools);

// Tabs opened by one test must not gate the edits of another.
beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: null, hydrated: true });
});

const baseRequest = (id: string, overrides: object = {}) => ({
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
  ...overrides,
});

function setup() {
  const fake = createFakeWriteContext({
    collections: [
      { id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 },
      { id: "c2", name: "Other", createdAt: 1, updatedAt: 1 },
    ],
    folders: [
      { id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 },
      { id: "f2", collectionId: "c2", name: "Foreign", parentFolderId: null, order: 0 },
    ],
    requests: [baseRequest("r1"), baseRequest("r2")],
  } as never);
  const run = (name: string, input: unknown) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
      permissionMode: "skip",
    });
  const req = (id: string) => fake.state.requests.find((r) => r.id === id)!;
  return { ...fake, run, req };
}

/** Strict schemas need every auth field present, so unused ones are null. */
const auth = (fields: object) => ({
  type: "none",
  token: null,
  username: null,
  password: null,
  key: null,
  value: null,
  addTo: null,
  ...fields,
});

const NULLS = { name: null, method: null, url: null };

describe("create_request", () => {
  const valid = {
    collectionId: "c1",
    folderId: null,
    name: " Create ",
    method: "POST",
    url: "{{baseUrl}}/orders",
    headers: [{ key: "X-Id", value: "1", enabled: true }],
    params: [{ key: "q", value: "a", enabled: true }],
    body: { type: "json", content: "{ a }" },
    auth: auth({ type: "bearer", token: "{{TOKEN}}" }),
  };

  it("[success] creates a request with mapped body type and variable URL", async () => {
    const { run, state } = setup();
    const out = await run("create_request", valid);
    expect(out.ok).toBe(true);
    const created = state.requests.at(-1)!;
    expect(created.name).toBe("Create");
    expect(created.body.type).toBe("json");
    expect(created.params[0].type).toBe("query");
    expect(created.auth).toEqual({ type: "bearer", token: "{{TOKEN}}" });
  });

  it("[success][undo] is undoable", async () => {
    const { run, state, log } = setup();
    const out = (await run("create_request", valid)) as { data: { changeId: string } };
    await log.undo(out.data.changeId);
    expect(state.requests).toHaveLength(2);
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "orders"])(
    "[invalid] rejects url %s",
    async (url) => {
      const { run, state } = setup();
      const out = await run("create_request", { ...valid, url });
      expect(out.ok).toBe(false);
      expect(state.requests).toHaveLength(2);
    },
  );

  it("[success] accepts ws and wss urls", async () => {
    const { run } = setup();
    expect((await run("create_request", { ...valid, url: "wss://x.test/s" })).ok).toBe(true);
  });

  it("[invalid] rejects literal secrets, blank names and foreign folders", async () => {
    const { run } = setup();
    const secretHeader = [{ key: "Authorization", value: "Bearer abc123", enabled: true }];
    expect((await run("create_request", { ...valid, headers: secretHeader })).ok).toBe(false);
    expect((await run("create_request", { ...valid, auth: auth({ type: "bearer", token: "abc" }) })).ok).toBe(false);
    expect((await run("create_request", { ...valid, name: "  " })).ok).toBe(false);
    expect((await run("create_request", { ...valid, folderId: "f2" })).ok).toBe(false);
  });
});

describe("update_request", () => {
  it("[success][undo] updates fields and undo restores them", async () => {
    const { run, req, log } = setup();
    const out = (await run("update_request", {
      requestId: "r1",
      name: "Renamed",
      method: "PUT",
      url: "https://x.test",
    })) as { data: { changeId: string } };
    expect(req("r1")).toMatchObject({ name: "Renamed", method: "PUT", url: "https://x.test" });
    await log.undo(out.data.changeId);
    expect(req("r1")).toMatchObject({ name: "Req r1", method: "GET" });
  });

  it("[invalid] fails on no-ops, bad urls, blank names and unknown ids", async () => {
    const { run } = setup();
    expect((await run("update_request", { requestId: "r1", ...NULLS })).ok).toBe(false);
    expect((await run("update_request", { requestId: "r1", ...NULLS, url: "ftp://x" })).ok).toBe(false);
    expect((await run("update_request", { requestId: "r1", ...NULLS, name: " " })).ok).toBe(false);
    expect((await run("update_request", { requestId: "nope", ...NULLS, name: "x" })).ok).toBe(false);
  });
});

describe("duplicate_request", () => {
  it("[success] copies within the same collection keeping the folder", async () => {
    const { run, state } = setup();
    state.requests[0].folderId = "f1";
    await run("duplicate_request", { requestId: "r1", toCollectionId: null });
    const copy = state.requests.at(-1)!;
    expect(copy.name).toBe("Req r1 (copy)");
    expect(copy.folderId).toBe("f1");
    expect(copy.id).not.toBe("r1");
  });

  it("[undo] removes the copy again", async () => {
    const { run, state, log } = setup();
    const count = state.requests.length;
    const out = (await run("duplicate_request", { requestId: "r1", toCollectionId: null })) as {
      data: { changeId: string };
    };
    expect(state.requests).toHaveLength(count + 1);
    await log.undo(out.data.changeId);
    expect(state.requests).toHaveLength(count);
  });

  it("[success] copies into another collection at its root", async () => {
    const { run, state } = setup();
    await run("duplicate_request", { requestId: "r1", toCollectionId: "c2" });
    expect(state.requests.at(-1)).toMatchObject({ collectionId: "c2", folderId: null });
  });

  it("[success][invalid] fails for an unknown request", async () => {
    const { run } = setup();
    expect((await run("duplicate_request", { requestId: "zz", toCollectionId: null })).ok).toBe(false);
  });
});

describe("headers and params", () => {
  it("[undo] set_request_headers restores the previous headers", async () => {
    const { run, req, log } = setup();
    const before = structuredClone(req("r1").headers);
    const out = (await run("set_request_headers", {
      requestId: "r1",
      upsert: [{ key: "X-New", value: "1", enabled: true }],
      remove: null,
    })) as { data: { changeId: string } };
    expect(req("r1").headers).not.toEqual(before);
    await log.undo(out.data.changeId);
    expect(req("r1").headers).toEqual(before);
  });


  it("[success] upserts case-insensitively, removes and appends", async () => {
    const { run, req } = setup();
    await run("set_request_headers", {
      requestId: "r1",
      upsert: [
        { key: "accept", value: "text/plain", enabled: false },
        { key: "X-New", value: "1", enabled: true },
      ],
      remove: null,
    });
    expect(req("r1").headers.map((h) => [h.key, h.value, h.enabled])).toEqual([
      ["Accept", "text/plain", false],
      ["X-New", "1", true],
    ]);
    await run("set_request_headers", { requestId: "r1", upsert: null, remove: ["ACCEPT"] });
    expect(req("r1").headers.map((h) => h.key)).toEqual(["X-New"]);
  });

  it("[success][invalid] refuses literal secret header values and allows variable references", async () => {
    const { run, req } = setup();
    const bad = await run("set_request_headers", {
      requestId: "r1",
      upsert: [{ key: "X-Api-Key", value: "sk-live-1234567890abcdef", enabled: true }],
      remove: null,
    });
    expect(bad.ok).toBe(false);
    const good = await run("set_request_headers", {
      requestId: "r1",
      upsert: [{ key: "X-Api-Key", value: "{{API_KEY}}", enabled: true }],
      remove: null,
    });
    expect(good.ok).toBe(true);
    expect(req("r1").headers.at(-1)?.value).toBe("{{API_KEY}}");
  });

  it("[success][invalid][undo] sets query params and fails on unknown request", async () => {
    const { run, req } = setup();
    await run("set_request_params", {
      requestId: "r1",
      upsert: [{ key: "page", value: "2", enabled: true }],
      remove: null,
    });
    expect(req("r1").params[0]).toMatchObject({ key: "page", type: "query" });
    expect(
      (await run("set_request_params", { requestId: "zz", upsert: null, remove: null })).ok,
    ).toBe(false);
  });
});

describe("set_request_body", () => {
  it("[success] maps form to form-data with parsed rows, and none clears content", async () => {
    const { run, req } = setup();
    await run("set_request_body", { requestId: "r1", body: { type: "form-data", content: "a=1" } });
    expect(req("r1").body.type).toBe("form-data");
    await run("set_request_body", { requestId: "r1", body: { type: "none", content: "ignored" } });
    expect(req("r1").body).toEqual({ type: "none", content: "" });
  });

  it("[success] stores text bodies as given", async () => {
    const { run, req } = setup();
    await run("set_request_body", { requestId: "r1", body: { type: "text", content: "hi" } });
    expect(req("r1").body).toEqual({ type: "text", content: "hi" });
  });
});

describe("set_request_auth", () => {
  it("[success] accepts variable references for every type", async () => {
    const { run, req } = setup();
    await run("set_request_auth", {
      requestId: "r1",
      auth: auth({ type: "basic", username: "u", password: "{{PW}}" }),
    });
    expect(req("r1").auth).toEqual({ type: "basic", username: "u", password: "{{PW}}" });
    await run("set_request_auth", {
      requestId: "r1",
      auth: auth({ type: "api-key", key: "X-Key", value: "{{K}}", addTo: "query" }),
    });
    expect(req("r1").auth).toEqual({ type: "api-key", key: "X-Key", value: "{{K}}", addTo: "query" });
    await run("set_request_auth", { requestId: "r1", auth: auth({ type: "none" }) });
    expect(req("r1").auth).toEqual({ type: "none" });
  });

  it("[success][invalid][undo] refuses literals and an API key without a name", async () => {
    const { run } = setup();
    const withAuth = (fields: object) => ({ requestId: "r1", auth: auth(fields) });
    expect((await run("set_request_auth", withAuth({ type: "bearer", token: "eyJhbGciOi.real.token" }))).ok).toBe(false);
    expect((await run("set_request_auth", withAuth({ type: "basic", username: "u", password: "hunter2" }))).ok).toBe(false);
    expect((await run("set_request_auth", withAuth({ type: "api-key", value: "{{K}}" }))).ok).toBe(false);
    expect((await run("set_request_auth", withAuth({ type: "api-key", key: "k", value: "plain" }))).ok).toBe(false);
  });
});

describe("set_request_scripts", () => {
  it("[success][invalid][undo] stores text only and leaves untouched scripts alone", async () => {
    const { run, req } = setup();
    await run("set_request_scripts", { requestId: "r1", pre: "log(1)", post: null });
    expect(req("r1")).toMatchObject({ preScript: "log(1)", postScript: "" });
    expect((await run("set_request_scripts", { requestId: "r1", pre: null, post: null })).ok).toBe(false);
  });

  it("[success] sets only the post script and leaves the pre script alone", async () => {
    const { run, req } = setup();
    await run("set_request_scripts", { requestId: "r1", pre: null, post: "check()" });
    expect(req("r1")).toMatchObject({ preScript: "", postScript: "check()" });
  });
});

describe("bulk_update_requests", () => {
  const op = { method: null, urlReplace: null, upsertHeaders: null, removeHeaders: null };

  it("[success][undo] updates all targets as one change and undoes them together", async () => {
    const { run, req, log } = setup();
    const out = (await run("bulk_update_requests", {
      ids: ["r1", "r2", "r1"],
      op: { ...op, method: "DELETE", urlReplace: { find: "api.test", replace: "api.v2.test" } },
    })) as { data: { changeId: string } };
    expect(req("r1")).toMatchObject({ method: "DELETE", url: "https://api.v2.test/orders" });
    expect(req("r2").method).toBe("DELETE");
    await log.undo(out.data.changeId);
    expect(req("r1")).toMatchObject({ method: "GET", url: "https://api.test/orders" });
    expect(req("r2").method).toBe("GET");
  });

  it("[success] a header-only op keeps method and url and merges headers", async () => {
    const { run, req } = setup();
    await run("bulk_update_requests", {
      ids: ["r1"],
      op: {
        ...op,
        upsertHeaders: [{ key: "X-Trace", value: "{{trace}}", enabled: true }],
      },
    });
    expect(req("r1")).toMatchObject({ method: "GET", url: "https://api.test/orders" });
    expect(req("r1").headers.map((h) => h.key)).toContain("X-Trace");
  });

  it("[invalid] rejects a url replacement that breaks any target, changing nothing", async () => {
    const { run, req } = setup();
    const out = await run("bulk_update_requests", {
      ids: ["r1", "r2"],
      op: { ...op, urlReplace: { find: "https://", replace: "javascript:" } },
    });
    expect(out.ok).toBe(false);
    expect(req("r1").url).toBe("https://api.test/orders");
  });

  it("[invalid] fails on empty op, literal secret headers, and more than 50 ids", async () => {
    const { run } = setup();
    expect((await run("bulk_update_requests", { ids: ["r1"], op })).ok).toBe(false);
    expect(
      (await run("bulk_update_requests", {
        ids: ["r1"],
        op: { ...op, upsertHeaders: [{ key: "Authorization", value: "Bearer abcdef123456", enabled: true }] },
      })).ok,
    ).toBe(false);
    const many = Array.from({ length: 51 }, (_, i) => `r${i}`);
    expect((await run("bulk_update_requests", { ids: many, op: { ...op, method: "GET" } })).ok).toBe(false);
  });
});

describe("bulk approval gate (N=10)", () => {
  const op = { method: "PUT", urlReplace: null, upsertHeaders: null, removeHeaders: null };
  const ids = (count: number) => Array.from({ length: count }, (_, i) => `b${i}`);

  function setupMany(count: number) {
    const fake = createFakeWriteContext({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      requests: ids(count).map((id) => baseRequest(id)),
    } as never);
    const run = (input: unknown, approved: boolean) =>
      executeTool(registry, "bulk_update_requests", input, {
        store: fake.store,
        redact: DEFAULT_REDACT_CONTEXT,
        write: fake.write,
        approval: approved ? grantApproval() : undefined,
      });
    const methods = () => fake.state.requests.map((r) => r.method);
    return { ...fake, run, methods };
  }

  it("[success] applies 10 requests without Approve", async () => {
    const { run, methods } = setupMany(10);
    expect((await run({ ids: ids(10), op }, false)).ok).toBe(true);
    expect(methods().every((m) => m === "PUT")).toBe(true);
  });

  it("[success] holds 11 requests until Approve and changes nothing meanwhile", async () => {
    const { run, methods } = setupMany(11);
    expect(await run({ ids: ids(11), op }, false)).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(methods().every((m) => m === "GET")).toBe(true);
  });

  it("[invalid] counts distinct ids, so repeats cannot trigger or dodge the gate", async () => {
    const { run } = setupMany(11);
    expect((await run({ ids: [...ids(10), ...ids(10)], op }, false)).ok).toBe(true);
  });

  it("[success][undo] applies 11 after Approve as one change that Undo restores in full", async () => {
    const { run, methods, log } = setupMany(11);
    const out = (await run({ ids: ids(11), op }, true)) as { ok: true; data: { changeId: string } };
    expect(out.ok).toBe(true);
    expect(methods().every((m) => m === "PUT")).toBe(true);
    await log.undo(out.data.changeId);
    expect(methods().every((m) => m === "GET")).toBe(true);
  });

  it("[success] previews the real names and the full count for the card", () => {
    const { store } = setupMany(11);
    expect(
      previewConfirmation(registry, "bulk_update_requests", { ids: ids(11), op }, store),
    ).toEqual({
      action: "bulkUpdate",
      severity: "caution",
      targets: ["Req b0", "Req b1", "Req b2", "Req b3", "Req b4"],
      count: 11,
    });
  });
});

describe("HH-H07: edit cards name unsaved tabs", () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null, hydrated: true });
  });

  const openDirtyTab = (requestId: string) => {
    useTabsStore.getState().openTab({ name: `Tab ${requestId}`, requestId });
    const tab = useTabsStore.getState().tabs.at(-1)!;
    useTabsStore.getState().updateTabState(tab.tabId, { isDirty: true });
  };

  it("lists the dirty tab on every edit card, and none when the tab is clean", () => {
    const { store } = setup();
    const inputs: [string, unknown][] = [
      ["update_request", { requestId: "r1", ...NULLS, url: "https://a.test" }],
      ["set_request_scripts", { requestId: "r1", pre: "a()", post: null }],
      ["bulk_update_requests", { ids: ["r1", "r2"], op: { method: "PUT", urlReplace: null, upsertHeaders: null, removeHeaders: null } }],
    ];
    for (const [name, input] of inputs) {
      expect(previewConfirmation(registry, name, input, store), name).not.toHaveProperty("dirtyTabs");
    }
    openDirtyTab("r1");
    for (const [name, input] of inputs) {
      const tabs = previewConfirmation(registry, name, input, store)?.dirtyTabs;
      expect(tabs?.map((t) => t.name), name).toEqual(["Tab r1"]);
    }
  });

  it("the bulk card keeps its action, and an unknown id gets no card", () => {
    const { store } = setup();
    const preview = previewConfirmation(
      registry,
      "bulk_update_requests",
      { ids: ["r1", "r1", "missing"], op: { method: "PUT", urlReplace: null, upsertHeaders: null, removeHeaders: null } },
      store,
    );
    expect(preview).toBeNull();
    const known = previewConfirmation(
      registry,
      "bulk_update_requests",
      { ids: ["r1"], op: { method: "PUT", urlReplace: null, upsertHeaders: null, removeHeaders: null } },
      store,
    );
    expect(known).toMatchObject({ action: "bulkUpdate", targets: ["Req r1"], count: 1 });
  });

  it("the scripts card shows both scripts in full, and a missing request gets no card", () => {
    const { store } = setup();
    const known = previewConfirmation(
      registry,
      "set_request_scripts",
      { requestId: "r1", pre: "a()", post: "b()" },
      store,
    );
    expect(known).toMatchObject({
      targets: ["Req r1"],
      detail: "Pre-request script:\na()\n\nPost-response script:\nb()",
    });
    const missing = previewConfirmation(
      registry,
      "set_request_scripts",
      { requestId: "nope", pre: null, post: "b()" },
      store,
    );
    expect(missing).toBeNull();
  });

  it("[invalid] set_request_scripts refuses a literal secret and an empty change", async () => {
    const { run, req } = setup();
    const secret = await run("set_request_scripts", {
      requestId: "r1",
      pre: 'const k = "sk_live_abcdefghijklmnop1234";',
      post: null,
    });
    expect(secret.ok).toBe(false);
    expect(await run("set_request_scripts", { requestId: "r1", pre: null, post: null })).toMatchObject({ ok: false });
    expect(req("r1").preScript).toBe("");
  });
});

describe("secretPairProblem", () => {
  it("[invalid] refuses a pair carrying control characters", () => {
    expect(secretPairProblem([{ key: "X-Test", value: "a\r\nInjected: 1" }])).toMatch(
      /control/i,
    );
  });

  it("[success] accepts an ordinary pair", () => {
    expect(secretPairProblem([{ key: "Accept", value: "application/json" }])).toBeNull();
  });
});

describe("HH-M02: read -> write -> read round trip", () => {
  const roundTripRegistry = createRegistry([...requestWriteTools, ...readTools]);

  function bench() {
    const { run: write, req, store, write: writer } = setup();
    const read = async () =>
      (
        (await executeTool(roundTripRegistry, "get_request", { requestId: "r1" }, {
          store,
          redact: DEFAULT_REDACT_CONTEXT,
          write: writer,
        })) as { data: { body: unknown; auth: unknown } }
      ).data;
    return { write, read, req };
  }

  it.each(["json", "text", "xml", "html", "urlencoded", "none"] as const)(
    "[success] a %s body read back writes back to the identical body",
    async (type) => {
      const { write, read } = bench();
      const content = type === "none" ? "" : type === "urlencoded" ? "a=1&b=2" : "<a>1</a>";
      expect((await write("set_request_body", { requestId: "r1", body: { type, content } })).ok).toBe(true);
      const first = (await read()).body as { type: string; content: string };
      expect(first.type).toBe(type);
      await write("set_request_body", { requestId: "r1", body: { type: first.type, content: first.content } });
      expect((await read()).body).toEqual(first);
    },
  );

  it("[success] a form-data body keeps its rows through a read and a write", async () => {
    const { write, read } = bench();
    await write("set_request_body", { requestId: "r1", body: { type: "form-data", content: "a=1&b=2" } });
    const first = (await read()).body as { type: string; content: string; formData: unknown[] };
    expect(first.type).toBe("form-data");
    expect(first.formData).toHaveLength(2);
    await write("set_request_body", { requestId: "r1", body: { type: first.type, content: first.content } });
    expect((await read()).body).toEqual(first);
  });

  it("[success] xml and html are stored under their own type, not coerced", async () => {
    const { write, req } = bench();
    await write("set_request_body", { requestId: "r1", body: { type: "xml", content: "<a/>" } });
    expect(req("r1").body).toEqual({ type: "xml", content: "<a/>" });
    await write("set_request_body", { requestId: "r1", body: { type: "html", content: "<p/>" } });
    expect(req("r1").body).toEqual({ type: "html", content: "<p/>" });
  });

  const authCases = [
    ["none", auth({ type: "none" })],
    ["bearer", auth({ type: "bearer", token: "{{TOKEN}}" })],
    ["basic", auth({ type: "basic", username: "u", password: "{{PW}}" })],
    ["api-key", auth({ type: "api-key", key: "X-Key", value: "{{K}}", addTo: "query" })],
  ] as const;

  it.each(authCases)("[success] %s auth read back writes back to the identical auth", async (_name, input) => {
    const { write, read } = bench();
    expect((await write("set_request_auth", { requestId: "r1", auth: input })).ok).toBe(true);
    const first = (await read()).auth as Record<string, unknown>;
    expect(first.type).toBe(input.type);
    const echo = auth({
      type: first.type,
      token: first.token ?? null,
      username: first.username ?? null,
      password: first.password ?? null,
      key: first.key ?? null,
      value: first.value ?? null,
      addTo: first.addTo ?? null,
    });
    expect((await write("set_request_auth", { requestId: "r1", auth: echo })).ok).toBe(true);
    expect((await read()).auth).toEqual(first);
  });
});

describe("branch coverage: validation edges", () => {
  const impl = (name: string) => requestWriteTools.find((tool) => tool.name === name)!;
  const direct = (fake: ReturnType<typeof setup>, name: string, input: unknown, extra: object = {}) =>
    (impl(name).run as (i: unknown, c: unknown) => Promise<{ ok: boolean; error?: string }>)(input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
      permissionMode: "skip",
      ...extra,
    });

  it("[invalid] a redaction placeholder value looks like a secret", () => {
    expect(secretPairProblem([{ key: "X-Note", value: "[redacted]" }])).toMatch(/looks like a literal secret/);
  });

  it("[success] bearer, basic and api-key auth with every optional field null fall back to empty values", async () => {
    const { run, req } = setup();
    await run("set_request_auth", { requestId: "r1", auth: auth({ type: "bearer" }) });
    expect(req("r1").auth).toEqual({ type: "bearer", token: "" });
    await run("set_request_auth", { requestId: "r1", auth: auth({ type: "basic" }) });
    expect(req("r1").auth).toEqual({ type: "basic", username: "", password: "" });
    await run("set_request_auth", { requestId: "r1", auth: auth({ type: "api-key", key: "X-Key" }) });
    expect(req("r1").auth).toEqual({ type: "api-key", key: "X-Key", value: "", addTo: "header" });
  });

  it("[invalid] an api-key without a key name is refused", async () => {
    const { run, req } = setup();
    const result = await run("set_request_auth", { requestId: "r1", auth: auth({ type: "api-key", value: "{{K}}" }) });
    expect(result).toMatchObject({ ok: false, error: "key is required for an API key" });
    expect(req("r1").auth).toEqual({ type: "none" });
  });

  it("[success] create_request with null headers, params, body and auth stores empty defaults", async () => {
    const { run, state } = setup();
    const result = await run("create_request", {
      collectionId: "c1",
      folderId: null,
      name: "Bare",
      method: "GET",
      url: "https://api.test/bare",
      headers: null,
      params: null,
      body: null,
      auth: null,
    });
    expect(result.ok).toBe(true);
    const created = state.requests.find((r) => r.name === "Bare")!;
    expect(created).toMatchObject({ headers: [], params: [], auth: { type: "none" }, body: { type: "none", content: "" } });
  });

  it("[invalid] create_request refuses a literal secret header and a bad auth", async () => {
    const { run, state } = setup();
    const base = { collectionId: "c1", folderId: null, name: "N", method: "GET", url: "https://a.test", params: null, body: null };
    const header = await run("create_request", { ...base, headers: [{ key: "Authorization", value: "Bearer sk_live_abcdefghijklmnop1234", enabled: true }], auth: null });
    expect(header.ok).toBe(false);
    const badAuth = await run("create_request", { ...base, headers: null, auth: auth({ type: "bearer", token: "sk_live_abcdefghijklmnop1234" }) });
    expect(badAuth).toMatchObject({ ok: false });
    expect(state.requests).toHaveLength(2);
  });

  it("[success] update_request changes only the fields that are given", async () => {
    const { run, req } = setup();
    await run("update_request", { requestId: "r1", ...NULLS, name: "Renamed" });
    expect(req("r1")).toMatchObject({ name: "Renamed", method: "GET", url: "https://api.test/orders" });
    await run("update_request", { requestId: "r1", ...NULLS, method: "PUT" });
    expect(req("r1")).toMatchObject({ name: "Renamed", method: "PUT", url: "https://api.test/orders" });
    await run("update_request", { requestId: "r1", ...NULLS, url: " https://api.test/new " });
    expect(req("r1")).toMatchObject({ name: "Renamed", method: "PUT", url: "https://api.test/new" });
  });

  it("[invalid] update_request refuses a blank name and a bad url, leaving the request alone", async () => {
    const { run, req } = setup();
    expect(await run("update_request", { requestId: "r1", ...NULLS, name: "   " })).toMatchObject({ ok: false, error: "name must not be empty" });
    expect(await run("update_request", { requestId: "r1", ...NULLS, url: "ftp://x" })).toMatchObject({ ok: false });
    expect(req("r1")).toMatchObject({ name: "Req r1", url: "https://api.test/orders" });
  });

  it("[invalid] set_request_params refuses a secret value and accepts null upsert with a removal", async () => {
    const { run, req } = setup();
    await run("set_request_params", { requestId: "r1", upsert: [{ key: "a", value: "1", enabled: true }], remove: null });
    const secret = await run("set_request_params", {
      requestId: "r1",
      upsert: [{ key: "api_key", value: "sk_live_abcdefghijklmnop1234", enabled: true }],
      remove: null,
    });
    expect(secret.ok).toBe(false);
    expect(req("r1").params.map((p) => p.key)).toEqual(["a"]);
    await run("set_request_params", { requestId: "r1", upsert: null, remove: ["A"] });
    expect(req("r1").params).toEqual([]);
  });

  it("[success] set_request_scripts writes only the post script when pre is null", async () => {
    const { run, req } = setup();
    await run("set_request_scripts", { requestId: "r1", pre: null, post: "b()" });
    expect(req("r1")).toMatchObject({ preScript: "", postScript: "b()" });
    await run("set_request_scripts", { requestId: "r1", pre: "a()", post: null });
    expect(req("r1")).toMatchObject({ preScript: "a()", postScript: "b()" });
  });

  it("[success] the scripts card shows only the given script and names an unknown id", () => {
    const { store } = setup();
    const preview = (describe: unknown, input: unknown) =>
      (describe as (i: unknown, s: unknown) => { targets: string[]; detail: string })(input, store);
    const describe = impl("set_request_scripts").describe;
    expect(preview(describe, { requestId: "r1", pre: "a()", post: null })).toMatchObject({
      targets: ["Req r1"],
      detail: "Pre-request script:\na()",
    });
    expect(preview(describe, { requestId: "ghost", pre: null, post: "b()" })).toMatchObject({
      targets: ["ghost"],
      detail: "Post-response script:\nb()",
    });
  });

  it("[invalid] a request that disappears before the run is reported, for edit and duplicate", async () => {
    const fake = setup();
    expect(await direct(fake, "set_request_body", { requestId: "gone", body: { type: "none", content: "" } })).toMatchObject({
      ok: false,
      error: "request not found: gone",
    });
    expect(await direct(fake, "duplicate_request", { requestId: "gone", toCollectionId: null })).toMatchObject({
      ok: false,
      error: "request not found: gone",
    });
  });

  it("[success] an edit still applies when the second read of the request comes back empty", async () => {
    const fake = setup();
    const original = fake.state.requests.find((r) => r.id === "r1")!;
    const store = {
      ...fake.store,
      requests: vi.fn().mockReturnValueOnce([original]).mockReturnValue([]),
    };
    const result = await direct({ ...fake, store } as never, "set_request_body", {
      requestId: "r1",
      body: { type: "text", content: "hi" },
    });
    expect(result.ok).toBe(true);
    expect(fake.req("r1").body).toEqual({ type: "text", content: "hi" });
  });

  it("[invalid] an edit or bulk edit over a dirty tab waits for the user's decision and changes nothing", async () => {
    const fake = setup();
    useTabsStore.getState().openTab({ name: "Tab r1", requestId: "r1" });
    const tab = useTabsStore.getState().tabs.at(-1)!;
    useTabsStore.getState().updateTabState(tab.tabId, { isDirty: true });
    const waiting = "the user must choose what to do with unsaved changes first";
    expect(await direct(fake, "set_request_body", { requestId: "r1", body: { type: "text", content: "x" } })).toMatchObject({ ok: false, error: waiting });
    const op = { method: "PUT", urlReplace: null, upsertHeaders: null, removeHeaders: null };
    expect(await direct(fake, "bulk_update_requests", { ids: ["r1"], op })).toMatchObject({ ok: false, error: waiting });
    expect(fake.req("r1")).toMatchObject({ method: "GET", body: { type: "none", content: "" } });
  });
});
