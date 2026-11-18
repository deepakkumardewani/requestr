import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { historyEntry } from "../relay/testing/historyFixtures";
import { exportHistory } from "./exportHistory";

const downloadFile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/historyExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/historyExport")>()),
  downloadFile,
}));
vi.mock("@/lib/idb", () => ({ getDB: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const MIME = "application/json;charset=utf-8";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
  downloadFile.mockClear();
  useHistoryStore.setState({
    entries: [
      historyEntry({ id: "a", type: "http" }),
      historyEntry({ id: "b", type: "websocket" }),
      historyEntry({ id: "c", type: "socketio" }),
    ],
  });
});

describe("exportHistory", () => {
  it("json keeps every entry and downloads the dated file", () => {
    const result = exportHistory("json");
    expect(result).toEqual({ count: 3, excludedCount: 0 });
    const [content, filename, mime] = downloadFile.mock.calls[0];
    expect(filename).toBe("requestr-history-2026-05-02.json");
    expect(mime).toBe(MIME);
    expect(JSON.parse(content)).toHaveLength(3);
  });

  it("har drops websocket and socketio entries and reports the exact exclusions", () => {
    const result = exportHistory("har");
    expect(result).toEqual({ count: 1, excludedCount: 2 });
    const [content, filename, mime] = downloadFile.mock.calls[0];
    expect(filename).toBe("requestr-history-2026-05-02.har");
    expect(mime).toBe(MIME);
    const har = JSON.parse(content);
    expect(har.log.version).toBe("1.2");
    expect(har.log.entries).toHaveLength(1);
  });

  it("exports an empty history as a file with zero entries", () => {
    useHistoryStore.setState({ entries: [] });
    expect(exportHistory("json")).toEqual({ count: 0, excludedCount: 0 });
    expect(JSON.parse(downloadFile.mock.calls[0][0])).toEqual([]);
    expect(exportHistory("har")).toEqual({ count: 0, excludedCount: 0 });
    expect(JSON.parse(downloadFile.mock.calls[1][0]).log.entries).toEqual([]);
  });
});
