import { describe, expect, it } from "vitest";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { collectionWriteTools } from "./collectionWrite";
import { createRegistry, executeTool } from "./registry";

const registry = createRegistry(collectionWriteTools);

function setup() {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    folders: [
      { id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 },
      { id: "f2", collectionId: "c1", name: "Deep", parentFolderId: "f1", order: 0 },
    ],
    requests: [
      {
        id: "r1",
        collectionId: "c1",
        folderId: null,
        name: "List",
        method: "GET",
        url: "https://api.test/orders",
        params: [],
        headers: [],
        auth: { type: "none" },
        body: { type: "none", content: "" },
        preScript: "",
        postScript: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });
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

describe("create_collection", () => {
  it("[success] creates a collection that appears in the store", async () => {
    const { run, data, state } = setup();
    const out = await run("create_collection", { name: " Billing ", parentId: null });
    expect(out.ok).toBe(true);
    expect(state.collections.map((c) => c.name)).toEqual(["Orders", "Billing"]);
    expect(data(out).createdIds).toEqual([state.collections[1].id]);
    expect(data(out)).not.toHaveProperty("before");
  });

  it("[success] creates a folder under a collection and under a folder", async () => {
    const { run, state } = setup();
    await run("create_collection", { name: "Reports", parentId: "c1" });
    await run("create_collection", { name: "Nested", parentId: "f1" });
    const reports = state.folders.find((f) => f.name === "Reports");
    const nested = state.folders.find((f) => f.name === "Nested");
    expect(reports).toMatchObject({ collectionId: "c1", parentFolderId: null, order: 1 });
    expect(nested).toMatchObject({ collectionId: "c1", parentFolderId: "f1", order: 1 });
  });

  it("[invalid] rejects a blank name and an unknown parent", async () => {
    const { run, state } = setup();
    expect(await run("create_collection", { name: "   ", parentId: null })).toEqual({
      ok: false,
      error: "name must not be empty",
    });
    expect(await run("create_collection", { name: "X", parentId: "nope" })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
    expect(state.collections).toHaveLength(1);
  });

  it("[success][undo] is undone by removing what it created", async () => {
    const { run, data, log, state } = setup();
    const out = await run("create_collection", { name: "Billing", parentId: null });
    await log.undo(String(data(out).changeId));
    expect(state.collections.map((c) => c.id)).toEqual(["c1"]);
  });

  it("[invalid] fails without a change log", async () => {
    const { store } = setup();
    const out = await executeTool(
      registry,
      "create_collection",
      { name: "X", parentId: null },
      { store, redact: DEFAULT_REDACT_CONTEXT },
    );
    expect(out.ok).toBe(false);
  });
});

describe("rename_collection", () => {
  it("[success][undo] renames a collection and a folder, and undoes both", async () => {
    const { run, data, log, state } = setup();
    const first = await run("rename_collection", { id: "c1", name: "Sales" });
    const second = await run("rename_collection", { id: "f1", name: "Staff" });
    expect(state.collections[0].name).toBe("Sales");
    expect(state.folders[0].name).toBe("Staff");
    await log.undo(String(data(first).changeId));
    await log.undo(String(data(second).changeId));
    expect(state.collections[0].name).toBe("Orders");
    expect(state.folders[0].name).toBe("Admin");
  });

  it("[invalid] rejects unknown ids and blank names", async () => {
    const { run } = setup();
    expect(await run("rename_collection", { id: "nope", name: "X" })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
    expect(await run("rename_collection", { id: "c1", name: " " })).toMatchObject({ ok: false });
  });
});

describe("move_item", () => {
  it("[success][undo] moves a request into a folder and undoes it", async () => {
    const { run, data, log, state } = setup();
    const out = await run("move_item", { id: "r1", toParentId: "f2", index: null });
    expect(state.requests[0]).toMatchObject({ collectionId: "c1", folderId: "f2" });
    await log.undo(String(data(out).changeId));
    expect(state.requests[0].folderId).toBeNull();
  });

  it("[success] moves a request to another collection", async () => {
    const { run, writer, state } = setup();
    writer.put("collection", { id: "c2", name: "Other", createdAt: 1, updatedAt: 1 });
    await run("move_item", { id: "r1", toParentId: "c2", index: null });
    expect(state.requests[0]).toMatchObject({ collectionId: "c2", folderId: null });
  });

  it("[success] moves a folder to the top level of its collection at an index", async () => {
    const { run, state } = setup();
    await run("move_item", { id: "f2", toParentId: "c1", index: 0 });
    expect(state.folders.find((f) => f.id === "f2")).toMatchObject({
      parentFolderId: null,
      order: 0,
    });
  });

  it("[success] appends a folder when no index is given", async () => {
    const { run, state } = setup();
    await run("move_item", { id: "f2", toParentId: "c1", index: null });
    expect(state.folders.find((f) => f.id === "f2")?.order).toBe(1);
  });

  it("[invalid] refuses to move a folder into itself or another collection", async () => {
    const { run, writer } = setup();
    expect(await run("move_item", { id: "f1", toParentId: "f2", index: null })).toEqual({
      ok: false,
      error: "a folder cannot be moved into itself",
    });
    expect(await run("move_item", { id: "f1", toParentId: "f1", index: null })).toMatchObject({
      ok: false,
    });
    writer.put("collection", { id: "c2", name: "Other", createdAt: 1, updatedAt: 1 });
    expect(await run("move_item", { id: "f1", toParentId: "c2", index: null })).toEqual({
      ok: false,
      error: "folders can only move inside their own collection",
    });
  });

  it("[success] lets a nested folder move under a top-level folder that is not inside it", async () => {
    const { run, state } = setup();
    (state.folders as unknown[]).push({
      id: "f3",
      collectionId: "c1",
      name: "Sibling",
      parentFolderId: null,
      order: 1,
    } as never);
    expect((await run("move_item", { id: "f2", toParentId: "f3", index: null })).ok).toBe(true);
    expect(state.folders.find((f) => f.id === "f2")?.parentFolderId).toBe("f3");
  });

  it("[invalid] returns errors for unknown ids", async () => {
    const { run } = setup();
    expect(await run("move_item", { id: "r1", toParentId: "nope", index: null })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
    expect(await run("move_item", { id: "nope", toParentId: "c1", index: null })).toEqual({
      ok: false,
      error: "item not found: nope",
    });
  });
});
