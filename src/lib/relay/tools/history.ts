import { clearHistory } from "@/lib/history/clearHistory";
import { exportHistory } from "@/lib/history/exportHistory";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { ConfirmPreview, ToolImpl } from "./registry";

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

const exportHistoryTool: ToolImpl<"export_history"> = {
  name: "export_history",
  run: ({ format }) => ({ ok: true, data: exportHistory(format) }),
};

export const historyTools = [clearHistoryTool, exportHistoryTool] as const;
