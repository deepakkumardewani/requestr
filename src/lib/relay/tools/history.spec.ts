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
  it("[success] downloads json with every entry and needs no approval", async () => {
    seed(2);
    const out = await executeTool(registry, "export_history", { format: "json" }, context);
    expect(out).toEqual({ ok: true, data: { count: 2, excludedCount: 0 } });
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile.mock.calls[0][1]).toMatch(/^requestr-history-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("[success] har reports the entries it left out", async () => {
    useHistoryStore.setState({
      entries: [historyEntry({ id: "a" }), historyEntry({ id: "b", type: "websocket" })],
    });
    const out = await executeTool(registry, "export_history", { format: "har" }, context);
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
    const out = await executeTool(registry, "export_history", { format: "json" }, context);
    expect(out).not.toHaveProperty("data.changeId");
    expect(useHistoryStore.getState().entries).toHaveLength(1);
  });
});
