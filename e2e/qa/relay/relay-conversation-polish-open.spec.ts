import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const COLLECTION_ID = "qa-v2nav-col";
const INNER_FOLDER_ID = "qa-v2nav-folder-inner";

type Row = { id: string; name?: string };

const openButton = (scope: Locator) => scope.getByRole("button", { name: "Open" });
const summaryRows = (page: Page) => page.getByTestId("relay-changes-row");
// The end-of-turn summary row for the entity (cards are replaced by it once the turn ends).
const cardFor = (page: Page, label: string) =>
  summaryRows(page).filter({ hasText: label });

/** The first string `field` in the latest `toolName` output the client sent back. */
function outputField(bodies: unknown[], toolName: string, field: string) {
  const body = bodies.at(-1) as { messages?: unknown[] };
  const parts = (body.messages ?? []).flatMap(
    (message) => (message as { parts?: unknown[] }).parts ?? [],
  ) as { type?: string; output?: unknown }[];
  const output = parts.filter((p) => p.type === `tool-${toolName}`).at(-1)?.output;
  const search = (node: unknown): string | undefined => {
    if (!node || typeof node !== "object") return undefined;
    const record = node as Record<string, unknown>;
    if (typeof record[field] === "string") return record[field];
    return Object.values(record).map(search).find(Boolean);
  };
  const value = search(output);
  if (!value) throw new Error(`no ${field} in ${toolName} output`);
  return value;
}

async function rowNamed(page: Page, store: string, name: string): Promise<Row> {
  const rows = (await dumpIdbStore(page, store)) as Row[];
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(`no ${store} row named ${name}`);
  return row;
}

async function start(page: Page, scripts: RelayScript[], prompt: string) {
  await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, prompt);
}

test.describe("Relay conversation polish: Open @qa", () => {
  test("[REL-CP-OPEN-01] Open on a folder created in a collapsed nested collection reveals, selects and scrolls to its row, even already on /app",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP open folder ${Date.now()}`;
      await start(
        page,
        [
          {
            kind: "clientTools",
            calls: [
              { toolName: "create_folder", input: { parentId: INNER_FOLDER_ID, name } },
            ],
          },
          { kind: "text", text: "Folder created." },
        ],
        "Create a folder",
      );
      await expect(page.getByText("Folder created.")).toBeVisible();
      const card = cardFor(page, name);
      await expect(card).toHaveCount(1);

      const folder = await rowNamed(page, "folders", name);
      const row = page.getByTestId(`folder-item-${folder.id}`);
      await expect(page.getByTestId(`collection-item-${COLLECTION_ID}`)).toBeVisible();
      await expect(row).toHaveCount(0);
      await expect(page).toHaveURL(/\/app\/?$/);

      await openButton(card).click();

      await expect(page).toHaveURL(/\/app\/?$/);
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute("data-selected", "");
      await expect(row).toBeInViewport();
      await snap("01-folder-revealed");
    },
  );

  test("[REL-CP-OPEN-02] a collection deleted via Relay shows no Open on its row",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP open col ${Date.now()}`;
      await start(
        page,
        [
          { kind: "clientTools", calls: [{ toolName: "create_collection", input: { name, parentId: null } }] },
          {
            kind: "clientTools",
            calls: (bodies) => [
              {
                toolName: "delete_collection",
                input: { ids: [outputField(bodies, "create_collection", "collectionId")] },
              },
            ],
          },
          { kind: "text", text: "Collection removed." },
        ],
        "Create then delete a collection",
      );
      const card = cardFor(page, name);
      await expect(card).toHaveCount(1);
      await expect(openButton(card)).toBeVisible();

      await page.getByTestId("relay-confirm-approve").click();
      await expect(page.getByText("Collection removed.")).toBeVisible();

      expect(await rowNamed(page, "collections", name).catch(() => null)).toBeNull();
      await expect(openButton(card)).toHaveCount(0);
      await expect(openButton(summaryRows(page))).toHaveCount(0);
      await snap("02-deleted-no-open");
    },
  );

  test("[REL-CP-OPEN-03] an undone change row shows no Open",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP open undo ${Date.now()}`;
      await start(
        page,
        [
          {
            kind: "clientTools",
            calls: [
              { toolName: "create_folder", input: { parentId: INNER_FOLDER_ID, name } },
            ],
          },
          { kind: "text", text: "Folder created." },
        ],
        "Create a folder",
      );
      const card = cardFor(page, name);
      await expect(openButton(card)).toBeVisible();

      await page.getByRole("button", { name: "Undo all" }).click();

      await expect(card).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Undo all" })).toHaveCount(0);
      await expect(openButton(card)).toHaveCount(0);
      await snap("03-undone-no-open");
    },
  );

  test("[REL-CP-OPEN-04] a chain card's Open navigates to /chain/<id>",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP open chain ${Date.now()}`;
      await start(
        page,
        [
          { kind: "clientTools", calls: [{ toolName: "create_chain", input: { name } }] },
          { kind: "text", text: "Chain created." },
        ],
        "Create a chain",
      );
      const card = cardFor(page, name);
      await expect(openButton(card)).toBeVisible();
      const chain = await rowNamed(page, "chains", name);

      await openButton(card).click();

      await expect(page).toHaveURL(new RegExp(`/chain/${chain.id}/?$`));
      await snap("04-chain-opened");
    },
  );
});
