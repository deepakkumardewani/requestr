import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayRoutesHandle,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const COLLECTION_ID = "qa-e2e-relayimp-col";
const COLLECTION_TESTID = `collection-item-${COLLECTION_ID}`;
const TABS_STORE = "tabs";
const REQ_A = { id: "qa-e2e-relayimp-req-a", name: "Request A" } as const;
const REQ_B = { id: "qa-e2e-relayimp-req-b", name: "Request B" } as const;
const SEEDED_NAMES = [
  "Request A",
  "Request B",
  "500 Error Request",
  "GraphQL Query",
];
const SEEDED_COUNT = String(SEEDED_NAMES.length);
const REQ_A_ORIGINAL_URL = "https://example.com/api/request-a";
const REQ_A_EDITED_URL = "https://example.com/api/request-a-edited";
const USER_DECLINED = "user declined";
const REPLY_TEXT = "Done.";

type Call = { toolName: string; input: unknown };

const tabs = (page: Page) => page.getByTestId("tab");
const tabNamed = (page: Page, name: string) =>
  tabs(page).filter({ hasText: name });
const requestItem = (page: Page, name: string) =>
  page
    .getByTestId(COLLECTION_TESTID)
    .getByTestId("request-item")
    .filter({ hasText: name });
const closeCard = (page: Page) => page.getByTestId("relay-close-tabs-card");
const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");
const urlInput = (page: Page) => page.getByTestId("url-input");

const clientTools = (...calls: Call[]) =>
  ({ kind: "clientTools", calls }) satisfies RelayScript;
const reply = () => ({ kind: "text", text: REPLY_TEXT }) satisfies RelayScript;
const closeAllTabs = (includePinned: boolean | null = null): Call => ({
  toolName: "close_all_tabs",
  input: { includePinned },
});

/** Text of the body the client sent after running a tool: it carries the tool result. */
function followUpBody(routes: RelayRoutesHandle, index: number): string {
  return JSON.stringify(routes.requestBodies[index] ?? null);
}

async function openWorkspace(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

async function expandCollection(page: Page) {
  const collection = page.getByTestId(COLLECTION_TESTID);
  await expect(collection).toBeVisible();
  const trigger = collection.getByRole("button").first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(requestItem(page, REQ_A.name)).toBeVisible();
}

async function openRequest(page: Page, name: string) {
  await expandCollection(page);
  await requestItem(page, name).click();
  await expect(tabNamed(page, name)).toBeVisible();
}

async function pinRequest(page: Page, name: string) {
  await expandCollection(page);
  await requestItem(page, name).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Pin to top", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Pin to top", exact: true }),
  ).toBeHidden();
}

async function makeDirty(page: Page, name: string) {
  await tabNamed(page, name).click();
  await urlInput(page).fill(REQ_A_EDITED_URL);
  await expect(
    tabNamed(page, name).getByTestId("tab-dirty-indicator"),
  ).toBeVisible();
}

/** The persisted tab id of a request's tab; the DOM does not expose it. */
async function persistedTabId(page: Page, requestId: string): Promise<string> {
  let found = "";
  await expect
    .poll(async () => {
      found = await page.evaluate(
        ({ dbName, store, id }) =>
          new Promise<string>((resolve, reject) => {
            const open = indexedDB.open(dbName);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const all = db.transaction(store).objectStore(store).getAll();
              all.onsuccess = () => {
                db.close();
                const rows = all.result as {
                  tabId: string;
                  requestId: string | null;
                }[];
                resolve(rows.find((row) => row.requestId === id)?.tabId ?? "");
              };
              all.onerror = () => reject(all.error);
            };
          }),
        { dbName: IDB_DB_NAME, store: TABS_STORE, id: requestId },
      );
      return found;
    })
    .not.toBe("");
  return found;
}

test.describe("Relay close tabs and bulk delete", () => {
  test("[REL-TAB-01] close_tab on a clean tab closes it silently",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      let tabId = "";
      const routes = await openWorkspace(page, [
        {
          kind: "clientTools",
          calls: () => [{ toolName: "close_tab", input: { tabId } }],
        },
        reply(),
      ]);
      await openRequest(page, REQ_A.name);
      await openRequest(page, REQ_B.name);
      tabId = await persistedTabId(page, REQ_A.id);

      await sendMessage(page, "Close the Request A tab");

      await expect(tabNamed(page, REQ_A.name)).toHaveCount(0);
      await expect(tabNamed(page, REQ_B.name)).toHaveCount(1);
      await expect(closeCard(page)).toHaveCount(0);
      await expect(confirmCard(page)).toHaveCount(0);
      await expect
        .poll(() => routes.requestBodies.length)
        .toBeGreaterThanOrEqual(2);
      expect(followUpBody(routes, 1)).toContain('"closed":1');
    },
  );

  test("[REL-TAB-02] close_all_tabs keeps the pinned tab and reports the kept count; naming pinned tabs closes them",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWorkspace(page, [
        clientTools(closeAllTabs()),
        reply(),
        clientTools(closeAllTabs(true)),
        reply(),
      ]);
      await pinRequest(page, REQ_A.name);
      await openRequest(page, REQ_A.name);
      await openRequest(page, REQ_B.name);

      await sendMessage(page, "Close all my tabs");

      await expect(tabNamed(page, REQ_B.name)).toHaveCount(0);
      await expect(tabs(page)).toHaveCount(1);
      await expect(tabNamed(page, REQ_A.name)).toHaveCount(1);
      await expect.poll(() => routes.requestBodies.length).toBeGreaterThanOrEqual(2);
      const report = followUpBody(routes, 1);
      expect(report).toContain('"closed":1');
      expect(report).toContain('"pinnedKept":1');

      await sendMessage(page, "Close all tabs, including the pinned ones");

      await expect(tabs(page)).toHaveCount(0);
    },
  );

  test("[REL-TAB-03] with a dirty tab the card lists it and Save all & close saves then closes",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, [clientTools(closeAllTabs()), reply()]);
      await openRequest(page, REQ_A.name);
      await openRequest(page, REQ_B.name);
      await makeDirty(page, REQ_A.name);

      await sendMessage(page, "Close all my tabs");

      await expect(closeCard(page)).toBeVisible();
      await expect(page.getByTestId("relay-close-tabs-list")).toContainText(
        REQ_A.name,
      );
      await expect(page.getByTestId("relay-close-tabs-list")).not.toContainText(
        REQ_B.name,
      );
      await expect(tabs(page)).toHaveCount(2);

      await page.getByTestId("relay-close-tabs-save-all").click();

      await expect(tabs(page)).toHaveCount(0);
      await requestItem(page, REQ_A.name).click();
      await expect(urlInput(page)).toHaveValue(REQ_A_EDITED_URL);
    },
  );

  test("[REL-TAB-04] Discard & close closes without saving and Cancel leaves every tab open",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWorkspace(page, [
        clientTools(closeAllTabs()),
        reply(),
        clientTools(closeAllTabs()),
        reply(),
      ]);
      await openRequest(page, REQ_A.name);
      await openRequest(page, REQ_B.name);
      await makeDirty(page, REQ_A.name);

      await sendMessage(page, "Close all my tabs");
      await expect(closeCard(page)).toBeVisible();
      await page.getByTestId("relay-close-tabs-cancel").click();

      await expect(tabs(page)).toHaveCount(2);
      await expect(
        tabNamed(page, REQ_A.name).getByTestId("tab-dirty-indicator"),
      ).toBeVisible();

      // The cancelled turn must finish before the next message is sent.
      await expect
        .poll(() => routes.requestBodies.length)
        .toBeGreaterThanOrEqual(2);
      expect(followUpBody(routes, 1)).toContain(USER_DECLINED);

      await sendMessage(page, "Try closing them again");
      await expect(closeCard(page).last()).toBeVisible();
      await page.getByTestId("relay-close-tabs-discard").last().click();

      await expect(tabs(page)).toHaveCount(0);
      await requestItem(page, REQ_A.name).click();
      await expect(urlInput(page)).toHaveValue(REQ_A_ORIGINAL_URL);
    },
  );

  test("[REL-TAB-05] delete_requests_in_collection shows the destructive card with the count; declining changes nothing",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWorkspace(page, [
        clientTools({
          toolName: "delete_requests_in_collection",
          input: { collectionId: COLLECTION_ID },
        }),
        reply(),
      ]);
      await expandCollection(page);

      await sendMessage(page, "Delete every request in the collection");

      await expect(confirmCard(page)).toBeVisible();
      await expect(confirmCard(page)).toContainText(SEEDED_COUNT);
      await expect(confirmCard(page)).toHaveAttribute("data-severity", "danger");
      for (const name of SEEDED_NAMES) {
        await expect(requestItem(page, name)).toBeVisible();
      }

      await page.getByTestId("relay-confirm-decline").click();

      for (const name of SEEDED_NAMES) {
        await expect(requestItem(page, name)).toBeVisible();
      }
      await expect
        .poll(() => routes.requestBodies.length)
        .toBeGreaterThanOrEqual(2);
      expect(followUpBody(routes, 1)).toContain(USER_DECLINED);
    },
  );

  test("[REL-TAB-06] after declining the bulk delete and reloading, every request is still there",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      const routes = await openWorkspace(page, [
        clientTools({
          toolName: "delete_requests_in_collection",
          input: { collectionId: COLLECTION_ID },
        }),
        reply(),
      ]);
      await expandCollection(page);
      await sendMessage(page, "Delete every request in the collection");
      await page.getByTestId("relay-confirm-decline").click();
      await expect
        .poll(() => routes.requestBodies.length)
        .toBeGreaterThanOrEqual(2);

      await page.reload();

      await expandCollection(page);
      for (const name of SEEDED_NAMES) {
        await expect(requestItem(page, name)).toBeVisible();
      }
    },
  );

  test("[REL-TAB-07] close_all_tabs with no open tabs reports that nothing was closed",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      const routes = await openWorkspace(page, [
        clientTools(closeAllTabs()),
        reply(),
      ]);
      await expect(tabs(page)).toHaveCount(0);

      await sendMessage(page, "Close all my tabs");

      await expect
        .poll(() => routes.requestBodies.length)
        .toBeGreaterThanOrEqual(2);
      expect(followUpBody(routes, 1)).toContain('"closed":0');
      await expect(closeCard(page)).toHaveCount(0);
      await expect(confirmCard(page)).toHaveCount(0);
    },
  );
});
