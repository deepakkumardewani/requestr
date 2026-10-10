/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";
import type { HistoryEntry, HttpTab } from "@/types";
import {
  buildExportFilename,
  downloadFile,
  exportHistoryAsCSV,
  exportHistoryAsJSON,
} from "./historyExport";

function httpTab(): HttpTab {
  return {
    tabId: "t1",
    requestId: null,
    name: "r",
    isDirty: false,
    type: "http",
    url: "https://example.com",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
  };
}

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "e1",
    method: "GET",
    url: "https://example.com",
    status: 200,
    duration: 10.4,
    size: 1,
    timestamp: Date.parse("2026-05-02T12:00:00.000Z"),
    request: httpTab(),
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      duration: 10.4,
      size: 1,
      url: "https://example.com",
      method: "GET",
      timestamp: Date.parse("2026-05-02T12:00:00.000Z"),
    },
    ...overrides,
  };
}

describe("exportHistoryAsCSV", () => {
  it("escapes commas, quotes, and newlines in csvCell values", () => {
    const csv = exportHistoryAsCSV([
      entry({
        url: 'https://ex.com?q=a,b',
        method: "POST",
      }),
      entry({
        url: "https://line.com",
        method: "GET",
        request: httpTab(),
      }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("timestamp,method,url,status,duration_ms");
    expect(lines[1]).toContain('"https://ex.com?q=a,b"');
  });

  it("rounds duration_ms in CSV rows", () => {
    const csv = exportHistoryAsCSV([entry({ duration: 10.6 })]);
    expect(csv).toContain(",11");
  });
});

describe("exportHistoryAsJSON", () => {
  it("rounds duration_ms in JSON export records", () => {
    const json = exportHistoryAsJSON([entry({ duration: 9.4 })]);
    const parsed = JSON.parse(json) as { duration_ms: number }[];
    expect(parsed[0]?.duration_ms).toBe(9);
  });
});

describe("buildExportFilename", () => {
  it("returns a dated filename with the chosen extension", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T15:00:00.000Z"));
    expect(buildExportFilename("csv")).toBe("requestly-history-2026-05-02.csv");
    expect(buildExportFilename("json")).toBe(
      "requestly-history-2026-05-02.json",
    );
    vi.useRealTimers();
  });
});

describe("downloadFile", () => {
  it("creates a blob anchor and revokes the object URL", () => {
    const click = vi.fn();
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");

    const anchor = document.createElement("a");
    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    anchor.click = click;

    downloadFile('{"a":1}', "out.json", "application/json");

    expect(create).toHaveBeenCalled();
    expect(anchor.download).toBe("out.json");
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:mock");
  });
});
