import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  startRelayGate,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const TELEMETRY_EVENT = "relay:telemetry";
const FEEDBACK_EVENT = "relay_feedback";
const ANSWER_MARKDOWN = "**Bold answer** with `code`\n\n- first item\n- second item";
const PARTIAL_TEXT = "Looking into it";
const FINAL_TEXT = "Looking into it, done.";
const TEXT_PART_ID = "qa-actions-text-1";

type TelemetryEvent = { name: string; payload: Record<string, unknown> };

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const answerActions = (page: Page) => page.getByTestId("relay-answer-actions");

async function openWith(page: Page, script: RelayScript[]) {
  await installRelayRoutes(page, script);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

/** Collects every relay telemetry event the page emits into `window.__relayEvents`. */
async function installTelemetrySink(page: Page) {
  await page.addInitScript((eventName) => {
    const events: unknown[] = [];
    (window as unknown as { __relayEvents: unknown[] }).__relayEvents = events;
    window.addEventListener(eventName, (event) =>
      events.push((event as CustomEvent).detail)
    );
  }, TELEMETRY_EVENT);
}

const readEvents = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __relayEvents: TelemetryEvent[] }).__relayEvents
  );

/** Every persisted byte the page can hold: web storage plus all IndexedDB stores. */
async function snapshotStorage(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const dump = (storage: Storage) =>
      Object.keys(storage)
        .sort()
        .map((key) => [key, storage.getItem(key)]);
    const databases = await indexedDB.databases();
    const idb: Record<string, Record<string, unknown[]>> = {};
    for (const info of databases) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(info.name as string);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const stores: Record<string, unknown[]> = {};
      for (const storeName of Array.from(db.objectStoreNames)) {
        stores[storeName] = await new Promise<unknown[]>((resolve, reject) => {
          const request = db
            .transaction(storeName)
            .objectStore(storeName)
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      db.close();
      idb[info.name] = stores;
    }
    return JSON.stringify({
      local: dump(localStorage),
      session: dump(sessionStorage),
      idb,
    });
  });
}

test.describe("Relay message actions", () => {
  test("[REL-QOL-04] Copy puts the answer's markdown on the clipboard",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await openWith(page, [{ kind: "text", text: ANSWER_MARKDOWN }]);
      await sendMessage(page, "give me markdown");
      await expect(assistantBubbles(page).last()).toContainText("Bold answer");

      const copy = page.getByTestId("relay-copy-message");
      await copy.click();

      await expect(copy).toHaveAccessibleName("Copied");
      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(ANSWER_MARKDOWN);
    }
  );

  test("[REL-QOL-05] a thumbs click emits relay_feedback with the rating and no text, and nothing is stored",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await installTelemetrySink(page);
      await openWith(page, [{ kind: "text", text: ANSWER_MARKDOWN }]);
      await sendMessage(page, "give me markdown");
      await expect(answerActions(page)).toBeVisible();
      // Let the finished turn persist, so the "before" snapshot is the settled state.
      await expect
        .poll(async () => {
          const first = await snapshotStorage(page);
          const second = await snapshotStorage(page);
          return first === second;
        })
        .toBe(true);
      const before = await snapshotStorage(page);
      const eventsBefore = (await readEvents(page)).length;

      await page.getByTestId("relay-thumbs-up").click();
      await expect(page.getByTestId("relay-thumbs-up")).toHaveAttribute(
        "aria-pressed",
        "true"
      );

      const feedback = (await readEvents(page))
        .slice(eventsBefore)
        .filter((event) => event.name === FEEDBACK_EVENT);
      expect(feedback).toEqual([
        { name: FEEDBACK_EVENT, payload: { rating: "up" } },
      ]);
      expect(JSON.stringify(await readEvents(page))).not.toContain(
        "Bold answer"
      );
      expect(await snapshotStorage(page)).toBe(before);
    }
  );

  test("[REL-QOL-10] message actions are hidden while streaming and appear when the answer completes",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      const gate = await startRelayGate(page);
      await openWith(page, [{ kind: "gated", gate }]);
      await sendMessage(page, "tell me more");
      await gate.push([
        { type: "text-start", id: TEXT_PART_ID },
        { type: "text-delta", id: TEXT_PART_ID, delta: PARTIAL_TEXT },
      ]);
      await expect(assistantBubbles(page).last()).toContainText(PARTIAL_TEXT);
      await expect(page.getByTestId("relay-stop")).toBeVisible();
      await expect(answerActions(page)).toHaveCount(0);

      await gate.push([
        { type: "text-delta", id: TEXT_PART_ID, delta: ", done." },
        { type: "text-end", id: TEXT_PART_ID },
      ]);
      await gate.end();

      await expect(assistantBubbles(page).last()).toContainText(FINAL_TEXT);
      await expect(answerActions(page)).toBeVisible();
      await expect(page.getByTestId("relay-copy-message")).toBeVisible();
      await expect(page.getByTestId("relay-stop")).toHaveCount(0);
    }
  );
});
