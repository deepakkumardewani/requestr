import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  startRelayGate,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const ANSWER_MARKDOWN = "**Bold answer** with `code`\n\n- first item\n- second item";
const PARTIAL_TEXT = "Looking into it";
const FINAL_TEXT = "Looking into it, done.";
const TEXT_PART_ID = "qa-actions-text-1";

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const answerActions = (page: Page) => page.getByTestId("relay-answer-actions");

async function openWith(page: Page, script: RelayScript[]) {
  await installRelayRoutes(page, script);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
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
