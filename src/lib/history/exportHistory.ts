import {
  buildExportFilename,
  downloadFile,
  exportHistoryAsJSON,
} from "@/lib/historyExport";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { buildHar } from "./exportHar";

export type HistoryExportFormat = "json" | "har";

export type HistoryExportResult = { count: number; excludedCount: number };

const JSON_MIME = "application/json;charset=utf-8";

/** Downloads the whole history (never a filtered view) as JSON or HAR. One path for the menu and the chat tool. */
export function exportHistory(
  format: HistoryExportFormat,
): HistoryExportResult {
  const { entries } = useHistoryStore.getState();
  if (format === "json") {
    downloadFile(
      exportHistoryAsJSON(entries),
      buildExportFilename("json"),
      JSON_MIME,
    );
    return { count: entries.length, excludedCount: 0 };
  }
  const { har, excludedCount } = buildHar(entries);
  downloadFile(
    JSON.stringify(har, null, 2),
    buildExportFilename("har"),
    JSON_MIME,
  );
  return { count: har.log.entries.length, excludedCount };
}
