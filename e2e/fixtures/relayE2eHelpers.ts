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

/** Fallback viewport width when Playwright reports none. */
const DEFAULT_VIEWPORT_WIDTH_PX = 1280;

/** Intermediate mouse-move steps so the resize handler sees a real drag. */
const DRAG_MOVE_STEPS = 16;

/** Timeout in ms for waiting on launcher to close after selection. */
const LAUNCHER_CLOSE_TIMEOUT_MS = 5000;

const RELAY_CHORD_MAC = "Meta+i";
const RELAY_CHORD_OTHER = "Control+Shift+L";
const LAUNCHER_ROW = "relay-launcher-row";

const TOGGLE = "relay-toggle";
const DOCK = "relay-dock";
const RESIZE_HANDLE = "relay-resize-handle";
const CLOSE = "relay-close";
const COMPOSER = "relay-composer";
const SEND = "relay-send";
const BANNER = "relay-banner";
const PICKER_TRIGGER = "relay-picker-trigger";
const LAUNCHER = "relay-launcher";
const MENTION_OPTION = "relay-mention-option";

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

/** Drags the dock's resize handle until the dock is `widthPx` wide. */
export async function dragDockToWidth(
  page: Page,
  widthPx: number,
): Promise<void> {
  const viewport = page.viewportSize()?.width ?? DEFAULT_VIEWPORT_WIDTH_PX;
  const handle = page.getByTestId(RESIZE_HANDLE);
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle is not rendered");
  const centerY = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, centerY);
  await page.mouse.down();
  await page.mouse.move(viewport - widthPx, centerY, {
    steps: DRAG_MOVE_STEPS,
  });
  await page.mouse.up();
  await expectDockWidth(page, widthPx);
}

/** Types a message into the composer and sends it. */
export async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByTestId(COMPOSER).fill(text);
  await page.getByTestId(SEND).click();
}

/** Opens the `+` launcher and waits until it is shown. */
export async function openLauncher(page: Page): Promise<void> {
  await page.getByTestId(PICKER_TRIGGER).click();
  await expect(page.getByTestId(LAUNCHER)).toBeVisible();
}

/** Attaches the open tab through the launcher's Attach section "Current tab" row (the only way a tab reaches Relay). */
export async function attachCurrentTab(page: Page): Promise<void> {
  await openLauncher(page);
  const currentTabRow = page
    .getByTestId(LAUNCHER_ROW)
    .filter({ has: page.getByText(/Current tab/) })
    .first();
  await currentTabRow.click();
  await expect(page.getByTestId(LAUNCHER)).toBeHidden();
}

/** Attaches the first item of `kind` whose text contains `search` from the launcher. */
export async function attachFromPicker(
  page: Page,
  kind: "environment" | "request" | "collection" | "chain",
  search: string,
): Promise<void> {
  await openLauncher(page);

  // Click the attach row for this kind (case-insensitive text matching)
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);
  // Scoped to the Attach section: Recent rows can also mention the kind and would attach directly.
  await page
    .getByTestId("relay-launcher-section-attach")
    .getByTestId(LAUNCHER_ROW)
    .filter({ hasText: new RegExp(kindLabel, "i") })
    .first()
    .click();

  // Launcher is now in list view; type the search term to filter
  await page.keyboard.type(search);

  // Enter acts on the highlighted row, so wait until a matching one is selected.
  await expect(
    page
      .getByTestId(MENTION_OPTION)
      .filter({ hasText: search })
      .and(page.locator('[aria-selected="true"]'))
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Enter");

  // Wait for launcher to close after selection
  await expect(page.getByTestId(LAUNCHER)).toBeHidden({
    timeout: LAUNCHER_CLOSE_TIMEOUT_MS,
  });
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
