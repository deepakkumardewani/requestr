import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { expandWorkedGroups, openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes, type RelayScript } from "../../fixtures/relayRoutes";
import { downloadCapture, dumpIdbStore } from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const COLLECTION_ID = "qa-v2ent-col";
const COLLECTION_NAME = "TOOLENT Collection";
const CHAIN_ID = "qa-v2ent-chain";
const ENV_ID = "qa-v2ent-env";
const RENAME_FOLDER_ID = "qa-v2ent-folder-rename";
const RENAME_FOLDER_NAME = "TOOLENT Rename me";
const DELETE_FOLDER_ID = "qa-v2ent-folder-delete";
const DELETE_FOLDER_NAME = "TOOLENT Keep me";
const SEEDED_REQUEST_NAME = "TOOLENT Request";
const COPY_SUFFIX = " (copy)";
const CATALOG_SLUG = "checkouts";
const CATALOG_NAME = "BigCommerce (Checkouts)";
const USER_DECLINED_RESULT = "user declined";
const POSTMAN_SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
const TOOL_NAME = /\b(?:duplicate_(?:collection|chain|environment)|create_folder|rename_folder|delete_folder|export_postman|import_api_catalog)\b/;

const summary = (page: Page) => page.getByTestId("relay-changes-summary");
const rows = (page: Page) => page.getByTestId("relay-changes-row");
const rowFor = (page: Page, label: string) => rows(page).filter({ hasText: label });
const card = (page: Page) => page.getByTestId("relay-confirm-card");
const approve = (page: Page) => page.getByTestId("relay-confirm-approve");
const decline = (page: Page) => page.getByTestId("relay-confirm-decline");

type Named = { name: string };
type ToolCall = { toolName: string; input: unknown };

const names = async (page: Page, store: string): Promise<string[]> =>
  ((await dumpIdbStore(page, store)) as Named[]).map((row) => row.name);

const countNamed = (all: string[], name: string) => all.filter((n) => n === name).length;

/** Opens Relay with the scripted turns installed. */
async function openWith(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

const toolTurn = (calls: ToolCall[], done: string): RelayScript[] => [
  { kind: "clientTools", calls },
  { kind: "text", text: done },
];

/** The latest `tool-<name>` output (or error text) the client sent back to the model. */
async function sentToolOutput(bodies: unknown[], toolName: string): Promise<string> {
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(2);
  const body = bodies.at(-1) as { messages?: { parts?: unknown[] }[] };
  const parts = (body.messages ?? []).flatMap((m) => m.parts ?? []) as {
    type?: string;
    output?: unknown;
    errorText?: string;
  }[];
  const part = parts.findLast((p) => p.type === `tool-${toolName}`);
  return JSON.stringify(part?.output ?? part?.errorText ?? null);
}

test.describe("Relay v2 entity tools @qa", () => {
  test("[REL-V2-TOOLENT-01] duplicate_collection, duplicate_chain and duplicate_environment create copies, appear in the summary with Open, and Undo removes them",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const done = "Made three copies.";
      await openWith(
        page,
        toolTurn(
          [
            { toolName: "duplicate_collection", input: { collectionId: COLLECTION_ID } },
            { toolName: "duplicate_chain", input: { chainId: CHAIN_ID } },
            { toolName: "duplicate_environment", input: { environmentId: ENV_ID } },
          ],
          done,
        ),
      );
      await sendMessage(page, "Duplicate my collection, chain and environment");
      await expect(page.getByText(done)).toBeVisible();

      const copies = {
        collection: `${COLLECTION_NAME}${COPY_SUFFIX}`,
        chain: `TOOLENT Chain${COPY_SUFFIX}`,
        environment: `TOOLENT Environment${COPY_SUFFIX}`,
      };
      // A summary row is labelled by what was done to the source, and Open points at the copy.
      const rowLabels = {
        collection: `Duplicated collection "${COLLECTION_NAME}"`,
        chain: 'Duplicated chain "TOOLENT Chain"',
        environment: 'Duplicated environment "TOOLENT Environment"',
      };
      await expect(summary(page)).toBeVisible();
      await expect(rows(page)).toHaveCount(3);
      for (const label of Object.values(rowLabels)) {
        const row = rowFor(page, label);
        await expect(row).toHaveCount(1);
        await expect(row).toHaveAttribute("data-op", "created");
        await expect(row.getByRole("button", { name: "Open" })).toBeEnabled();
      }
      expect(await names(page, "collections")).toContain(copies.collection);
      expect(await names(page, "chains")).toContain(copies.chain);
      expect(await names(page, "environments")).toContain(copies.environment);
      // The copy is a deep copy: the seeded folders and request came along.
      expect(countNamed(await names(page, "requests"), SEEDED_REQUEST_NAME)).toBe(2);
      await snap("01-copies-in-summary");


      await summary(page).getByRole("button", { name: "Undo all" }).click();

      for (const label of Object.values(rowLabels)) {
        await expect(rowFor(page, label).getByTestId("relay-changes-reason")).toHaveText("Undone");
      }
      await expect.poll(() => names(page, "collections")).not.toContain(copies.collection);
      await expect.poll(() => names(page, "chains")).not.toContain(copies.chain);
      await expect.poll(() => names(page, "environments")).not.toContain(copies.environment);
      expect(await names(page, "collections")).toContain(COLLECTION_NAME);
      expect(countNamed(await names(page, "requests"), SEEDED_REQUEST_NAME)).toBe(1);
      await snap("01-copies-undone");
    },
  );

  test("[REL-V2-TOOLENT-02] create_folder and rename_folder apply and Undo reverts",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const created = `TOOLENT New folder ${Date.now()}`;
      const renamed = `TOOLENT Renamed ${Date.now()}`;
      const done = "Folder work done.";
      await openWith(
        page,
        toolTurn(
          [
            { toolName: "create_folder", input: { parentId: COLLECTION_ID, name: created } },
            { toolName: "rename_folder", input: { id: RENAME_FOLDER_ID, name: renamed } },
          ],
          done,
        ),
      );
      await sendMessage(page, "Add a folder and rename the other one");
      await expect(page.getByText(done)).toBeVisible();

      await expect.poll(() => names(page, "folders")).toEqual(
        expect.arrayContaining([created, renamed]),
      );
      expect(await names(page, "folders")).not.toContain(RENAME_FOLDER_NAME);
      await expandWorkedGroups(page);
      const cards = page.getByTestId("relay-change-card");
      await expect(cards).toHaveCount(2);
      await snap("02-folder-changes-applied");

      await cards.filter({ hasText: renamed }).getByRole("button", { name: "Undo" }).click();
      await cards.filter({ hasText: created }).getByRole("button", { name: "Undo" }).click();

      await expect.poll(() => names(page, "folders")).toContain(RENAME_FOLDER_NAME);
      const folders = await names(page, "folders");
      expect(folders).not.toContain(created);
      expect(folders).not.toContain(renamed);
      await expect(page.getByTestId("relay-change-undone")).toHaveCount(2);
      await snap("02-folder-changes-undone");
    },
  );

  test("[REL-V2-TOOLENT-03] delete_folder asks first and declining deletes nothing",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWith(
        page,
        toolTurn([{ toolName: "delete_folder", input: { id: DELETE_FOLDER_ID } }], "Left it alone."),
      );
      await sendMessage(page, "Delete the Keep me folder");

      await expect(card(page)).toBeVisible();
      await expect(card(page)).toContainText(DELETE_FOLDER_NAME);
      await expect(card(page)).not.toContainText(TOOL_NAME);
      // Nothing has run yet: the folder is intact and no follow-up request went out.
      expect(await names(page, "folders")).toContain(DELETE_FOLDER_NAME);
      expect(routes.requestBodies).toHaveLength(1);
      await snap("03-delete-folder-card");

      await decline(page).click();

      expect(await sentToolOutput(routes.requestBodies, "delete_folder")).toContain(
        USER_DECLINED_RESULT,
      );
      await expect(page.getByText("Left it alone.")).toBeVisible();
      expect(await names(page, "folders")).toContain(DELETE_FOLDER_NAME);
      expect(countNamed(await names(page, "requests"), SEEDED_REQUEST_NAME)).toBe(1);
      await expect(rows(page)).toHaveCount(0);
    },
  );

  test("[REL-V2-TOOLENT-04] export_postman downloads a Postman file for one collection",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const done = "Exported for Postman.";
      const routes = await openWith(
        page,
        toolTurn([{ toolName: "export_postman", input: { collectionId: COLLECTION_ID } }], done),
      );

      const file = await downloadCapture(page, () =>
        sendMessage(page, "Export my collection for Postman"),
      );
      await expect(page.getByText(done)).toBeVisible();

      expect(file.filename).toBe("TOOLENT_Collection.postman_collection.json");
      const postman = file.json<{
        info: { name: string; schema: string };
        item: { name: string }[];
      }>();
      expect(postman.info.schema).toBe(POSTMAN_SCHEMA);
      expect(postman.info.name).toBe(COLLECTION_NAME);
      expect(JSON.stringify(postman.item)).toContain(SEEDED_REQUEST_NAME);
      expect(await sentToolOutput(routes.requestBodies, "export_postman")).toMatch(/"requestCount":1/);
      await snap("04-postman-exported");
    },
  );

  test("[REL-V2-TOOLENT-05] import_api_catalog asks first, then imports the provider and the Hub tab shows it as imported",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const done = "Imported the catalog.";
      const routes = await openWith(
        page,
        toolTurn([{ toolName: "import_api_catalog", input: { slug: CATALOG_SLUG } }], done),
      );
      await sendMessage(page, "Import the BigCommerce checkouts API");

      await expect(card(page)).toBeVisible();
      await expect(card(page)).toContainText(CATALOG_SLUG);
      expect(await names(page, "collections")).not.toContain(CATALOG_NAME);
      expect(routes.requestBodies).toHaveLength(1);
      await snap("05-catalog-card");

      await approve(page).click();
      await expect(page.getByText(done)).toBeVisible();

      await expect.poll(() => names(page, "collections")).toContain(CATALOG_NAME);
      expect(await names(page, "environments")).toContain(CATALOG_NAME);
      await expect(rowFor(page, CATALOG_NAME).first()).toBeVisible();
      expect(await sentToolOutput(routes.requestBodies, "import_api_catalog")).toMatch(/"requestCount":\d+/);

      await page.getByRole("tab", { name: /hub/i }).click();
      const provider = page.getByText(CATALOG_NAME, { exact: true });
      await expect(provider).toBeVisible();
      await expect(page.getByText("Imported", { exact: true }).first()).toBeVisible();
      await snap("05-hub-shows-imported");
    },
  );

  test("[REL-V2-TOOLENT-06] every step row and card shows plain-language labels and no tool name",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const done = "All entity steps finished.";
      const created = `TOOLENT Labels ${Date.now()}`;
      await openWith(page, [
        {
          kind: "clientTools",
          calls: [
            { toolName: "duplicate_collection", input: { collectionId: COLLECTION_ID } },
            { toolName: "duplicate_chain", input: { chainId: CHAIN_ID } },
            { toolName: "duplicate_environment", input: { environmentId: ENV_ID } },
            { toolName: "create_folder", input: { parentId: COLLECTION_ID, name: created } },
            { toolName: "rename_folder", input: { id: RENAME_FOLDER_ID, name: `${created} renamed` } },
            { toolName: "export_postman", input: { collectionId: COLLECTION_ID } },
          ],
        },
        { kind: "clientTools", calls: [{ toolName: "delete_folder", input: { id: DELETE_FOLDER_ID } }] },
        { kind: "clientTools", calls: [{ toolName: "import_api_catalog", input: { slug: CATALOG_SLUG } }] },
        { kind: "text", text: done },
      ]);
      await sendMessage(page, "Do all the entity things");

      await expect(card(page)).toContainText(DELETE_FOLDER_NAME);
      await expect(card(page)).not.toContainText(TOOL_NAME);
      await approve(page).click();
      await expect(card(page)).toContainText(CATALOG_SLUG);
      await expect(card(page)).not.toContainText(TOOL_NAME);
      await approve(page).click();
      await expect(page.getByText(done)).toBeVisible();

      await expandWorkedGroups(page);
      // Tools that change something read as change cards; the rest read as step rows.
      const changeLabels = [
        'Duplicated collection "TOOLENT Collection"',
        'Duplicated chain "TOOLENT Chain"',
        'Duplicated environment "TOOLENT Environment"',
        `Created folder "${created}"`,
        `Renamed "${RENAME_FOLDER_NAME}" to "${created} renamed"`,
        `Deleted folder "${DELETE_FOLDER_NAME}"`,
        'Imported "BigCommerce (Checkouts)" from the API catalog',
      ];
      const cards = page.getByTestId("relay-change-card");
      for (const label of changeLabels) {
        await expect(cards.filter({ hasText: label })).toHaveCount(1);
      }
      await expect(cards).toHaveCount(changeLabels.length);
      const stepRows = page.getByTestId("relay-tool-row");
      await expect(stepRows).toHaveCount(1);
      await expect(stepRows).toHaveText("Exported a collection for Postman");
      // No part of the thread, the cards, the rows or the summary leaks a tool name.
      await expect(page.getByRole("log", { name: "Relay conversation" })).not.toContainText(TOOL_NAME);
      await expect(summary(page)).toBeVisible();
      await snap("06-plain-language-steps");
    },
  );
});
