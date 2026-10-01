import type { IDBPDatabase } from "idb";
import { isPlainRecord } from "@/lib/chainJson";
import type {
  Chain,
  ChainAssertion,
  ChainBlock,
  ChainEdge,
  ChainHistoryNode,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EnvPromotion,
  HistoryBlock,
} from "@/types/chain";
import { migrateEdge } from "@/types/chain";

/** The unified-`Chain` schema version this migration targets; fixed even when `CHAIN_SCHEMA_VERSION` later moves on. */
const V5_SCHEMA_VERSION = 5;

import type { RequestlyDB } from "./idb";

/**
 * Legacy (pre-v5) `chainConfigs` record shape — one per collection chain.
 * Not part of the current architecture; kept only so migration code can read
 * old records off disk. See `LegacyStandaloneChain` for the sibling shape.
 */
export type LegacyChainConfig = {
  collectionId: string;
  edges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  nodeIds?: string[];
  historyNodes?: ChainHistoryNode[];
  nodeAssertions?: Record<string, ChainAssertion[]>;
  delayNodes?: DelayNodeConfig[];
  conditionNodes?: ConditionNodeConfig[];
  displayNodes?: DisplayBlock[];
  envPromotions?: EnvPromotion[];
  /** Set to 5 once this record has been folded into the unified v5 `Chain` shape. */
  schemaVersion?: number;
};

/** Legacy (pre-v5) `chains` record shape — one per standalone chain. */
export type LegacyStandaloneChain = {
  id: string;
  name: string;
  createdAt: number;
  edges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  nodeIds: string[];
  historyNodes: ChainHistoryNode[];
  nodeAssertions?: Record<string, ChainAssertion[]>;
  delayNodes?: DelayNodeConfig[];
  conditionNodes?: ConditionNodeConfig[];
  displayNodes?: DisplayBlock[];
  envPromotions?: EnvPromotion[];
  /** Set to 5 once this record has been upgraded in place to the unified v5 `Chain` shape. */
  schemaVersion?: number;
};

/** Thrown when the v4→v5 chain migration cannot proceed safely (e.g. an id collision). */
export class MigrationError extends Error {
  context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "MigrationError";
    this.context = context;
  }
}

const DEFAULT_CHAIN_NAME = "Collection chain";

type MigrationDB = IDBPDatabase<RequestlyDB>;

type LegacyBlockArrays = {
  historyNodes?: ChainHistoryNode[];
  delayNodes?: DelayNodeConfig[];
  conditionNodes?: ConditionNodeConfig[];
  displayNodes?: DisplayBlock[];
};

function foldBlocks(record: LegacyBlockArrays): ChainBlock[] {
  const history = (record.historyNodes ?? []).map(
    (n): HistoryBlock => ({ ...n, type: "history" }),
  );
  return [
    ...history,
    ...(record.delayNodes ?? []),
    ...(record.conditionNodes ?? []),
    ...(record.displayNodes ?? []),
  ];
}

/**
 * Pre-migration records in the `chains` store are still in the legacy per-type-array
 * shape, not the v5 `Chain` the store type declares, so the shape is checked at runtime.
 */
function isLegacyStandaloneChain(
  record: unknown,
): record is LegacyStandaloneChain {
  return (
    isPlainRecord(record) &&
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    Array.isArray(record.historyNodes)
  );
}

/** Migrates one legacy `chainConfigs` record into a v5 `Chain`, in a single transaction. */
async function migrateCollectionConfig(
  db: MigrationDB,
  config: LegacyChainConfig,
  collectionNames: Map<string, string>,
): Promise<void> {
  const collectionId = config.collectionId;
  const tx = db.transaction(["chainConfigs", "chains"], "readwrite");
  const chainsStore = tx.objectStore("chains");
  const configsStore = tx.objectStore("chainConfigs");

  const existing = await chainsStore.get(collectionId);
  if (existing && existing.collectionId !== collectionId) {
    tx.abort();
    throw new MigrationError("id collision", { id: collectionId });
  }

  const chain: Chain = {
    id: collectionId,
    scope: "collection",
    schemaVersion: V5_SCHEMA_VERSION,
    collectionId,
    name: collectionNames.get(collectionId) ?? DEFAULT_CHAIN_NAME,
    blocks: foldBlocks(config),
    nodeIds: config.nodeIds ?? [],
    edges: (config.edges ?? []).map(migrateEdge),
    nodePositions: config.nodePositions ?? {},
    nodeAssertions: config.nodeAssertions,
    envPromotions: config.envPromotions,
  };

  await chainsStore.put(chain);
  await configsStore.put({ ...config, schemaVersion: V5_SCHEMA_VERSION });
  await tx.done;
}

/** Upgrades one legacy-shape `chains` record (per-type arrays) in place to v5 `Chain` shape. */
async function migrateStandaloneChain(
  db: MigrationDB,
  chain: LegacyStandaloneChain,
): Promise<void> {
  const tx = db.transaction(["chains"], "readwrite");
  const chainsStore = tx.objectStore("chains");

  const upgraded: Chain = {
    id: chain.id,
    scope: "standalone",
    schemaVersion: V5_SCHEMA_VERSION,
    name: chain.name,
    createdAt: chain.createdAt,
    blocks: foldBlocks(chain),
    nodeIds: chain.nodeIds ?? [],
    edges: (chain.edges ?? []).map(migrateEdge),
    nodePositions: chain.nodePositions ?? {},
    nodeAssertions: chain.nodeAssertions,
    envPromotions: chain.envPromotions,
  };

  await chainsStore.put(upgraded);
  await tx.done;
}

/**
 * Migrates every legacy `chainConfigs` / `chains` record to the unified v5 `Chain` shape.
 * Progress is per-record (`schemaVersion === V5_SCHEMA_VERSION`), so a throw partway through leaves earlier
 * records migrated and later ones untouched — the next call resumes from where it stopped.
 */
export async function migrateChainsToV5(
  db: MigrationDB,
  collectionNames: Map<string, string>,
): Promise<void> {
  const configRecords = await db.getAll("chainConfigs");
  for (const config of configRecords) {
    if (config.schemaVersion === V5_SCHEMA_VERSION) continue;
    await migrateCollectionConfig(db, config, collectionNames);
  }

  const chainRecords = await db.getAll("chains");
  for (const chain of chainRecords) {
    if (chain.schemaVersion === V5_SCHEMA_VERSION) continue;
    if (!isLegacyStandaloneChain(chain)) {
      throw new MigrationError("unrecognised legacy chain record", {
        id: chain.id,
      });
    }
    await migrateStandaloneChain(db, chain);
  }
}
