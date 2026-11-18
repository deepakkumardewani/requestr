import type { Page } from "@playwright/test";
import {
  expandWorkedGroups,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installProxyReply,
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { dumpIdb, dumpIdbStore } from "../../fixtures/relayV2Helpers";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const PERM_KEY = "rq_relay_permission_mode";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const BACKUP_APP_ID = "requestr-backup";
const BACKUP_SCHEMA_VERSION = 1;
const IMPORTED_SUFFIX = " (imported)";
/** The entity stores Undo must put back exactly as they were. */
const ENTITY_STORES = [
  "collections",
  "folders",
  "requests",
  "chains",
  "environments",
] as const;

const CHAIN_COLLECTION = {
  id: "qa-hh-undo-col-chain",
  name: "HH Undo Collection With Chain",
};
const EDIT_COLLECTION = {
  id: "qa-hh-undo-col-edit",
  name: "HH Undo Edit Collection",
};
// A collection's chain is stored under the collection's own id.
const CHAIN_ID = CHAIN_COLLECTION.id;
const CHAIN_REQUEST_IDS = ["qa-hh-undo-chain-a", "qa-hh-undo-chain-b"];
const ACTIVE_ENV = { id: "qa-hh-undo-env", name: "HH Undo Env" };

type Mode = "review" | "skip";
type StoredRequest = {
  id: string;
  name: string;
  method: string;
  url: string;
  updatedAt?: number;
  assertions?: { id: string }[];
};
type Named = { id: string; name: string };

const reply = (text: string) => ({ kind: "text", text }) satisfies RelayScript;
const tools = (...calls: { toolName: string; input: unknown }[]) =>
  ({ kind: "clientTools", calls }) satisfies RelayScript;

const updateRequest = (requestId: string, patch: { url?: string; method?: string }) =>
  tools({
    toolName: "update_request",
    input: {
      requestId,
      name: null,
      method: patch.method ?? null,
      url: patch.url ?? null,
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

async function seedActiveEnv(page: Page) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [ACTIVE_ENV_KEY, ACTIVE_ENV.id] as const,
  );
}

const collectionRow = (page: Page, name: string) =>
  page.getByTestId(/^collection-item-/).filter({ hasText: name });
const requestItem = (page: Page, name: string) =>
  page.getByTestId("request-item").filter({ hasText: name });
const tabFor = (page: Page, name: string) =>
  page.getByTestId("tab").filter({ hasText: name });
const urlInput = (page: Page) => page.getByTestId("url-input");
const changeBar = (page: Page) => page.getByTestId("relay-turn-changes");
const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");
const dirtyCard = (page: Page) => page.getByTestId("relay-close-tabs-card");

/** Drops `updatedAt`, which a restore re-stamps; every other field must match. */
const stripUpdatedAt = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUpdatedAt);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "updatedAt")
      .map(([key, inner]) => [key, stripUpdatedAt(inner)]),
  );
};

/** Every store a backup merge writes; Undo must leave none of the merged rows behind. */
const IMPORT_STORES = [...ENTITY_STORES, "chainConfigs", "history", "chainRuns"] as const;

/** Collection ids in the order the sidebar lists them (the store's in-memory order). */
const sidebarOrder = (page: Page) =>
  page
    .getByTestId(/^collection-item-/)
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-testid")?.replace("collection-item-", "")),
    );

/** Reads the whole entity state, the "before" and "after" of every Undo comparison. */
const entitySnapshot = async (page: Page) =>
  stripUpdatedAt(await dumpIdb(page, ENTITY_STORES)) as Record<
    string,
    Record<string, unknown>[]
  >;

const requestRecord = async (page: Page, id: string) =>
  ((await dumpIdbStore(page, "requests")) as StoredRequest[]).find(
    (row) => row.id === id,
  );

/** Same record with the timestamp the save bumped, which Undo is not meant to rewind. */
const withoutTimestamp = (record: StoredRequest | undefined) => {
  const { updatedAt: _ignored, ...rest } = record ?? ({} as StoredRequest);
  return rest;
};

/** Expands the request's collection if needed, then opens it in a tab. */
async function openRequest(page: Page, collectionId: string, name: string) {
  const row = page.getByTestId(`collection-item-${collectionId}`);
  await expect(row).toBeVisible();
  const trigger = row.getByRole("button").first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  }
  await requestItem(page, name).click();
  await expect(tabFor(page, name)).toBeVisible();
}

/** Types into the active tab's URL bar, which makes the tab dirty. */
async function editTabUrl(page: Page, name: string, url: string) {
  await tabFor(page, name).click();
  await urlInput(page).fill(url);
  await expect(tabFor(page, name).getByTestId("tab-dirty-indicator")).toBeVisible();
}

/** Opens the workspace with scripted replies, Relay closed. */
async function openWorkspace(page: Page, mode: Mode, scripts: RelayScript[]) {
  await seedMode(page, mode);
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await expect(collectionRow(page, EDIT_COLLECTION.name)).toBeVisible();
  return routes;
}

/** The `tool-<name>` result the client sent back to the model in its latest request. */
async function sentToolOutput(bodies: unknown[], toolName: string) {
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(2);
  const body = bodies.at(-1) as { messages?: { parts?: unknown[] }[] };
  const parts = (body.messages ?? []).flatMap(
    (message) => message.parts ?? [],
  ) as { type?: string; output?: unknown; errorText?: string }[];
  const part = parts.findLast((p) => p.type === `tool-${toolName}`);
  return JSON.stringify(part?.output ?? part?.errorText ?? null);
}

/** One change has no summary bar, so Undo is on its card inside the Worked group. */
async function undoChange(page: Page) {
  await expandWorkedGroups(page);
  const card = page.getByTestId("relay-change-card");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Undo" }).click();
  await expect(card.getByTestId("relay-change-undone")).toBeVisible();
}

function backupFile(data: {
  collections: Record<string, unknown>[];
  chainConfigs: Record<string, unknown>[];
  history: Record<string, unknown>[];
}) {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    idbVersion: 6,
    exportedAt: "2026-03-04T10:30:00.000Z",
    appVersion: "0.0.0-e2e",
    includesSecrets: false,
    sections: ["collections", "history"],
    data: { ...data, folders: [], requests: [], chainRuns: [] },
  };
}

test.describe("Relay undo fidelity and open-request edits @qa", () => {
  test(
    "Relay edits the URL of a clean open request: tab shows it, stays clean, Save keeps it, Undo restores request and tab (HH-H07)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = "HH Undo Clean";
      const requestId = "qa-hh-undo-clean";
      const newUrl = "https://example.com/api/hh-clean-edited";
      // Wide enough that the URL bar shows the whole edited URL in the proof shots.
      await page.setViewportSize({ width: 1800, height: 900 });
      await openWorkspace(page, "skip", [
        updateRequest(requestId, { url: newUrl }),
        reply("Updated the URL."),
      ]);
      await openRequest(page, EDIT_COLLECTION.id, name);
      const original = await requestRecord(page, requestId);
      expect(original?.url).toBe("https://example.com/api/hh-clean-original");
      await expect(urlInput(page)).toHaveValue(original?.url ?? "");
      await openRelay(page);

      await sendMessage(page, "Change the URL");

      await expect(urlInput(page)).toHaveValue(newUrl);
      await expect(tabFor(page, name).getByTestId("tab-dirty-indicator")).toHaveCount(0);
      await expect
        .poll(async () => (await requestRecord(page, requestId))?.url)
        .toBe(newUrl);
      await snap("01-clean-edit-applied");

      // The button is disabled on a clean tab; the shortcut still runs Save.
      await expect(page.getByTestId("save-request-btn")).toBeDisabled();
      await page.keyboard.press("ControlOrMeta+s");
      await expect(page.getByText("Request saved")).toBeVisible();
      await expect(urlInput(page)).toHaveValue(newUrl);
      await expect
        .poll(async () => (await requestRecord(page, requestId))?.url)
        .toBe(newUrl);

      await undoChange(page);

      await expect(page.getByTestId("relay-change-blocked")).toHaveCount(0);
      await expect(urlInput(page)).toHaveValue(original?.url ?? "");
      await expect(tabFor(page, name).getByTestId("tab-dirty-indicator")).toHaveCount(0);
      await expect
        .poll(async () => withoutTimestamp(await requestRecord(page, requestId)))
        .toEqual(withoutTimestamp(original));
      await snap("02-clean-edit-undone");
    },
  );

  test(
    "dirty tab: the gate appears in Review and in Skip; save-all, discard and decline each leave the expected request and tab state (HH-H07)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const cases = {
        decline: {
          id: "qa-hh-undo-dirty-decline",
          name: "HH Undo Dirty Decline",
          original: "https://example.com/api/hh-decline-original",
          tabUrl: "https://example.com/api/hh-decline-tab-edit",
        },
        save: {
          id: "qa-hh-undo-dirty-save",
          name: "HH Undo Dirty Save",
          original: "https://example.com/api/hh-save-original",
          tabUrl: "https://example.com/api/hh-save-tab-edit",
        },
        discard: {
          id: "qa-hh-undo-dirty-discard",
          name: "HH Undo Dirty Discard",
          original: "https://example.com/api/hh-discard-original",
          tabUrl: "https://example.com/api/hh-discard-tab-edit",
        },
      };
      // Relay changes the method and the user changes the URL, so each outcome shows which edit survived.
      await openWorkspace(page, "review", [
        updateRequest(cases.decline.id, { method: "POST" }),
        reply("Declined path done."),
        updateRequest(cases.save.id, { method: "POST" }),
        reply("Save-all path done."),
        updateRequest(cases.discard.id, { method: "POST" }),
        reply("Discard path done."),
      ]);
      for (const item of Object.values(cases)) {
        await openRequest(page, EDIT_COLLECTION.id, item.name);
        await editTabUrl(page, item.name, item.tabUrl);
      }
      await openRelay(page);

      // Review: decline leaves request and tab untouched.
      await sendMessage(page, "Make the decline request a POST");
      await expect(dirtyCard(page)).toBeVisible();
      await expect(dirtyCard(page)).toContainText(cases.decline.name);
      // An edit gate says "editing ... apply", never the delete wording.
      await expect(dirtyCard(page)).toContainText(/Editing will change \d+ tabs? with unsaved changes/);
      await expect(dirtyCard(page)).not.toContainText(/Deleting|close/i);
      await expect(page.getByTestId("relay-close-tabs-save-all")).toHaveText("Save all & apply");
      await expect(page.getByTestId("relay-close-tabs-discard")).toHaveText("Discard & apply");
      await expect(page.getByTestId("relay-close-tabs-cancel")).toHaveText("Keep my edits, skip the change");
      await snap("03-gate-in-review");
      await page.getByTestId("relay-close-tabs-cancel").click();
      await expect(page.getByText("Declined path done.")).toBeVisible();
      const declined = await requestRecord(page, cases.decline.id);
      expect(declined).toMatchObject({ method: "GET", url: cases.decline.original });
      await tabFor(page, cases.decline.name).click();
      await expect(urlInput(page)).toHaveValue(cases.decline.tabUrl);
      await expect(
        tabFor(page, cases.decline.name).getByTestId("tab-dirty-indicator"),
      ).toBeVisible();

      // Review: save-all keeps the tab's URL and adds the Relay method.
      await sendMessage(page, "Make the save request a POST");
      await expect(dirtyCard(page)).toBeVisible();
      await page.getByTestId("relay-close-tabs-save-all").click();
      await expect(page.getByText("Save-all path done.")).toBeVisible();
      await expect
        .poll(() => requestRecord(page, cases.save.id))
        .toMatchObject({ method: "POST", url: cases.save.tabUrl });
      await tabFor(page, cases.save.name).click();
      await expect(urlInput(page)).toHaveValue(cases.save.tabUrl);
      await expect(
        tabFor(page, cases.save.name).getByTestId("tab-dirty-indicator"),
      ).toHaveCount(0);

      // Skip: the gate still asks, and discard keeps only the Relay edit.
      await page.getByTestId("relay-permission-trigger").click();
      await page.getByTestId("relay-permission-option-skip").click();
      await sendMessage(page, "Make the discard request a POST");
      await expect(dirtyCard(page)).toBeVisible();
      await snap("04-gate-in-skip");
      await page.getByTestId("relay-close-tabs-discard").click();
      await expect(page.getByText("Discard path done.")).toBeVisible();
      await expect
        .poll(() => requestRecord(page, cases.discard.id))
        .toMatchObject({ method: "POST", url: cases.discard.original });
      await tabFor(page, cases.discard.name).click();
      await expect(urlInput(page)).toHaveValue(cases.discard.original);
      await expect(
        tabFor(page, cases.discard.name).getByTestId("tab-dirty-indicator"),
      ).toHaveCount(0);
      await snap("05-gate-outcomes");
    },
  );

  test(
    "delete a seeded collection with a chain, Undo: collection and chain are both back (HH-H09)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openWorkspace(page, "skip", [
        tools({
          toolName: "delete_collection",
          input: { ids: [CHAIN_COLLECTION.id] },
        }),
        reply("Deleted the collection."),
      ]);
      await openRelay(page);
      await expect(collectionRow(page, CHAIN_COLLECTION.name)).toBeVisible();
      const before = await entitySnapshot(page);
      const orderBefore = await sidebarOrder(page);
      // Not last, so a restore that appends instead of re-inserting would be caught.
      expect(orderBefore.indexOf(CHAIN_COLLECTION.id)).toBeGreaterThanOrEqual(0);
      expect(orderBefore.indexOf(CHAIN_COLLECTION.id)).toBeLessThan(orderBefore.length - 1);
      const chainsBefore = before.chains as Named[];
      expect(chainsBefore.map((c) => c.id)).toContain(CHAIN_ID);
      expect((before.requests as Named[]).map((r) => r.id)).toEqual(
        expect.arrayContaining(CHAIN_REQUEST_IDS),
      );

      await sendMessage(page, "Delete the chain collection");

      await expect(collectionRow(page, CHAIN_COLLECTION.name)).toHaveCount(0);
      await expect
        .poll(async () =>
          ((await dumpIdbStore(page, "chains")) as Named[]).map((c) => c.id),
        )
        .not.toContain(CHAIN_ID);
      await snap("06-collection-deleted");

      await undoChange(page);

      await expect(collectionRow(page, CHAIN_COLLECTION.name)).toBeVisible();
      await expect.poll(() => entitySnapshot(page)).toEqual(before);
      await expect.poll(() => sidebarOrder(page)).toEqual(orderBefore);
      await expect(collectionRow(page, CHAIN_COLLECTION.name)).toBeInViewport();
      await snap("07-collection-restored");

      // The restored chain opens on its own page: collection name as title, both request nodes on the canvas.
      await page.goto(`/chain/${CHAIN_ID}`);
      await expect(
        page.getByRole("heading", { name: CHAIN_COLLECTION.name, level: 1 }),
      ).toBeVisible();
      for (const requestId of CHAIN_REQUEST_IDS) {
        await expect(page.getByTestId(`chain-node-${requestId}`)).toBeVisible();
      }
      await snap("07b-chain-restored");
    },
  );

  test(
    "import a backup whose ids collide with existing ones (merge-only import renames the colliding entities), Undo: exactly the merged entities, including the renamed copies, are removed and the pre-existing entities are untouched (HH-M11)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const stamp = uniqueName("import");
      const newName = `${stamp} new`;
      const collidingName = `${stamp} colliding`;
      const newId = `qa-hh-import-${Date.now()}-${nameCounter}`;
      const file = backupFile({
        collections: [
          {
            id: EDIT_COLLECTION.id,
            name: collidingName,
            description: "same id, different content",
            createdAt: 1700000000000,
            updatedAt: 1700000001000,
          },
          {
            id: newId,
            name: newName,
            description: "",
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          },
        ],
        chainConfigs: [{ collectionId: newId, steps: [] }],
        history: [
          {
            id: `${newId}-history`,
            timestamp: 1700000000000,
            method: "GET",
            url: "https://example.com/api/imported-history",
          },
        ],
      });
      await openWorkspace(page, "review", [
        tools({ toolName: "import_backup", input: {} }),
        reply("Imported."),
      ]);
      await openRelay(page);
      const snapshotStores = async () =>
        stripUpdatedAt(await dumpIdb(page, IMPORT_STORES)) as Record<string, unknown[]>;
      const before = await snapshotStores();
      const orderBefore = await sidebarOrder(page);

      await sendMessage(page, "Import a backup file");
      await expect(confirmCard(page)).toBeVisible();
      await page.getByTestId("relay-import-backup-input").setInputFiles({
        name: "relay-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(file)),
      });
      await expect(page.getByTestId("relay-import-backup-merge")).toBeVisible();
      await page.getByTestId("relay-confirm-approve").click();

      // The merge adds the new collection and a renamed copy of the colliding one; the original stays.
      await expect(collectionRow(page, newName)).toBeVisible();
      await expect(collectionRow(page, `${collidingName}${IMPORTED_SUFFIX}`)).toBeVisible();
      const merged = (await dumpIdbStore(page, "collections")) as Named[];
      expect(merged).toHaveLength((before.collections as Named[]).length + 2);
      expect(merged.find((c) => c.id === EDIT_COLLECTION.id)?.name).toBe(
        EDIT_COLLECTION.name,
      );
      // The side stores the merge wrote are non-vacuously populated before Undo.
      expect(await dumpIdbStore(page, "chainConfigs")).toEqual(
        expect.arrayContaining([expect.objectContaining({ collectionId: newId })]),
      );
      expect(await dumpIdbStore(page, "history")).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: `${newId}-history` })]),
      );
      await snap("08-backup-merged");

      await undoChange(page);

      await expect(collectionRow(page, newName)).toHaveCount(0);
      await expect(
        collectionRow(page, `${collidingName}${IMPORTED_SUFFIX}`),
      ).toHaveCount(0);
      await expect(collectionRow(page, EDIT_COLLECTION.name)).toBeVisible();
      await expect.poll(snapshotStores).toEqual(before);
      await expect.poll(() => sidebarOrder(page)).toEqual(orderBefore);
      await snap("09-backup-undone");
    },
  );

  test(
    "delete the active environment, Undo: it is active again (HH-M13)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await seedActiveEnv(page);
      await openWorkspace(page, "skip", [
        tools({
          toolName: "delete_environment",
          input: { id: ACTIVE_ENV.id },
        }),
        reply("Deleted the environment."),
      ]);
      await openRelay(page);
      const trigger = page.getByTestId("env-selector-trigger").first();
      const activeLabel = new RegExp(`${ACTIVE_ENV.name}(?! Spare)`);
      await expect(trigger).toContainText(activeLabel);
      const before = await entitySnapshot(page);
      expect((before.environments as Named[]).map((e) => e.id)).toContain(
        ACTIVE_ENV.id,
      );

      await sendMessage(page, "Delete the active environment");

      await expect(trigger).not.toContainText(activeLabel);
      await snap("10-active-env-deleted");

      await undoChange(page);

      await expect(trigger).toContainText(activeLabel);
      await expect.poll(() => entitySnapshot(page)).toEqual(before);
      await snap("11-active-env-restored");
    },
  );

  test(
    "multi-delete with one bad id deletes nothing and reports the id (HH-M10)",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const badId = `qa-hh-missing-${Date.now()}-${++nameCounter}`;
      const validIds = ["qa-hh-undo-multi-a", "qa-hh-undo-multi-b"];
      const routes = await openWorkspace(page, "skip", [
        tools({
          toolName: "delete_requests",
          input: { ids: [validIds[0], badId, validIds[1]] },
        }),
        reply("Could not delete."),
      ]);
      await openRelay(page);
      const before = await entitySnapshot(page);
      expect((before.requests as Named[]).map((r) => r.id)).toEqual(
        expect.arrayContaining(validIds),
      );

      await sendMessage(page, "Delete these requests");

      await expect(page.getByTestId("relay-worked-group").or(page.getByTestId("relay-tool-row")).first()).toBeVisible();
      expect(await sentToolOutput(routes.requestBodies, "delete_requests")).toContain(badId);
      expect(await entitySnapshot(page)).toEqual(before);
      await expect(changeBar(page)).toHaveCount(0);
      // The refusal names the bad id in the visible Relay tool row.
      await expandWorkedGroups(page);
      await expect(page.getByTestId("relay-tool-row").getByText(badId, { exact: false }).first()).toBeVisible();
      await snap("12-multi-delete-refused");
    },
  );

  test(
    "Save all & close keeps assertions (HH-M14)",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const name = "HH Undo Assert";
      const requestId = "qa-hh-undo-assert";
      const editedUrl = "https://example.com/api/hh-assert-edited";
      const assertionRows = page.getByRole("button", { name: "Delete assertion" });
      await installProxyReply(page, {
        status: 200,
        statusText: "OK",
        body: JSON.stringify({ ok: true }),
      });
      await openWorkspace(page, "review", [
        tools({ toolName: "close_all_tabs", input: { includePinned: null } }),
        reply("Closed the tabs."),
      ]);
      await openRequest(page, EDIT_COLLECTION.id, name);
      const seeded = await requestRecord(page, requestId);
      expect(seeded?.assertions).toHaveLength(1);
      await page.getByTestId("send-request-btn").click();
      await page.getByTestId("response-tab-more").click();
      await page.getByTestId("response-more-tests").click();
      await expect(assertionRows).toHaveCount(1);
      // A second assertion that exists only in the tab until Save all & close.
      await page.getByRole("button", { name: "Add Assertion" }).click();
      await expect(assertionRows).toHaveCount(2);
      await urlInput(page).fill(editedUrl);
      await expect(tabFor(page, name).getByTestId("tab-dirty-indicator")).toBeVisible();
      await openRelay(page);

      await sendMessage(page, "Close all tabs");
      await expect(dirtyCard(page)).toBeVisible();
      await snap("13-save-all-gate");
      await page.getByTestId("relay-close-tabs-save-all").click();

      await expect(tabFor(page, name)).toHaveCount(0);
      await expect
        .poll(async () => (await requestRecord(page, requestId))?.assertions?.length)
        .toBe(2);
      const saved = await requestRecord(page, requestId);
      expect(saved?.url).toBe(editedUrl);
      expect(saved?.assertions?.map((a) => a.id)).toContain(
        seeded?.assertions?.[0].id,
      );
      await snap("14-assertions-kept");
    },
  );
});
