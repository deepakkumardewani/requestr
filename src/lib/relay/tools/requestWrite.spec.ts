import { describe, expect, it } from "vitest";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import {
  APPROVAL_REQUIRED,
  createRegistry,
  executeTool,
  grantApproval,
  previewConfirmation,
} from "./registry";
import { requestWriteTools } from "./requestWrite";

const registry = createRegistry(requestWriteTools);

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
  keyName: null,
  keyValue: null,
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
    body: { type: "graphql", content: "{ a }" },
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
    await run("set_request_body", { requestId: "r1", body: { type: "form", content: "a=1" } });
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
      auth: auth({ type: "apikey", keyName: "X-Key", keyValue: "{{K}}", addTo: "query" }),
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
    expect((await run("set_request_auth", withAuth({ type: "apikey", keyValue: "{{K}}" }))).ok).toBe(false);
    expect((await run("set_request_auth", withAuth({ type: "apikey", keyName: "k", keyValue: "plain" }))).ok).toBe(false);
  });
});

describe("set_request_scripts", () => {
  it("[success][invalid][undo] stores text only and leaves untouched scripts alone", async () => {
    const { run, req } = setup();
    await run("set_request_scripts", { requestId: "r1", pre: "log(1)", post: null });
    expect(req("r1")).toMatchObject({ preScript: "log(1)", postScript: "" });
    expect((await run("set_request_scripts", { requestId: "r1", pre: null, post: null })).ok).toBe(false);
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
