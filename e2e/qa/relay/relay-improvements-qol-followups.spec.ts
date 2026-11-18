import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const MAX_FOLLOW_UPS = 3;
const FAILED_STATUS = 500;
const TOOL_ANSWER = "The server returned an error.";
const PLAIN_ANSWER = "Just a plain answer.";
const CHIP_ANSWER = "Here is the fix.";

const failedSend = {
  kind: "tool",
  toolName: "send_request",
  input: { requestId: "qa-followup-request" },
  output: { ok: true, data: { status: FAILED_STATUS } },
  text: TOOL_ANSWER,
} satisfies RelayScript;

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const chips = (page: Page) => page.getByTestId("relay-follow-up");

async function openWith(page: Page, scripts: RelayScript[]) {
  await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

test.describe("Relay follow-up chips", () => {
  // prettier-ignore
  test("[REL-QOL-06] after a 500 result up to 3 follow-up chips appear and vanish on typing",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWith(page, [failedSend]);
      await sendMessage(page, "send it");
      await expect(assistantBubbles(page).last()).toContainText(TOOL_ANSWER);

      await expect(page.getByTestId("relay-follow-ups")).toBeVisible();
      await expect(chips(page)).not.toHaveCount(0);
      expect(await chips(page).count()).toBeLessThanOrEqual(MAX_FOLLOW_UPS);

      await page.getByTestId("relay-composer").fill("x");
      await expect(page.getByTestId("relay-follow-ups")).toHaveCount(0);
    }
  );

  // prettier-ignore
  test("[REL-QOL-11] clicking a follow-up chip sends its prompt and the chips clear",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWith(page, [failedSend, { kind: "text", text: CHIP_ANSWER }]);
      await sendMessage(page, "send it");
      await expect(assistantBubbles(page).last()).toContainText(TOOL_ANSWER);

      const chip = chips(page).first();
      const label = (await chip.textContent())?.trim() ?? "";
      expect(label).not.toBe("");
      await chip.click();

      await expect(
        page.getByTestId("relay-message-user").last()
      ).toContainText(label);
      await expect(assistantBubbles(page).last()).toContainText(CHIP_ANSWER);
      await expect(page.getByTestId("relay-follow-ups")).toHaveCount(0);
    }
  );

  // prettier-ignore
  test("[REL-QOL-12] an answer with no tool result shows no follow-up chips",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWith(page, [{ kind: "text", text: PLAIN_ANSWER }]);
      await sendMessage(page, "hello");
      await expect(assistantBubbles(page).last()).toContainText(PLAIN_ANSWER);
      await expect(page.getByTestId("relay-follow-ups")).toHaveCount(0);
      await expect(chips(page)).toHaveCount(0);
    }
  );
});
