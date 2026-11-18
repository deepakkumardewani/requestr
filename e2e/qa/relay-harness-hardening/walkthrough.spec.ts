import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  expandWorkedGroups,
  openList,
  openRelay,
  putThreads,
  runtimeThread,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installProxyReply,
  installProxyRoutes,
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";

/** Final walkthrough of the relay-harness-hardening SPEC section 8 flows, one test per flow. */
const WORKSPACE_PATH = "/app";
const PERM_KEY = "rq_relay_permission_mode";
const PROOF_DIR = "agent_docs/qa/relay-harness-hardening";

const SEED_COLLECTION_ID = "qa-e2e-relayimp-col";
const SEED_REQUEST_ID = "qa-e2e-relayimp-req-a";
const CHAIN_RUN_ID = "qa-e2e-relay-chain";
const CHAIN_FIRST_STEP_URL = "relay-chain-a";
const CHAIN_SECOND_STEP_URL = "relay-chain-b";
const CHAIN_COLLECTION = {
  id: "qa-hh-undo-col-chain",
  name: "HH Undo Collection With Chain",
};
const CHAIN_REQUEST_IDS = ["qa-hh-undo-chain-a", "qa-hh-undo-chain-b"];
const FAILING_STATUS_TEXT = "Client Closed Request";
const SAMPLE_COLLECTION_TESTID = "collection-item-qa-collection-1";
const SAMPLE_REQUEST = "QA E2E Relay - Large response request";
const IMAGE_HOST = "attacker.test";
const IMAGE_URL = `https://${IMAGE_HOST}/x?d=1`;
const PRE_SCRIPT = 'console.log("qa-hh-walkthrough-pre-script");';
const LEGACY_THREAD_TITLE = "Legacy delete thread";
const LEGACY_REPLY = "The old request was deleted.";
const OK_REPLY = { status: 200, statusText: "OK", body: "{}" } as const;
const SCHEMA_VERSION_WITH_RUNTIME_THREADS = 18;

type Mode = "review" | "skip";
type Call = { toolName: string; input: unknown };

const tools = (...calls: Call[]) =>
  ({ kind: "clientTools", calls }) satisfies RelayScript;
const reply = (text: string) => ({ kind: "text", text }) satisfies RelayScript;

const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");
const closeCard = (page: Page) => page.getByTestId("relay-close-tabs-card");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const collectionRow = (page: Page, name: string) =>
  page.getByTestId(/^collection-item-/).filter({ hasText: name });

const setScripts = (): Call => ({
  toolName: "set_request_scripts",
  input: { requestId: SEED_REQUEST_ID, pre: PRE_SCRIPT, post: null },
});
const createCollection = (name: string): Call => ({
  toolName: "create_collection",
  input: { name },
});
const createRequest = (name: string): Call => ({
  toolName: "create_request",
  input: {
    collectionId: SEED_COLLECTION_ID,
    folderId: null,
    name,
    method: "GET",
    url: "https://api.example.com/walkthrough",
    headers: null,
    params: null,
    body: null,
    auth: null,
  },
});

let nameCounter = 0;
/** Unique per test and repeat so parallel workers and --repeat-each never share data. */
function uniqueName(label: string) {
  nameCounter += 1;
  return `QA HH walkthrough ${label} ${Date.now()}-${nameCounter}`;
}

/** Saves a reviewed proof shot where the task's Files list expects it. */
async function proofShot(page: Page, file: string) {
  await page.screenshot({ path: `${PROOF_DIR}/${file}.png` });
}

async function openWorkspace(page: Page, mode: Mode, scripts: RelayScript[]) {
  await page.addInitScript(
    ([key, value]) => {
      // Only when unset, so a reload keeps whatever the page changed it to.
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PERM_KEY, mode] as const,
  );
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

/** Proxy that holds every request open until the test releases it. */
async function installHeldProxy(page: Page) {
  const urls: string[] = [];
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/proxy", async (route) => {
    const payload = JSON.parse(route.request().postData() ?? "{}") as {
      url?: string;
    };
    urls.push(payload.url ?? "");
    await released;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      })
      .catch(() => undefined);
  });
  return { urls, release };
}

async function namesIn(page: Page, store: string, prefix: string) {
  const rows = (await dumpIdbStore(page, store)) as { name: string }[];
  return rows
    .filter((row) => row.name.startsWith(prefix))
    .map((row) => row.name)
    .sort();
}

async function storedPreScript(page: Page) {
  const rows = (await dumpIdbStore(page, "requests")) as {
    id: string;
    preScript?: string;
  }[];
  return rows.find((row) => row.id === SEED_REQUEST_ID)?.preScript;
}

/** Gives the sample request a stored failing response so the inline AI button appears. */
async function openFailingResponse(page: Page) {
  await installProxyReply(page, {
    status: 499,
    statusText: FAILING_STATUS_TEXT,
    body: '{"error":"client_closed"}',
  });
  await page.goto(WORKSPACE_PATH);
  const collection = page.getByTestId(SAMPLE_COLLECTION_TESTID);
  const trigger = collection.getByRole("button").first();
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await collection
    .getByTestId("request-item")
    .filter({ hasText: SAMPLE_REQUEST })
    .click();
  await page.getByTestId("send-request-btn").click();
  await expect(page.getByTestId("response-status-text")).toHaveText(
    FAILING_STATUS_TEXT,
  );
}

test.describe("Relay harness hardening walkthrough @qa", () => {
  test(
    "Review mode: a script change shows an approval card and writes nothing until Approve",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, "review", [tools(setScripts()), reply("Done.")]);

      await sendMessage(page, "Set the pre-request script on Request A");

      await expect(confirmCard(page)).toBeVisible();
      await expect(confirmCard(page)).toContainText("Change request scripts?");
      await expect(confirmCard(page)).toContainText("qa-hh-walkthrough-pre-script");
      expect(await storedPreScript(page)).toBeFalsy();
      await proofShot(page, "01-review-script-card");
    },
  );

  test(
    "Skip mode: the same escalating call writes with no new prompt",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, "skip", [tools(setScripts()), reply("Done.")]);

      await sendMessage(page, "Set the pre-request script on Request A");

      await expect(assistantBubbles(page).last()).toContainText("Done.");
      await expect(confirmCard(page)).toHaveCount(0);
      await expect(closeCard(page)).toHaveCount(0);
      await expect.poll(() => storedPreScript(page)).toBe(PRE_SCRIPT);
    },
  );

  test(
    "an image in a reply is shown as a link and the image host is never requested",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const imageRequests: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).hostname === IMAGE_HOST) {
          imageRequests.push(request.url());
        }
      });
      await page.route(`**://${IMAGE_HOST}/**`, (route) => route.abort());
      await openWorkspace(page, "review", [
        reply(`Here is the chart: ![](${IMAGE_URL}) done.`),
      ]);

      await sendMessage(page, "Show me a chart");

      const bubble = assistantBubbles(page).last();
      await expect(bubble).toContainText("Here is the chart");
      await expect(bubble.getByRole("link", { name: IMAGE_URL })).toBeVisible();
      await expect(bubble.locator("img")).toHaveCount(0);
      await proofShot(page, "02-image-as-link");
      expect(imageRequests).toEqual([]);
    },
  );

  test(
    "Stop mid-run issues no further requests and the composer returns to idle",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWorkspace(page, "skip", [
        tools({
          toolName: "run_chain",
          input: { chainId: CHAIN_RUN_ID, fromNodeId: null },
        }),
        reply("a follow-up must never be requested"),
      ]);
      const proxy = await installProxyRoutes(page, (url) =>
        url.includes(CHAIN_FIRST_STEP_URL) ? "hang" : OK_REPLY,
      );

      await sendMessage(page, "Run the chain");
      await expect.poll(() => proxy.requestedUrls.length).toBe(1);
      await page.getByTestId("relay-stop").click();

      await expect(page.getByTestId("relay-send")).toBeVisible();
      expect(routes.requestBodies).toHaveLength(1);
      expect(proxy.requestedUrls.join()).not.toContain(CHAIN_SECOND_STEP_URL);
    },
  );

  test(
    "Retry after a server error creates no duplicates",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const prefix = uniqueName("retry");
      const names = [1, 2, 3].map((n) => `${prefix} req${n}`);
      const routes = await openWorkspace(page, "skip", [
        tools(createRequest(names[0])),
        tools(createRequest(names[1])),
        tools(createRequest(names[2])),
        { kind: "serverError" },
        reply("Finished after retry."),
      ]);

      await sendMessage(page, "Create three requests");
      await expect(page.getByTestId("relay-banner")).toBeVisible();
      await expect.poll(() => routes.requestBodies.length).toBe(4);
      expect(await namesIn(page, "requests", prefix)).toHaveLength(3);

      await page.getByTestId("relay-retry").click();

      await expect(assistantBubbles(page).last()).toContainText(
        "Finished after retry.",
      );
      expect(await namesIn(page, "requests", prefix)).toEqual([...names].sort());
    },
  );

  test(
    "switching threads keeps queued changes in the original thread",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const stamp = uniqueName("switch");
      const [a1, a2, b1, b2] = ["a1", "a2", "b1", "b2"].map(
        (key) => `${stamp} ${key}`,
      );
      await page.addInitScript(
        ([key, value]) => localStorage.setItem(key, value),
        [PERM_KEY, "skip"] as const,
      );
      await installRelayRoutes(page, [
        tools(
          { toolName: "send_request", input: { requestId: SEED_REQUEST_ID } },
          createCollection(a1),
          createCollection(a2),
        ),
        tools(createCollection(b1), createCollection(b2)),
        reply("Thread B done."),
      ]);
      const proxy = await installHeldProxy(page);
      await page.goto(WORKSPACE_PATH);
      await openRelay(page);

      await sendMessage(page, "Thread A prompt");
      await expect.poll(() => proxy.urls.length).toBe(1);
      await page.getByTestId("relay-new-thread").click();
      await expect(page.getByTestId("relay-empty")).toBeVisible();
      proxy.release();
      await expect(collectionRow(page, a1)).toBeVisible();

      await sendMessage(page, "Thread B prompt");
      const barB = page.getByTestId("relay-turn-changes");
      await expect(barB).toBeVisible();
      await barB.getByRole("button", { name: "Undo all" }).click();
      await expect
        .poll(() => namesIn(page, "collections", stamp))
        .toEqual([a1, a2].sort());

      await openList(page);
      await page
        .getByTestId("relay-thread-item")
        .filter({ hasText: "Thread A prompt" })
        .getByTestId("relay-thread-select")
        .click();
      await expandWorkedGroups(page);
      await expect(
        page
          .getByTestId("relay-turn-changes")
          .getByTestId("relay-changes-row"),
      ).toHaveCount(2);
    },
  );

  test(
    "Regenerate on a turn with applied changes asks Keep or Undo",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const stamp = uniqueName("regen");
      const [a1, a2, b1, b2] = ["a1", "a2", "b1", "b2"].map(
        (key) => `${stamp} ${key}`,
      );
      await openWorkspace(page, "skip", [
        tools(createCollection(a1), createCollection(a2)),
        reply("Reply one."),
        tools(createCollection(b1), createCollection(b2)),
        reply("Reply two."),
      ]);
      const dialog = page.getByTestId("relay-keep-undo");

      await sendMessage(page, "Create two collections");
      await expect(assistantBubbles(page).last()).toContainText("Reply one.");
      await expect
        .poll(() => namesIn(page, "collections", stamp))
        .toEqual([a1, a2].sort());

      await page.getByTestId("relay-regenerate").click();
      await expect(dialog).toBeVisible();
      // The dialog fades in; shoot it fully opaque.
      await expect(dialog).toHaveCSS("opacity", "1");
      await proofShot(page, "03-keep-undo-dialog");
      await page.getByTestId("relay-keep-undo-undo").click();

      await expect(assistantBubbles(page).last()).toContainText("Reply two.");
      await expect
        .poll(() => namesIn(page, "collections", stamp))
        .toEqual([b1, b2].sort());
    },
  );

  test(
    "Undo of a deleted collection restores it together with its chain",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, "skip", [
        tools({
          toolName: "delete_collection",
          input: { ids: [CHAIN_COLLECTION.id] },
        }),
        reply("Deleted the collection."),
      ]);
      await expect(collectionRow(page, CHAIN_COLLECTION.name)).toBeVisible();

      await sendMessage(page, "Delete the chain collection");
      await expect(collectionRow(page, CHAIN_COLLECTION.name)).toHaveCount(0);

      await expandWorkedGroups(page);
      const card = page.getByTestId("relay-change-card");
      await card.getByRole("button", { name: "Undo" }).click();
      await expect(card.getByTestId("relay-change-undone")).toBeVisible();

      await expect(collectionRow(page, CHAIN_COLLECTION.name)).toBeVisible();
      await expect
        .poll(async () =>
          ((await dumpIdbStore(page, "chains")) as { id: string }[]).map(
            (chain) => chain.id,
          ),
        )
        .toContain(CHAIN_COLLECTION.id);
      await proofShot(page, "04-undo-collection-chain");

      await page.goto(`/chain/${CHAIN_COLLECTION.id}`);
      for (const requestId of CHAIN_REQUEST_IDS) {
        await expect(page.getByTestId(`chain-node-${requestId}`)).toBeVisible();
      }
    },
  );

  test(
    "an old thread that used a removed tool name still renders",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, "review", [reply("unused")]);
      await putThreads(page, [
        runtimeThread(SCHEMA_VERSION_WITH_RUNTIME_THREADS, 0, {
          title: LEGACY_THREAD_TITLE,
          messages: [
            {
              id: "qa-hh-walkthrough-user",
              role: "user",
              parts: [{ type: "text", text: "Delete the old request" }],
            },
            {
              id: "qa-hh-walkthrough-assistant",
              role: "assistant",
              parts: [
                { type: "step-start" },
                {
                  type: "tool-delete_request",
                  toolCallId: "qa-hh-walkthrough-call",
                  state: "output-available",
                  input: { ids: ["qa-hh-walkthrough-gone"] },
                  output: { ok: true, data: { deleted: 1 } },
                },
                { type: "step-start" },
                { type: "text", text: LEGACY_REPLY },
              ],
            },
          ],
        }),
      ]);

      await openList(page);
      await page
        .getByTestId("relay-thread-item")
        .filter({ hasText: LEGACY_THREAD_TITLE })
        .getByTestId("relay-thread-select")
        .click();

      await expect(assistantBubbles(page).last()).toContainText(LEGACY_REPLY);
      await expandWorkedGroups(page);
    },
  );

  test(
    "Relay chat and inline AI both still work",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const explanation = "qa-hh-walkthrough inline explanation";
      await page.route("**/api/ai", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ explanation }),
        }),
      );
      await installRelayRoutes(page, [reply("Relay reply through the guard.")]);
      await openFailingResponse(page);

      await page.getByTestId("ai-explain-btn").click();
      await expect(page.getByTestId("ai-explanation")).toHaveText(explanation);

      await openRelay(page);
      await sendMessage(page, "hello");
      await expect(assistantBubbles(page).last()).toContainText(
        "Relay reply through the guard.",
      );
      await expect(page.getByTestId("relay-banner")).toHaveCount(0);
    },
  );
});
