import type { Page } from "@playwright/test";
import {
  expandWorkedGroups,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  startRelayGate,
  type RelayGate,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const TEXT_PART_ID = "qa-stop-text-1";
const PARTIAL_TEXT = "Looking into it";
const LATE_TEXT = " and here is the rest";
const NEXT_ANSWER = "Back and ready.";
const DELETE_TOOL = "delete_collection";
const DELETE_CALL_ID = "qa-stop-delete-1";
const DOOMED_ID = "qa-e2e-relay-doomed";
const STREAM_ERROR_CODE = "server_error";
// The client maps an unrecognised server error onto the generic unavailable banner.
const BANNER_ERROR_CODE = "relay_unavailable";

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");

/** Opens the dock with the first chat response held open by a gate; `then` answers later requests. */
async function openWithGate(
  page: Page,
  then: RelayScript[] = []
): Promise<RelayGate> {
  const gate = await startRelayGate(page);
  await installRelayRoutes(page, [{ kind: "gated", gate }, ...then]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return gate;
}

/** Sends a prompt and streams the first part of an answer, leaving the reply open. */
async function startPartialReply(page: Page, gate: RelayGate) {
  await sendMessage(page, "tell me more");
  await gate.push([
    { type: "text-start", id: TEXT_PART_ID },
    { type: "text-delta", id: TEXT_PART_ID, delta: PARTIAL_TEXT },
  ]);
  await expect(assistantBubbles(page).last()).toContainText(PARTIAL_TEXT);
  await expect(page.getByTestId("relay-stop")).toBeVisible();
}

test.describe("Relay stop streaming", () => {
  test("[REL-QOL-01] Stop mid-stream halts the reply and send returns",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const gate = await openWithGate(page);
      await startPartialReply(page, gate);

      await page.getByTestId("relay-stop").click();
      await expect(page.getByTestId("relay-send")).toBeVisible();
      await expect(page.getByTestId("relay-stop")).toHaveCount(0);
      await expect(page.getByTestId("relay-activity")).toHaveCount(0);

      // Anything the server still writes after Stop must not reach the thread.
      await gate.push([
        { type: "text-delta", id: TEXT_PART_ID, delta: LATE_TEXT },
      ]);
      await expect(assistantBubbles(page).last()).toContainText(PARTIAL_TEXT);
      await expect(assistantBubbles(page).last()).not.toContainText(LATE_TEXT);
    }
  );

  test("[REL-QOL-07] Stop during a pending tool call leaves no pending tool and the next prompt sends normally",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const gate = await openWithGate(page, [
        { kind: "text", text: NEXT_ANSWER },
      ]);
      await sendMessage(page, "delete the doomed collection");
      await gate.push([
        {
          type: "tool-input-available",
          toolCallId: DELETE_CALL_ID,
          toolName: DELETE_TOOL,
          input: { ids: [DOOMED_ID] },
        },
      ]);
      await expect(page.getByTestId("relay-confirm-card")).toBeVisible();
      await expect(page.getByTestId("relay-stop")).toBeVisible();

      await page.getByTestId("relay-stop").click();

      await expect(page.getByTestId("relay-send")).toBeVisible();
      await expect(page.getByTestId("relay-worked-group")).toHaveAttribute(
        "data-label",
        "stopped"
      );
      await expandWorkedGroups(page);
      await expect(page.getByTestId("relay-confirm-declined")).toBeVisible();
      await expect(page.getByTestId("relay-confirm-approve")).toHaveCount(0);
      await expect(
        page.locator('[data-testid="relay-tool-row"][data-state="running"]')
      ).toHaveCount(0);
      await expect(page.getByTestId("relay-send")).toBeVisible();

      await sendMessage(page, "never mind, say hi");
      await expect(assistantBubbles(page).last()).toContainText(NEXT_ANSWER);
      await expect(page.getByTestId("relay-banner")).toHaveCount(0);
    }
  );

  test("[REL-QOL-08] a chat route error mid-stream shows the error and restores send",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      const gate = await openWithGate(page);
      await startPartialReply(page, gate);

      await gate.push([
        {
          type: "error",
          errorText: JSON.stringify({ error: STREAM_ERROR_CODE }),
        },
      ]);
      await gate.end();

      await expect(page.getByTestId("relay-banner")).toHaveAttribute(
        "data-error-code",
        BANNER_ERROR_CODE
      );
      await expect(page.getByTestId("relay-activity")).toHaveCount(0);
      await expect(page.getByTestId("relay-send")).toBeVisible();
      await expect(page.getByTestId("relay-stop")).toHaveCount(0);
    }
  );
});
