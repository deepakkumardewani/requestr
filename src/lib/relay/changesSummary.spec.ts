import { createTranslator } from "use-intl";
import { relayMessages } from "@/components/relay/relayIntlMock";
import { describe, expect, it } from "vitest";
import type { ChangeView } from "./changeLog";
import {
  buildChangesSummary,
  formatHeadline,
  type HeadlineGroup,
} from "./changesSummary";
import { createFakeStoreAccess } from "./storeAccess";
import {
  createChain,
  createCollection,
  createEnvironment,
  createRequest,
} from "./testing/entityTestData";

let counter = 0;
function change(overrides: Partial<ChangeView> = {}): ChangeView {
  counter += 1;
  return {
    id: `ch${counter}`,
    threadId: "t1",
    turnId: "turn1",
    toolCallId: "call1",
    entity: "request",
    entityId: "r1",
    before: { name: "old" },
    afterHash: "h",
    status: "applied",
    summary: "Updated thing",
    after: { name: "new" },
    ...overrides,
  };
}

function store() {
  return createFakeStoreAccess({
    requests: [createRequest("r1", "List users"), createRequest("r2", "Get user")],
    collections: [createCollection("c1", "Users")],
    environments: [createEnvironment("e1", "Prod")],
    chains: [createChain("k1", "Flow")],
    folders: [
      {
        id: "f1",
        collectionId: "c1",
        parentFolderId: null,
        name: "Folder",
      } as never,
    ],
  });
}

describe("buildChangesSummary operations", () => {
  it("classifies a null before as created", () => {
    const { access } = store();
    const { rows } = buildChangesSummary([change({ before: null })], access);
    expect(rows.map((row) => row.op)).toEqual(["created"]);
  });

  it("classifies a null after as deleted", () => {
    const { access } = store();
    const { rows } = buildChangesSummary([change({ after: null })], access);
    expect(rows[0].op).toBe("deleted");
  });

  it("classifies an all-null array after as deleted", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "requests", entityId: "r1,r2", after: [null, null] })],
      access,
    );
    expect(rows.map((row) => row.op)).toEqual(["deleted", "deleted"]);
  });

  it("classifies a partly-null array after as updated", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "requests", entityId: "r1,r2", after: [null, {}] })],
      access,
    );
    expect(rows.map((row) => row.op)).toEqual(["updated", "updated"]);
  });

  it("drops tab navigation entirely", () => {
    const { access } = store();
    const result = buildChangesSummary(
      [change({ entity: "tab", entityId: "r1" })],
      access,
    );
    expect(result).toEqual({ rows: [], groups: [] });
  });
});

describe("buildChangesSummary entities", () => {
  it("makes one request row per batched id using store names, falling back to the id", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "requests", entityId: "r1,r2,ghost" })],
      access,
    );
    expect(rows.map((row) => [row.kind, row.label])).toEqual([
      ["request", "List users"],
      ["request", "Get user"],
      ["request", "ghost"],
    ]);
    expect(rows[2].open).toEqual({ enabled: false, reason: "deleted" });
  });

  it("opens a chain by its id with the change summary as label", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "chain", entityId: "k1", summary: "Edited Flow" })],
      access,
    );
    expect(rows[0]).toMatchObject({
      kind: "chain",
      label: "Edited Flow",
      open: { enabled: true, target: { kind: "chain", id: "k1" } },
    });
  });

  it.each(["environment", "activeEnvironment"] as const)(
    "treats %s as an environment",
    (entity) => {
      const { access } = store();
      const { rows } = buildChangesSummary(
        [change({ entity, entityId: "e1" })],
        access,
      );
      expect(rows[0]).toMatchObject({
        kind: "environment",
        open: { enabled: true, target: { kind: "environment", id: "e1" } },
      });
    },
  );

  it("opens a collection directly", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "collection", entityId: "c1" })],
      access,
    );
    expect(rows[0].open).toEqual({
      enabled: true,
      target: { kind: "collection", id: "c1" },
    });
  });

  it.each(["folder", "tree"] as const)(
    "opens the owning collection for a %s",
    (entity) => {
      const { access } = store();
      const { rows } = buildChangesSummary(
        [change({ entity, entityId: "f1" })],
        access,
      );
      expect(rows[0]).toMatchObject({
        kind: "collection",
        open: { enabled: true, target: { kind: "collection", id: "c1" } },
      });
    },
  );

  it("disables Open for a folder that no longer exists", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "folder", entityId: "gone" })],
      access,
    );
    expect(rows[0].open).toEqual({ enabled: false, reason: "deleted" });
  });

  it("opens settings at its section without an existence check", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "settings", entityId: "appearance" })],
      access,
    );
    expect(rows[0]).toMatchObject({
      kind: "item",
      open: {
        enabled: true,
        target: { kind: "settings", id: "appearance" },
      },
    });
  });

  it("gives an unknown entity an item row with no Open", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ entity: "mystery", entityId: "x" })],
      access,
    );
    expect(rows[0]).toMatchObject({ kind: "item", open: null });
  });
});

describe("buildChangesSummary open state", () => {
  it("reports undone before deleted", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [change({ status: "undone", after: null })],
      access,
    );
    expect(rows[0].open).toEqual({ enabled: false, reason: "undone" });
  });

  it("reports deleted when the change deleted the entity", () => {
    const { access } = store();
    const { rows } = buildChangesSummary([change({ after: null })], access);
    expect(rows[0].open).toEqual({ enabled: false, reason: "deleted" });
  });

  it("reports deleted when the entity vanished from the store", () => {
    const { access, state } = store();
    state.requests = [];
    const { rows } = buildChangesSummary([change()], access);
    expect(rows[0].open).toEqual({ enabled: false, reason: "deleted" });
  });
});

describe("buildChangesSummary headline groups", () => {
  it("counts per op and kind in a stable order and ignores undone rows", () => {
    const { access } = store();
    const { rows, groups } = buildChangesSummary(
      [
        change({ entity: "requests", entityId: "r1,r2", before: null }),
        change({ entity: "chain", entityId: "k1" }),
        change({ entity: "request", entityId: "r1", after: null }),
        change({ entity: "environment", entityId: "e1", status: "undone" }),
      ],
      access,
    );
    expect(rows).toHaveLength(5);
    expect(groups).toEqual([
      { op: "created", kind: "request", count: 2 },
      { op: "updated", kind: "chain", count: 1 },
      { op: "deleted", kind: "request", count: 1 },
    ]);
  });

  it("yields no groups for an empty log", () => {
    expect(buildChangesSummary([], store().access)).toEqual({
      rows: [],
      groups: [],
    });
  });
});

describe("request labels", () => {
  it("keeps the request name from the change snapshot once the request is gone", () => {
    const { access } = store();
    const { rows } = buildChangesSummary(
      [
        change({
          entityId: "gone",
          before: { id: "gone", name: "Old name" },
          after: null,
        }),
        change({
          entity: "requests",
          entityId: "gone1,gone2",
          before: [{ id: "gone1", name: "One" }, null],
          after: [null, null],
        }),
      ],
      access,
    );
    expect(rows.map((row) => row.label)).toEqual(["Old name", "One", "gone2"]);
  });
});

describe("formatHeadline", () => {
  // The real English copy, so a verb baked into a per-kind key shows up here.
  const translator = createTranslator({
    locale: "en",
    messages: { changes: relayMessages("en").changes },
    namespace: "changes",
  });
  const t = ((key: string, values: Record<string, string | number>) =>
    translator(key as never, values as never)) as Parameters<
    typeof formatHeadline
  >[1];

  it("says each verb once per run of the same op", () => {
    const groups: HeadlineGroup[] = [
      { op: "created", kind: "request", count: 2 },
      { op: "created", kind: "chain", count: 1 },
      { op: "updated", kind: "environment", count: 1 },
    ];
    expect(formatHeadline(groups, t)).toBe(
      "Created 2 requests, 1 chain, updated 1 environment",
    );
  });

  it("starts a new verb for every op and uses the singular for one", () => {
    const groups: HeadlineGroup[] = [
      { op: "updated", kind: "item", count: 1 },
      { op: "deleted", kind: "collection", count: 3 },
    ];
    expect(formatHeadline(groups, t)).toBe(
      "Updated 1 item, deleted 3 collections",
    );
  });

  it("returns an empty string for no groups", () => {
    expect(formatHeadline([], t)).toBe("");
  });
});
