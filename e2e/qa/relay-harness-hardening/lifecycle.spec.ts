import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import {
  expandWorkedGroups,
  openList,
  openRelay,
  openRelayEditor,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installProxyRoutes,
  installRelayRoutes,
  startRelayGate,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const PERM_KEY = "rq_relay_permission_mode";
const THREADS_STORE = "relay_threads";
const REQUESTS_STORE = "requests";
const COLLECTIONS_STORE = "collections";
const CHAIN_ID = "qa-e2e-relay-chain";
const CHAIN_FIRST_STEP_URL = "relay-chain-a";
const CHAIN_SECOND_STEP_URL = "relay-chain-b";
const SEED_COLLECTION_ID = "qa-e2e-relayimp-col";
const SEED_REQUEST_ID = "qa-e2e-relayimp-req-a";
const PARTIAL_TEXT_ID = "qa-hh-lifecycle-text";
const PARTIAL_TEXT = "qa-hh-m21 partial reply";

type Mode = "review" | "skip";
type Call = { toolName: string; input: unknown };

const OK_REPLY = { status: 200, statusText: "OK", body: "{}" } as const;

const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");
const declinedNote = (page: Page) => page.getByTestId("relay-confirm-declined");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const toolRows = (page: Page) => page.getByTestId("relay-tool-row");
const collectionRow = (page: Page, name: string) =>
  page.getByTestId(/^collection-item-/).filter({ hasText: name });

const clientTools = (...calls: Call[]) =>
  ({ kind: "clientTools", calls }) satisfies RelayScript;
const reply = (text: string) => ({ kind: "text", text }) satisfies RelayScript;
const createCollection = (name: string): Call => ({
  toolName: "create_collection",
  input: { name, parentId: null },
});
const runChain = (): Call => ({
  toolName: "run_chain",
  input: { chainId: CHAIN_ID, fromNodeId: null },
});
const createRequest = (name: string): Call => ({
  toolName: "create_request",
  input: {
    collectionId: SEED_COLLECTION_ID,
    folderId: null,
    name,
    method: "GET",
    url: "https://api.example.com/lifecycle",
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
  return `QA HH ${label} ${Date.now()}-${nameCounter}`;
}

async function seedMode(page: Page, mode: Mode) {
  await page.addInitScript(
    ([key, value]) => {
      // Only when unset, so a reload keeps whatever the page changed it to.
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PERM_KEY, mode] as const,
  );
}

async function openWorkspace(page: Page, mode: Mode, scripts: RelayScript[]) {
  await seedMode(page, mode);
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

type IdbReadArgs = { dbName: string; store: string };
function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    ({ dbName, store: name }: IdbReadArgs) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      }),
    { dbName: IDB_DB_NAME, store },
  ) as Promise<T[]>;
}

async function requestsNamed(page: Page, prefix: string) {
  const rows = await readStore<{ name: string }>(page, REQUESTS_STORE);
  return rows
    .filter((row) => row.name.startsWith(prefix))
    .map((r) => r.name)
    .sort();
}

async function collectionsNamed(page: Page, prefix: string) {
  const rows = await readStore<{ name: string }>(page, COLLECTIONS_STORE);
  return rows
    .filter((row) => row.name.startsWith(prefix))
    .map((r) => r.name)
    .sort();
}

type StoredThread = {
  messages: { parts: { type: string; text?: string }[]; role: string }[];
  runningToolCalls?: string[];
};

test.describe("Relay turn lifecycle @qa", () => {
  test(
    "Stop mid-run_chain in Skip mode: no follow-up model request and the composer returns to idle (HH-H01, HH-M01)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWorkspace(page, "skip", [
        clientTools(runChain()),
        reply("qa-hh-h01 follow-up must never be requested"),
      ]);
      const proxy = await installProxyRoutes(page, (url) =>
        url.includes(CHAIN_FIRST_STEP_URL) ? "hang" : OK_REPLY,
      );

      await sendMessage(page, "Run the chain");

      await expect.poll(() => proxy.requestedUrls.length).toBe(1);
      await expect(confirmCard(page)).toHaveCount(0);
      await expect(page.getByTestId("relay-stop")).toBeVisible();
      await snap("01-run-chain-running");

      await page.getByTestId("relay-stop").click();

      await expect(page.getByTestId("relay-send")).toBeVisible();
      await expect(page.getByTestId("relay-stop")).toHaveCount(0);
      await expect(page.getByTestId("relay-worked-group")).toHaveAttribute(
        "data-label",
        "stopped",
      );
      await expandWorkedGroups(page);
      await expect(toolRows(page).last()).not.toHaveAttribute(
        "data-state",
        "running",
      );
      // The aborted output is recorded by now; a follow-up would already be on the wire.
      expect(routes.requestBodies).toHaveLength(1);
      await expect(
        page.getByText("qa-hh-h01 follow-up must never be requested"),
      ).toHaveCount(0);
      expect(proxy.requestedUrls.join()).not.toContain(CHAIN_SECOND_STEP_URL);
      await snap("02-stopped-idle");
    },
  );

  test(
    "Retry after step 4 error: exactly 3 new requests in the sidebar, no duplicates (HH-H05)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const prefix = uniqueName("retry");
      const names = [1, 2, 3].map((n) => `${prefix} req${n}`);
      const routes = await openWorkspace(page, "skip", [
        clientTools(createRequest(names[0])),
        clientTools(createRequest(names[1])),
        clientTools(createRequest(names[2])),
        { kind: "serverError" },
        reply("Finished after retry."),
      ]);

      await sendMessage(page, "Create three requests");

      const banner = page.getByTestId("relay-banner");
      await expect(banner).toBeVisible();
      await expect.poll(() => routes.requestBodies.length).toBe(4);
      expect(await requestsNamed(page, prefix)).toHaveLength(3);
      await snap("03-error-after-step-3");

      await page.getByTestId("relay-retry").click();

      await expect(assistantBubbles(page).last()).toContainText(
        "Finished after retry.",
      );
      // Retry is exactly one more chat request: nothing earlier was re-sent as new work.
      expect(routes.requestBodies).toHaveLength(5);
      expect(await requestsNamed(page, prefix)).toEqual([...names].sort());
      await snap("04-retried-no-duplicates");
    },
  );

  test(
    "switch threads with a queued tool: the change shows in the original thread's Changes bar and \"Undo all\" in the new thread does not revert it (HH-H06)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const stamp = uniqueName("switch");
      const [a1, a2, b1, b2] = ["a1", "a2", "b1", "b2"].map(
        (key) => `${stamp} ${key}`,
      );
      const proxy = await openWorkspaceForSwitch(page, [
        clientTools(
          { toolName: "send_request", input: { requestId: SEED_REQUEST_ID } },
          createCollection(a1),
          createCollection(a2),
        ),
        clientTools(createCollection(b1), createCollection(b2)),
        reply("Thread B done."),
      ]);
      {
        await sendMessage(page, "Thread A prompt");
        await expect.poll(() => proxy.urls.length).toBe(1);

        // Thread A's creates are queued behind the held send; leave the thread now.
        await page.getByTestId("relay-new-thread").click();
        await expect(page.getByTestId("relay-empty")).toBeVisible();
        proxy.release();
        await expect(collectionRow(page, a1)).toBeVisible();
        await expect(collectionRow(page, a2)).toBeVisible();

        await sendMessage(page, "Thread B prompt");
        const barB = page.getByTestId("relay-turn-changes");
        await expect(barB).toBeVisible();
        await expect(collectionRow(page, b1)).toBeVisible();
        await barB.getByRole("button", { name: "Undo all" }).click();
        await expect.poll(() => collectionsNamed(page, stamp)).toEqual(
          [a1, a2].sort(),
        );
        await expect(collectionRow(page, b1)).toHaveCount(0);
        await expect(collectionRow(page, a1)).toBeVisible();
        await snap("05-new-thread-undo-all");

        await openList(page);
        await page
          .getByTestId("relay-thread-item")
          .filter({ hasText: "Thread A prompt" })
          .getByTestId("relay-thread-select")
          .click();
        await expandWorkedGroups(page);
        const barA = page.getByTestId("relay-turn-changes");
        await expect(barA.getByTestId("relay-changes-row")).toHaveCount(2);
        await expect(
          barA.getByRole("button", { name: "Undo all" }),
        ).toBeVisible();
        await snap("06-original-thread-changes");
      }
    },
  );

  test(
    "Regenerate on a turn with applied changes shows Keep/Undo; Undo reverts, Keep leaves them counted under the new turn (HH-M23)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const stamp = uniqueName("regen");
      const [a1, a2, b1, b2] = ["a1", "a2", "b1", "b2"].map(
        (key) => `${stamp} ${key}`,
      );
      const routes = await openWorkspace(page, "skip", [
        clientTools(createCollection(a1), createCollection(a2)),
        reply("Reply one."),
        clientTools(createCollection(b1), createCollection(b2)),
        reply("Reply two."),
        reply("Reply three."),
      ]);
      const dialog = page.getByTestId("relay-keep-undo");

      await sendMessage(page, "Create two collections");
      await expect(assistantBubbles(page).last()).toContainText("Reply one.");
      await expect.poll(() => collectionsNamed(page, stamp)).toEqual([a1, a2].sort());

      await page.getByTestId("relay-regenerate").click();
      await expect(dialog).toBeVisible();
      await snap("07-keep-undo-dialog");
      await page.getByTestId("relay-keep-undo-undo").click();

      await expect(assistantBubbles(page).last()).toContainText("Reply two.");
      await expect(dialog).toHaveCount(0);
      expect(routes.requestBodies.length).toBeGreaterThanOrEqual(4);
      await expect
        .poll(() => collectionsNamed(page, stamp))
        .toEqual([b1, b2].sort());

      await page.getByTestId("relay-regenerate").click();
      await expect(dialog).toBeVisible();
      await page.getByTestId("relay-keep-undo-keep").click();

      await expect(assistantBubbles(page).last()).toContainText("Reply three.");
      expect(await collectionsNamed(page, stamp)).toEqual([b1, b2].sort());
      const bar = page.getByTestId("relay-turn-changes");
      await expect(bar.getByTestId("relay-changes-row")).toHaveCount(2);
      await expect(bar).toContainText(b1);
      await snap("08-kept-under-new-turn");
    },
  );

  test(
    "reload during an approved call shows \"interrupted, may have applied\", not \"Declined\" (HH-M22)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openWorkspace(page, "review", [clientTools(runChain())]);
      const proxy = await installProxyRoutes(page, () => "hang");

      await sendMessage(page, "Run the chain");
      await expect(confirmCard(page)).toBeVisible();
      await page.getByTestId("relay-confirm-approve").click();
      await expect.poll(() => proxy.requestedUrls.length).toBe(1);
      // The running mark and the message are saved asynchronously; reload only once both are stored.
      await expect
        .poll(async () => {
          const threads = await readStore<StoredThread>(page, THREADS_STORE);
          return threads.some(
            (thread) =>
              (thread.runningToolCalls?.length ?? 0) > 0 &&
              thread.messages.length >= 2,
          );
        })
        .toBe(true);

      await page.reload();

      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await expandWorkedGroups(page);
      await expect(toolRows(page).last()).toContainText(
        "Interrupted, may have applied",
      );
      await expect(declinedNote(page)).toHaveCount(0);
      await expect(page.getByText("Declined")).toHaveCount(0);
      await snap("09-maybe-applied");
    },
  );

  test(
    "Send is disabled while an auto tool runs (HH-M20)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWorkspace(page, "skip", [
        clientTools({
          toolName: "send_request",
          input: { requestId: SEED_REQUEST_ID },
        }),
        reply("Tool finished."),
      ]);
      const proxy = await installHeldProxy(page);

      await sendMessage(page, "Send request A");

      await expect.poll(() => proxy.urls.length).toBe(1);
      await expect(page.getByTestId("relay-stop")).toBeVisible();
      await expect(page.getByTestId("relay-send")).toHaveCount(0);
      // Enter in the composer must not start a second turn while the tool runs.
      await page.getByTestId("relay-composer").fill("a second message");
      await page.keyboard.press("Enter");
      expect(routes.requestBodies).toHaveLength(1);
      await snap("10-send-disabled-while-running");

      proxy.release();

      await expect(assistantBubbles(page).last()).toContainText(
        "Tool finished.",
      );
      await expect(page.getByTestId("relay-send")).toBeVisible();
      expect(routes.requestBodies).toHaveLength(2);
    },
  );

  test(
    "partial reply survives a reload marked Interrupted (HH-M21)",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      // App bug: a text-only partial reply reloads with no Interrupted marker.
      // The label only renders on a WorkedGroup (tool steps), and the stored
      // interruptedMessageId is null after a reload mid-stream. Remove this
      // marker once the marker also shows for a reply with no tool steps.
      test.fail();
      await reloadMidStream(page, { withToolStep: false });

      await expect(assistantBubbles(page).last()).toContainText(PARTIAL_TEXT);
      await expect(assistantBubbles(page).last()).toContainText(/interrupted/i);
      await snap("11-partial-interrupted-text-only");
    },
  );

  test(
    "partial reply after a finished tool step survives a reload marked Interrupted (HH-M21)",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      await reloadMidStream(page, { withToolStep: true });

      await expect(assistantBubbles(page).last()).toContainText(PARTIAL_TEXT);
      await expect(page.getByTestId("relay-worked-group")).toHaveAttribute(
        "data-label",
        "interrupted",
      );
      await snap("12-partial-interrupted-after-tool");
    },
  );

  test(
    "a mode change in one page is seen by a second page of the same context before its next tool call (HH-M24)",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, context, snap }) => {
      const routes = await openWorkspace(page, "skip", [
        clientTools({
          toolName: "set_request_scripts",
          input: { requestId: SEED_REQUEST_ID, pre: "// qa-hh-m24", post: null },
        }),
        reply("Set it."),
      ]);
      const second = await context.newPage();
      await second.goto(WORKSPACE_PATH);
      await openRelayEditor(second);

      await second.getByTestId("relay-permission-trigger").click();
      await second.getByTestId("relay-permission-option-review").click();
      await expect(second.getByTestId("relay-permission-notice")).toBeHidden();

      await sendMessage(page, "Set the scripts");

      await expect(confirmCard(page)).toBeVisible();
      expect(routes.requestBodies).toHaveLength(1);
      await snap("13-mode-seen-by-first-page");
      await page.getByTestId("relay-confirm-decline").click();
      await second.close();
    },
  );
});

/** Switch scenario: Skip mode, a held send in front of the queued creates. */
async function openWorkspaceForSwitch(page: Page, scripts: RelayScript[]) {
  await seedMode(page, "skip");
  await installRelayRoutes(page, scripts);
  const proxy = await installHeldProxy(page);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return proxy;
}

/** Streams a partial reply, waits until it is stored, then reloads the page mid-stream. */
async function reloadMidStream(page: Page, opts: { withToolStep: boolean }) {
  await seedMode(page, "review");
  const gate = await startRelayGate(page);
  await installRelayRoutes(page, [{ kind: "gated", gate }]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);

  await sendMessage(page, "Tell me more");
  if (opts.withToolStep) {
    await gate.push([
      {
        type: "tool-input-available",
        toolCallId: "qa-hh-m21-tool",
        toolName: "list_collections",
        input: {},
      },
      {
        type: "tool-output-available",
        toolCallId: "qa-hh-m21-tool",
        output: { collections: [] },
      },
      { type: "finish-step" },
      { type: "start-step" },
    ]);
  }
  await gate.push([
    { type: "text-start", id: PARTIAL_TEXT_ID },
    { type: "text-delta", id: PARTIAL_TEXT_ID, delta: PARTIAL_TEXT },
  ]);
  await expect(assistantBubbles(page).last()).toContainText(PARTIAL_TEXT);
  await expect
    .poll(async () => {
      const threads = await readStore<StoredThread>(page, THREADS_STORE);
      return JSON.stringify(threads).includes(PARTIAL_TEXT);
    })
    .toBe(true);

  await page.reload();
  await expect(page.getByTestId("relay-dock")).toBeVisible();
}
