// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historyEntry } from "./relay/testing/historyFixtures";
import {
  buildExportFilename,
  downloadFile,
  exportHistoryAsCSV,
  exportHistoryAsJSON,
} from "./historyExport";

describe("buildExportFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T23:59:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it.each(["csv", "json", "har"] as const)("names the %s file with the date", (format) => {
    expect(buildExportFilename(format)).toBe(`requestr-history-2026-05-02.${format}`);
  });
});

describe("exportHistoryAsCSV", () => {
  it("writes the header and unchanged rows", () => {
    const csv = exportHistoryAsCSV([historyEntry({ url: "https://api.test/x" })]);
    expect(csv).toBe(
      "timestamp,method,url,status,duration_ms\n2026-05-02T10:30:00.000Z,GET,https://api.test/x,200,121",
    );
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    const csv = exportHistoryAsCSV([historyEntry({ url: 'https://a.test/?q="x",y\nz' })]);
    expect(csv.split("\n").slice(1).join("\n")).toBe(
      '2026-05-02T10:30:00.000Z,GET,"https://a.test/?q=""x"",y\nz",200,121',
    );
  });

  it("returns only the header for no entries", () => {
    expect(exportHistoryAsCSV([])).toBe("timestamp,method,url,status,duration_ms");
  });
});

describe("exportHistoryAsJSON", () => {
  it("serialises a summary record per entry with rounded duration", () => {
    expect(JSON.parse(exportHistoryAsJSON([historyEntry({ url: "https://api.test/x" })]))).toEqual([
      {
        timestamp: "2026-05-02T10:30:00.000Z",
        method: "GET",
        url: "https://api.test/x",
        status: 200,
        duration_ms: 121,
      },
    ]);
  });
});

describe("downloadFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("clicks a temporary anchor with the filename and revokes the object url", async () => {
    let blob: Blob | undefined;
    const create = vi.fn((b: Blob) => {
      blob = b;
      return "blob:fake";
    });
    const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const clicked: Array<{ href: string; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });

    downloadFile("hello", "f.json", "application/json");

    expect(clicked).toEqual([{ href: "blob:fake", download: "f.json" }]);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
    expect(blob?.type).toBe("application/json");
    expect(await blob?.text()).toBe("hello");
  });
});
