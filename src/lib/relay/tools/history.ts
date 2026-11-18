import { clearHistory } from "@/lib/history/clearHistory";
import { exportHistory } from "@/lib/history/exportHistory";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { redactUrl } from "../redact";
import type { ConfirmPreview, ToolImpl } from "./registry";
import { HISTORY_LIST_LIMIT_DEFAULT } from "./schemas";

/**
 * History tools call the same facade as the history panel menu (FR-153), so
 * chat and menu cannot drift apart.
 */

const HISTORY_ALREADY_EMPTY = "history is already empty";
const HISTORY_TARGET = "history";

const clearHistoryTool: ToolImpl<"clear_history"> = {
  name: "clear_history",
  describe: (): ConfirmPreview => {
    const count = useHistoryStore.getState().entries.length;
    return {
      action: "delete",
      severity: "danger",
      // The card names a single target in its title; several are summarised by count.
      targets: count === 1 ? [HISTORY_TARGET] : [],
      count,
    };
  },
  run: () => {
    if (useHistoryStore.getState().entries.length === 0) {
      return { ok: false, error: HISTORY_ALREADY_EMPTY };
    }
    return { ok: true, data: clearHistory() };
  },
};

/** Summaries only: bodies and headers stay out so a long history costs little. */
const listHistoryTool: ToolImpl<"list_history"> = {
  name: "list_history",
  run: ({ limit, offset }, { redact }) => {
    const { entries } = useHistoryStore.getState();
    const start = offset ?? 0;
    const end = start + (limit ?? HISTORY_LIST_LIMIT_DEFAULT);
    return {
      ok: true,
      data: {
        total: entries.length,
        entries: entries.slice(start, end).map((entry) => ({
          id: entry.id,
          method: entry.method,
          url: redactUrl(entry.url, redact),
          status: entry.status,
          durationMs: entry.duration,
          timestamp: entry.timestamp,
        })),
        nextOffset: end < entries.length ? end : null,
      },
    };
  },
};

const exportHistoryTool: ToolImpl<"export_history"> = {
  name: "export_history",
  run: ({ format }) => ({ ok: true, data: exportHistory(format) }),
};

export const historyTools = [
  clearHistoryTool,
  listHistoryTool,
  exportHistoryTool,
] as const;
