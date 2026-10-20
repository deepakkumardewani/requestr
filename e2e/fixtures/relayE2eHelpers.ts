/**
 * Thin helpers for the Relay e2e specs (e2e/qa/relay/*.spec.ts).
 * All functions use getByTestId / web-first assertions. No fixed sleeps.
 *
 * `sendMessage` and `expectBanner` target the conventional `relay-send` and
 * `relay-banner` test ids; the components that own them arrive in the chat
 * phases, so they are not exercised by the shell spec.
 */
import { expect, type Page } from "@playwright/test";

/** Maximum distance in px between an expected and a measured dock width. */
const WIDTH_TOLERANCE_PX = 1;

const RELAY_CHORD_MAC = "Meta+i";
const RELAY_CHORD_OTHER = "Control+Shift+L";

const TOGGLE = "relay-toggle";
const DOCK = "relay-dock";
const CLOSE = "relay-close";
const COMPOSER = "relay-composer";
const SEND = "relay-send";
const BANNER = "relay-banner";
const PICKER_TRIGGER = "relay-picker-trigger";
const PICKER = "relay-picker";
const PICKER_CURRENT_TAB = "relay-picker-current-tab";
const PICKER_SEARCH = "relay-picker-search";
const PICKER_ROW = "relay-picker-row";
const PICKER_KIND_PREFIX = "relay-picker-kind-";

/** Presses the platform's Relay chord (Cmd+I on Mac, Ctrl+Shift+L elsewhere). */
export async function pressRelayShortcut(page: Page): Promise<void> {
  const onMac = await page.evaluate(() =>
    /Mac|iPhone|iPad|iPod/.test(navigator.platform),
  );
  await page.keyboard.press(onMac ? RELAY_CHORD_MAC : RELAY_CHORD_OTHER);
}

/** Opens the dock through the toggle button and waits until it is usable. */
export async function openRelay(page: Page): Promise<void> {
  const toggle = page.getByTestId(TOGGLE);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId(DOCK)).toBeVisible();
  await expect(page.getByTestId(COMPOSER)).toBeFocused();
}

/** Closes the dock through its header close button. */
export async function closeRelay(page: Page): Promise<void> {
  await page.getByTestId(CLOSE).click();
  await expect(page.getByTestId(DOCK)).toBeHidden();
}

/** Asserts the dock is `widthPx` wide, waiting out the open transition. */
export async function expectDockWidth(
  page: Page,
  widthPx: number,
): Promise<void> {
  await expect
    .poll(async () => (await page.getByTestId(DOCK).boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(widthPx - WIDTH_TOLERANCE_PX);
  await expect
    .poll(async () => (await page.getByTestId(DOCK).boundingBox())?.width ?? 0)
    .toBeLessThanOrEqual(widthPx + WIDTH_TOLERANCE_PX);
}

/** Types a message into the composer and sends it. */
export async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByTestId(COMPOSER).fill(text);
  await page.getByTestId(SEND).click();
}

/** Attaches the open tab through the picker's "Current tab" row (the only way a tab reaches Relay). */
export async function attachCurrentTab(page: Page): Promise<void> {
  await page.getByTestId(PICKER_TRIGGER).click();
  await expect(page.getByTestId(PICKER)).toBeVisible();
  await page.getByTestId(PICKER_CURRENT_TAB).click();
  await expect(page.getByTestId(PICKER)).toBeHidden();
}

/** Attaches the first picker row of `kind` whose text contains `search`. */
export async function attachFromPicker(
  page: Page,
  kind: "environment" | "request" | "collection",
  search: string,
): Promise<void> {
  await page.getByTestId(PICKER_TRIGGER).click();
  await expect(page.getByTestId(PICKER)).toBeVisible();
  await page.getByTestId(`${PICKER_KIND_PREFIX}${kind}`).click();
  await page.getByTestId(PICKER_SEARCH).fill(search);
  await page
    .getByTestId(PICKER_ROW)
    .filter({ hasText: search })
    .first()
    .click();
  await expect(page.getByTestId(PICKER)).toBeHidden();
}

/** Asserts the status banner is visible and contains `text`. */
export async function expectBanner(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  await expect(page.getByTestId(BANNER)).toContainText(text);
}

// Thread seeding helpers for relay-threads.spec.ts and relay-polish-threads.spec.ts

import { IDB_DB_NAME } from "@/lib/idbSchema";

export const WORKSPACE_PATH = "/app";
export const LOCAL_WORKSPACE = "local";
export const THREADS_STORE = "relay_threads";

export type StoredThread = {
  id: string;
  title: string;
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
  messages: unknown[];
  interruptedMessageId: string | null;
};

/** Creates a thread object with the given index and age, suitable for IndexedDB insertion. */
export function runtimeThread(
  index: number,
  ageMs: number = 0,
  overrides: Partial<StoredThread> = {},
): StoredThread {
  const now = Date.now();
  const timestamp = now - ageMs;
  const label = String(index).padStart(2, "0");
  return {
    id: `qa-e2e-relay-polish-thread-${label}`,
    title: `QA polish thread ${label}`,
    workspaceId: LOCAL_WORKSPACE,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [
      {
        id: `qa-e2e-relay-polish-msg-${label}`,
        role: "user",
        parts: [{ type: "text", text: `Question ${label}` }],
      },
    ],
    interruptedMessageId: null,
    ...overrides,
  };
}

/** Writes threads straight into IndexedDB, the way an earlier session would have left them. */
export async function putThreads(page: Page, threads: StoredThread[]) {
  await page.evaluate(
    ({ dbName, store, rows }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(store, "readwrite");
          for (const row of rows) tx.objectStore(store).put(row);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, store: THREADS_STORE, rows: threads },
  );
}

/** Reads all threads from IndexedDB. */
export async function readThreads(page: Page): Promise<StoredThread[]> {
  return page.evaluate(
    ({ dbName, store }) =>
      new Promise<StoredThread[]>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction(store).objectStore(store).getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result as StoredThread[]);
          };
          request.onerror = () => reject(request.error);
        };
      }),
    { dbName: IDB_DB_NAME, store: THREADS_STORE },
  );
}

/** Installs relay routes, navigates to workspace, and opens the relay dock. */
export async function openWithRoutes(page: Page, text = "Hello from Relay") {
  const { installRelayRoutes } = await import("./relayRoutes");
  await installRelayRoutes(page, { kind: "text", text });
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

/** Clicks the thread trigger button and waits for the overlay to be visible. */
export async function openList(page: Page) {
  await page.getByTestId("relay-thread-trigger").click();
  await expect(page.getByTestId("relay-thread-overlay")).toBeVisible();
}
