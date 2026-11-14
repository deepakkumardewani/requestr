import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import {
  expandWorkedGroups,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const PERM_KEY = "rq_relay_permission_mode";
const COLLECTION_ID = "qa-e2e-relayimp-col";
const COLLECTION_TESTID = `collection-item-${COLLECTION_ID}`;
const REQ = { id: "qa-e2e-relayimp-req-a", name: "Request A" } as const;
const REQ_EDITED_URL = "https://example.com/api/request-a-edited";
const ENV_ID = "qa-e2e-relayimp-env";
const ENV_HOST_KEY = "relayHost";
const ENV_HOST_VALUE = "qa-relayimp-host-value";
const REQUESTS_STORE = "requests";

const PRE_SCRIPT = 'console.log("qa-hh-h03-pre-script-marker");';
const POST_SCRIPT = 'console.log("qa-hh-h03-post-script-marker");';

const IMAGE_HOST = "attacker.test";
const IMAGE_URL = `https://${IMAGE_HOST}/x?d=1`;
const NEW_BASE_URL = "https://qa-hh-m05.example.test";

type Mode = "review" | "skip";
type Call = { toolName: string; input: unknown };

const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");
const closeCard = (page: Page) => page.getByTestId("relay-close-tabs-card");
const changeCards = (page: Page) => page.getByTestId("relay-change-card");
const declinedNote = (page: Page) => page.getByTestId("relay-confirm-declined");
const approve = (page: Page) => page.getByTestId("relay-confirm-approve");
const decline = (page: Page) => page.getByTestId("relay-confirm-decline");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const requestItem = (page: Page) =>
  page
    .getByTestId(COLLECTION_TESTID)
    .getByTestId("request-item")
    .filter({ hasText: REQ.name });
const tabNamed = (page: Page) =>
  page.getByTestId("tab").filter({ hasText: REQ.name });

const clientTools = (...calls: Call[]) =>
  ({ kind: "clientTools", calls }) satisfies RelayScript;
const reply = (text: string) => ({ kind: "text", text }) satisfies RelayScript;

async function openWorkspace(page: Page, mode: Mode, scripts: RelayScript[]) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PERM_KEY, mode] as const,
  );
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

async function expandCollection(page: Page) {
  const trigger = page
    .getByTestId(COLLECTION_TESTID)
    .getByRole("button")
    .first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(requestItem(page)).toBeVisible();
}

async function openRequestTab(page: Page) {
  await expandCollection(page);
  await requestItem(page).click();
  await expect(tabNamed(page)).toBeVisible();
}

/** The saved request as the app persisted it, so "no write" is checked against storage, not the UI. */
async function storedRequest(page: Page, id: string) {
  return page.evaluate(
    ({ dbName, store, key }) =>
      new Promise<{ preScript?: string; postScript?: string } | null>(
        (resolve, reject) => {
          const open = indexedDB.open(dbName);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const request = db.transaction(store).objectStore(store).get(key);
            request.onsuccess = () => {
              db.close();
              resolve(request.result ?? null);
            };
            request.onerror = () => reject(request.error);
          };
        },
      ),
    { dbName: IDB_DB_NAME, store: REQUESTS_STORE, key: id },
  );
}

const scriptCall = () =>
  clientTools({
    toolName: "set_request_scripts",
    input: { requestId: REQ.id, pre: PRE_SCRIPT, post: POST_SCRIPT },
  });

test.describe("Relay security approvals and image rendering @qa", () => {
  test(
    "Review mode: scripted set_request_scripts shows a card with the full script, no write before Approve; Skip mode writes with no card",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openWorkspace(page, "review", [scriptCall(), reply("Done.")]);

      await sendMessage(page, "Set the scripts on Request A");

      await expect(confirmCard(page)).toBeVisible();
      await expect(confirmCard(page)).toContainText("Change request scripts?");
      await expect(confirmCard(page)).toContainText("qa-hh-h03-pre-script-marker");
      await expect(confirmCard(page)).toContainText("qa-hh-h03-post-script-marker");
      await snap("01-script-card");
    },
  );

  test(
    "Review mode: set_request_scripts holds the write until Approve (HH-H03, HH-RISK)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWorkspace(page, "review", [
        scriptCall(),
        reply("Done."),
      ]);
      expect((await storedRequest(page, REQ.id))?.preScript).toBe("");

      await sendMessage(page, "Set the scripts on Request A");

      await expect(confirmCard(page)).toBeVisible();
      await expect(confirmCard(page)).toHaveAttribute("data-action", "change");
      expect(routes.requestBodies).toHaveLength(1);
      expect((await storedRequest(page, REQ.id))?.preScript).toBe("");
      await snap("01b-script-card-pending");

      await approve(page).click();

      await expect
        .poll(async () => (await storedRequest(page, REQ.id))?.preScript)
        .toBe(PRE_SCRIPT);
      expect((await storedRequest(page, REQ.id))?.postScript).toBe(POST_SCRIPT);
      await expect(assistantBubbles(page).last()).toContainText("Done.");
    },
  );

  test(
    "Skip mode: set_request_scripts writes with no card (HH-H03, HH-RISK)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, "skip", [scriptCall(), reply("Done.")]);

      await sendMessage(page, "Set the scripts on Request A");

      await expect(assistantBubbles(page).last()).toContainText("Done.");
      await expect(confirmCard(page)).toHaveCount(0);
      await expect
        .poll(async () => (await storedRequest(page, REQ.id))?.preScript)
        .toBe(PRE_SCRIPT);
      await expandWorkedGroups(page);
      await expect(changeCards(page).first()).toBeVisible();
    },
  );

  test(
    "a reply containing an image renders a link, zero img, and no network request to the image host (HH-H02)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const imageRequests: string[] = [];
      await page.route(`**://${IMAGE_HOST}/**`, async (route) => {
        imageRequests.push(route.request().url());
        await route.abort();
      });
      page.on("request", (request) => {
        if (new URL(request.url()).hostname === IMAGE_HOST) {
          imageRequests.push(request.url());
        }
      });
      await openWorkspace(page, "review", [
        reply(`Here is the chart: ![](${IMAGE_URL}) done.`),
      ]);

      await sendMessage(page, "Show me a chart");

      const bubble = assistantBubbles(page).last();
      await expect(bubble).toContainText("Here is the chart");
      await expect(bubble.getByRole("link", { name: IMAGE_URL })).toHaveAttribute(
        "href",
        IMAGE_URL,
      );
      await expect(bubble.locator("img")).toHaveCount(0);
      await expect(page.locator(`img[src*="${IMAGE_HOST}"]`)).toHaveCount(0);
      await snap("02-image-as-link");
      expect(imageRequests).toEqual([]);
    },
  );

  test(
    "Review: shareValues true shows a card; Deny leaves values masked on the next get_environment (HH-H04)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWorkspace(page, "review", [
        clientTools({
          toolName: "set_relay_preferences",
          input: { shareValues: true, enabled: null },
        }),
        { kind: "readTool", toolName: "get_environment", input: { environmentId: ENV_ID } },
        reply("Read it."),
      ]);

      await sendMessage(page, "Share my values and read the environment");

      await expect(confirmCard(page)).toBeVisible();
      await snap("03-share-values-card");
      await decline(page).click();

      await expect(assistantBubbles(page).last()).toContainText("Read it.");
      await expandWorkedGroups(page);
      await expect(declinedNote(page)).toBeVisible();
      await expect.poll(() => routes.requestBodies.length).toBe(3);
      const envResult = JSON.stringify(routes.requestBodies[2]);
      expect(envResult).toContain(ENV_HOST_KEY);
      expect(envResult).not.toContain(ENV_HOST_VALUE);
    },
  );

  test(
    "Skip: shareValues true applies with no card and the next get_environment shows values (HH-H04)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWorkspace(page, "skip", [
        clientTools({
          toolName: "set_relay_preferences",
          input: { shareValues: true, enabled: null },
        }),
        { kind: "readTool", toolName: "get_environment", input: { environmentId: ENV_ID } },
        reply("Read it."),
      ]);

      await sendMessage(page, "Share my values and read the environment");

      await expect(assistantBubbles(page).last()).toContainText("Read it.");
      await expect(confirmCard(page)).toHaveCount(0);
      await expect.poll(() => routes.requestBodies.length).toBe(3);
      expect(JSON.stringify(routes.requestBodies[2])).toContain(ENV_HOST_VALUE);
    },
  );

  const escalations = [
    {
      title: "base URL change (HH-M05)",
      tag: "04-base-url",
      riskTitle: "Change the global base URL?",
      call: {
        toolName: "set_global_variables",
        input: { baseUrl: NEW_BASE_URL, headers: null },
      },
    },
    {
      title: "sslVerify false (HH-M06)",
      tag: "05-ssl-off",
      riskTitle: "Turn off TLS verification?",
      call: {
        toolName: "update_proxy_settings",
        input: { sslVerify: false, followRedirects: null },
      },
    },
  ] as const;

  for (const { title, tag, riskTitle, call } of escalations) {
    test(
      `Review shows a card for ${title}`,
      { tag: ["@qa", "@high"] },
      async ({ seededPage: page, snap }) => {
        const routes = await openWorkspace(page, "review", [
          clientTools(call),
          reply("Applied."),
        ]);

        await sendMessage(page, "Change the setting");

        await expect(confirmCard(page)).toBeVisible();
        await expect(confirmCard(page)).toContainText(riskTitle);
        expect(routes.requestBodies).toHaveLength(1);
        await snap(`${tag}-review-card`);
        await decline(page).click();
        await expandWorkedGroups(page);
        await expect(declinedNote(page)).toBeVisible();
        await expect(changeCards(page)).toHaveCount(0);
      },
    );

    test(
      `Skip shows no card for ${title}`,
      { tag: ["@qa", "@high"] },
      async ({ seededPage: page }) => {
        await openWorkspace(page, "skip", [
          clientTools(call),
          reply("Applied."),
        ]);

        await sendMessage(page, "Change the setting");

        await expect(assistantBubbles(page).last()).toContainText("Applied.");
        await expect(confirmCard(page)).toHaveCount(0);
        await expandWorkedGroups(page);
        await expect(changeCards(page).first()).toBeVisible();
      },
    );
  }

  test(
    "Skip mode: deleting a request with a dirty tab shows the gate; confirm deletes (HH-M07)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openWorkspace(page, "skip", [
        clientTools({ toolName: "delete_request", input: { ids: [REQ.id] } }),
        reply("Deleted."),
      ]);
      await openRequestTab(page);
      await tabNamed(page).click();
      await page.getByTestId("url-input").fill(REQ_EDITED_URL);

      await sendMessage(page, "Delete Request A");

      await expect(closeCard(page)).toBeVisible();
      await expect(requestItem(page)).toBeVisible();
      await snap("06-dirty-delete-gate");
      await page.getByTestId("relay-close-tabs-discard").click();

      await expect(requestItem(page)).toHaveCount(0);
      await expect(tabNamed(page)).toHaveCount(0);
    },
  );

  test(
    "Skip mode: declining the dirty-tab delete gate leaves the request and tab intact (HH-M07)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, "skip", [
        clientTools({ toolName: "delete_request", input: { ids: [REQ.id] } }),
        reply("Left it."),
      ]);
      await openRequestTab(page);
      await tabNamed(page).click();
      await page.getByTestId("url-input").fill(REQ_EDITED_URL);

      await sendMessage(page, "Delete Request A");

      await expect(closeCard(page)).toBeVisible();
      await page.getByTestId("relay-close-tabs-cancel").click();

      await expect(assistantBubbles(page).last()).toContainText("Left it.");
      await expect(requestItem(page)).toBeVisible();
      await expect(tabNamed(page)).toHaveCount(1);
      await expect(page.getByTestId("url-input")).toHaveValue(REQ_EDITED_URL);
    },
  );

  test(
    "Review: export_history shows a card and Decline downloads nothing (L-05)",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const downloads: string[] = [];
      page.on("download", (download) => downloads.push(download.suggestedFilename()));
      const routes = await openWorkspace(page, "review", [
        clientTools({ toolName: "export_history", input: { format: "json" } }),
        reply("Exported."),
      ]);

      await sendMessage(page, "Export my history");

      await expect(confirmCard(page)).toBeVisible();
      expect(routes.requestBodies).toHaveLength(1);
      await snap("07-export-history-card");
      await decline(page).click();
      await expect(assistantBubbles(page).last()).toContainText("Exported.");
      expect(downloads).toEqual([]);
    },
  );

  test(
    "Skip: export_history downloads with no card (L-05)",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, "skip", [
        clientTools({ toolName: "export_history", input: { format: "json" } }),
        reply("Exported."),
      ]);
      const download = page.waitForEvent("download");

      await sendMessage(page, "Export my history");

      expect((await download).suggestedFilename()).toBeTruthy();
      await expect(assistantBubbles(page).last()).toContainText("Exported.");
      await expect(confirmCard(page)).toHaveCount(0);
    },
  );
});
