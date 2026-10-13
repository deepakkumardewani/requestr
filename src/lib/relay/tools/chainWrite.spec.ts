import { describe, expect, it } from "vitest";
import type { Chain } from "@/types/chain";
import { DEFAULT_REDACT_CONTEXT, REDACTED } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { chainWriteTools } from "./chainWrite";
import { createRegistry, executeTool } from "./registry";

const registry = createRegistry(chainWriteTools);

const request = (id: string, name: string, url = "https://api.test/x") => ({
  id,
  collectionId: "c1",
  folderId: null,
  name,
  method: "GET" as const,
  url,
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

const baseChain = (overrides: Partial<Chain> = {}): Chain => ({
  id: "ch1",
  scope: "standalone",
  schemaVersion: 5,
  name: "Login flow",
  blocks: [],
  nodeIds: ["r1", "r2"],
  edges: [
    {
      id: "e1",
      sourceRequestId: "r1",
      targetRequestId: "r2",
      injections: [],
    },
  ],
  nodePositions: { r1: { x: 40, y: 120 }, r2: { x: 320, y: 120 } },
  ...overrides,
});

function setup(chain: Chain = baseChain()) {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    requests: [
      request("r1", "Login"),
      request("r2", "Me", "https://api.test/me?api_key=abcdef123456"),
    ],
    chains: [chain],
  } as never);
  const run = (name: string, input: unknown) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
  const data = (outcome: Awaited<ReturnType<typeof run>>) =>
    (outcome as { ok: true; data: Record<string, unknown> }).data;
  return { ...fake, run, data };
}

describe("get_chain", () => {
  it("[success] lists nodes and edges with request details redacted", async () => {
    const { run, data } = setup(
      baseChain({
        blocks: [
          {
            id: "h1",
            type: "history",
            historyEntryId: "x",
            name: "Ping",
            method: "GET",
            url: "https://api.test/ping?token=supersecretvalue",
            params: [],
            headers: [{ id: "a", key: "Authorization", value: "Bearer abc", enabled: true }],
            auth: { type: "bearer", token: "supersecretvalue" },
            body: { type: "none", content: "" },
          },
          { id: "d1", type: "delay", delayMs: 500 },
        ],
      }),
    );
    const out = await run("get_chain", { chainId: "ch1" });
    expect(out.ok).toBe(true);
    const chain = data(out) as {
      nodes: { id: string; url?: string; headers?: unknown; auth?: unknown }[];
      edges: { from: string; to: string; handle: string | null }[];
    };
    expect(chain.nodes.map((node) => node.id)).toEqual(["r1", "r2", "h1", "d1"]);
    expect(chain.edges).toEqual([
      { id: "e1", from: "r1", to: "r2", handle: null, injections: [] },
    ]);
    const json = JSON.stringify(out);
    expect(json).not.toContain("supersecretvalue");
    expect(json).not.toContain("abcdef123456");
    expect(json).toContain(REDACTED);
    const history = chain.nodes.find((node) => node.id === "h1");
    expect(history?.headers).toBeUndefined();
    expect(history?.auth).toBeUndefined();
  });

  it("[success] summarises evaluate, start and subchain blocks without their code or bindings", async () => {
    const { run } = setup(
      baseChain({
        blocks: [
          { id: "ev", type: "evaluate", code: "return secretLogic", outputAlias: "out" },
          { id: "st", type: "start", inputs: [{ key: "user", defaultValue: "pw", source: "literal" }] },
          { id: "sc", type: "subchain", chainId: "other", inputBindings: { token: "abc123" } },
        ],
      }),
    );
    const text = JSON.stringify(await run("get_chain", { chainId: "ch1" }));
    expect(text).not.toContain("secretLogic");
    expect(text).not.toContain("abc123");
    expect(text).toContain('"inputs":["user"]');
    expect(text).toContain('"inputBindings":["token"]');
  });

  it("[success] redacts assertion expectations", async () => {
    const { run } = setup(
      baseChain({
        nodeAssertions: {
          r1: [
            {
              id: "a1",
              source: "status",
              operator: "eq",
              expectedValue: "Bearer abcdefghijkl",
              enabled: true,
            },
          ],
        },
      }),
    );
    const text = JSON.stringify(await run("get_chain", { chainId: "ch1" }));
    expect(text).not.toContain("abcdefghijkl");
  });

  it("[invalid] fails for an unknown chain and for bad input", async () => {
    const { run } = setup();
    expect(await run("get_chain", { chainId: "nope" })).toEqual({
      ok: false,
      error: "chain not found: nope",
    });
    expect(await run("get_chain", {})).toMatchObject({ ok: false });
  });
});

describe("get_chain_run", () => {
  it("[success] reports that no run is available yet", async () => {
    const { run, data } = setup();
    expect(data(await run("get_chain_run", { chainId: "ch1" }))).toEqual({
      chainId: "ch1",
      available: false,
    });
  });

  it("[success] summarises per-node results and caps long errors", async () => {
    const { run, data, state } = setup(
      baseChain({ blocks: [{ id: "d1", type: "delay", delayMs: 1 }] }),
    );
    state.chainRunState = {
      ch1: {
        r1: {
          state: "passed",
          extractedValues: { token: "supersecretvalue" },
          response: { status: 200 } as never,
          assertionResults: [{ assertionId: "a1", passed: true, actual: "200" }],
        },
        r2: { state: "failed", extractedValues: {}, error: "x".repeat(500) },
        d1: { state: "skipped", extractedValues: {} },
      },
    };
    const out = await run("get_chain_run", { chainId: "ch1" });
    const result = data(out) as {
      counts: Record<string, number>;
      untrusted: boolean;
      nodes: { nodeId: string; name: string; status: number | null; error: string | null }[];
    };
    expect(result.untrusted).toBe(true);
    expect(result.counts).toEqual({ passed: 1, failed: 1, skipped: 1 });
    expect(result.nodes.map((node) => node.name)).toEqual(["Login", "Me", "delay"]);
    expect(result.nodes[0].status).toBe(200);
    expect(result.nodes[1].error).toHaveLength(200);
    expect(JSON.stringify(out)).not.toContain("supersecretvalue");
  });

  it("[invalid] fails for an unknown chain", async () => {
    const { run } = setup();
    expect(await run("get_chain_run", { chainId: "nope" })).toEqual({
      ok: false,
      error: "chain not found: nope",
    });
  });
});

const chainsOf = (state: { chains: Chain[] }) => state.chains;

describe("create_chain", () => {
  it("[success][undo] creates a standalone chain and undo removes it", async () => {
    const { run, data, state, log } = setup();
    const out = await run("create_chain", { name: " Checkout ", collectionId: null });
    expect(out.ok).toBe(true);
    const id = (data(out).createdIds as string[])[0];
    const created = chainsOf(state as never).find((chain) => chain.id === id);
    expect(created).toMatchObject({ name: "Checkout", scope: "standalone" });
    await log.undo(String(data(out).changeId));
    expect(chainsOf(state as never).some((chain) => chain.id === id)).toBe(false);
  });

  it("[success] attaches to a collection using its id, once", async () => {
    const { run, state } = setup();
    expect((await run("create_chain", { name: "Orders flow", collectionId: "c1" })).ok).toBe(true);
    expect(chainsOf(state as never).find((chain) => chain.id === "c1")?.scope).toBe("collection");
    expect(await run("create_chain", { name: "Again", collectionId: "c1" })).toMatchObject({
      ok: false,
    });
  });

  it("[invalid] rejects an empty name and an unknown collection", async () => {
    const { run } = setup();
    expect(await run("create_chain", { name: "  ", collectionId: null })).toMatchObject({ ok: false });
    expect(await run("create_chain", { name: "x", collectionId: "nope" })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
  });
});

describe("add_chain_node", () => {
  const add = (block: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    chainId: "ch1",
    block: {
      kind: "delay",
      requestId: null,
      sourceJsonPath: null,
      schema: null,
      delayMs: null,
      itemAlias: null,
      maxIterations: null,
      variable: null,
      branches: null,
      targetField: null,
      targetKey: null,
      ...block,
    },
    after: null,
    afterHandle: null,
    ...extra,
  });
  const current = (state: unknown) =>
    chainsOf(state as never).find((chain) => chain.id === "ch1") as Chain;

  it("[success][undo] adds an assertion after a node and undo restores nodes and edges (AC-12)", async () => {
    const { run, data, state, log } = setup();
    const before = structuredClone(current(state));
    const out = await run(
      "add_chain_node",
      add({ kind: "assertion", schema: '{"type":"object"}', sourceJsonPath: "$.body" }, { after: "r2" }),
    );
    expect(out.ok).toBe(true);
    const after = current(state);
    expect(after.blocks).toHaveLength(1);
    expect(after.edges.at(-1)).toMatchObject({ sourceRequestId: "r2", targetRequestId: after.blocks[0].id });
    await log.undo(String(data(out).changeId));
    expect(current(state)).toEqual(before);
  });

  it("[success][invalid] adds a saved request once and rejects a duplicate or unknown one", async () => {
    const { run, state } = setup(baseChain({ nodeIds: ["r1"], edges: [] }));
    expect((await run("add_chain_node", add({ kind: "request", requestId: "r2" }, { after: "r1" }))).ok).toBe(true);
    expect(current(state).nodeIds).toEqual(["r1", "r2"]);
    expect(await run("add_chain_node", add({ kind: "request", requestId: "r2" }))).toMatchObject({ ok: false });
    expect(await run("add_chain_node", add({ kind: "request", requestId: "zz" }))).toMatchObject({ ok: false });
  });

  it("[success] adds a loop with its collect, a condition with an else, and an extract", async () => {
    const { run, state } = setup();
    await run("add_chain_node", add({ kind: "loop", sourceJsonPath: "$.items" }, { after: "r2" }));
    const types = current(state).blocks.map((block) => block.type);
    expect(types).toEqual(["loop", "collect"]);
    await run("add_chain_node", add({ kind: "condition", variable: "status" }, { after: "r1", afterHandle: "success" }));
    const condition = current(state).blocks.find((block) => block.type === "condition");
    expect(condition && "branches" in condition && condition.branches.at(-1)?.label).toBe("else");
    const out = await run(
      "add_chain_node",
      add({ kind: "extract", sourceJsonPath: "$.token", targetKey: "token" }, { after: "r1" }),
    );
    expect(out.ok).toBe(true);
  });

  it("[invalid] returns structured errors for invalid configs (FR-43)", async () => {
    const { run, state } = setup();
    const snapshot = structuredClone(current(state));
    for (const input of [
      add({ kind: "delay" }),
      add({ kind: "loop" }),
      add({ kind: "condition" }),
      add({ kind: "extract", sourceJsonPath: "$.a" }),
      add({ kind: "assertion", schema: "not json" }),
      add({ kind: "delay", delayMs: 10 }, { after: "ghost" }),
      add({ kind: "delay", delayMs: 10 }, { after: "r1", afterHandle: "weird" }),
      { ...add({ kind: "delay", delayMs: 10 }), chainId: "nope" },
    ]) {
      expect(await run("add_chain_node", input)).toMatchObject({ ok: false });
    }
    expect(current(state)).toEqual(snapshot);
  });
});

const noPatch = {
  sourceJsonPath: null,
  schema: null,
  delayMs: null,
  itemAlias: null,
  maxIterations: null,
  variable: null,
  branches: null,
  targetField: null,
  targetKey: null,
};
const withBlocks = (blocks: Chain["blocks"], edges: Chain["edges"] = []) =>
  baseChain({ blocks, edges, nodeIds: ["r1", "r2"] });
const currentChain = (state: unknown) =>
  chainsOf(state as never).find((chain) => chain.id === "ch1") as Chain;

describe("update_chain_node", () => {
  it("[success][undo] patches a delay and undo restores it", async () => {
    const { run, data, state, log } = setup(withBlocks([{ id: "d1", type: "delay", delayMs: 100 }]));
    const out = await run("update_chain_node", {
      chainId: "ch1",
      nodeId: "d1",
      patch: { ...noPatch, delayMs: 900 },
    });
    expect(out.ok).toBe(true);
    expect(currentChain(state).blocks[0]).toMatchObject({ delayMs: 900 });
    await log.undo(String(data(out).changeId));
    expect(currentChain(state).blocks[0]).toMatchObject({ delayMs: 100 });
  });

  it("[success][invalid] keeps surviving condition branch ids and blocks removing a wired branch", async () => {
    const branches = [
      { id: "b1", label: "ok", expression: "== 1" },
      { id: "b2", label: "else", expression: "" },
    ];
    const { run, state } = setup(
      withBlocks(
        [{ id: "c", type: "condition", variable: "s", branches }],
        [{ id: "e", sourceRequestId: "c", targetRequestId: "r2", injections: [], branchId: "b1" }],
      ),
    );
    const keep = await run("update_chain_node", {
      chainId: "ch1",
      nodeId: "c",
      patch: { ...noPatch, branches: [{ label: "ok", expression: "== 2" }] },
    });
    expect(keep.ok).toBe(true);
    const condition = currentChain(state).blocks[0];
    expect("branches" in condition && condition.branches[0]).toMatchObject({ id: "b1", expression: "== 2" });
    const drop = await run("update_chain_node", {
      chainId: "ch1",
      nodeId: "c",
      patch: { ...noPatch, branches: [{ label: "other", expression: "== 3" }] },
    });
    expect(drop).toMatchObject({ ok: false });
  });

  it("[invalid] rejects wrong-kind fields, request nodes, bad schema and unknown nodes", async () => {
    const { run } = setup(
      withBlocks([
        { id: "d1", type: "delay", delayMs: 1 },
        { id: "v1", type: "validate", schema: "{}", sourceJsonPath: "" },
      ]),
    );
    const patch = (nodeId: string, change: object) =>
      run("update_chain_node", { chainId: "ch1", nodeId, patch: { ...noPatch, ...change } });
    expect(await patch("d1", { variable: "x" })).toMatchObject({ ok: false });
    expect(await patch("r1", { delayMs: 5 })).toMatchObject({ ok: false });
    expect(await patch("v1", { schema: "[1]" })).toMatchObject({ ok: false });
    expect(await patch("ghost", {})).toMatchObject({ ok: false });
  });
});

describe("connect_chain_nodes", () => {
  const connect = (extra: object) => ({
    chainId: "ch1",
    from: "r1",
    to: "d1",
    handle: null,
    remove: null,
    ...extra,
  });
  const delayChain = () =>
    withBlocks([{ id: "d1", type: "delay", delayMs: 1 }], [
      { id: "e1", sourceRequestId: "r1", targetRequestId: "r2", injections: [] },
    ]);

  it("[success][undo] adds an edge and undo removes it", async () => {
    const { run, data, state, log } = setup(delayChain());
    const out = await run("connect_chain_nodes", connect({}));
    expect(out.ok).toBe(true);
    expect(currentChain(state).edges).toHaveLength(2);
    await log.undo(String(data(out).changeId));
    expect(currentChain(state).edges).toHaveLength(1);
  });

  it("[success][undo] removes an existing edge and undo restores it", async () => {
    const { run, data, state, log } = setup(delayChain());
    const out = await run("connect_chain_nodes", connect({ to: "r2", remove: true }));
    expect(out.ok).toBe(true);
    expect(currentChain(state).edges).toHaveLength(0);
    await log.undo(String(data(out).changeId));
    expect(currentChain(state).edges).toHaveLength(1);
    expect(await run("connect_chain_nodes", connect({ to: "d1", remove: true }))).toMatchObject({ ok: false });
  });

  it("[invalid] rejects cycles, duplicates, self links, bad handles and unknown nodes", async () => {
    const { run, state } = setup(delayChain());
    const snapshot = structuredClone(currentChain(state));
    for (const input of [
      connect({ from: "r2", to: "r1" }),
      connect({ to: "r2" }),
      connect({ to: "r1" }),
      connect({ handle: "body" }),
      connect({ from: "d1", to: "r2", handle: "fail" }),
      connect({ to: "ghost" }),
      connect({ chainId: "nope" }),
    ]) {
      expect(await run("connect_chain_nodes", input)).toMatchObject({ ok: false });
    }
    expect(currentChain(state)).toEqual(snapshot);
  });

  it("[success] allows a fail-path edge from a request", async () => {
    const { run, state } = setup(delayChain());
    expect((await run("connect_chain_nodes", connect({ handle: "fail" }))).ok).toBe(true);
    expect(currentChain(state).edges.at(-1)?.branchId).toBe("fail");
  });
});
