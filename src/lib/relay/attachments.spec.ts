import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_DETAIL_CLOSE,
  ATTACHMENT_DETAIL_OPEN,
  ATTACHMENT_DETAIL_TRUNCATED_NOTE,
  type AttachmentMeta,
  buildAttachmentDetail,
  buildAttachmentMetadata,
  noLongerExists,
  readAttachmentMetadata,
  RELAY_ATTACHMENT_DETAIL_MAX_CHARS,
} from "./attachments";
import type { ContextChip } from "./chips";
import { buildRedactContext } from "./redact";
import { ENV_SECRET_VALUE } from "./redact.corpus";
import { createFakeStoreAccess, type StoreSource } from "./storeAccess";

const request = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  collectionId: "c1",
  name: `Request ${id}`,
  method: "POST" as const,
  url: `https://api.test/${id}`,
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const tab = (requestId: string | null) => ({
  tabId: "t1",
  requestId,
  name: "Open tab",
  isDirty: false,
  type: "http" as const,
  url: "https://api.test/r1",
  method: "DELETE" as const,
  headers: [],
  params: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
});

const env = {
  id: "e1",
  name: "Prod",
  variables: [
    { id: "v1", key: "host", initialValue: "visible.test", currentValue: "visible.test", isSecret: false },
    { id: "v2", key: "apiKey", initialValue: ENV_SECRET_VALUE, currentValue: ENV_SECRET_VALUE, isSecret: true },
  ],
  createdAt: 0,
  updatedAt: 0,
};

function seeded(over: Partial<StoreSource> = {}) {
  const { access, state } = createFakeStoreAccess({
    collections: [{ id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 }],
    requests: [request("r1")],
    environments: [env],
    tabs: [tab("r1")] as never,
    activeTabId: "t1",
    ...over,
  });
  return { store: access, state };
}

const detailFor = (
  attachments: readonly AttachmentMeta[],
  seed: ReturnType<typeof seeded>,
  shareValues = false,
) =>
  buildAttachmentDetail(attachments, {
    store: seed.store,
    redact: buildRedactContext(seed.state.environments, shareValues),
  });

describe("buildAttachmentMetadata", () => {
  it("records the method of a saved request and of the active tab", () => {
    const chips: ContextChip[] = [
      { kind: "request", id: "r1", label: "R1" },
      { kind: "tab", id: "t1", label: "Open tab" },
    ];
    expect(buildAttachmentMetadata(chips, seeded().store)).toEqual([
      { id: "r1", kind: "request", label: "R1", method: "POST" },
      { id: "t1", kind: "tab", label: "Open tab", method: "DELETE" },
    ]);
  });

  it("omits the method for an unknown request, an inactive tab and non-request kinds", () => {
    const seed = seeded();
    seed.state.activeTabId = "other";
    const chips: ContextChip[] = [
      { kind: "request", id: "gone", label: "Gone" },
      { kind: "tab", id: "t1", label: "Open tab" },
      { kind: "chain", id: "ch1", label: "Chain" },
    ];
    expect(buildAttachmentMetadata(chips, seed.store)).toEqual([
      { id: "gone", kind: "request", label: "Gone" },
      { id: "t1", kind: "tab", label: "Open tab" },
      { id: "ch1", kind: "chain", label: "Chain" },
    ]);
  });

  it("returns an empty list for no chips", () => {
    expect(buildAttachmentMetadata([], seeded().store)).toEqual([]);
  });
});

describe("readAttachmentMetadata", () => {
  it.each([null, undefined, {}, { attachments: "nope" }, "text"])(
    "reads %j as no attachments",
    (metadata) => {
      expect(readAttachmentMetadata(metadata)).toEqual([]);
    },
  );

  it("keeps well-formed entries and drops malformed ones", () => {
    const good = { id: "r1", kind: "request", label: "R1" };
    const metadata = {
      attachments: [
        good,
        null,
        "r2",
        { id: 1, kind: "request", label: "x" },
        { id: "r3", kind: "request" },
        { id: "r4", kind: "folder", label: "x" },
      ],
    };
    expect(readAttachmentMetadata(metadata)).toEqual([good]);
  });
});

describe("noLongerExists", () => {
  it("names the missing item", () => {
    expect(noLongerExists("Prod")).toBe("Prod no longer exists");
  });
});

describe("buildAttachmentDetail", () => {
  it("is empty when nothing is attached", async () => {
    expect(await detailFor([], seeded())).toBe("");
  });

  it("fences the detail as untrusted and lists each item's identity line", async () => {
    const detail = await detailFor(
      [{ id: "r1", kind: "request", label: "R1" }],
      seeded(),
    );
    expect(detail.startsWith(ATTACHMENT_DETAIL_OPEN)).toBe(true);
    expect(detail.endsWith(ATTACHMENT_DETAIL_CLOSE)).toBe(true);
    expect(detail).toContain("- request r1: R1");
    expect(detail).toContain("https://api.test/r1");
  });

  it("withholds variable values while Share is off", async () => {
    const detail = await detailFor(
      [{ id: "e1", kind: "environment", label: "Prod" }],
      seeded(),
      false,
    );
    expect(detail).toContain("host");
    expect(detail).not.toContain("visible.test");
    expect(detail).not.toContain(ENV_SECRET_VALUE);
  });

  it("shares non-secret values with Share on but never a secret", async () => {
    const detail = await detailFor(
      [{ id: "e1", kind: "environment", label: "Prod" }],
      seeded(),
      true,
    );
    expect(detail).toContain("visible.test");
    expect(detail).not.toContain(ENV_SECRET_VALUE);
  });

  it.each([
    ["request", "Ghost"],
    ["collection", "Ghost"],
    ["environment", "Ghost"],
    ["chain", "Ghost"],
  ] as const)("notes a deleted %s", async (kind, label) => {
    const detail = await detailFor([{ id: "missing", kind, label }], seeded());
    expect(detail).toContain(`- ${kind} missing: ${label}\n${label} no longer exists`);
  });

  it("describes the active tab with its saved request", async () => {
    const detail = await detailFor(
      [{ id: "t1", kind: "tab", label: "Open tab" }],
      seeded(),
    );
    expect(detail).toContain('"tab":');
    expect(detail).toContain('"request":');
  });

  it("describes an unsaved active tab without a request", async () => {
    const detail = await detailFor(
      [{ id: "t1", kind: "tab", label: "Open tab" }],
      seeded({ tabs: [tab(null)] as never }),
    );
    expect(detail).toContain('"tab":');
    expect(detail).not.toContain('"request":');
  });

  it("describes an active tab whose saved request was deleted without a request", async () => {
    const detail = await detailFor(
      [{ id: "t1", kind: "tab", label: "Open tab" }],
      seeded({ requests: [] }),
    );
    expect(detail).toContain('"tab":');
    expect(detail).not.toContain('"request":');
  });

  it("describes a non-active tab by id and name only", async () => {
    const seed = seeded();
    seed.state.activeTabId = "other";
    const detail = await detailFor(
      [{ id: "t1", kind: "tab", label: "Open tab" }],
      seed,
    );
    expect(detail).toContain('{"tabId":"t1","name":"Open tab"}');
  });

  it("degrades every item after the budget is spent, in attach order", async () => {
    const body = Array.from({ length: 3000 }, (_, i) => `f${i}=v${i}`).join("&");
    const big = Array.from({ length: 10 }, (_, i) =>
      request(`big${i}`, { name: `Big ${i}`, body: { type: "raw", content: body } }),
    );
    const attachments: AttachmentMeta[] = big.map((r) => ({
      id: r.id,
      kind: "request",
      label: r.name,
    }));
    const detail = await detailFor(attachments, seeded({ requests: big as never }));
    expect(detail).toContain(ATTACHMENT_DETAIL_TRUNCATED_NOTE);
    expect(detail.indexOf("- request big0: Big 0\n{")).toBeGreaterThan(-1);
    const tail = detail.slice(detail.indexOf(ATTACHMENT_DETAIL_TRUNCATED_NOTE));
    expect(tail).toContain("- request big9: Big 9");
    expect(tail).not.toContain("https://api.test/big9");
    expect(detail.length).toBeLessThan(RELAY_ATTACHMENT_DETAIL_MAX_CHARS + 2_000);
  });

  it("never adds the truncation note when everything fits", async () => {
    const detail = await detailFor(
      [{ id: "r1", kind: "request", label: "R1" }],
      seeded(),
    );
    expect(detail).not.toContain(ATTACHMENT_DETAIL_TRUNCATED_NOTE);
  });
});
