import { commitChange } from "../changeLog";
import { openEntity } from "../openEntity";
import type { ToolImpl } from "./registry";

/**
 * UI tools move the user's view, never their data. Opening is still logged so
 * the Change Card can put the previous tab back (FR-41).
 */

const openItem: ToolImpl<"open_item"> = {
  name: "open_item",
  refs: ({ id }) => [{ kind: "request", id }],
  run: ({ id }, { store, write }) =>
    openEntity("request", id, {
      store,
      writer: write?.writer,
      commit: (spec) => commitChange(write, spec),
    }),
};

const NO_ANSWER = "the user has not answered yet";
const EMPTY_ANSWER = "the answer is empty";

/**
 * The card shows the options and the app supplies the answer as `selection`:
 * an option, or text the user typed (BUG-04). The tool only checks it is
 * non-empty, so the model can never answer for the user.
 */
const askUser: ToolImpl<"ask_user"> = {
  name: "ask_user",
  run: async (_input, { selection }) => {
    if (selection === undefined) return { ok: false, error: NO_ANSWER };
    if (typeof selection !== "string" || selection.trim() === "") {
      return { ok: false, error: EMPTY_ANSWER };
    }
    return { ok: true, data: { choice: selection.trim() } };
  },
};

export const uiTools = [openItem, askUser] as const;
