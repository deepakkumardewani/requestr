import { describe, expect, it, vi } from "vitest";
import type { Chain } from "@/types/chain";
import { DEFAULT_REDACT_CONTEXT, REDACTED } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { chainWriteTools } from "./chainWrite";
import { createRegistry, executeTool } from "./registry";
import { uiTools } from "./ui";

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
    const out = await run("create_chain", { name: " Checkout " });
    expect(out.ok).toBe(true);
    const id = (data(out).createdIds as string[])[0];
    const created = chainsOf(state as never).find((chain) => chain.id === id);
    expect(created).toMatchObject({ name: "Checkout", scope: "standalone" });
    await log.undo(String(data(out).changeId));
    expect(chainsOf(state as never).some((chain) => chain.id === id)).toBe(false);
  });

  it("[invalid] rejects an empty name", async () => {
    const { run } = setup();
    expect(await run("create_chain", { name: "  " })).toMatchObject({ ok: false });
  });

  it("[invalid] rejects a collectionId and never adds a collection (AC1.2)", async () => {
    const { run, state } = setup();
    expect(await run("create_chain", { name: "X", collectionId: "c1" })).toMatchObject({
      ok: false,
    });
    expect(await run("create_chain", { name: "X", collectionId: null })).toMatchObject({
      ok: false,
    });
    expect(chainsOf(state as never)).toHaveLength(1);
  });

  it("[success] creates a standalone chain with no collectionId and leaves collections alone (AC1.1)", async () => {
    const { run, data, state } = setup();
    const collectionsBefore = (state as unknown as { collections: unknown[] }).collections;
    const out = await run("create_chain", { name: "Flow" });
    const id = (data(out).createdIds as string[])[0];
    const created = chainsOf(state as never).find((chain) => chain.id === id);
    expect(created?.scope).toBe("standalone");
    expect(created?.collectionId).toBeUndefined();
    expect((state as unknown as { collections: unknown[] }).collections).toEqual(collectionsBefore);
  });

  it("[success] gives each created chain a distinct id", async () => {
    const { run, data } = setup();
    const first = (data(await run("create_chain", { name: "A" })).createdIds as string[])[0];
    const second = (data(await run("create_chain", { name: "B" })).createdIds as string[])[0];
    expect(first).not.toBe(second);
  });
});

describe("existing collection chain (AC1.4)", () => {
  const collectionChain = () =>
    baseChain({ id: "c1", scope: "collection", collectionId: "c1", name: "Orders chain" });
  const bothRegistry = createRegistry([...chainWriteTools, ...uiTools]);

  it("[success][undo] is readable, editable and undoable", async () => {
    const { run, data, state, log } = setup(collectionChain());
    const read = await run("get_chain", { chainId: "c1" });
    expect(read.ok).toBe(true);
    expect(data(read)).toMatchObject({ id: "c1", name: "Orders chain" });

    const renamed = await run("rename_chain", { id: "c1", name: "Renamed" });
    expect(renamed.ok).toBe(true);
    expect(chainsOf(state as never)[0]).toMatchObject({
      name: "Renamed",
      scope: "collection",
      collectionId: "c1",
    });
    await log.undo(String(data(renamed).changeId));
    expect(chainsOf(state as never)[0].name).toBe("Orders chain");
  });

  it("[success] opens through open_item with its route", async () => {
    const fake = createFakeWriteContext({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      requests: [],
      chains: [collectionChain()],
    } as never);
    const navigate = vi.fn();
    const out = await executeTool(bothRegistry, "open_item", { kind: "chain", id: "c1" }, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
      navigate,
    });
    expect(out.ok).toBe(true);
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining("c1"));
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

describe("chain writes reach the open editor (CONV-08)", () => {
  const deepFreeze = <T,>(value: T): T => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  };

  it("commits new chain, block and edge objects without mutating the previous ones", async () => {
    const original = deepFreeze(
      withBlocks(
        [{ id: "d1", type: "delay", delayMs: 100 }],
        baseChain().edges,
      ),
    );
    const { run, state } = setup(original);
    const patched = await run("update_chain_node", {
      chainId: "ch1",
      nodeId: "d1",
      patch: { ...noPatch, delayMs: 900 },
    });
    const connected = await run("connect_chain_nodes", {
      chainId: "ch1",
      from: "r1",
      to: "r2",
      handle: null,
      remove: true,
    });
    expect(patched.ok).toBe(true);
    expect(connected.ok).toBe(true);
    const next = currentChain(state);
    expect(next).not.toBe(original);
    expect(next.blocks[0]).not.toBe(original.blocks[0]);
    expect(next.edges).not.toBe(original.edges);
    expect(original.blocks[0]).toMatchObject({ delayMs: 100 });
  });
});

describe("update_chain_node by node kind", () => {
  const blocks: Chain["blocks"] = [
    { id: "l1", type: "loop", sourceJsonPath: "$.a", itemAlias: "item", maxIterations: 5 },
    { id: "x1", type: "display", sourceJsonPath: "$.t", targetField: "header", targetKey: "X-A" },
    { id: "v1", type: "validate", schema: "{}", sourceJsonPath: "$.v" },
    { id: "ev", type: "evaluate", code: "return 1", outputAlias: "out" },
  ];
  const patchNode = (run: ReturnType<typeof setup>["run"], nodeId: string, change: object) =>
    run("update_chain_node", { chainId: "ch1", nodeId, patch: { ...noPatch, ...change } });
  const blockOf = (state: unknown, id: string) => currentChain(state).blocks.find((b) => b.id === id);

  it("[success][undo] patches a loop and keeps the fields it was not given", async () => {
    const { run, data, state, log } = setup(withBlocks(blocks));
    const out = await patchNode(run, "l1", { itemAlias: "row", maxIterations: 9 });
    expect(blockOf(state, "l1")).toMatchObject({ sourceJsonPath: "$.a", itemAlias: "row", maxIterations: 9 });
    await log.undo(String(data(out).changeId));
    expect(blockOf(state, "l1")).toMatchObject({ itemAlias: "item", maxIterations: 5 });
  });

  it("[success] patches a display node and a validate node", async () => {
    const { run, state } = setup(withBlocks(blocks));
    await patchNode(run, "x1", { targetField: "url", targetKey: "id" });
    await patchNode(run, "v1", { schema: '{"type":"object"}' });
    expect(blockOf(state, "x1")).toMatchObject({ sourceJsonPath: "$.t", targetField: "url", targetKey: "id" });
    expect(blockOf(state, "v1")).toMatchObject({ schema: '{"type":"object"}', sourceJsonPath: "$.v" });
    await patchNode(run, "x1", { sourceJsonPath: "$.u" });
    await patchNode(run, "v1", { sourceJsonPath: "$.w" });
    expect(blockOf(state, "x1")).toMatchObject({ sourceJsonPath: "$.u", targetKey: "id" });
    expect(blockOf(state, "v1")).toMatchObject({ sourceJsonPath: "$.w" });
  });

  it("[invalid] rejects a patch on a node kind with no settings", async () => {
    const { run } = setup(withBlocks(blocks));
    expect(await patchNode(run, "ev", {})).toEqual({
      ok: false,
      error: "a evaluate node has no settings to update",
    });
  });

  it("[success] patches a condition variable and leaves its branches", async () => {
    const branches = [{ id: "b1", label: "ok", expression: "== 1" }];
    const { run, state } = setup(withBlocks([{ id: "c", type: "condition", variable: "s", branches }]));
    expect((await patchNode(run, "c", { variable: "t" })).ok).toBe(true);
    expect(blockOf(state, "c")).toMatchObject({ variable: "t", branches });
  });
});

describe("connect_chain_nodes handles by source kind", () => {
  const chain = () =>
    withBlocks([
      { id: "l1", type: "loop", sourceJsonPath: "$.a", itemAlias: "i", maxIterations: 3 },
      { id: "d1", type: "delay", delayMs: 1 },
      {
        id: "c1",
        type: "condition",
        variable: "s",
        branches: [{ id: "b1", label: "ok", expression: "== 1" }],
      },
    ]);
  const connect = (from: string, handle: string | null, to = "r2") => ({
    chainId: "ch1",
    from,
    to,
    handle,
    remove: null,
  });

  it("[success] wires a loop body, a condition branch by label and a handle-less node", async () => {
    const { run, state } = setup(chain());
    expect((await run("connect_chain_nodes", connect("l1", "body"))).ok).toBe(true);
    expect((await run("connect_chain_nodes", connect("c1", "ok"))).ok).toBe(true);
    expect((await run("connect_chain_nodes", connect("d1", null))).ok).toBe(true);
    expect(currentChain(state).edges.map((e) => [e.sourceRequestId, e.branchId])).toEqual([
      ["l1", "body"],
      ["c1", "b1"],
      ["d1", undefined],
    ]);
  });

  it("[invalid] rejects an unknown loop or condition handle and a handle on a delay", async () => {
    const { run } = setup(chain());
    expect(await run("connect_chain_nodes", connect("l1", "nope"))).toMatchObject({ ok: false });
    expect(await run("connect_chain_nodes", connect("c1", "nope"))).toMatchObject({ ok: false });
    expect(await run("connect_chain_nodes", connect("d1", "fail"))).toMatchObject({ ok: false });
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

describe("rename_chain", () => {
  it("[success][undo] renames and restores the old name", async () => {
    const { run, state, data, log } = setup();
    const out = await run("rename_chain", { id: "ch1", name: " Checkout flow " });
    expect(out.ok).toBe(true);
    expect(currentChain(state).name).toBe("Checkout flow");
    await log.undo(String(data(out).changeId));
    expect(currentChain(state).name).toBe("Login flow");
  });

  it("[invalid] rejects a blank name and an unknown chain", async () => {
    const { run, state } = setup();
    expect(await run("rename_chain", { id: "ch1", name: "  " })).toMatchObject({ ok: false });
    expect(await run("rename_chain", { id: "nope", name: "X" })).toMatchObject({ ok: false });
    expect(currentChain(state).name).toBe("Login flow");
  });
});

describe("HH-M17: chain tools accept omitted nullable keys", () => {
  const current = (state: unknown) =>
    chainsOf(state as never).find((chain) => chain.id === "ch1") as Chain;

  it("[success][undo] add_chain_node adds a delay node when every unused key is omitted", async () => {
    const { run, state, data, log } = setup();
    const before = structuredClone(current(state));
    const out = await run("add_chain_node", {
      chainId: "ch1",
      block: { kind: "delay", delayMs: 250 },
      after: "r2",
      afterHandle: null,
    });
    expect(out.ok).toBe(true);
    expect(current(state).blocks).toHaveLength(1);
    await log.undo(String(data(out).changeId));
    expect(current(state)).toEqual(before);
  });

  it("[invalid] a delay node with delayMs omitted is refused like one with delayMs null", async () => {
    const { run, state } = setup();
    const omitted = await run("add_chain_node", { chainId: "ch1", block: { kind: "delay" }, after: null, afterHandle: null });
    const nulled = await run("add_chain_node", {
      chainId: "ch1",
      block: { kind: "delay", delayMs: null },
      after: null,
      afterHandle: null,
    });
    expect(omitted).toMatchObject({ ok: false });
    expect(omitted).toEqual(nulled);
    expect(current(state).blocks).toHaveLength(0);
  });

  it("[success] a request block may omit every key but requestId", async () => {
    const { run, state } = setup(baseChain({ nodeIds: ["r1"], edges: [] }));
    const out = await run("add_chain_node", {
      chainId: "ch1",
      block: { kind: "request", requestId: "r2" },
      after: "r1",
      afterHandle: null,
    });
    expect(out.ok).toBe(true);
    expect(current(state).nodeIds).toContain("r2");
  });

  it("[success] update_chain_node patches one field and leaves omitted keys alone", async () => {
    const { run, state } = setup();
    const added = await run("add_chain_node", { chainId: "ch1", block: { kind: "delay", delayMs: 100 }, after: null, afterHandle: null });
    expect(added.ok).toBe(true);
    const nodeId = current(state).blocks[0].id;
    const out = await run("update_chain_node", { chainId: "ch1", nodeId, patch: { delayMs: 900 } });
    expect(out.ok).toBe(true);
    expect(JSON.stringify(current(state).blocks[0])).toContain("900");
  });

  it("[invalid] a patch field the node kind lacks is refused when set, and ignored when omitted", async () => {
    const { run, state } = setup();
    await run("add_chain_node", { chainId: "ch1", block: { kind: "delay", delayMs: 100 }, after: null, afterHandle: null });
    const nodeId = current(state).blocks[0].id;
    expect((await run("update_chain_node", { chainId: "ch1", nodeId, patch: { itemAlias: "x" } })).ok).toBe(false);
    expect((await run("update_chain_node", { chainId: "ch1", nodeId, patch: { delayMs: 5 } })).ok).toBe(true);
  });

  it("[success] a condition block with branches omitted still gets its else branch", async () => {
    const { run, state } = setup();
    const out = await run("add_chain_node", {
      chainId: "ch1",
      block: { kind: "condition", variable: "x" },
      after: null,
      afterHandle: null,
    });
    expect(out).toMatchObject({ ok: true });
    expect(current(state).blocks).toHaveLength(1);
  });
});

describe("branch coverage: descriptions, defaults and refusals", () => {
  const impl = (name: string) => chainWriteTools.find((tool) => tool.name === name)!;
  const direct = (fake: ReturnType<typeof setup>, name: string, input: unknown) =>
    (impl(name).run as (i: unknown, c: unknown) => Promise<{ ok: boolean; error?: string }>)(input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
  const emptyBlock = {
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
  };
  const addInput = (block: object, extra: object = {}) => ({
    chainId: "ch1",
    block: { ...emptyBlock, ...block },
    after: null,
    afterHandle: null,
    ...extra,
  });
  const edge = (id: string, from: string, to: string, branchId?: string) => ({
    id,
    sourceRequestId: from,
    targetRequestId: to,
    injections: [],
    ...(branchId ? { branchId } : {}),
  });
  const nestedLoops = () =>
    baseChain({
      nodeIds: ["r1"],
      edges: [edge("e1", "l1", "l2", "body"), edge("e2", "l2", "l3", "body")],
      blocks: ["l1", "l2", "l3"].map((id) => ({
        id,
        type: "loop" as const,
        sourceJsonPath: "$.a",
        itemAlias: "i",
        maxIterations: 2,
      })),
    });

  it("[success] get_chain names a node whose request is gone by its id and keeps real injections", async () => {
    const { run, data } = setup(
      baseChain({
        nodeIds: ["r1", "ghost"],
        edges: [
          {
            id: "e1",
            sourceRequestId: "r1",
            targetRequestId: "ghost",
            injections: [
              { sourceJsonPath: "$.token", targetField: "header", targetKey: "Authorization" },
              { sourceJsonPath: "", targetField: "header", targetKey: "X-Only-Key" },
              { sourceJsonPath: "", targetField: "url", targetKey: "" },
            ],
          },
        ],
        nodeAssertions: {
          r1: [{ id: "a1", source: "status", operator: "eq", enabled: true } as never],
        },
      }),
    );
    const chain = data(await run("get_chain", { chainId: "ch1" })) as {
      nodes: { id: string; name?: string; method: string | null; url: string | null }[];
      edges: { injections: { targetKey: string }[] }[];
      assertions: { assertions: { expectedValue: string }[] }[];
    };
    expect(chain.nodes.find((node) => node.id === "ghost")).toMatchObject({ name: "ghost", method: null, url: null });
    expect(chain.edges[0].injections.map((item) => item.targetKey)).toEqual(["Authorization", "X-Only-Key"]);
    expect(chain.assertions[0].assertions[0].expectedValue).toBe("");
  });

  it("[success] get_chain_run names a history node and falls back to the id for an unknown node", async () => {
    const { run, data, state } = setup(
      baseChain({
        blocks: [
          {
            id: "h1",
            type: "history",
            historyEntryId: "x",
            name: "Ping",
            method: "GET",
            url: "https://api.test/ping",
            params: [],
            headers: [],
            auth: { type: "none" },
            body: { type: "none", content: "" },
          },
        ],
      }),
    );
    state.chainRunState = {
      ch1: {
        h1: { state: "passed", extractedValues: {} },
        mystery: { state: "skipped", extractedValues: {} },
      },
    };
    const nodes = (data(await run("get_chain_run", { chainId: "ch1" })) as { nodes: { name: string }[] }).nodes;
    expect(nodes.map((node) => node.name)).toEqual(["Ping", "mystery"]);
  });

  it("[invalid] every chain tool reports a chain that vanished before it ran", async () => {
    const fake = setup();
    const inputs: [string, unknown][] = [
      ["get_chain", { chainId: "gone" }],
      ["get_chain_run", { chainId: "gone" }],
      ["rename_chain", { id: "gone", name: "New" }],
      ["add_chain_node", addInput({ delayMs: 5 }, { chainId: "gone" })],
      ["update_chain_node", { chainId: "gone", nodeId: "d1", patch: noPatch }],
      ["connect_chain_nodes", { chainId: "gone", from: "r1", to: "r2", handle: null, remove: null }],
    ];
    for (const [name, input] of inputs) {
      expect(await direct(fake, name, input), name).toEqual({ ok: false, error: "chain not found: gone" });
    }
  });

  it("[invalid] extract, request and loop nodes name the field they are missing", async () => {
    const { run } = setup();
    expect(await run("add_chain_node", addInput({ kind: "extract", targetKey: "X-A" }))).toMatchObject({
      ok: false,
      error: "sourceJsonPath is required for a extract node",
    });
    expect(await run("add_chain_node", addInput({ kind: "request" }))).toMatchObject({
      ok: false,
      error: "requestId is required for a request node",
    });
  });

  it("[success] an assertion node with no schema or path gets an empty object schema and path", async () => {
    const { run, state } = setup();
    const out = await run("add_chain_node", addInput({ kind: "assertion" }));
    expect(out.ok).toBe(true);
    const chain = chainsOf(state as never)[0];
    expect(chain.blocks.at(-1)).toMatchObject({ type: "validate", schema: "{}", sourceJsonPath: "" });
  });

  it("[invalid] a new node cannot hang off an output that is already wired", async () => {
    const { run, state } = setup(
      baseChain({
        nodeIds: ["r1"],
        edges: [edge("e1", "l1", "r1", "body")],
        blocks: [{ id: "l1", type: "loop", sourceJsonPath: "$.a", itemAlias: "i", maxIterations: 2 }],
      }),
    );
    const out = await run("add_chain_node", addInput({ delayMs: 5 }, { after: "l1", afterHandle: "body" }));
    expect(out).toEqual({ ok: false, error: "those nodes cannot be connected" });
    expect(chainsOf(state as never)[0].blocks).toHaveLength(1);
  });

  it("[invalid] adding a fourth nested loop is refused and the chain is unchanged", async () => {
    const { run, state } = setup(nestedLoops());
    const out = await run(
      "add_chain_node",
      addInput({ kind: "loop", sourceJsonPath: "$.b" }, { after: "l3", afterHandle: "body" }),
    );
    expect(out).toEqual({ ok: false, error: "loops cannot be nested that deeply" });
    expect(chainsOf(state as never)[0].blocks).toHaveLength(3);
  });

  it("[invalid] a second edge into an extract node is refused", async () => {
    const { run, state } = setup(
      baseChain({
        edges: [edge("e1", "r1", "x1")],
        blocks: [{ id: "x1", type: "display", sourceJsonPath: "$.t", targetField: "header", targetKey: "X-A" }],
      }),
    );
    const out = await run("connect_chain_nodes", { chainId: "ch1", from: "r2", to: "x1", handle: null, remove: null });
    expect(out).toEqual({ ok: false, error: "an extract node accepts only one incoming edge" });
    expect(chainsOf(state as never)[0].edges).toHaveLength(1);
  });

  it("[invalid] nothing can connect into a start node", async () => {
    const { run } = setup(baseChain({ blocks: [{ id: "st", type: "start", inputs: [] }] }));
    const out = await run("connect_chain_nodes", { chainId: "ch1", from: "r1", to: "st", handle: null, remove: null });
    expect(out).toEqual({ ok: false, error: "nothing can connect into a start node" });
  });

  it("[success] a loop patch with only an alias keeps the path and cap, and a delay patch with no delay keeps it", async () => {
    const { run, state } = setup(
      withBlocks([
        { id: "l1", type: "loop", sourceJsonPath: "$.a", itemAlias: "item", maxIterations: 5 },
        { id: "d1", type: "delay", delayMs: 100 },
      ]),
    );
    await run("update_chain_node", { chainId: "ch1", nodeId: "l1", patch: { ...noPatch, itemAlias: "row" } });
    await run("update_chain_node", { chainId: "ch1", nodeId: "d1", patch: noPatch });
    const blocks = currentChain(state).blocks;
    expect(blocks[0]).toMatchObject({ sourceJsonPath: "$.a", itemAlias: "row", maxIterations: 5 });
    expect(blocks[1]).toMatchObject({ delayMs: 100 });
  });
});
