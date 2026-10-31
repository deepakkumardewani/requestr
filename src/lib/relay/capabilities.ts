/**
 * What Relay can do (RP-206): the single source of truth behind the
 * capabilities popover. Pure and typed; the
 * approval markers call `approvalNeeded` so they can never drift from the rules.
 */

import type { RelayPermissionMode } from "./permission";
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
  | "transfer"
  | "settings"
  | "navigation"
  | "backup";

export type CapabilityIcon =
  | "book-open"
  | "pencil"
  | "play"
  | "folder-tree"
  | "arrow-left-right";

export type CapabilityBadge = "asks" | "runs" | "asksBulk";

export type CapabilityCategoryEntry = {
  id: CapabilityCategory;
  icon: CapabilityIcon;
  titleKey: `capabilities.category.${CapabilityCategory}.title`;
  descriptionKey: `capabilities.category.${CapabilityCategory}.description`;
  /** Representative tools of the area; their approval rules decide its marker. */
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
  get_app_settings: "settings",
  set_theme: "settings",
  set_language: "settings",
  update_proxy_settings: "settings",
  set_global_variables: "settings",
  set_relay_preferences: "settings",
  open_page: "navigation",
  show_sidebar_tab: "navigation",
  export_backup: "backup",
  import_backup: "backup",
  duplicate_collection: "write",
  duplicate_chain: "write",
  duplicate_environment: "write",
  create_folder: "organize",
  rename_folder: "organize",
  delete_folder: "organize",
  export_postman: "transfer",
  import_api_catalog: "transfer",
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

/** Display order. */
export const CAPABILITY_CATEGORIES: readonly CapabilityCategoryEntry[] = [
  {
    id: "read",
    icon: "book-open",
    titleKey: "capabilities.category.read.title",
    descriptionKey: "capabilities.category.read.description",
    tools: [
      "get_request",
      "get_collection",
      "get_environment",
      "search_workspace",
      "get_last_response",
    ],
  },
  {
    id: "write",
    icon: "pencil",
    titleKey: "capabilities.category.write.title",
    descriptionKey: "capabilities.category.write.description",
    tools: [
      "create_request",
      "update_request",
      "set_request_headers",
      "create_collection",
      "create_chain",
      "create_environment",
      "bulk_update_requests",
    ],
  },
  {
    id: "run",
    icon: "play",
    titleKey: "capabilities.category.run.title",
    descriptionKey: "capabilities.category.run.description",
    tools: ["send_request", "run_chain", "generate_tests"],
  },
  {
    id: "organize",
    icon: "folder-tree",
    titleKey: "capabilities.category.organize.title",
    descriptionKey: "capabilities.category.organize.description",
    tools: [
      "rename_collection",
      "move_item",
      "rename_environment",
      "delete_request",
      "delete_collection",
      "delete_folder",
      "clear_history",
      "open_item",
      "close_tab",
    ],
  },
  {
    id: "transfer",
    icon: "arrow-left-right",
    titleKey: "capabilities.category.transfer.title",
    descriptionKey: "capabilities.category.transfer.description",
    tools: [
      "import_curl",
      "export_curl",
      "export_history",
      "export_postman",
      "import_api_catalog",
    ],
  },
  {
    id: "settings",
    icon: "pencil",
    titleKey: "capabilities.category.settings.title",
    descriptionKey: "capabilities.category.settings.description",
    tools: [
      "get_app_settings",
      "set_theme",
      "set_language",
      "update_proxy_settings",
      "set_global_variables",
      "set_relay_preferences",
    ],
  },
  {
    id: "navigation",
    icon: "folder-tree",
    titleKey: "capabilities.category.navigation.title",
    descriptionKey: "capabilities.category.navigation.description",
    tools: ["open_page", "show_sidebar_tab"],
  },
  {
    id: "backup",
    icon: "arrow-left-right",
    titleKey: "capabilities.category.backup.title",
    descriptionKey: "capabilities.category.backup.description",
    tools: ["export_backup", "import_backup"],
  },
];

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

/** The area's marker; "runs" means no approval applies and the row shows none. */
export const categoryBadge = (
  category: CapabilityCategoryEntry,
  mode: RelayPermissionMode,
): CapabilityBadge => capabilityBadge(category.tools, mode);
