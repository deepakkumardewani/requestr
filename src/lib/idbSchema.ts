/**
 * Single source of truth for the app's IndexedDB schema — version, store
 * names, keyPaths, and indexes. Pure data, no browser/idb imports, so it can
 * be shared by `src/lib/idb.ts` (the real app database), the QA e2e seed
 * fixture (`e2e/fixtures/qaSeed.ts`), and the generator that produces the
 * standalone agent-browser init script (`scripts/build-qa-seed-js.ts`).
 *
 * Bump `IDB_VERSION` and add/edit entries in `IDB_STORES` together whenever
 * the app's persisted schema changes — every consumer derives from this file.
 */
import { IDB_DB_NAME } from "./constants";

export { IDB_DB_NAME };

export const IDB_VERSION = 5;

export type IdbIndexDef = {
  name: string;
  keyPath: string;
};

export type IdbStoreDef = {
  name: string;
  /** Omitted for out-of-line keys (e.g. `settings`, keyed by caller-supplied key). */
  keyPath?: string;
  indexes?: IdbIndexDef[];
};

export const IDB_STORES: IdbStoreDef[] = [
  { name: "collections", keyPath: "id" },
  {
    name: "requests",
    keyPath: "id",
    indexes: [{ name: "by-collection", keyPath: "collectionId" }],
  },
  {
    name: "folders",
    keyPath: "id",
    indexes: [{ name: "by-collection", keyPath: "collectionId" }],
  },
  { name: "environments", keyPath: "id" },
  {
    name: "history",
    keyPath: "id",
    indexes: [{ name: "by-timestamp", keyPath: "timestamp" }],
  },
  { name: "tabs", keyPath: "tabId" },
  { name: "settings" },
  { name: "chainConfigs", keyPath: "collectionId" },
  { name: "chains", keyPath: "id" },
  {
    name: "chainRuns",
    keyPath: "id",
    indexes: [{ name: "by-chain", keyPath: "chainId" }],
  },
];

export const IDB_STORE_NAMES = IDB_STORES.map((store) => store.name);
