import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import { RELAY_MAX_THREADS } from "../../../src/lib/relay/constants";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const LOCAL_WORKSPACE = "local";
const THREADS_STORE = "relay_threads";
const FOREIGN_THREAD_ID = "qa-e2e-relay-thread-foreign";
const FOREIGN_TITLE = "QA foreign workspace thread";
/** Fixed past instant so runtime threads are always older than anything the app creates now. */
const RUNTIME_BASE_TIME_MS = 1_700_000_100_000;
const MS_PER_THREAD = 1_000;

type StoredThread = {
  id: string;
  title: string;
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
  messages: unknown[];
  interruptedMessageId: string | null;
};

const trigger = (page: Page) => page.getByTestId("relay-thread-trigger");
const items = (page: Page) => page.getByTestId("relay-thread-item");
const search = (page: Page) => page.getByTestId("relay-thread-search");
const title = (page: Page) => page.getByTestId("relay-title");
const userBubbles = (page: Page) => page.getByTestId("relay-message-user");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");

function runtimeThread(
  index: number,
  overrides: Partial<StoredThread> = {},
): StoredThread {
  const stamp = RUNTIME_BASE_TIME_MS + index * MS_PER_THREAD;
  const label = String(index).padStart(2, "0");
  return {
    id: `qa-e2e-relay-thread-${label}`,
    title: `QA thread ${label}`,
    workspaceId: LOCAL_WORKSPACE,
    createdAt: stamp,
    updatedAt: stamp,
    messages: [
      {
        id: `qa-e2e-relay-msg-${label}`,
        role: "user",
        parts: [{ type: "text", text: `Question ${label}` }],
      },
    ],
    interruptedMessageId: null,
    ...overrides,
  };
}

/** Writes threads straight into IndexedDB, the way an earlier session would have left them. */
async function putThreads(page: Page, threads: StoredThread[]) {
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

async function readThreads(page: Page): Promise<StoredThread[]> {
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

async function openWithRoutes(page: Page, text = "Hello from Relay") {
  await installRelayRoutes(page, { kind: "text", text });
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

async function openList(page: Page) {
  await trigger(page).click();
  await expect(page.getByTestId("relay-threads")).toBeVisible();
}

test.describe("Relay threads @qa", () => {
  test("[REL-THR-01] Reloading restores the last thread (FR-10, FR-11, FR-12, AC-13)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, "Here is the summary");
    await sendMessage(page, "Summarise my requests please");
    await expect(assistantBubbles(page)).toContainText("Here is the summary");

    // Saves are debounced; reloading before the write lands would lose the turn.
    await expect
      .poll(async () => {
        const mine = (await readThreads(page)).filter(
          (thread) => thread.workspaceId === LOCAL_WORKSPACE,
        );
        return mine.map((thread) => thread.messages.length);
      })
      .toEqual([2]);

    // The dock is restored open from storage and, by design, does not steal focus.
    await page.reload();
    await expect(page.getByTestId("relay-dock")).toBeVisible();

    await expect(userBubbles(page)).toHaveText("Summarise my requests please");
    await expect(assistantBubbles(page)).toContainText("Here is the summary");
    await expect(title(page)).toHaveText("Summarise my requests please");
    await snap("01-restored");
  });

  test("[REL-THR-02] Search, rename and delete with confirmation and undo (FR-11, AC-13)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page);
    await putThreads(page, [
      runtimeThread(1, { title: "Alpha plan" }),
      runtimeThread(2, { title: "Beta notes" }),
    ]);

    await openList(page);
    await expect(items(page)).toHaveCount(2);
    await items(page).filter({ hasText: "Alpha plan" }).getByTestId("relay-thread-select").click();
    await expect(title(page)).toHaveText("Alpha plan");

    await openList(page);
    await search(page).fill("plan");
    await expect(items(page)).toHaveCount(1);
    await expect(items(page)).toContainText("Alpha plan");

    await page.getByTestId("relay-thread-rename").click();
    const renameInput = page.getByTestId("relay-thread-rename-input");
    await renameInput.fill("Renamed plan");
    await renameInput.press("Enter");
    await expect(items(page)).toContainText("Renamed plan");
    await expect(title(page)).toHaveText("Renamed plan");
    await snap("02-renamed");

    await page.getByTestId("relay-thread-delete").click();
    await expect(page.getByTestId("relay-thread-delete-dialog")).toBeVisible();
    await snap("02-confirm");
    await page.getByTestId("relay-thread-delete-confirm").click();

    await expect(items(page)).toHaveCount(0);
    await expect(page.getByTestId("relay-empty")).toBeVisible();
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    await snap("02-undo-toast");

    await undo.click();

    await expect(items(page)).toHaveCount(1);
    await expect(items(page)).toContainText("Renamed plan");
    await expect(userBubbles(page)).toHaveText("Question 01");
  });

  test("[REL-THR-03] Threads from another workspace are not listed (FR-10, AC-13)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page);
    await putThreads(page, [runtimeThread(1, { title: "My own thread" })]);
    const stored = await readThreads(page);
    expect(stored.map((thread) => thread.id)).toContain(FOREIGN_THREAD_ID);

    await openList(page);

    await expect(items(page)).toHaveCount(1);
    await expect(items(page)).toContainText("My own thread");
    await expect(page.getByText(FOREIGN_TITLE)).toHaveCount(0);

    await search(page).fill("foreign");
    await expect(page.getByTestId("relay-threads-empty")).toBeVisible();
    await expect(items(page)).toHaveCount(0);
    await snap("03-isolated");
  });

  test("[REL-THR-04] The 51st thread prunes the oldest and shows a one-time notice (FR-14)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page);
    await putThreads(
      page,
      Array.from({ length: RELAY_MAX_THREADS }, (_, index) =>
        runtimeThread(index),
      ),
    );
    await expect(page.getByTestId("relay-pruned-notice")).toHaveCount(0);

    await page.getByTestId("relay-new-thread").click();

    const notice = page.getByTestId("relay-pruned-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "status");
    await snap("04-pruned-notice");

    await openList(page);
    await expect(items(page)).toHaveCount(RELAY_MAX_THREADS);
    await expect(page.getByText("QA thread 00", { exact: true })).toHaveCount(0);
    await expect(page.getByText("QA thread 01", { exact: true })).toBeVisible();

    await page.getByTestId("relay-pruned-notice-dismiss").click();
    await expect(notice).toHaveCount(0);
    // Close and reopen the list: the dismissed notice must stay gone.
    await trigger(page).click();
    await openList(page);
    await expect(notice).toHaveCount(0);
  });

  test("[REL-THR-05] New thread starts a blank conversation and keeps the old one (FR-12)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, "First answer");
    await sendMessage(page, "Remember this question");
    await expect(assistantBubbles(page)).toContainText("First answer");

    await page.getByTestId("relay-new-thread").click();

    await expect(page.getByTestId("relay-empty")).toBeVisible();
    await expect(userBubbles(page)).toHaveCount(0);
    await expect(assistantBubbles(page)).toHaveCount(0);
    await snap("05-blank");

    await openList(page);
    await expect(items(page)).toHaveCount(2);
    await items(page)
      .filter({ hasText: "Remember this question" })
      .getByTestId("relay-thread-select")
      .click();

    await expect(userBubbles(page)).toHaveText("Remember this question");
    await expect(assistantBubbles(page)).toContainText("First answer");
  });
});
