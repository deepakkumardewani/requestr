import { describe, expect, it } from "vitest";
import type { ChangeView } from "./changeLog";
import type { UIMessage } from "ai";
import {
  changeIdsFromOutput,
  changeIdsOfMessage,
  groupChanges,
  KEPT_CHANGE_IDS_KEY,
  readKeptChangeIds,
  type ChangeGroup,
} from "./changeGroups";

let counter = 0;
function change(overrides: Partial<ChangeView> = {}): ChangeView {
  counter += 1;
  return {
    id: `ch${counter}`,
    threadId: "t1",
    turnId: "turn1",
    toolCallId: `call${counter}`,
    entity: "chain",
    entityId: "k1",
    before: { name: "Flow", nodeIds: [], blocks: [] },
    afterHash: "h",
    status: "applied",
    summary: "Updated chain",
    after: { name: "Flow", nodeIds: ["a"], blocks: [] },
    ...overrides,
  };
}

const chainSnapshot = (name: string, nodeIds: string[], blocks: unknown[] = []) => ({
  name,
  nodeIds,
  blocks,
});

function onlyGroup(changes: ChangeView[]): ChangeGroup {
  const items = groupChanges(changes);
  expect(items).toHaveLength(1);
  const [item] = items;
  if (item.kind !== "group") throw new Error("expected a group");
  return item;
}

describe("groupChanges", () => {
  it("returns an empty list for no changes", () => {
    expect(groupChanges([])).toEqual([]);
  });

  it("leaves a single chain change as a plain change", () => {
    const only = change();
    expect(groupChanges([only])).toEqual([{ kind: "single", change: only }]);
  });

  it("groups consecutive edits of one chain in the same turn", () => {
    const a = change({ before: null, after: chainSnapshot("Flow", ["a"]) });
    const b = change({
      before: chainSnapshot("Flow", ["a"]),
      after: chainSnapshot("Flow", ["a", "b"]),
    });
    const group = onlyGroup([a, b]);
    expect(group.chainId).toBe("k1");
    expect(group.changes).toEqual([a, b]);
    expect(group.changeIds).toEqual([a.id, b.id]);
  });

  it("marks a group that starts with create_chain as created", () => {
    const group = onlyGroup([
      change({ before: null, after: chainSnapshot("Flow", ["a"]) }),
      change(),
    ]);
    expect(group.created).toBe(true);
  });

  it("labels a group without create_chain as an update", () => {
    const group = onlyGroup([change(), change()]);
    expect(group.created).toBe(false);
  });

  it("counts nodes and blocks from the chain after the last change", () => {
    const group = onlyGroup([
      change({ before: null, after: chainSnapshot("Flow", ["a"]) }),
      change({ after: chainSnapshot("Flow", ["a", "b"], [{ id: "blk" }]) }),
    ]);
    expect(group.nodeCount).toBe(3);
  });

  it("nets adds and deletes: the final snapshot decides the count", () => {
    const group = onlyGroup([
      change({ before: null, after: chainSnapshot("Flow", ["a", "b", "c"]) }),
      change({ after: chainSnapshot("Flow", ["a"]) }),
    ]);
    expect(group.nodeCount).toBe(1);
  });

  it("does not count connects or renames as nodes", () => {
    const group = onlyGroup([
      change({ before: null, after: chainSnapshot("Flow", ["a", "b"]) }),
      change({ after: { ...chainSnapshot("Flow", ["a", "b"]), edges: [{}] } }),
      change({ after: chainSnapshot("Renamed", ["a", "b"]) }),
    ]);
    expect(group.nodeCount).toBe(2);
    expect(group.chainName).toBe("Renamed");
  });

  it("counts zero nodes when the final snapshot has no node lists", () => {
    const group = onlyGroup([change({ after: { name: "Flow" } }), change({ after: { name: "Flow" } })]);
    expect(group.nodeCount).toBe(0);
  });

  it("counts zero nodes when the final snapshot is not an object", () => {
    const group = onlyGroup([change(), change({ after: "gone" })]);
    expect(group.nodeCount).toBe(0);
  });

  it("falls back to the first change's before name when the final snapshot has none", () => {
    const group = onlyGroup([
      change({ before: chainSnapshot("Original", []) }),
      change({ after: { nodeIds: ["a"] } }),
    ]);
    expect(group.chainName).toBe("Original");
  });

  it("uses an empty name when no snapshot carries one", () => {
    const group = onlyGroup([
      change({ before: null, after: { nodeIds: [] } }),
      change({ after: { nodeIds: [] } }),
    ]);
    expect(group.chainName).toBe("");
  });

  it("is undone only when every member is undone", () => {
    expect(
      onlyGroup([change({ status: "undone" }), change({ status: "undone" })]).undone,
    ).toBe(true);
    expect(
      onlyGroup([change({ status: "undone" }), change({ status: "applied" })]).undone,
    ).toBe(false);
  });

  it("never groups delete_chain and leaves it as a single change", () => {
    const edit = change();
    const del = change({ after: null });
    const items = groupChanges([edit, del]);
    expect(items).toEqual([
      { kind: "single", change: edit },
      { kind: "single", change: del },
    ]);
  });

  it("flags a group whose chain is deleted by a later change", () => {
    const del = change({ after: null });
    const items = groupChanges([change(), change(), del]);
    expect(items).toHaveLength(2);
    const [group, deletion] = items;
    expect(group.kind === "group" && group.deletedLater).toBe(true);
    expect(deletion).toEqual({ kind: "single", change: del });
  });

  it("does not flag deletedLater for a different chain's deletion or an earlier one", () => {
    const earlier = change({ entityId: "k1", after: null });
    const other = change({ entityId: "k2", after: null });
    const group = onlyGroup([earlier, change(), change()].slice(1));
    expect(group.deletedLater).toBe(false);
    const withOther = groupChanges([change(), change(), other]);
    const first = withOther[0];
    expect(first.kind === "group" && first.deletedLater).toBe(false);
  });

  it("ends the run when a different chain is edited", () => {
    const items = groupChanges([
      change({ entityId: "k1" }),
      change({ entityId: "k1" }),
      change({ entityId: "k2" }),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["group", "single"]);
  });

  it("ends the run when another entity intervenes", () => {
    const items = groupChanges([
      change(),
      change({ entity: "request", entityId: "r1" }),
      change(),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["single", "single", "single"]);
  });

  it("does not group edits across turns", () => {
    const items = groupChanges([
      change({ turnId: "turn1" }),
      change({ turnId: "turn1" }),
      change({ turnId: "turn2" }),
      change({ turnId: "turn2" }),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["group", "group"]);
  });

  it("starts a new run after a deletion of the same chain", () => {
    const items = groupChanges([change(), change({ after: null }), change(), change()]);
    expect(items.map((item) => item.kind)).toEqual(["single", "single", "group"]);
  });

  it("keeps non-chain changes in order as singles", () => {
    const req = change({ entity: "request", entityId: "r1" });
    const env = change({ entity: "environment", entityId: "e1" });
    expect(groupChanges([req, env])).toEqual([
      { kind: "single", change: req },
      { kind: "single", change: env },
    ]);
  });
});

describe("group changeIds (L-21)", () => {
  it("lists every member id oldest first so the card count matches Undo all", () => {
    const first = change({ id: "c-first" });
    const second = change({ id: "c-second" });
    const third = change({ id: "c-third" });

    const group = onlyGroup([first, second, third]);

    expect(group.changeIds).toEqual(["c-first", "c-second", "c-third"]);
    expect(group.changeIds).toHaveLength(group.changes.length);
  });
});

describe("changeIdsFromOutput", () => {
  it("reads the id of a single write", () => {
    expect(
      changeIdsFromOutput({ ok: true, data: { changeId: "c1" } }),
    ).toEqual(["c1"]);
  });

  it("reads the ids of a bulk write", () => {
    expect(
      changeIdsFromOutput({ ok: true, data: { changeIds: ["c1", "c2"] } }),
    ).toEqual(["c1", "c2"]);
  });

  it("combines both fields", () => {
    expect(
      changeIdsFromOutput({
        ok: true,
        data: { changeId: "c1", changeIds: ["c2"] },
      }),
    ).toEqual(["c1", "c2"]);
  });

  it.each([
    ["a failed result", { ok: false, data: { changeId: "c1" } }],
    ["no data", { ok: true }],
    ["null data", { ok: true, data: null }],
    ["non-object data", { ok: true, data: "c1" }],
    ["a null output", null],
    ["an undefined output", undefined],
    ["a non-string changeId", { ok: true, data: { changeId: 7 } }],
    ["a mixed changeIds list", { ok: true, data: { changeIds: ["c1", 2] } }],
  ])("reports no ids for %s", (_name, output) => {
    expect(changeIdsFromOutput(output)).toEqual([]);
  });
});

describe("readKeptChangeIds", () => {
  it("reads the ids a Keep carried over", () => {
    expect(readKeptChangeIds({ [KEPT_CHANGE_IDS_KEY]: ["k1", "k2"] })).toEqual([
      "k1",
      "k2",
    ]);
  });

  it.each([
    ["undefined metadata", undefined],
    ["null metadata", null],
    ["metadata without the key", { other: 1 }],
    ["a non-array value", { [KEPT_CHANGE_IDS_KEY]: "k1" }],
    ["a list with a non-string", { [KEPT_CHANGE_IDS_KEY]: ["k1", 3] }],
  ])("is empty for %s", (_name, metadata) => {
    expect(readKeptChangeIds(metadata)).toEqual([]);
  });
});

describe("changeIdsOfMessage (HH-M23)", () => {
  const toolPart = (type: string, output: unknown) => ({
    type,
    toolCallId: "call",
    state: "output-available",
    input: {},
    output,
  });

  function message(
    parts: unknown[],
    metadata?: Record<string, unknown>,
  ): UIMessage {
    return { id: "m", role: "assistant", parts, metadata } as UIMessage;
  }

  it("collects the ids of its own tool results", () => {
    const result = changeIdsOfMessage(
      message([
        { type: "text", text: "done" },
        toolPart("tool-update_request", { ok: true, data: { changeId: "c1" } }),
        toolPart("tool-delete_requests", {
          ok: true,
          data: { changeIds: ["c2", "c3"] },
        }),
      ]),
    );

    expect(result).toEqual(["c1", "c2", "c3"]);
  });

  it("adds the ids a Keep carried in from a discarded turn, without duplicates", () => {
    const result = changeIdsOfMessage(
      message(
        [
          toolPart("tool-update_request", {
            ok: true,
            data: { changeId: "c1" },
          }),
        ],
        { [KEPT_CHANGE_IDS_KEY]: ["k1", "c1"] },
      ),
    );

    expect(result).toEqual(["c1", "k1"]);
  });

  it("ignores tool parts that have no result yet and non-tool parts", () => {
    const pending = { type: "tool-update_request", toolCallId: "c", state: "input-available", input: {} };

    expect(
      changeIdsOfMessage(message([pending, { type: "text", text: "x" }])),
    ).toEqual([]);
  });
});
