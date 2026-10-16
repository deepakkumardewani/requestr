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
