import type { Page } from "@playwright/test";
import { IDB_DB_NAME, IDB_STORES, IDB_VERSION } from "../../src/lib/idbSchema";
import { loadSeedData } from "./seed";

const seedData = loadSeedData();

/**
 * Shared QA seed fixture — writes environments, a collection with requests,
 * a legacy-format chain config (for migration testing), and every chain
 * shape the P10.4 final-walkthrough checklist requires.
 *
 * Source of truth is `e2e/fixtures/seed/` (one JSON file per feature area,
 * merged by `loadSeedData`). The plain-JS copy used by agent-browser
 * (`qa-seed.init.js`) is generated from the same data + schema via
 * `bun run qa:seed:build` — never hand-edit that file.
 *
 * Idempotency: writes only run once per browser context (guarded by a
 * sessionStorage flag), matching the pattern used by the other chain/
 * collections e2e specs (see e2e/chain.spec.ts). This means a `page.reload()`
 * within the same test will NOT re-seed or clobber state the app has since
 * changed — which is what we want for a walkthrough that mutates data as it
 * goes. If a brand-new tab/context is used, seeding runs again from scratch.
 */
export async function seedQaData(page: Page) {
  await page.addInitScript(
    (args: {
      data: typeof seedData;
      dbName: string;
      version: number;
      stores: typeof IDB_STORES;
    }) => {
      const { data, dbName, version, stores } = args;
      const FLAG = "e2e-qa-seeded";
      if (sessionStorage.getItem(FLAG)) return;
      sessionStorage.setItem(FLAG, "1");

      // Schema (name/version/stores) comes from src/lib/idbSchema.ts, the
      // same source the real app uses. This addInitScript can run and open
      // the database before the app itself has ever opened it (e.g. on the
      // very first navigation of a fresh browser context) — without an
      // explicit version + upgrade handler here, that first
      // `indexedDB.open(dbName)` with no version creates an empty v1
      // database with NO object stores, and every `putAll` below silently
      // no-ops (`objectStoreNames.contains` is false), seeding nothing.
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of stores) {
          if (db.objectStoreNames.contains(store.name)) continue;
          const objectStore = store.keyPath
            ? db.createObjectStore(store.name, { keyPath: store.keyPath })
            : db.createObjectStore(store.name);
          for (const index of store.indexes ?? []) {
            objectStore.createIndex(index.name, index.keyPath);
          }
        }
      };
      req.onsuccess = () => {
        const db = req.result;

        const putAll = (storeName: string, records: unknown[]) => {
          if (!db.objectStoreNames.contains(storeName) || records.length === 0)
            return;
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          for (const record of records) store.put(record);
        };

        putAll("environments", data.environments);
        putAll("collections", data.collections);
        putAll("requests", data.requests);
        putAll("chains", data.chains);

        // Legacy chain config, keyed by collectionId, for migration testing.
        if (db.objectStoreNames.contains("chainConfigs")) {
          const tx = db.transaction("chainConfigs", "readwrite");
          tx.objectStore("chainConfigs").put(data.legacyChainConfig);
        }

        // Legacy-shape standalone `chains` record (the "chains" store's own
        // pre-v5 shape, distinct from `chainConfigs` above) — proves
        // migration handles both old stores, not just one.
        putAll("chains", [data.legacyStandaloneChain]);

        db.close();
      };
    },
    {
      data: seedData,
      dbName: IDB_DB_NAME,
      version: IDB_VERSION,
      stores: IDB_STORES,
    },
  );
}

export { seedData as qaSeedData };
