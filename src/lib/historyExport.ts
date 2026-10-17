import type { HistoryEntry } from "@/types";

type ExportFormat = "csv" | "json" | "har";

const CSV_HEADERS = [
  "timestamp",
  "method",
  "url",
  "status",
  "duration_ms",
] as const;

/** Wraps a CSV cell value in quotes and escapes internal quotes. */
function csvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serializes history entries to a CSV string with headers. */
export function exportHistoryAsCSV(entries: HistoryEntry[]): string {
  const headerRow = CSV_HEADERS.join(",");
  const dataRows = entries.map((e) =>
    [
      csvCell(new Date(e.timestamp).toISOString()),
      csvCell(e.method),
      csvCell(e.url),
      csvCell(e.status),
      csvCell(Math.round(e.duration)),
    ].join(","),
  );
  return [headerRow, ...dataRows].join("\n");
}

type HistoryExportRecord = {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  duration_ms: number;
};

/** Serializes history entries to a JSON array string. */
export function exportHistoryAsJSON(entries: HistoryEntry[]): string {
  const records: HistoryExportRecord[] = entries.map((e) => ({
    timestamp: new Date(e.timestamp).toISOString(),
    method: e.method,
    url: e.url,
    status: e.status,
    duration_ms: Math.round(e.duration),
  }));
  return JSON.stringify(records, null, 2);
}

/** Triggers a browser file download with the given content. */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Returns a timestamped filename, e.g. `requestr-history-2026-05-02.csv` */
export function buildExportFilename(format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  return `requestr-history-${date}.${format}`;
}
