/**
 * What Relay can do (RP-206): the single source of truth behind the
 * capabilities popover and the new-chat empty state. Pure and typed; the
 * approval badges call `approvalNeeded` so they can never drift from the rules.
 */

import type { RelayPermissionMode } from "./permission";
import type { SlashTargetKind } from "./slashCommands";
import {
  approvalNeeded,
  BULK_CONFIRM_THRESHOLD,
  type RelayToolName,
} from "./tools/schemas";

export type CapabilityCategory =
  | "read"
  | "write"
  | "run"
  | "organize"
  | "transfer";

export type CapabilityIcon =
  | "book-open"
  | "pencil"
  | "play"
  | "folder-tree"
  | "arrow-left-right";

export type CapabilityBadge = "asks" | "runs" | "asksBulk";

/** A starter prompt; `promptKey` is both the button text and the message it sends. */
export type CapabilityExample = {
  id: string;
  promptKey: `capabilities.${CapabilityCategory}.examples.${number}`;
  /** The item the prompt is about; absent when it needs none. */
  requiresTarget?: SlashTargetKind;
};

export type CapabilityCategoryEntry = {
  id: CapabilityCategory;
  icon: CapabilityIcon;
  titleKey: `capabilities.category.${CapabilityCategory}.title`;
  descriptionKey: `capabilities.category.${CapabilityCategory}.description`;
  examples: readonly CapabilityExample[];
};

export type CapabilityAction = {
  id: string;
  category: CapabilityCategory;
  labelKey: `capabilities.${CapabilityCategory}.actions.${number}`;
  tools: readonly RelayToolName[];
};

/** `satisfies` makes a tool added to the schemas without a category fail typecheck. */
export const CAPABILITY_CATEGORY_BY_TOOL = {
  get_workspace_summary: "read",
  search_workspace: "read",
  get_request: "read",
  get_collection: "read",
  list_environments: "read",
  get_environment: "read",
  get_active_context: "read",
  get_last_response: "read",
  get_chain: "read",
  get_chain_run: "read",
  get_tab_request: "read",
  diff_responses: "read",
  generate_docs: "read",
  create_collection: "write",
  create_chain: "write",
  add_chain_node: "write",
  update_chain_node: "write",
  connect_chain_nodes: "write",
  create_request: "write",
  update_request: "write",
  create_graphql_request: "write",
  create_websocket_request: "write",
  create_socketio_request: "write",
  update_tab_request: "write",
  duplicate_request: "write",
  set_request_headers: "write",
  set_request_params: "write",
  set_request_body: "write",
  set_request_auth: "write",
  set_request_scripts: "write",
  bulk_update_requests: "write",
  create_environment: "write",
  set_env_variables: "write",
  set_active_environment: "write",
  generate_tests: "run",
  send_request: "run",
  run_chain: "run",
  ask_user: "read",
  rename_collection: "organize",
  move_item: "organize",
  rename_environment: "organize",
  rename_chain: "organize",
  open_item: "organize",
  close_tab: "organize",
  close_all_tabs: "organize",
  delete_request: "organize",
  delete_requests: "organize",
  delete_requests_in_collection: "organize",
  delete_collection: "organize",
  delete_environment: "organize",
  delete_chain: "organize",
  delete_chain_node: "organize",
  clear_history: "organize",
  import_curl: "transfer",
  export_curl: "transfer",
  export_history: "transfer",
} as const satisfies Record<RelayToolName, CapabilityCategory>;

const example = (
  category: CapabilityCategory,
  n: number,
  requiresTarget?: SlashTargetKind,
): CapabilityExample => ({
  id: `${category}-${n}`,
  promptKey: `capabilities.${category}.examples.${n}`,
  ...(requiresTarget ? { requiresTarget } : {}),
});

/** Display order; 2 to 3 starters each. */
export const CAPABILITY_CATEGORIES: readonly CapabilityCategoryEntry[] = [
  {
    id: "read",
    icon: "book-open",
    titleKey: "capabilities.category.read.title",
    descriptionKey: "capabilities.category.read.description",
    examples: [
      example("read", 1, "request"),
      example("read", 2),
      example("read", 3),
    ],
  },
  {
    id: "write",
    icon: "pencil",
    titleKey: "capabilities.category.write.title",
    descriptionKey: "capabilities.category.write.description",
    examples: [
      example("write", 1),
      example("write", 2, "request"),
      example("write", 3),
    ],
  },
  {
    id: "run",
    icon: "play",
    titleKey: "capabilities.category.run.title",
    descriptionKey: "capabilities.category.run.description",
    examples: [
      example("run", 1, "request"),
      example("run", 2, "request"),
      example("run", 3, "request"),
    ],
  },
  {
    id: "organize",
    icon: "folder-tree",
    titleKey: "capabilities.category.organize.title",
    descriptionKey: "capabilities.category.organize.description",
    examples: [
      example("organize", 1),
      example("organize", 2),
      example("organize", 3),
    ],
  },
  {
    id: "transfer",
    icon: "arrow-left-right",
    titleKey: "capabilities.category.transfer.title",
    descriptionKey: "capabilities.category.transfer.description",
    examples: [
      example("transfer", 1),
      example("transfer", 2, "request"),
      example("transfer", 3),
    ],
  },
];

const action = (
  category: CapabilityCategory,
  n: number,
  tools: readonly RelayToolName[],
): CapabilityAction => ({
  id: `${category}-${n}`,
  category,
  labelKey: `capabilities.${category}.actions.${n}`,
  tools,
});

/** Action lines, each carrying the approval badge of its tools. */
export const CAPABILITY_ACTIONS: readonly CapabilityAction[] = [
  action("read", 1, [
    "get_request",
    "get_collection",
    "get_environment",
    "search_workspace",
  ]),
  action("read", 2, ["get_last_response"]),
  action("write", 1, [
    "create_request",
    "update_request",
    "set_request_headers",
  ]),
  action("write", 2, [
    "create_collection",
    "create_chain",
    "create_environment",
  ]),
  action("write", 3, ["bulk_update_requests"]),
  action("run", 1, ["send_request"]),
  action("run", 2, ["run_chain"]),
  action("run", 3, ["generate_tests"]),
  action("organize", 1, [
    "rename_collection",
    "move_item",
    "rename_environment",
  ]),
  action("organize", 2, [
    "delete_request",
    "delete_collection",
    "clear_history",
  ]),
  action("organize", 3, ["open_item", "close_tab"]),
  action("transfer", 1, ["import_curl"]),
  action("transfer", 2, ["export_curl", "export_history"]),
];

export const actionsFor = (
  category: CapabilityCategory,
): readonly CapabilityAction[] =>
  CAPABILITY_ACTIONS.filter((candidate) => candidate.category === category);

const distinctIds = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `probe-${index}`);

/** Probe inputs: one id, and one more distinct id than the bulk threshold. */
const SMALL_INPUT = { ids: distinctIds(1) };
const LARGE_INPUT = { ids: distinctIds(BULK_CONFIRM_THRESHOLD + 1) };

function toolBadge(
  tool: RelayToolName,
  mode: RelayPermissionMode,
): CapabilityBadge {
  if (approvalNeeded(tool, SMALL_INPUT, mode)) return "asks";
  return approvalNeeded(tool, LARGE_INPUT, mode) ? "asksBulk" : "runs";
}

const BADGE_SEVERITY: Record<CapabilityBadge, number> = {
  runs: 0,
  asksBulk: 1,
  asks: 2,
};

/** The strictest badge among the tools, as decided by the live `approvalNeeded`. */
export function capabilityBadge(
  tools: readonly RelayToolName[],
  mode: RelayPermissionMode,
): CapabilityBadge {
  return tools.reduce<CapabilityBadge>((strictest, tool) => {
    const badge = toolBadge(tool, mode);
    return BADGE_SEVERITY[badge] > BADGE_SEVERITY[strictest]
      ? badge
      : strictest;
  }, "runs");
}
