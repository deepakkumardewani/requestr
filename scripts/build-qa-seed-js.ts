/**
 * Generates e2e/fixtures/qa-seed.init.js from e2e/fixtures/seed/ (the single
 * source of truth for QA seed data) and src/lib/idbSchema.ts (the single
 * source of truth for the IndexedDB schema). Run via `bun run qa:seed:build`
 * whenever the seed data or schema changes. Do not hand-edit the generated
 * file.
 *
 * The generated file is a standalone plain-JS init script (no imports, no
 * TS) so it can be passed directly to agent-browser:
 *   agent-browser open --init-script e2e/fixtures/qa-seed.init.js http://localhost:3000
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IDB_DB_NAME,
  type IdbStoreDef,
  IDB_STORES,
  IDB_VERSION,
} from "../src/lib/idbSchema";
import { loadSeedData, type QaSeedData } from "../e2e/fixtures/seed";

const BANNER = `// GENERATED FILE — do not edit by hand.
// Source of truth: e2e/fixtures/seed/ (data) + src/lib/idbSchema.ts (schema)
// Regenerate with: bun run qa:seed:build
//
// Usage with agent-browser:
//   agent-browser open --init-script e2e/fixtures/qa-seed.init.js http://localhost:3000
`;

function buildStoreCreationSnippet(stores: IdbStoreDef[]): string {
  return stores
    .map((store) => {
      const create = store.keyPath
        ? `db.createObjectStore(${JSON.stringify(store.name)}, { keyPath: ${JSON.stringify(store.keyPath)} })`
        : `db.createObjectStore(${JSON.stringify(store.name)})`;
      const indexCalls = (store.indexes ?? [])
        .map(
          (index) =>
            `.createIndex(${JSON.stringify(index.name)}, ${JSON.stringify(index.keyPath)})`,
        )
        .join("");
      return `    if (!db.objectStoreNames.contains(${JSON.stringify(store.name)})) {
      ${create}${indexCalls};
    }`;
    })
    .join("\n");
}

/** Pure builder so tests can assert the generated output without touching disk. */
export function buildQaSeedInitScript(
  data: QaSeedData,
  stores: IdbStoreDef[] = IDB_STORES,
  dbName: string = IDB_DB_NAME,
  version: number = IDB_VERSION,
): string {
  const body = `(function seedQaData() {
  var FLAG = "e2e-qa-seeded";
  if (sessionStorage.getItem(FLAG)) return;
  sessionStorage.setItem(FLAG, "1");

  var data = ${JSON.stringify(data, null, 2)};

  // Schema (name/version/stores) mirrors src/lib/idbSchema.ts. Without an
  // explicit version + upgrade handler here, a bare
  // \`indexedDB.open(${JSON.stringify(dbName)})\` on a fresh browser profile
  // creates an empty v1 DB with NO object stores, and every putAll below
  // silently no-ops. Keep this schema in sync with e2e/fixtures/qaSeed.ts.
  var IDB_VERSION = ${version};
  var req = indexedDB.open(${JSON.stringify(dbName)}, IDB_VERSION);
  req.onupgradeneeded = () => {
    var db = req.result;
${buildStoreCreationSnippet(stores)}
  };
  req.onsuccess = () => {
    var db = req.result;

    function putAll(storeName, records) {
      if (!db.objectStoreNames.contains(storeName) || !records || records.length === 0) return;
      var tx = db.transaction(storeName, "readwrite");
      var store = tx.objectStore(storeName);
      var i;
      for (i = 0; i < records.length; i++) store.put(records[i]);
    }

    putAll("environments", data.environments);
    putAll("collections", data.collections);
    putAll("requests", data.requests);
    putAll("folders", data.folders);
    putAll("history", data.history);
    putAll("chains", data.chains);
    putAll("chainRuns", data.chainRuns);
    putAll("relay_threads", data.relayThreads);

    var chainConfigsTx;
    if (db.objectStoreNames.contains("chainConfigs")) {
      chainConfigsTx = db.transaction("chainConfigs", "readwrite");
      chainConfigsTx.objectStore("chainConfigs").put(data.legacyChainConfig);
    }

    db.close();
  };
})();
`;

  return BANNER + body;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, "../e2e/fixtures/qa-seed.init.js");
  writeFileSync(outPath, buildQaSeedInitScript(loadSeedData()));
  console.log(`Wrote ${outPath}`);
}
