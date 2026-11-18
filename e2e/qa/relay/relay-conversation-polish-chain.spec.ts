import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const NODE_COUNT = 4;
const DELAY_MS = 10;

const EMPTY_BLOCK = {
  kind: "delay",
  requestId: null,
  sourceJsonPath: null,
  schema: null,
  delayMs: DELAY_MS,
  itemAlias: null,
  maxIterations: null,
  variable: null,
  branches: null,
  targetField: null,
  targetKey: null,
} as const;

type Row = { id: string; name?: string; collectionId?: unknown; scope?: unknown };

/** The first string `field` in the latest `toolName` output the client sent back. */
function outputField(bodies: unknown[], toolName: string, field: string) {
  const body = bodies[bodies.length - 1] as { messages?: unknown[] };
  let found: string | undefined;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (found === undefined && typeof record[field] === "string") {
      found = record[field] as string;
    }
    Object.values(record).forEach(visit);
  };
  for (const message of body.messages ?? []) {
    for (const part of (message as { parts?: unknown[] }).parts ?? []) {
      const tool = part as { type?: string; output?: unknown };
      if (tool.type === `tool-${toolName}`) visit(tool.output);
    }
  }
  if (!found) throw new Error(`no ${toolName}.${field} in the tool outputs`);
  return found;
}

const addDelay = (chainId: string) => ({
  toolName: "add_chain_node",
  input: { chainId, block: EMPTY_BLOCK, after: null, afterHandle: null },
});

const rowsOf = async (page: Page, store: string) =>
  (await dumpIdbStore(page, store)) as Row[];

/** Writes rows (keyed by each store's keyPath) straight into the app's IndexedDB. */
async function putRows(page: Page, store: string, rows: object[]) {
  await page.evaluate(
    ({ dbName, storeName, data }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(storeName, "readwrite");
          data.forEach((row) => tx.objectStore(storeName).put(row));
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, storeName: store, data: rows },
  );
}

async function start(page: Page, scripts: RelayScript[], prompt: string) {
  await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, prompt);
}

test.describe("Relay conversation polish: standalone chains", () => {
  test("[REL-CP-CHAIN-01] create_chain with 4 nodes leaves collections untouched and the chain has no collectionId",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP chain ${Date.now()}`;
      await page.goto(WORKSPACE_PATH);
      const before = (await rowsOf(page, "collections")).map((c) => c.id).sort();
      expect(before.length).toBeGreaterThan(0);

      const chainId = (bodies: unknown[]) =>
        outputField(bodies, "create_chain", "chainId");
      const nodeTurn: RelayScript = {
        kind: "clientTools",
        calls: (bodies) => [addDelay(chainId(bodies))],
      };
      await start(
        page,
        [
          { kind: "clientTools", calls: [{ toolName: "create_chain", input: { name } }] },
          nodeTurn,
          nodeTurn,
          nodeTurn,
          nodeTurn,
          { kind: "text", text: "Chain built." },
        ],
        "Build a chain",
      );
      await expect(page.getByText("Chain built.")).toBeVisible();

      const chains = await rowsOf(page, "chains");
      const created = chains.filter((c) => c.name === name);
      expect(created).toHaveLength(1);
      expect(created[0].collectionId ?? null).toBeNull();
      expect((created[0] as { blocks?: unknown[] }).blocks).toHaveLength(NODE_COUNT);
      const after = (await rowsOf(page, "collections")).map((c) => c.id).sort();
      expect(after).toEqual(before);
      await snap("01-standalone-chain");
    },
  );

  test("[REL-CP-CHAIN-02] create a chain and open it ends at /chain/<id> of the created chain",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP open chain ${Date.now()}`;
      await start(
        page,
        [
          { kind: "clientTools", calls: [{ toolName: "create_chain", input: { name } }] },
          {
            kind: "clientTools",
            calls: (bodies) => [
              {
                toolName: "open_item",
                input: { kind: "chain", id: outputField(bodies, "create_chain", "chainId") },
              },
            ],
          },
          { kind: "text", text: "Opened it." },
        ],
        "Create a chain and open it",
      );
      await expect(page).toHaveURL(/\/chain\/[^/]+$/);
      const urlId = new URL(page.url()).pathname.split("/").pop();
      const created = (await rowsOf(page, "chains")).filter((c) => c.name === name);
      expect(created).toHaveLength(1);
      expect(urlId).toBe(created[0].id);
      await snap("02-chain-opened");
    },
  );

  test("[REL-CP-CHAIN-03] a collection-scoped chain (chain id = collection id) is still editable and openable via Relay and keeps scope 'collection'",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const collectionId = `qa-cp-collection-${Date.now()}`;
      await page.goto(WORKSPACE_PATH);
      await putRows(page, "collections", [
        { id: collectionId, name: `CP collection ${collectionId}`, description: "", createdAt: Date.now(), updatedAt: Date.now() },
      ]);
      await putRows(page, "chains", [
        {
          id: collectionId,
          scope: "collection",
          schemaVersion: 5,
          collectionId,
          name: `CP collection ${collectionId}`,
          createdAt: Date.now(),
          blocks: [],
          nodeIds: [],
          edges: [],
          nodePositions: {},
        },
      ]);
      await page.reload();

      const chainRow = async () =>
        (await rowsOf(page, "chains")).find((c) => c.id === collectionId) as
          | { blocks?: unknown[]; scope?: unknown; collectionId?: unknown }
          | undefined;
      expect((await chainRow())?.scope).toBe("collection");
      expect((await chainRow())?.blocks).toHaveLength(0);

      await start(
        page,
        [
          { kind: "clientTools", calls: [addDelay(collectionId)] },
          { kind: "clientTools", calls: [{ toolName: "open_item", input: { kind: "chain", id: collectionId } }] },
          { kind: "text", text: "Edited and opened." },
        ],
        "Edit the collection chain and open it",
      );
      await expect(page).toHaveURL(new RegExp(`/chain/${collectionId}$`));
      await expect.poll(async () => (await chainRow())?.blocks?.length).toBe(1);
      const after = await chainRow();
      expect(after?.scope).toBe("collection");
      expect(after?.collectionId).toBe(collectionId);
      await snap("03-collection-chain-edited");
    },
  );
});
