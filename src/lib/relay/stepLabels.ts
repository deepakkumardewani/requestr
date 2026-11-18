import { isRelayToolName, RELAY_TOOL_SCHEMAS } from "@/lib/relay/tools/schemas";

/** Keys under the `relay` i18n namespace. */
export const ACTIVITY_THINKING_KEY = "activity.thinking";
export const ACTIVITY_GENERIC_KEY = "activity.generic";
const ACTIVITY_TOOL_KEY_PREFIX = "activity.tools.";

export type StepLabel = { key: string; params: { name?: string } };

/**
 * Tools whose label embeds the target name taken from the call input. While
 * the input is still streaming the name is missing, so they show the generic
 * label rather than a sentence with a hole.
 */
const NAME_INPUT_FIELD: Record<string, "query" | "name"> = {
  search_workspace: "query",
  create_collection: "name",
  rename_collection: "name",
  create_chain: "name",
  create_request: "name",
  create_environment: "name",
  create_graphql_request: "name",
  create_websocket_request: "name",
  create_socketio_request: "name",
  rename_environment: "name",
  rename_chain: "name",
};

const GENERIC_LABEL: StepLabel = { key: ACTIVITY_GENERIC_KEY, params: {} };

function targetName(toolName: string, input: unknown): string | undefined {
  const field = NAME_INPUT_FIELD[toolName];
  if (!field || !input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * The i18n key and params for a live tool step. Every registered tool has a
 * label keyed by its name (a spec enforces it); anything else is generic.
 */
export function stepLabelFor(toolName: string, input: unknown): StepLabel {
  if (!isRelayToolName(toolName)) return GENERIC_LABEL;
  if (toolName in NAME_INPUT_FIELD) {
    const name = targetName(toolName, input);
    return name
      ? { key: ACTIVITY_TOOL_KEY_PREFIX + toolName, params: { name } }
      : GENERIC_LABEL;
  }
  return { key: ACTIVITY_TOOL_KEY_PREFIX + toolName, params: {} };
}

/** Keys under the `relay` namespace for the grouped read lines (CONV-04). */
export const READ_SEGMENT = {
  request: "turn.summary.readRequest",
  item: "turn.summary.readItem",
  searched: "turn.summary.searched",
  explored: "turn.summary.explored",
} as const;

export type ReadSegmentKey = (typeof READ_SEGMENT)[keyof typeof READ_SEGMENT];

const SEARCH_TOOLS: ReadonlySet<string> = new Set(["search_workspace"]);
const EXPLORE_TOOLS: ReadonlySet<string> = new Set([
  "get_workspace_summary",
  "get_collection",
]);
const REQUEST_READ_TOOLS: ReadonlySet<string> = new Set([
  "get_request",
  "get_tab_request",
  "get_last_response",
  "export_curl",
  "diff_responses",
]);

/** The grouped-line key a read tool counts towards; null for a write, card or unknown tool. */
export function readSegmentFor(toolName: string): ReadSegmentKey | null {
  if (!isRelayToolName(toolName)) return null;
  if (RELAY_TOOL_SCHEMAS[toolName].kind !== "read") return null;
  if (SEARCH_TOOLS.has(toolName)) return READ_SEGMENT.searched;
  if (EXPLORE_TOOLS.has(toolName)) return READ_SEGMENT.explored;
  if (REQUEST_READ_TOOLS.has(toolName)) return READ_SEGMENT.request;
  return READ_SEGMENT.item;
}
