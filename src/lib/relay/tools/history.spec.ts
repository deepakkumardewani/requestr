import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeStoreAccess } from "../storeAccess";
import { historyEntry } from "../testing/historyFixtures";
import { historyTools } from "./history";
import { APPROVAL_REQUIRED, createRegistry, executeTool, grantApproval, previewConfirmation } from "./registry";

const downloadFile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/historyExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/historyExport")>()),
  downloadFile,
}));
vi.mock("@/lib/idb", () => ({ getDB: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const registry = createRegistry(historyTools);
const store = createFakeStoreAccess().access;
const context = { store, redact: DEFAULT_REDACT_CONTEXT };
const approved = { ...context, approval: grantApproval() };

const seed = (count: number) =>
  useHistoryStore.setState({
    entries: Array.from({ length: count }, (_, i) => historyEntry({ id: `h${i}` })),
  });

beforeEach(() => {
  downloadFile.mockClear();
  useHistoryStore.setState({ entries: [] });
});

describe("clear_history", () => {
  it("[success] clears every entry after approval and returns the count", async () => {
    seed(3);
    const out = await executeTool(registry, "clear_history", {}, approved);
    expect(out).toEqual({ ok: true, data: { count: 3 } });
    expect(useHistoryStore.getState().entries).toEqual([]);
  });

  it("[success] is destructive: refuses to run without approval and leaves entries", async () => {
    seed(2);
    const out = await executeTool(registry, "clear_history", {}, context);
    expect(out).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(useHistoryStore.getState().entries).toHaveLength(2);
  });

  it("[invalid] rejects unexpected input", async () => {
    seed(1);
    const out = await executeTool(registry, "clear_history", { all: true }, approved);
    expect(out.ok).toBe(false);
    expect(useHistoryStore.getState().entries).toHaveLength(1);
  });

  it("[invalid] reports an already empty history instead of clearing", async () => {
    const out = await executeTool(registry, "clear_history", {}, approved);
    expect(out).toEqual({ ok: false, error: "history is already empty" });
  });

  it("[undo] returns no changeId because cleared history cannot be restored", async () => {
    seed(1);
    const out = await executeTool(registry, "clear_history", {}, approved);
    expect(out).toEqual({ ok: true, data: { count: 1 } });
    expect(out).not.toHaveProperty("data.changeId");
  });

  it("describes a danger delete card with the count", () => {
    seed(3);
    expect(previewConfirmation(registry, "clear_history", {}, store)).toEqual({
      action: "delete",
      severity: "danger",
      targets: [],
      count: 3,
    });
  });

  it("names the single target when exactly one entry exists", () => {
    seed(1);
    expect(previewConfirmation(registry, "clear_history", {}, store)).toEqual({
      action: "delete",
      severity: "danger",
      targets: ["history"],
      count: 1,
    });
  });
});

describe("export_history", () => {
  it("[success] downloads json with every entry once approved", async () => {
    seed(2);
    const out = await executeTool(registry, "export_history", { format: "json" }, approved);
    expect(out).toEqual({ ok: true, data: { count: 2, excludedCount: 0 } });
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile.mock.calls[0][1]).toMatch(/^requestr-history-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("[success] har reports the entries it left out", async () => {
    useHistoryStore.setState({
      entries: [historyEntry({ id: "a" }), historyEntry({ id: "b", type: "websocket" })],
    });
    const out = await executeTool(registry, "export_history", { format: "har" }, approved);
    expect(out).toEqual({ ok: true, data: { count: 1, excludedCount: 1 } });
    expect(downloadFile.mock.calls[0][1]).toMatch(/\.har$/);
  });

  it("[invalid] rejects an unsupported format and downloads nothing", async () => {
    seed(1);
    const out = await executeTool(registry, "export_history", { format: "csv" }, context);
    expect(out.ok).toBe(false);
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("[undo] returns no changeId because an export changes no workspace data", async () => {
    seed(1);
    const out = await executeTool(registry, "export_history", { format: "json" }, approved);
    expect(out).not.toHaveProperty("data.changeId");
    expect(useHistoryStore.getState().entries).toHaveLength(1);
  });
});

describe("list_history", () => {
  it("[success] pages summaries and reports the next offset", async () => {
    seed(5);
    const out = (await executeTool(registry, "list_history", { limit: 2, offset: 0 }, context)) as {
      ok: boolean;
      data: { total: number; entries: { id: string }[]; nextOffset: number | null };
    };
    expect(out.ok).toBe(true);
    expect(out.data.total).toBe(5);
    expect(out.data.entries.map((entry) => entry.id)).toEqual(["h0", "h1"]);
    expect(out.data.nextOffset).toBe(2);
  });

  it("[invalid] rejects a limit above the maximum", async () => {
    seed(1);
    const out = await executeTool(registry, "list_history", { limit: 10_000, offset: null }, context);
    expect(out).toMatchObject({ ok: false });
  });
});

describe("list_history: paging and privacy", () => {
  type Page = {
    ok: true;
    data: { total: number; entries: Record<string, unknown>[]; nextOffset: number | null };
  };
  const list = (input: { limit?: number | null; offset?: number | null }, ctx = context) =>
    executeTool(registry, "list_history", { limit: null, offset: null, ...input }, ctx) as Promise<Page>;

  it("[success] an empty history lists nothing and has no next page", async () => {
    expect(await list({})).toEqual({ ok: true, data: { total: 0, entries: [], nextOffset: null } });
  });

  it("[success] the default page is 20 entries", async () => {
    seed(25);
    const out = await list({});
    expect(out.data.entries).toHaveLength(20);
    expect(out.data.nextOffset).toBe(20);
  });

  it("[success] the last page ends with a null next offset and an offset past the end is empty", async () => {
    seed(5);
    expect((await list({ limit: 2, offset: 4 })).data).toMatchObject({
      entries: [{ id: "h4" }],
      nextOffset: null,
    });
    expect((await list({ offset: 99 })).data).toMatchObject({ entries: [], nextOffset: null, total: 5 });
  });

  it("[success] a page that exactly reaches the end has no next offset", async () => {
    seed(4);
    expect((await list({ limit: 2, offset: 2 })).data.nextOffset).toBeNull();
  });

  it("[success] returns summaries only, with no body or headers", async () => {
    useHistoryStore.setState({ entries: [historyEntry({ id: "a", duration: 55 })] });
    const [entry] = (await list({})).data.entries;
    expect(Object.keys(entry).sort()).toEqual(["durationMs", "id", "method", "status", "timestamp", "url"]);
    expect(entry).toMatchObject({ id: "a", method: "GET", status: 200, durationMs: 55 });
  });

  it("[success] redacts secrets in the listed url", async () => {
    useHistoryStore.setState({
      entries: [historyEntry({ id: "a", url: "https://api.test/x?api_key=SECRET123&a=1" })],
    });
    const [entry] = (await list({})).data.entries;
    expect(String(entry.url)).not.toContain("SECRET123");
    expect(String(entry.url)).toContain("a=1");
  });

  it("[invalid] rejects a negative offset, a zero limit and extra keys", async () => {
    seed(1);
    for (const input of [{ limit: null, offset: -1 }, { limit: 0, offset: null }, { limit: null, offset: null, extra: 1 }]) {
      expect((await executeTool(registry, "list_history", input, context)).ok).toBe(false);
    }
    expect((await executeTool(registry, "list_history", {}, context)).ok).toBe(false);
  });

  it("[success] needs no approval", async () => {
    seed(1);
    expect((await list({})).ok).toBe(true);
  });
});
