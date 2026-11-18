import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const LOCAL_WORKSPACE = "local";
const THREADS_STORE = "relay_threads";
const FIRST_PROMPT = "first question";
const SECOND_PROMPT = "second question";
const EDITED_PROMPT = "second question, reworded";
const FIRST_ANSWER = "Answer to the first.";
const OLD_ANSWER = "Original answer.";
const NEW_ANSWER = "Regenerated answer.";
const EDITED_ANSWER = "Answer to the reworded question.";
const TRIMMED_MESSAGE_COUNT = 4;

type StoredThread = { workspaceId: string; messages: unknown[] };

const userBubbles = (page: Page) => page.getByTestId("relay-message-user");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");

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

async function openWithAnswers(page: Page, answers: string[]) {
  await installRelayRoutes(
    page,
    answers.map((text) => ({ kind: "text" as const, text })),
  );
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

/** Runs two turns, then edits the last user message and resends it. */
async function editSecondTurn(page: Page) {
  await sendMessage(page, FIRST_PROMPT);
  await expect(assistantBubbles(page)).toHaveCount(1);
  await expect(assistantBubbles(page).last()).toContainText(FIRST_ANSWER);
  await sendMessage(page, SECOND_PROMPT);
  await expect(assistantBubbles(page)).toHaveCount(2);
  await expect(assistantBubbles(page).last()).toContainText(OLD_ANSWER);

  await page.getByTestId("relay-edit-message").click();
  await page.getByTestId("relay-edit-input").fill(EDITED_PROMPT);
  await page.getByTestId("relay-edit-resend").click();
  await expect(assistantBubbles(page).last()).toContainText(EDITED_ANSWER);
}

test.describe("Relay regenerate and edit & resend", () => {
  // prettier-ignore
  test("[REL-QOL-02] Regenerate replaces the last answer",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWithAnswers(page, [OLD_ANSWER, NEW_ANSWER]);
      await sendMessage(page, FIRST_PROMPT);
      await expect(assistantBubbles(page).last()).toContainText(OLD_ANSWER);

      await page.getByTestId("relay-regenerate").click();

      await expect(assistantBubbles(page)).toHaveCount(1);
      await expect(assistantBubbles(page).last()).toContainText(NEW_ANSWER);
      await expect(assistantBubbles(page).last()).not.toContainText(OLD_ANSWER);
      await expect(userBubbles(page)).toHaveCount(1);
      await expect(userBubbles(page)).toHaveText(FIRST_PROMPT);
    },
  );

  // prettier-ignore
  test("[REL-QOL-03] Edit & resend replaces the last user message and drops later messages",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWithAnswers(page, [FIRST_ANSWER, OLD_ANSWER, EDITED_ANSWER]);
      await editSecondTurn(page);

      await expect(userBubbles(page)).toHaveCount(2);
      await expect(userBubbles(page).first()).toHaveText(FIRST_PROMPT);
      await expect(userBubbles(page).last()).toHaveText(EDITED_PROMPT);
      await expect(assistantBubbles(page)).toHaveCount(2);
      await expect(assistantBubbles(page).first()).toContainText(FIRST_ANSWER);
      await expect(page.getByText(OLD_ANSWER)).toHaveCount(0);
      await expect(page.getByText(SECOND_PROMPT, { exact: true })).toHaveCount(0);
    },
  );

  // prettier-ignore
  test("[REL-QOL-09] after Edit & resend a reload shows only the trimmed thread",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWithAnswers(page, [FIRST_ANSWER, OLD_ANSWER, EDITED_ANSWER]);
      await editSecondTurn(page);

      // Saves are debounced; reloading before the trimmed thread lands would restore the old one.
      await expect
        .poll(async () => {
          const mine = (await readThreads(page)).filter(
            (thread) => thread.workspaceId === LOCAL_WORKSPACE,
          );
          return mine.map(
            (thread) =>
              thread.messages.length === TRIMMED_MESSAGE_COUNT &&
              JSON.stringify(thread.messages).includes(EDITED_ANSWER) &&
              !JSON.stringify(thread.messages).includes(OLD_ANSWER),
          );
        })
        .toEqual([true]);

      await page.reload();
      await expect(page.getByTestId("relay-dock")).toBeVisible();

      await expect(userBubbles(page)).toHaveCount(2);
      await expect(userBubbles(page).last()).toHaveText(EDITED_PROMPT);
      await expect(assistantBubbles(page)).toHaveCount(2);
      await expect(assistantBubbles(page).last()).toContainText(EDITED_ANSWER);
      await expect(page.getByText(OLD_ANSWER)).toHaveCount(0);
    },
  );
});
