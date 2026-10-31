import { describe, expect, it } from "vitest";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { destructiveTools } from "./destructive";
import { folderTools } from "./folderTools";
import { APPROVAL_REQUIRED, createRegistry, executeTool, grantApproval } from "./registry";

const registry = createRegistry(folderTools);

function setup() {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    folders: [
      { id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 },
    ],
  });
  const run = (name: string, input: unknown, withWrite = true) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: withWrite ? fake.write : undefined,
    });
  return { ...fake, run };
}

describe("create_folder", () => {
  it("[success][undo] creates a folder under a collection and undoes it", async () => {
    const { run, state, log } = setup();
    const out = await run("create_folder", { parentId: "c1", name: "Reports" });
    expect(out.ok).toBe(true);
    expect(state.folders.find((f) => f.name === "Reports")).toMatchObject({
      collectionId: "c1",
      parentFolderId: null,
    });
    const changeId = String((out as { data: { changeId: string } }).data.changeId);
    await log.undo(changeId);
    expect(state.folders.map((f) => f.name)).toEqual(["Admin"]);
  });

  it("[success] creates a nested folder under a folder", async () => {
    const { run, state } = setup();
    await run("create_folder", { parentId: "f1", name: "Deep" });
    expect(state.folders.find((f) => f.name === "Deep")?.parentFolderId).toBe("f1");
  });

  it("[invalid] rejects an unknown parent, a blank name and extra keys", async () => {
    const { run, state } = setup();
    expect(await run("create_folder", { parentId: "nope", name: "X" })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
    expect(await run("create_folder", { parentId: "c1", name: "  " })).toMatchObject({
      ok: false,
    });
    expect(
      await run("create_folder", { parentId: "c1", name: "X", extra: 1 }),
    ).toMatchObject({ ok: false });
    expect(state.folders).toHaveLength(1);
  });

  it("[invalid] fails without a change log", async () => {
    const { run } = setup();
    const out = await run("create_folder", { parentId: "c1", name: "X" }, false);
    expect(out.ok).toBe(false);
  });
});

describe("rename_folder", () => {
  it("[success][undo] renames a folder and undoes it", async () => {
    const { run, state, log } = setup();
    const out = await run("rename_folder", { id: "f1", name: "Staff" });
    expect(state.folders[0].name).toBe("Staff");
    await log.undo(String((out as { data: { changeId: string } }).data.changeId));
    expect(state.folders[0].name).toBe("Admin");
  });

  it("[invalid] refuses a collection id and points to rename_collection", async () => {
    const { run, state } = setup();
    const out = await run("rename_folder", { id: "c1", name: "Sales" });
    expect(out).toEqual({
      ok: false,
      error: "folder not found: c1. Use rename_collection to rename a collection.",
    });
    expect(state.collections[0].name).toBe("Orders");
  });

  it("[invalid] rejects an unknown id", async () => {
    const { run } = setup();
    expect(await run("rename_folder", { id: "nope", name: "X" })).toMatchObject({
      ok: false,
    });
  });
});

describe("delete_folder", () => {
  it("[invalid] needs the user's approval before anything is removed", async () => {
    const { store, write, state } = setup();
    const out = await executeTool(
      createRegistry(destructiveTools),
      "delete_folder",
      { id: "f1" },
      { store, redact: DEFAULT_REDACT_CONTEXT, write },
    );
    expect(out).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(state.folders).toHaveLength(1);
  });

  it("[success][undo] removes the folder once approved and Undo restores it", async () => {
    const { store, write, state, log } = setup();
    const out = await executeTool(
      createRegistry(destructiveTools),
      "delete_folder",
      { id: "f1" },
      { store, redact: DEFAULT_REDACT_CONTEXT, write, approval: grantApproval() },
    );
    expect(out.ok).toBe(true);
    expect(state.folders).toHaveLength(0);
    const changeId = String((out as { data: { changeId: string } }).data.changeId);
    await log.undo(changeId);
    expect(state.folders.map((f) => f.id)).toEqual(["f1"]);
  });
});
