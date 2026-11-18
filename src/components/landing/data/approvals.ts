import {
  RELAY_PERMISSION_MODES,
  type RelayPermissionMode,
} from "@/lib/relay/permission";
import {
  approvalNeeded,
  BULK_CONFIRM_THRESHOLD,
} from "@/lib/relay/tools/schemas";

/**
 * Sample Relay actions for the approval simulator. Whether each one stops to
 * ask is not written here: it is computed with the app's own `approvalNeeded`,
 * so the landing page cannot claim something the app does not do.
 */

export type ApprovalOutcome = "asks" | "runs";

interface SampleAction {
  id: string;
  /** What the action is, in the words a person would use. */
  label: string;
  tool: string;
  input: unknown;
}

export interface ApprovalRow {
  id: string;
  label: string;
  outcomes: Record<RelayPermissionMode, ApprovalOutcome>;
}

const SAMPLE_ID = "sample";
/** Comfortably over the threshold where a bulk edit starts needing approval. */
const LARGE_BULK_SIZE = BULK_CONFIRM_THRESHOLD + 15;
const LARGE_BULK_IDS = Array.from(
  { length: LARGE_BULK_SIZE },
  (_, index) => `${SAMPLE_ID}-${index}`,
);

const SAMPLE_ACTIONS: readonly SampleAction[] = [
  {
    id: "read",
    label: "Read a request to explain it",
    tool: "get_request",
    input: { requestId: SAMPLE_ID },
  },
  {
    id: "rename",
    label: "Rename a collection",
    tool: "rename_collection",
    input: { id: SAMPLE_ID, name: "Shop" },
  },
  {
    id: "headers",
    label: "Add a header to one request",
    tool: "set_request_headers",
    input: {
      requestId: SAMPLE_ID,
      upsert: [{ key: "Accept", value: "application/json" }],
      remove: null,
    },
  },
  {
    id: "bulk",
    label: `Edit ${LARGE_BULK_SIZE} requests at once`,
    tool: "bulk_update_requests",
    input: { ids: LARGE_BULK_IDS, op: { type: "set_method", method: "GET" } },
  },
  {
    id: "scripts",
    label: "Write a test script",
    tool: "set_request_scripts",
    input: { requestId: SAMPLE_ID, pre: null, post: "" },
  },
  {
    id: "send",
    label: "Send a request",
    tool: "send_request",
    input: { requestId: SAMPLE_ID },
  },
  {
    id: "delete",
    label: "Delete a collection",
    tool: "delete_collection",
    input: { ids: [SAMPLE_ID] },
  },
  {
    id: "backup",
    label: "Export a backup file",
    tool: "export_backup",
    input: {
      sections: ["collections"],
      collectionIds: null,
      environmentIds: null,
      chainIds: null,
      includeSecrets: null,
    },
  },
];

function outcomesFor(action: SampleAction): ApprovalRow["outcomes"] {
  const entries = RELAY_PERMISSION_MODES.map((mode) => [
    mode,
    approvalNeeded(action.tool, action.input, mode) ? "asks" : "runs",
  ]);
  return Object.fromEntries(entries) as ApprovalRow["outcomes"];
}

export const APPROVAL_ROWS: readonly ApprovalRow[] = SAMPLE_ACTIONS.map(
  (action) => ({
    id: action.id,
    label: action.label,
    outcomes: outcomesFor(action),
  }),
);
