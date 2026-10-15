import { isRelayToolName } from "@/lib/relay/tools/schemas";

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
