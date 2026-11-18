/**
 * Pure fixture creation logic for chain UI testing.
 * No side effects, no IDB writes — use chainFixturesWindow for that.
 */

import { generateId } from "@/lib/utils";
import type { HttpTab, RequestModel } from "@/types";
import type {
  Chain,
  ConditionBlock,
  DelayBlock,
  DisplayBlock,
} from "@/types/chain";
import { CHAIN_HANDLE_IDS, CHAIN_SCHEMA_VERSION } from "@/types/chain";

// ──────────────────────────────────────────────────────────────────────────
// Named Constants (no magic strings)
// ──────────────────────────────────────────────────────────────────────────

const FIXTURE_NAMES = {
  TWO_API_NODES: "Two API Nodes",
  WITH_DISPLAY: "With Display Node",
  ENV_VAR: "Environment Variables",
  UNREACHABLE: "Unreachable Endpoint",
  SLOW_REQUEST: "Slow Request (5s)",
  ALL_NODE_TYPES: "All Node Types",
} as const;

const FIXTURE_IDS = {
  TWO_API_NODES: "fixture-two-api",
  WITH_DISPLAY: "fixture-display",
  ENV_VAR: "fixture-env-var",
  UNREACHABLE: "fixture-unreachable",
  SLOW_REQUEST: "fixture-slow",
  ALL_NODE_TYPES: "fixture-all-types",
} as const;

const FIXTURE_COLLECTION_IDS = {
  TWO_API_NODES: "fixture-collection-two-api",
  WITH_DISPLAY: "fixture-collection-display",
  ENV_VAR: "fixture-collection-env-var",
  UNREACHABLE: "fixture-collection-unreachable",
  SLOW_REQUEST: "fixture-collection-slow",
  ALL_NODE_TYPES: "fixture-collection-all-types",
} as const;

// Real, deterministic endpoints for testing
const API_ENDPOINTS = {
  HTTPBIN_ANYTHING: "https://httpbin.org/anything",
  HTTPBIN_ANYTHING_WITH_TOKEN:
    "https://httpbin.org/anything?token=fixture-token-123",
  HTTPBIN_DELAY_5: "https://httpbin.org/delay/5",
  HTTPBIN_ANYTHING_DUMMY: "https://httpbin.org/anything",
  UNREACHABLE: "http://127.0.0.1:1/",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Helper to create default HttpTab for request conversion
// ──────────────────────────────────────────────────────────────────────────

function createDefaultHttpTab(
  name: string,
  url: string,
  method: "GET" | "POST" = "GET",
): HttpTab {
  return {
    tabId: "",
    requestId: null,
    name,
    isDirty: false,
    type: "http",
    url,
    method,
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
  };
}

function convertTabToRequest(
  tab: HttpTab,
  collectionId: string,
  requestId?: string,
): RequestModel {
  const now = Date.now();
  return {
    id: requestId || generateId(),
    collectionId,
    name: tab.name,
    method: tab.method,
    url: tab.url,
    params: tab.params,
    headers: tab.headers,
    auth: tab.auth,
    body: tab.body,
    preScript: tab.preScript,
    postScript: tab.postScript,
    timeoutMs: tab.timeoutMs,
    createdAt: now,
    updatedAt: now,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Fixture Builders
// ──────────────────────────────────────────────────────────────────────────

export type ChainFixtureWithRequests = {
  chain: Chain;
  requests: RequestModel[];
  collectionId: string;
  scenario: string;
  description: string;
};

export type ChainFixture = ChainFixtureWithRequests;

/**
 * Scenario: API A → B with JSON extraction.
 * A returns { args: { token: "fixture-token-123" } } from httpbin
 * B receives the token injected into Authorization header.
 */
export function createTwoApiNodesFixture(): ChainFixture {
  const nodeAId = generateId();
  const nodeBId = generateId();
  const edgeId = generateId();
  const collectionId = FIXTURE_COLLECTION_IDS.TWO_API_NODES;

  // Create request A (with token in query)
  const tabA = createDefaultHttpTab(
    "API Node A (Token Source)",
    API_ENDPOINTS.HTTPBIN_ANYTHING_WITH_TOKEN,
  );
  const requestA = convertTabToRequest(tabA, collectionId, nodeAId);

  // Create request B (dummy, will receive token)
  const tabB = createDefaultHttpTab(
    "API Node B (Token Consumer)",
    API_ENDPOINTS.HTTPBIN_ANYTHING_DUMMY,
  );
  const requestB = convertTabToRequest(tabB, collectionId, nodeBId);

  const chain: Chain = {
    id: FIXTURE_IDS.TWO_API_NODES,
    scope: "standalone",
    schemaVersion: CHAIN_SCHEMA_VERSION,
    name: FIXTURE_NAMES.TWO_API_NODES,
    createdAt: Date.now(),
    blocks: [],
    nodeIds: [nodeAId, nodeBId],
    edges: [
      {
        id: edgeId,
        sourceRequestId: nodeAId,
        targetRequestId: nodeBId,
        injections: [
          {
            sourceJsonPath: "$.args.token",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
      },
    ],
    nodePositions: {
      [nodeAId]: { x: 100, y: 100 },
      [nodeBId]: { x: 400, y: 100 },
    },
  };

  return {
    chain,
    requests: [requestA, requestB],
    collectionId,
    scenario: "twoApiNodes",
    description:
      "Two API nodes: A extracts token from query param (httpbin /anything?token=X), B receives it in Authorization header",
  };
}

/**
 * Scenario: API node with a Display node showing extracted response headers.
 */
export function createWithDisplayFixture(): ChainFixture {
  const apiNodeId = generateId();
  const displayNodeId = generateId();
  const collectionId = FIXTURE_COLLECTION_IDS.WITH_DISPLAY;

  // Create API request
  const tab = createDefaultHttpTab(
    "API Node (Header Source)",
    API_ENDPOINTS.HTTPBIN_ANYTHING,
  );
  const request = convertTabToRequest(tab, collectionId, apiNodeId);

  const displayBlock: DisplayBlock = {
    id: displayNodeId,
    type: "display",
    sourceJsonPath: "$.headers['User-Agent']",
    targetField: "header",
    targetKey: "X-User-Agent",
  };

  const chain: Chain = {
    id: FIXTURE_IDS.WITH_DISPLAY,
    scope: "standalone",
    schemaVersion: CHAIN_SCHEMA_VERSION,
    name: FIXTURE_NAMES.WITH_DISPLAY,
    createdAt: Date.now(),
    blocks: [displayBlock],
    nodeIds: [apiNodeId],
    edges: [],
    nodePositions: {
      [apiNodeId]: { x: 100, y: 100 },
      [displayNodeId]: { x: 300, y: 100 },
    },
  };

  return {
    chain,
    requests: [request],
    collectionId,
    scenario: "withDisplay",
    description:
      "An API node with a Display block extracting User-Agent header and injecting to X-User-Agent",
  };
}

/**
 * Scenario: Chain using environment variables (both resolved and unresolved).
 * Requires environment with baseUrl=https://httpbin.org to be created and activated.
 */
export function createEnvVarFixture(): ChainFixture {
  const nodeId = generateId();
  const collectionId = FIXTURE_COLLECTION_IDS.ENV_VAR;

  // URL uses {{baseUrl}} (will be resolved) and {{undefinedVar}} (will warn)
  const tab = createDefaultHttpTab(
    "API Node (Env Vars)",
    "{{baseUrl}}/anything?test={{undefinedVar}}",
  );
  const request = convertTabToRequest(tab, collectionId, nodeId);

  const chain: Chain = {
    id: FIXTURE_IDS.ENV_VAR,
    scope: "standalone",
    schemaVersion: CHAIN_SCHEMA_VERSION,
    name: FIXTURE_NAMES.ENV_VAR,
    createdAt: Date.now(),
    blocks: [],
    nodeIds: [nodeId],
    edges: [],
    nodePositions: {
      [nodeId]: { x: 100, y: 100 },
    },
  };

  return {
    chain,
    requests: [request],
    collectionId,
    scenario: "envVar",
    description:
      "Single API node using {{baseUrl}} (env var to be resolved) and {{undefinedVar}} (undefined, will show warning)",
  };
}

/**
 * Scenario: Unreachable endpoint for testing error handling.
 */
export function createUnreachableFixture(): ChainFixture {
  const nodeId = generateId();
  const collectionId = FIXTURE_COLLECTION_IDS.UNREACHABLE;

  const tab = createDefaultHttpTab(
    "API Node (Unreachable)",
    API_ENDPOINTS.UNREACHABLE,
  );
  const request = convertTabToRequest(tab, collectionId, nodeId);

  const chain: Chain = {
    id: FIXTURE_IDS.UNREACHABLE,
    scope: "standalone",
    schemaVersion: CHAIN_SCHEMA_VERSION,
    name: FIXTURE_NAMES.UNREACHABLE,
    createdAt: Date.now(),
    blocks: [],
    nodeIds: [nodeId],
    edges: [],
    nodePositions: {
      [nodeId]: { x: 100, y: 100 },
    },
  };

  return {
    chain,
    requests: [request],
    collectionId,
    scenario: "unreachable",
    description:
      "Single API node with unreachable endpoint (127.0.0.1:1) for testing network error handling",
  };
}

/**
 * Scenario: Slow request to httpbin.org/delay/5 (5s delay).
 * Good for testing timeout, abort, and loading states.
 */
export function createSlowRequestFixture(): ChainFixture {
  const nodeId = generateId();
  const collectionId = FIXTURE_COLLECTION_IDS.SLOW_REQUEST;

  const tab = createDefaultHttpTab(
    "API Node (Slow)",
    API_ENDPOINTS.HTTPBIN_DELAY_5,
  );
  const request = convertTabToRequest(tab, collectionId, nodeId);

  const chain: Chain = {
    id: FIXTURE_IDS.SLOW_REQUEST,
    scope: "standalone",
    schemaVersion: CHAIN_SCHEMA_VERSION,
    name: FIXTURE_NAMES.SLOW_REQUEST,
    createdAt: Date.now(),
    blocks: [],
    nodeIds: [nodeId],
    edges: [],
    nodePositions: {
      [nodeId]: { x: 100, y: 100 },
    },
  };

  return {
    chain,
    requests: [request],
    collectionId,
    scenario: "slow",
    description:
      "Single API node with 5-second delay (httpbin.org/delay/5) for testing timeouts and loading states",
  };
}

/**
 * Scenario: All node types (API, Delay, Condition, Display).
 * Demonstrates the full range of chain capabilities.
 */
export function createAllNodeTypesFixture(): ChainFixture {
  const apiNodeId = generateId();
  const delayNodeId = generateId();
  const conditionNodeId = generateId();
  const displayNodeId = generateId();
  const collectionId = FIXTURE_COLLECTION_IDS.ALL_NODE_TYPES;

  // Create API request
  const tab = createDefaultHttpTab(
    "API Node (All Types Demo)",
    API_ENDPOINTS.HTTPBIN_ANYTHING,
  );
  const request = convertTabToRequest(tab, collectionId, apiNodeId);

  const delayBlock: DelayBlock = {
    id: delayNodeId,
    type: "delay",
    delayMs: 2000,
  };

  const conditionBlock: ConditionBlock = {
    id: conditionNodeId,
    type: "condition",
    variable: "{{role}}",
    branches: [
      { id: "admin", label: "admin", expression: "== 'admin'" },
      { id: "user", label: "user", expression: "== 'user'" },
      {
        id: CHAIN_HANDLE_IDS.ELSE,
        label: CHAIN_HANDLE_IDS.ELSE,
        expression: "",
      },
    ],
  };

  const displayBlock: DisplayBlock = {
    id: displayNodeId,
    type: "display",
    sourceJsonPath: "$.headers['host']",
    targetField: "header",
    targetKey: "X-Host",
  };

  const chain: Chain = {
    id: FIXTURE_IDS.ALL_NODE_TYPES,
    scope: "standalone",
    schemaVersion: CHAIN_SCHEMA_VERSION,
    name: FIXTURE_NAMES.ALL_NODE_TYPES,
    createdAt: Date.now(),
    blocks: [delayBlock, conditionBlock, displayBlock],
    nodeIds: [apiNodeId],
    edges: [],
    nodePositions: {
      [apiNodeId]: { x: 100, y: 100 },
      [delayNodeId]: { x: 100, y: 250 },
      [conditionNodeId]: { x: 300, y: 150 },
      [displayNodeId]: { x: 500, y: 100 },
    },
  };

  return {
    chain,
    requests: [request],
    collectionId,
    scenario: "allNodeTypes",
    description:
      "All node types: API (httpbin), Delay (2s), Condition (role-based), Display (host extraction)",
  };
}

/**
 * Create all fixtures as a map for easy lookup.
 */
export function createAllFixtures(): Record<string, ChainFixture> {
  return {
    twoApiNodes: createTwoApiNodesFixture(),
    withDisplay: createWithDisplayFixture(),
    envVar: createEnvVarFixture(),
    unreachable: createUnreachableFixture(),
    slow: createSlowRequestFixture(),
    allNodeTypes: createAllNodeTypesFixture(),
  };
}

/**
 * Get a single fixture by scenario name.
 */
export function getFixture(scenario: string): ChainFixture | null {
  const all = createAllFixtures();
  return all[scenario] ?? null;
}
