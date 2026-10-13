import { describe, expect, it, vi } from "vitest";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { JWT_SECRET, PLAIN_PASSWORD } from "../redact.corpus";
import { createFakeStoreAccess } from "../storeAccess";
import { environmentWriteTools } from "./environmentWrite";
import { type NetworkPort, networkTools } from "./network";
import {
  createRegistry,
  executeTool,
  grantApproval,
  type ToolContext,
} from "./registry";
import { requestWriteTools } from "./requestWrite";
import {
  BULK_IDS_MAX,
  RELAY_TOOL_SCHEMAS,
  type RelayToolName,
} from "./schemas";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const registry = createRegistry([
  ...requestWriteTools,
  ...environmentWriteTools,
  ...networkTools,
]);

const baseRequest = (id: string, url = "https://api.test/orders") => ({
  id,
  collectionId: "c1",
  folderId: null,
  name: `Req ${id}`,
  method: "GET",
  url,
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

function setup(port?: NetworkPort) {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    folders: [],
    requests: [baseRequest("r1"), baseRequest("r2", "{{target}}/orders")],
    environments: [
      {
        id: "e1",
        name: "Local",
        variables: [
          { id: "v1", key: "target", initialValue: "file:///etc", currentValue: "", isSecret: false },
        ],
      },
    ],
    activeEnvironmentId: "e1",
  } as never);
  const run = (name: string, input: unknown) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
      network: port,
      approval: grantApproval(),
    } as ToolContext);
  return { ...fake, run };
}

const nullAuth = {
  type: "none",
  token: null,
  username: null,
  password: null,
  keyName: null,
  keyValue: null,
  addTo: null,
};
const pair = (key: string, value: string) => ({ key, value, enabled: true });
const times = <T>(count: number, make: (index: number) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(index));

/* ------------------------------- array caps -------------------------------- */

type ZodNode = { _zod: { def: Record<string, unknown>; bag?: { maximum?: number } } };

/** Paths of every array in a tool schema that has no `.max()`. */
function uncappedArrays(node: ZodNode, path: string): string[] {
  const def = node._zod.def;
  switch (def.type) {
    case "array": {
      const capped = typeof node._zod.bag?.maximum === "number";
      const inner = uncappedArrays(def.element as ZodNode, `${path}[]`);
      return capped ? inner : [path, ...inner];
    }
    case "nullable":
    case "optional":
      return uncappedArrays(def.innerType as ZodNode, path);
    case "object":
      return Object.entries(def.shape as Record<string, ZodNode>).flatMap(
        ([key, child]) => uncappedArrays(child, `${path}.${key}`),
      );
    default:
      return [];
  }
}

describe("[invalid] array caps", () => {
  it("leaves no array in any tool schema without an upper bound", () => {
    const uncapped = (Object.keys(RELAY_TOOL_SCHEMAS) as RelayToolName[]).flatMap(
      (name) =>
        uncappedArrays(RELAY_TOOL_SCHEMAS[name].inputSchema as unknown as ZodNode, name),
    );
    expect(uncapped).toEqual([]);
  });

  const tooManyIds = times(BULK_IDS_MAX + 1, (index) => `r${index}`);
  it.each([
    ["delete_request", { ids: tooManyIds }],
    ["delete_collection", { ids: tooManyIds }],
    [
      "bulk_update_requests",
      { ids: tooManyIds, op: { method: "GET", urlReplace: null, upsertHeaders: null, removeHeaders: null } },
    ],
    ["set_request_headers", { requestId: "r1", upsert: times(101, (i) => pair(`H${i}`, "v")), remove: null }],
    ["set_request_params", { requestId: "r1", upsert: null, remove: times(101, (i) => `p${i}`) }],
    ["set_env_variables", { environmentId: "e1", upsert: times(101, (i) => ({ key: `K${i}`, value: "v", secret: false })), remove: null }],
  ])("[invalid] %s rejects an oversized list", async (name, input) => {
    expect(RELAY_TOOL_SCHEMAS[name as RelayToolName].inputSchema.safeParse(input).success).toBe(false);
    expect((await setup().run(name, input)).ok).toBe(false);
  });
});

/* ------------------------------- ids and text ------------------------------ */

describe("[invalid] ids", () => {
  it.each(["", "x".repeat(201)])("rejects the id %#", (requestId) => {
    expect(RELAY_TOOL_SCHEMAS.get_request.inputSchema.safeParse({ requestId }).success).toBe(false);
    expect(RELAY_TOOL_SCHEMAS.send_request.inputSchema.safeParse({ requestId }).success).toBe(false);
  });

  it("fails cleanly for an id the workspace does not have", async () => {
    const out = await setup().run("set_request_headers", {
      requestId: "ghost",
      upsert: [pair("X-A", "1")],
      remove: null,
    });
    expect(out.ok).toBe(false);
  });
});

/* ---------------------------------- urls ----------------------------------- */

describe("[invalid] url schemes and control characters", () => {
  const create = (url: string) => ({
    collectionId: "c1",
    folderId: null,
    name: "R",
    method: "GET",
    url,
    headers: null,
    params: null,
    body: null,
    auth: null,
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "ftp://x", "data:text/html,x", "//no-scheme"])(
    "create_request refuses %s",
    async (url) => {
      expect((await setup().run("create_request", create(url))).ok).toBe(false);
    },
  );

  it.each(["https://a.test/x\r\nHost: evil", "{{baseUrl}}/a\nb"])(
    "refuses a url with a line break (%#)",
    async (url) => {
      expect((await setup().run("create_request", create(url))).ok).toBe(false);
    },
  );

  it("refuses a header whose value carries a line break", async () => {
    const out = await setup().run("set_request_headers", {
      requestId: "r1",
      upsert: [pair("X-Trace", "a\r\nX-Injected: 1")],
      remove: null,
    });
    expect(out.ok).toBe(false);
  });

  it("[invalid] send_request refuses a template that resolves to a disallowed scheme", async () => {
    const port = { send: vi.fn(), runChain: vi.fn() } as unknown as NetworkPort;
    const out = await setup(port).run("send_request", { requestId: "r2" });
    expect(out.ok).toBe(false);
    expect(port.send).not.toHaveBeenCalled();
  });
});

/* ---------------------------- literal secrets ------------------------------ */

describe("[invalid] literal secrets", () => {
  const changeHeaders = (upsert: unknown) => ({ requestId: "r1", upsert, remove: null });

  it.each([
    ["Authorization", `Bearer ${JWT_SECRET}`],
    ["X-Api-Key", PLAIN_PASSWORD],
    ["Cookie", "session=abc123def456ghi789"],
  ])("set_request_headers refuses a literal %s", async (key, value) => {
    const out = await setup().run("set_request_headers", changeHeaders([pair(key, value)]));
    expect(out.ok).toBe(false);
  });

  it("set_request_params refuses a literal token", async () => {
    const out = await setup().run("set_request_params", changeHeaders([pair("access_token", PLAIN_PASSWORD)]));
    expect(out.ok).toBe(false);
  });

  it.each([
    { type: "bearer", token: JWT_SECRET },
    { type: "basic", username: "u", password: PLAIN_PASSWORD },
    { type: "apikey", keyName: "X-Key", keyValue: PLAIN_PASSWORD, addTo: "header" },
  ])("set_request_auth refuses a literal %#", async (fields) => {
    const out = await setup().run("set_request_auth", { requestId: "r1", auth: { ...nullAuth, ...fields } });
    expect(out.ok).toBe(false);
  });

  it("bulk_update_requests refuses a literal secret header", async () => {
    const out = await setup().run("bulk_update_requests", {
      ids: ["r1"],
      op: { method: null, urlReplace: null, upsertHeaders: [pair("Authorization", `Bearer ${JWT_SECRET}`)], removeHeaders: null },
    });
    expect(out.ok).toBe(false);
  });

  it("environment tools refuse a secret value and never echo one", async () => {
    const env = setup();
    const created = await env.run("create_environment", {
      name: "Prod",
      variables: [{ key: "API_TOKEN", value: PLAIN_PASSWORD, secret: true }],
    });
    expect(created.ok).toBe(false);
    const updated = await env.run("set_env_variables", {
      environmentId: "e1",
      upsert: [{ key: "DB_PASSWORD", value: PLAIN_PASSWORD, secret: null }],
      remove: null,
    });
    expect(updated.ok).toBe(false);
    expect(JSON.stringify([created, updated])).not.toContain(PLAIN_PASSWORD);
  });
});

/* --------------------------------- scripts --------------------------------- */

describe("[success] script tools are text only", () => {
  it("stores a script verbatim and never executes it", async () => {
    const env = setup();
    const script = "globalThis.__relayPwned = true;";
    const out = await env.run("set_request_scripts", { requestId: "r1", pre: script, post: null });
    expect(out.ok).toBe(true);
    expect((globalThis as Record<string, unknown>).__relayPwned).toBeUndefined();
    expect(env.state.requests.find((r) => r.id === "r1")?.preScript).toBe(script);
  });

  it("[invalid] bounds the script length", () => {
    const tooLong = "x".repeat(50_001);
    expect(
      RELAY_TOOL_SCHEMAS.set_request_scripts.inputSchema.safeParse({ requestId: "r1", pre: tooLong, post: null }).success,
    ).toBe(false);
  });
});

/* ------------------------------ network output ----------------------------- */

describe("[invalid] network errors are scrubbed before the model sees them", () => {
  it("redacts a token echoed by a failed send", async () => {
    const port = {
      send: vi.fn(async () => {
        throw new Error(`request to https://a.test failed with Bearer ${JWT_SECRET}`);
      }),
      runChain: vi.fn(),
    } as unknown as NetworkPort;
    const out = await setup(port).run("send_request", { requestId: "r1" });
    expect(out.ok).toBe(false);
    expect(JSON.stringify(out)).not.toContain(JWT_SECRET);
  });

  it("redacts a token inside a failed chain step", async () => {
    const port = {
      send: vi.fn(),
      runChain: vi.fn(async () => ({
        status: "failed",
        counts: { passed: 0, failed: 1, skipped: 0, aborted: 0 },
        failed: [{ nodeId: "r1", label: "Req", error: `denied: Bearer ${JWT_SECRET}` }],
      })),
    } as unknown as NetworkPort;
    const env = createFakeStoreAccess({ requests: [], chains: [{ id: "ch1", name: "N", nodeIds: [], blocks: [], edges: [] }] } as never);
    const out = await executeTool(registry, "run_chain", { chainId: "ch1", fromNodeId: null }, {
      store: env.access,
      redact: DEFAULT_REDACT_CONTEXT,
      network: port,
      approval: grantApproval(),
    } as ToolContext);
    expect(out.ok).toBe(true);
    expect(JSON.stringify(out)).not.toContain(JWT_SECRET);
  });
});
