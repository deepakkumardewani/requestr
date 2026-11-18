// DummyJSON-only seed data for the capture scripts. Nothing here is a real
// credential: the login user is DummyJSON's public demo account.
import type { Page } from "@playwright/test";
import { IDB_DB_NAME, IDB_STORES, IDB_VERSION } from "../../src/lib/idbSchema";

const DUMMYJSON_BASE_URL = "https://dummyjson.com";
const SEED_EPOCH_MS = 1700000000000;
const COLLECTION_ID = "capture-collection";
const ENVIRONMENT_ID = "capture-env";
// DummyJSON's public demo account; not a real credential.
const DEMO_PASSWORD = "emilyspass";
const SEED_FLAG = "capture-seeded";

export const ENV_ID = ENVIRONMENT_ID;
export const PASSWORD_VARIABLE = "DUMMYJSON_PASSWORD";
export const CHAIN_ID = "capture-chain";
export const LOGIN_REQUEST_ID = "capture-req-login";
export const FIRST_REQUEST_URL = `${DUMMYJSON_BASE_URL}/products`;

type RequestSpec = {
  id: string;
  name: string;
  method: "GET" | "POST";
  url: string;
  headers?: { key: string; value: string }[];
  body?: string;
};

const REQUESTS: RequestSpec[] = [
  {
    id: LOGIN_REQUEST_ID,
    name: "Login",
    method: "POST",
    url: "{{baseUrl}}/user/login",
    headers: [{ key: "Content-Type", value: "application/json" }],
    body: JSON.stringify(
      { username: "emilys", password: "{{DUMMYJSON_PASSWORD}}" },
      null,
      2,
    ),
  },
  {
    id: "capture-req-me",
    name: "Get current user",
    method: "GET",
    url: "{{baseUrl}}/user/me",
  },
  {
    id: "capture-req-cart",
    name: "Get user cart",
    method: "GET",
    url: "{{baseUrl}}/carts/user/1",
  },
  {
    id: "capture-req-add",
    name: "Add product",
    method: "POST",
    url: "{{baseUrl}}/products/add",
    headers: [{ key: "Content-Type", value: "application/json" }],
    body: JSON.stringify({ title: "Desk lamp", price: 24.5 }, null, 2),
  },
  {
    id: "capture-req-products",
    name: "List products",
    method: "GET",
    url: "{{baseUrl}}/products?limit=5",
  },
  {
    id: "capture-req-search",
    name: "Search products",
    method: "GET",
    url: "{{baseUrl}}/products/search?q=phone",
  },
];

const toRow = (pair: { key: string; value: string }, index: number) => ({
  id: `h-${index}`,
  key: pair.key,
  value: pair.value,
  enabled: true,
});

const requestRecords = REQUESTS.map((r) => ({
  id: r.id,
  collectionId: COLLECTION_ID,
  folderId: null,
  name: r.name,
  method: r.method,
  url: r.url,
  params: [],
  headers: (r.headers ?? []).map(toRow),
  auth: { type: "none" },
  body: r.body
    ? { type: "json", content: r.body }
    : { type: "none", content: "" },
  preScript: "",
  postScript: "",
}));

const chainIds = REQUESTS.slice(0, 4).map((r) => r.id);

const chainRecord = {
  id: CHAIN_ID,
  scope: "standalone",
  schemaVersion: 5,
  name: "DummyJSON checkout flow",
  createdAt: SEED_EPOCH_MS,
  blocks: [],
  nodeIds: chainIds,
  edges: chainIds.slice(0, -1).map((source, i) => ({
    id: `capture-edge-${i}`,
    sourceRequestId: source,
    targetRequestId: chainIds[i + 1],
    injections:
      i === 0
        ? [
            {
              sourceJsonPath: "$.accessToken",
              targetField: "header",
              targetKey: "Authorization",
            },
          ]
        : [],
  })),
  nodePositions: Object.fromEntries(
    chainIds.map((id, i) => [id, { x: 80 + i * 320, y: 160 }]),
  ),
};

export const seedData = {
  environments: [
    {
      id: ENVIRONMENT_ID,
      name: "DummyJSON",
      description: "Public demo API",
      variables: [
        {
          id: "capture-var-password",
          key: PASSWORD_VARIABLE,
          initialValue: DEMO_PASSWORD,
          currentValue: DEMO_PASSWORD,
          isSecret: false,
        },
        {
          id: "capture-var-base",
          key: "baseUrl",
          initialValue: DUMMYJSON_BASE_URL,
          currentValue: DUMMYJSON_BASE_URL,
          isSecret: false,
        },
      ],
      createdAt: SEED_EPOCH_MS,
      updatedAt: SEED_EPOCH_MS,
    },
  ],
  collections: [
    {
      id: COLLECTION_ID,
      name: "DummyJSON Shop",
      description: "Demo storefront API",
      createdAt: SEED_EPOCH_MS,
      updatedAt: SEED_EPOCH_MS,
    },
  ],
  requests: requestRecords,
  chains: [chainRecord],
};

/** Writes the seed into IndexedDB before the first navigation, once per context. */
export async function seedCaptureData(
  page: Page,
  stores: string[] = Object.keys(seedData),
): Promise<void> {
  await page.addInitScript(
    (args) => {
      if (sessionStorage.getItem(args.flag)) return;
      sessionStorage.setItem(args.flag, "1");
      const open = indexedDB.open(args.dbName, args.version);
      open.onupgradeneeded = () => {
        const db = open.result;
        for (const store of args.stores) {
          if (db.objectStoreNames.contains(store.name)) continue;
          const created = store.keyPath
            ? db.createObjectStore(store.name, { keyPath: store.keyPath })
            : db.createObjectStore(store.name);
          for (const index of store.indexes ?? []) {
            created.createIndex(index.name, index.keyPath);
          }
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        for (const [name, records] of Object.entries(args.data)) {
          if (!db.objectStoreNames.contains(name)) continue;
          const store = db.transaction(name, "readwrite").objectStore(name);
          for (const record of records) store.put(record);
        }
        db.close();
      };
    },
    {
      flag: SEED_FLAG,
      dbName: IDB_DB_NAME,
      version: IDB_VERSION,
      stores: IDB_STORES,
      data: Object.fromEntries(
        Object.entries(seedData).filter(([name]) => stores.includes(name)),
      ) as Record<string, unknown[]>,
    },
  );
}
