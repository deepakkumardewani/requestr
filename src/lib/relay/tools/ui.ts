import type { TabSnapshot } from "../changeLog";
import { commitChange } from "../changeLog";
import type { ToolImpl } from "./registry";

/**
 * UI tools move the user's view, never their data. Opening is still logged so
 * the Change Card can put the previous tab back (FR-41).
 */

const openItem: ToolImpl<"open_item"> = {
  name: "open_item",
  refs: ({ id }) => [{ kind: "request", id }],
  run: async ({ id }, { store, write }) => {
    const request = store.requests().find((item) => item.id === id);
    if (!request) return { ok: false, error: `request not found: ${id}` };
    const alreadyOpen =
      write?.writer.tabs().some((tab) => tab.requestId === id) ?? false;
    const before: TabSnapshot = {
      openedForRequestId: alreadyOpen ? null : id,
      activateTabId: write?.writer.activeTabId() ?? null,
    };
    return commitChange(write, {
      entity: "tab",
      entityId: id,
      summary: `Opened "${request.name}"`,
      before,
      mutate: () => write?.writer.openRequest(request),
    });
  },
};

const NO_ANSWER = "the user has not answered yet";
const NOT_AN_OPTION = "the answer is not one of the options";

/**
 * The card shows the options and the app supplies the pick as `selection`; the
 * tool only checks it, so the model can never answer for the user.
 */
const askUser: ToolImpl<"ask_user"> = {
  name: "ask_user",
  run: async ({ options }, { selection }) => {
    if (selection === undefined) return { ok: false, error: NO_ANSWER };
    if (!options.includes(selection)) {
      return { ok: false, error: NOT_AN_OPTION };
    }
    return { ok: true, data: { choice: selection } };
  },
};

export const uiTools = [openItem, askUser] as const;
