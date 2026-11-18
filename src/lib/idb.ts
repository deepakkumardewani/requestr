import { type IDBPDatabase, type IDBPTransaction, openDB } from "idb";
import { toast } from "sonner";
import type {
  AppSettings,
  CollectionFolderModel,
  CollectionModel,
  EnvironmentModel,
  HistoryEntry,
  RequestModel,
  TabState,
} from "@/types";
import type { Chain } from "@/types/chain";
import type { LegacyChainConfig } from "./chainMigration";
import type { RunSummary } from "./chainRunHistory";
import { IDB_DB_NAME, IDB_STORES, IDB_VERSION } from "./idbSchema";
import type { RelayChangeRecord, RelayThread } from "./relay/threadDb";

/** Persisted record of a single chain execution — used for run history / recovery. */
export type ChainRunRecord = RunSummary;

export type RequestlyDB = {
  collections: {
    key: string;
    value: CollectionModel;
  };
  folders: {
    key: string;
    value: CollectionFolderModel;
    indexes: { "by-collection": string };
  };
  requests: {
    key: string;
    value: RequestModel;
    indexes: { "by-collection": string };
  };
  environments: {
    key: string;
    value: EnvironmentModel;
  };
  history: {
    key: string;
    value: HistoryEntry;
    indexes: { "by-timestamp": number };
  };
  tabs: {
    key: string;
    value: TabState;
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  chainConfigs: {
    key: string;
    value: LegacyChainConfig;
  };
  chains: {
    key: string;
    value: Chain;
  };
  chainRuns: {
    key: string;
    value: ChainRunRecord;
    indexes: { "by-chain": string };
  };
  relay_threads: {
    key: string;
    value: RelayThread;
    indexes: { "by-workspace": [string, number] };
  };
  relay_changes: {
    key: string;
    value: RelayChangeRecord;
    indexes: { "by-thread": string };
  };
};

let dbPromise: Promise<IDBPDatabase<RequestlyDB>> | null = null;

function openDatabase(): Promise<IDBPDatabase<RequestlyDB>> {
  // `openDB` throws synchronously when `indexedDB` does not exist (private
  // mode, some test environments); callers only handle a rejected promise.
  try {
    return openDB<RequestlyDB>(IDB_DB_NAME, IDB_VERSION, {
      upgrade(typedDb) {
        // Store names come from the shared schema (`idbSchema.ts`) as plain
        // strings, so treat the DB as schema-less while creating stores.
        const db = typedDb as unknown as IDBPDatabase;
        for (const store of IDB_STORES) {
          if (db.objectStoreNames.contains(store.name)) continue;

          const objectStore = db.createObjectStore(
            store.name,
            store.keyPath ? { keyPath: store.keyPath } : undefined,
          );
          for (const index of store.indexes ?? []) {
            objectStore.createIndex(index.name, index.keyPath);
          }
        }
      },
      blocked() {
        toast.error("Update ready", {
          description: "Close other Requestly tabs to finish updating.",
        });
      },
      blocking() {
        toast.error("New version available", {
          description: "Close this tab to let other tabs update.",
        });
      },
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

export function getDB(): Promise<IDBPDatabase<RequestlyDB>> | null {
  if (typeof window === "undefined") return null;

  if (!dbPromise) {
    const opening = openDatabase();
    dbPromise = opening;
    // A failed open must not be cached forever; the rejection itself still
    // reaches every caller, which decides how to degrade.
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null;
    });
  }

  return dbPromise;
}

export type StoreName = keyof RequestlyDB;

/**
 * The database with store names typed as plain strings, for code that works
 * across a dynamic list of stores (backup export, restore). Rejects when
 * IndexedDB is unavailable so callers fail loudly instead of exporting nothing.
 */
export async function getLooseDB(): Promise<IDBPDatabase> {
  const db = getDB();
  if (!db) throw new Error("IndexedDB is unavailable");
  return (await db) as unknown as IDBPDatabase;
}

/** Every record of a store in key order, unchanged. */
export async function readAllRecords(store: StoreName): Promise<unknown[]> {
  const db = await getLooseDB();
  return db.getAll(store);
}

export type LooseTransaction = IDBPTransaction<unknown, string[], "readwrite">;

/**
 * Runs `work` inside one readwrite transaction over `stores`. Any failure
 * aborts the transaction, so either every write lands or none does.
 */
export async function runInTransaction(
  stores: StoreName[],
  work: (tx: LooseTransaction) => Promise<void> | void,
): Promise<void> {
  const db = await getLooseDB();
  const tx = db.transaction(stores, "readwrite");
  const done = tx.done;
  try {
    await work(tx);
    await done;
  } catch (error) {
    abortQuietly(tx);
    // Aborting rejects `done` too; the original error below is the one to report.
    await done.catch(() => undefined);
    throw error;
  }
}

function abortQuietly(tx: LooseTransaction): void {
  try {
    tx.abort();
  } catch {
    // The transaction already finished or aborted itself (a failed request
    // aborts it); there is nothing left to roll back.
  }
}
