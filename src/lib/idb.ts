import { type IDBPDatabase, openDB } from "idb";
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
};

let dbPromise: Promise<IDBPDatabase<RequestlyDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RequestlyDB>> | null {
  if (typeof window === "undefined") return null;

  if (!dbPromise) {
    dbPromise = openDB<RequestlyDB>(IDB_DB_NAME, IDB_VERSION, {
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
  }

  return dbPromise;
}
