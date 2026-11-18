import type { BodyConfig, TabState } from "@/types";
import { snapshotTabRequest } from "./changeLog";

/**
 * Where a reply's code block can be put in the active tab (FR-183). Code is
 * only ever stored as text in one field; it is never run, sent or connected.
 */

export type ApplyField = "body" | "variables" | "draft";

/** Keys under `relay.apply` for the button label. */
export type ApplyLabelKey = "applyBody" | "applyVariables" | "applyMessage";

/** Keys under `relay.apply` for why the button is disabled. */
export type ApplyDisabledReason = "invalidJson" | "needsRequestTab";

export type ApplyAction = {
  label: ApplyLabelKey;
  /** Null when there is no tab to write to. */
  field: ApplyField | null;
  disabledReason?: ApplyDisabledReason;
};

const DEFAULT_LABEL: ApplyLabelKey = "applyBody";

/** Body types whose editor does not show free text, so applied code needs a text type. */
const NON_TEXT_BODY_TYPES: ReadonlySet<BodyConfig["type"]> = new Set([
  "none",
  "form-data",
  "urlencoded",
]);

export function isValidJson(code: string): boolean {
  try {
    JSON.parse(code);
    return true;
  } catch {
    return false;
  }
}

export function resolveApplyAction(
  activeTab: TabState | null | undefined,
  code: string,
): ApplyAction {
  if (!activeTab) {
    return {
      label: DEFAULT_LABEL,
      field: null,
      disabledReason: "needsRequestTab",
    };
  }
  switch (activeTab.type) {
    case "http":
      return { label: "applyBody", field: "body" };
    case "graphql":
      return isValidJson(code)
        ? { label: "applyVariables", field: "variables" }
        : {
            label: "applyVariables",
            field: "variables",
            disabledReason: "invalidJson",
          };
    case "websocket":
    case "socketio":
      return { label: "applyMessage", field: "draft" };
  }
}

function bodyTypeFor(current: BodyConfig["type"], code: string) {
  if (!NON_TEXT_BODY_TYPES.has(current)) return current;
  return isValidJson(code) ? "json" : "text";
}

/** The one-field patch for `field`; an HTTP body keeps its type unless that type cannot hold text. */
export function buildApplyPatch(
  tab: TabState,
  field: ApplyField,
  code: string,
): Partial<TabState> {
  if (field === "body" && tab.type === "http") {
    const type = bodyTypeFor(tab.body.type, code);
    return { body: { ...tab.body, type, content: code } };
  }
  return { [field]: code } as Partial<TabState>;
}

/**
 * What Undo restores. HTTP tabs have no tab snapshot (a null `before` would
 * close the tab), so only the body is kept.
 */
export function buildApplyBefore(tab: TabState): Partial<TabState> {
  if (tab.type === "http") return { body: tab.body };
  return (snapshotTabRequest(tab) ?? {}) as Partial<TabState>;
}
