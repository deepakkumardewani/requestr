import { describe, expect, it } from "vitest";
import type { Chain } from "@/types/chain";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { duplicateTools } from "./duplicateTools";
import { createRegistry, executeTool } from "./registry";

const registry = createRegistry(duplicateTools);

const request = (id: string, folderId: string | null) => ({
  id,
  collectionId: "c1",
  folderId,
  name: `Req ${id}`,
  method: "GET" as const,
  url: "https://api.test/x",
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

const chain = {
  id: "ch1",
  scope: "workspace",
  schemaVersion: 1,
  name: "Flow",
  createdAt: 1,
  blocks: [],
  nodeIds: ["r1"],
  edges: [],
  nodePositions: { r1: { x: 1, y: 2 } },
} as unknown as Chain;

function setup() {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    folders: [
      { id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 },
      { id: "f2", collectionId: "c1", name: "Deep", parentFolderId: "f1", order: 0 },
    ],
    requests: [request("r1", null), request("r2", "f2")],
    chains: [chain],
    environments: [
      {
        id: "e1",
        name: "Prod",
        variables: [
          { id: "v1", key: "host", initialValue: "a.test", currentValue: "a.test", enabled: true },
          { id: "v2", key: "token", initialValue: "s3cret", currentValue: "s3cret", enabled: true, isSecret: true },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ] as never,
  });
  const run = (name: string, input: unknown, withWrite = true) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: withWrite ? fake.write : undefined,
    });
  const changeId = (out: Awaited<ReturnType<typeof run>>) =>
    String((out as { data: { changeId: string } }).data.changeId);
  return { ...fake, run, changeId };
}

describe("duplicate_collection", () => {
  it("[success] copies the tree with fresh ids and remapped references", async () => {
    const { run, state } = setup();
    const out = await run("duplicate_collection", { collectionId: "c1" });
    expect(out.ok).toBe(true);
    expect(state.collections.map((c) => c.name)).toEqual(["Orders", "Orders (copy)"]);
    const copyId = state.collections[1].id;
    expect(copyId).not.toBe("c1");
    const folders = state.folders.filter((f) => f.collectionId === copyId);
    const [admin, deep] = ["Admin", "Deep"].map((n) => folders.find((f) => f.name === n)!);
    expect(admin.id).not.toBe("f1");
    expect(admin.parentFolderId).toBeNull();
    expect(deep.parentFolderId).toBe(admin.id);
    const requests = state.requests.filter((r) => r.collectionId === copyId);
    expect(requests).toHaveLength(2);
    expect(requests.find((r) => r.name === "Req r1")?.folderId).toBeNull();
    expect(requests.find((r) => r.name === "Req r2")?.folderId).toBe(deep.id);
    expect(requests.map((r) => r.id)).not.toContain("r1");
    // The source is untouched.
    expect(state.requests.filter((r) => r.collectionId === "c1")).toHaveLength(2);
  });

  it("[success] a request with no folder or an unknown folder lands at the copy's top level", async () => {
    const { run, state } = setup();
    const orphan = { ...request("r4", "f-gone"), folderId: "f-gone" };
    const bare = { ...request("r5", null), name: "Bare" } as Record<string, unknown>;
    delete bare.folderId;
    state.requests = [...state.requests, orphan, bare as never];
    await run("duplicate_collection", { collectionId: "c1" });
    const copyId = state.collections[1].id;
    const copies = state.requests.filter((r) => r.collectionId === copyId);
    expect(copies).toHaveLength(4);
    expect(copies.find((r) => r.name === "Req r4")?.folderId).toBeNull();
    expect(copies.find((r) => r.name === "Bare")?.folderId).toBeNull();
  });

  it("[success][undo] undo removes the copy and nothing else", async () => {
    const { run, changeId, log, state } = setup();
    const out = await run("duplicate_collection", { collectionId: "c1" });
    await log.undo(changeId(out));
    expect(state.collections.map((c) => c.id)).toEqual(["c1"]);
    expect(state.requests).toHaveLength(2);
    expect(state.folders).toHaveLength(2);
  });

  it("[success] the answer carries ids and a summary, not entity content", async () => {
    const { run } = setup();
    const out = await run("duplicate_collection", { collectionId: "c1" });
    const data = (out as { data: Record<string, unknown> }).data;
    expect(data.summary).toBe('Duplicated collection "Orders"');
    expect(data).toHaveProperty("collectionId");
    expect(JSON.stringify(data)).not.toContain("api.test");
  });

  it("[invalid] rejects an unknown collection and a missing change log", async () => {
    const { run } = setup();
    expect(await run("duplicate_collection", { collectionId: "nope" })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
    expect(await run("duplicate_collection", {}, true)).toMatchObject({ ok: false });
    expect(
      (await run("duplicate_collection", { collectionId: "c1" }, false)).ok,
    ).toBe(false);
  });
});

describe("duplicate_chain", () => {
  it("[success][undo] copies the chain under a new id and undoes it", async () => {
    const { run, changeId, log, state } = setup();
    const out = await run("duplicate_chain", { chainId: "ch1" });
    expect(out.ok).toBe(true);
    expect(state.chains).toHaveLength(2);
    const copy = state.chains[1];
    expect(copy).toMatchObject({ name: "Flow (copy)", nodeIds: ["r1"] });
    expect(copy.id).not.toBe("ch1");
    expect(copy.nodePositions).not.toBe(state.chains[0].nodePositions);
    await log.undo(changeId(out));
    expect(state.chains.map((c) => c.id)).toEqual(["ch1"]);
  });

  it("[invalid] rejects an unknown chain and a missing change log", async () => {
    const { run } = setup();
    expect(await run("duplicate_chain", { chainId: "nope" })).toMatchObject({ ok: false });
    expect((await run("duplicate_chain", { chainId: "ch1" }, false)).ok).toBe(false);
  });
});

describe("duplicate_environment", () => {
  it("[success] copies variables with new ids and blanks secret values", async () => {
    const { run, state } = setup();
    const out = await run("duplicate_environment", { environmentId: "e1" });
    expect(out.ok).toBe(true);
    const copy = state.environments[1];
    expect(copy.name).toBe("Prod (copy)");
    expect(copy.id).not.toBe("e1");
    const [host, token] = copy.variables;
    expect(host).toMatchObject({ key: "host", initialValue: "a.test", currentValue: "a.test" });
    expect(token).toMatchObject({ key: "token", initialValue: "", currentValue: "" });
    expect(host.id).not.toBe("v1");
    // The source keeps its secret.
    expect(state.environments[0].variables[1].currentValue).toBe("s3cret");
  });

  it("[success][undo] undo deletes the copy", async () => {
    const { run, changeId, log, state } = setup();
    const out = await run("duplicate_environment", { environmentId: "e1" });
    await log.undo(changeId(out));
    expect(state.environments.map((e) => e.id)).toEqual(["e1"]);
  });

  it("[invalid] rejects an unknown environment and a missing change log", async () => {
    const { run } = setup();
    expect(await run("duplicate_environment", { environmentId: "nope" })).toMatchObject({
      ok: false,
    });
    expect(
      (await run("duplicate_environment", { environmentId: "e1" }, false)).ok,
    ).toBe(false);
  });
});

describe("lookup guard inside each tool", () => {
  it("[invalid] fails by itself when the source vanished after the registry check", async () => {
    const { store, write } = setup();
    const context = { store, redact: DEFAULT_REDACT_CONTEXT, write };
    const [collectionTool, chainTool, environmentTool] = duplicateTools;
    expect(await collectionTool.run({ collectionId: "gone" }, context)).toEqual({
      ok: false,
      error: "collection not found: gone",
    });
    expect(await chainTool.run({ chainId: "gone" }, context)).toEqual({
      ok: false,
      error: "chain not found: gone",
    });
    expect(await environmentTool.run({ environmentId: "gone" }, context)).toEqual({
      ok: false,
      error: "environment not found: gone",
    });
  });
});
