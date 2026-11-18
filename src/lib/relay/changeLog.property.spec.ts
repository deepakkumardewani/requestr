import { describe, expect, it, vi } from "vitest";
import type { StoreSource } from "./storeAccess";
import {
  createFakeWriteContext,
  listWriteTools,
  writeThenUndo,
} from "./testing/changeLogTestKit";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/hub", () => ({
  announceSlugChange: vi.fn(),
  unmarkSlugImported: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

/**
 * Property: for every Relay tool that writes, write -> Undo leaves the store
 * deep-equal to what it was before. A new write tool must be added to CASES (or
 * to EXEMPT with a reason), otherwise "every write tool has a case" fails.
 */

const request = (id: string, collectionId: string, folderId: string | null) => ({
  id,
  collectionId,
  folderId,
  name: `Request ${id}`,
  method: "GET" as const,
  url: `https://api.test/${id}`,
  params: [],
  headers: [{ key: "X-Seed", value: "1", enabled: true }],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

const delayChain = (id: string, collectionId?: string) => ({
  id,
  scope: collectionId ? ("collection" as const) : ("standalone" as const),
  ...(collectionId ? { collectionId } : {}),
  schemaVersion: 5,
  name: `Chain ${id}`,
  createdAt: 1,
  blocks: [{ id: `${id}-d1`, type: "delay", delayMs: 10 }],
  nodeIds: ["r1", "r2"],
  edges: [
    {
      id: `${id}-e1`,
      sourceRequestId: "r1",
      targetRequestId: `${id}-d1`,
      injections: [],
    },
  ],
  nodePositions: {
    r1: { x: 0, y: 0 },
    r2: { x: 2, y: 2 },
    [`${id}-d1`]: { x: 1, y: 1 },
  },
});

/**
 * Undo puts an entity back with an upsert, so a restored row can land at the end
 * of its list. The contract is the same set of entities, so lists compare by id.
 */
function byIdentity(state: StoreSource): StoreSource {
  const sorted = <T>(list: readonly T[]) =>
    [...list].sort((a, b) =>
      (a as { id: string }).id.localeCompare((b as { id: string }).id),
    );
  return {
    ...state,
    collections: sorted(state.collections),
    folders: sorted(state.folders),
    requests: sorted(state.requests),
    environments: sorted(state.environments),
    chains: sorted(state.chains),
  };
}

/** Two collections, one folder, one environment active, a collection chain and a standalone chain. */
const seed = () =>
  createFakeWriteContext({
    collections: [
      { id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 },
      { id: "c2", name: "Billing", createdAt: 1, updatedAt: 1 },
    ],
    folders: [
      {
        id: "f1",
        collectionId: "c1",
        name: "Admin",
        parentFolderId: null,
        order: 0,
      },
    ],
    requests: [
      request("r1", "c1", null),
      request("r2", "c1", "f1"),
      request("r3", "c2", null),
    ],
    environments: [
      {
        id: "e1",
        name: "Staging",
        variables: [{ id: "v1", key: "baseUrl", value: "https://s", enabled: true }],
      },
      { id: "e2", name: "Production", variables: [] },
    ],
    activeEnvironmentId: "e1",
    chains: [delayChain("c1", "c1"), delayChain("ch1")],
  } as never);

const ADDED_HEADER = [{ key: "X-New", value: "2", enabled: true }];
const NO_AUTH_FIELDS = {
  token: null,
  username: null,
  password: null,
  key: null,
  value: null,
  addTo: null,
};
const NO_NODE_FIELDS = {
  sourceJsonPath: null,
  schema: null,
  delayMs: null,
  itemAlias: null,
  maxIterations: null,
  variable: null,
  branches: null,
  targetField: null,
  targetKey: null,
};

/** One valid input per write tool that the fake store can apply and undo. */
const CASES: Record<string, unknown> = {
  create_collection: { name: "Reports" },
  rename_collection: { id: "c1", name: "Sales" },
  move_item: { id: "r1", parentId: "c2", index: null },
  create_folder: { parentId: "c1", name: "Docs" },
  rename_folder: { id: "f1", name: "Staff" },
  create_chain: { name: "Fresh chain" },
  rename_chain: { id: "ch1", name: "Renamed chain" },
  add_chain_node: {
    chainId: "ch1",
    block: { kind: "delay", requestId: null, ...NO_NODE_FIELDS, delayMs: 50 },
    after: null,
    afterHandle: null,
  },
  update_chain_node: {
    chainId: "ch1",
    nodeId: "ch1-d1",
    patch: { ...NO_NODE_FIELDS, delayMs: 99 },
  },
  connect_chain_nodes: {
    chainId: "ch1",
    from: "ch1-d1",
    to: "r2",
    handle: null,
    remove: null,
  },
  create_request: {
    collectionId: "c1",
    folderId: null,
    name: "Fresh",
    method: "POST",
    url: "https://api.test/fresh",
    headers: null,
    params: null,
    body: null,
    auth: null,
  },
  update_request: { requestId: "r1", name: "Renamed", method: "PUT", url: null },
  duplicate_request: { requestId: "r1", toCollectionId: "c2" },
  set_request_headers: { requestId: "r1", upsert: ADDED_HEADER, remove: ["X-Seed"] },
  set_request_params: {
    requestId: "r1",
    upsert: [{ key: "page", value: "1", enabled: true }],
    remove: null,
  },
  set_request_body: { requestId: "r1", body: { type: "json", content: "{}" } },
  set_request_auth: {
    requestId: "r1",
    auth: { type: "bearer", ...NO_AUTH_FIELDS, token: "{{token}}" },
  },
  set_request_scripts: { requestId: "r1", pre: "const a = 1;", post: null },
  bulk_update_requests: {
    ids: ["r1", "r2"],
    op: { method: "PATCH", urlReplace: null, upsertHeaders: null, removeHeaders: null },
  },
  import_curl: { curl: "curl https://api.test/curl", collectionId: "c1" },
  create_environment: { name: "QA", variables: null },
  set_env_variables: {
    environmentId: "e1",
    upsert: [{ key: "region", value: "eu", secret: false }],
    remove: ["baseUrl"],
  },
  rename_environment: { id: "e1", name: "Staging 2" },
  set_active_environment: { environmentId: "e2" },
  duplicate_collection: { collectionId: "c1" },
  duplicate_chain: { chainId: "ch1" },
  duplicate_environment: { environmentId: "e1" },
  delete_requests: { ids: ["r1", "r3"] },
  delete_requests_in_collection: { collectionId: "c1" },
  delete_collection: { ids: ["c1"] },
  delete_folder: { id: "f1" },
  delete_environment: { id: "e1" },
  delete_chain: { id: "ch1" },
  delete_chain_node: { chainId: "ch1", nodeId: "ch1-d1" },
};

/**
 * Write tools the in-memory kit cannot round-trip, each with why and where its
 * undo is proven instead. An entry is a decision, not a gap: keep the reason true.
 */
const EXEMPT: Record<string, string> = {
  set_theme: "writes localStorage and next-themes; undo proven in changeLog.settings.spec.ts",
  set_language: "writes the settings store; undo proven in changeLog.settings.spec.ts",
  update_proxy_settings: "writes the settings store; undo proven in changeLog.settings.spec.ts",
  set_global_variables: "writes the settings store; undo proven in changeLog.settings.spec.ts",
  set_relay_preferences: "writes the relay store; undo proven in changeLog.settings.spec.ts",
  create_graphql_request: "opens a tab in the tabs store; tabRequest undo proven in changeLog.settings.spec.ts",
  create_websocket_request: "opens a tab in the tabs store; tabRequest undo proven in changeLog.settings.spec.ts",
  create_socketio_request: "opens a tab in the tabs store; tabRequest undo proven in changeLog.settings.spec.ts",
  update_tab_request: "edits a tab in the tabs store; tabRequest undo proven in changeLog.settings.spec.ts",
  generate_tests: "edits assertions of an open tab; tabRequest undo proven in changeLog.settings.spec.ts",
  import_backup: "needs a picked file; its undo is proven in backupTools.spec.ts",
  import_api_catalog: "needs the network catalog; its undo is proven in catalogTools.spec.ts",
  open_item: "navigation only, records no change",
  open_page: "navigation only, records no change",
  show_sidebar_tab: "navigation only, records no change",
  close_tab: "closes a tab, records no change",
  close_all_tabs: "closes tabs, records no change",
  export_backup: "exports a file, records no change",
  export_postman: "exports a file, records no change",
  export_history: "exports a file, records no change",
  clear_history: "irreversible by design, records no change",
  send_request: "sends a request, records no change",
  run_chain: "runs a chain, records no change",
};

describe("write -> undo property", () => {
  it("has a case or an exemption for every write tool, and no stale entries", () => {
    const tools = listWriteTools();
    expect(tools.length).toBeGreaterThan(40);
    const known = new Set([...Object.keys(CASES), ...Object.keys(EXEMPT)]);
    expect(tools.filter((name) => !known.has(name))).toEqual([]);
    expect([...known].filter((name) => !tools.includes(name))).toEqual([]);
    expect(Object.keys(CASES).filter((name) => name in EXEMPT)).toEqual([]);
  });

  it.each(Object.entries(CASES))(
    "%s: Undo puts the store back exactly as it was",
    async (toolName, input) => {
      const ctx = seed();
      const trip = await writeThenUndo(ctx, toolName, input);
      expect(trip.changeIds.length).toBeGreaterThan(0);
      expect(byIdentity(trip.afterWrite)).not.toEqual(byIdentity(trip.before));
      expect(trip.undone).toEqual(trip.changeIds.map(() => true));
      expect(byIdentity(trip.afterUndo)).toEqual(byIdentity(trip.before));
    },
  );
});
