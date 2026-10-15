import type { Page } from "@playwright/test";
import {
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
} from "../../fixtures/relayRoutes";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const REQ_A_NAME = "Request A";
const REQ_B_NAME = "Request B";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const RELAY_ENV_ID = "qa-e2e-relayimp-env";

const chips = (page: Page) => page.getByTestId("relay-context-chip");

/**
 * Opens the workspace with the environment active and routes installed.
 */
async function openWithRoutes(
  page: Page,
  ...args: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R
    : never
) {
  await page.addInitScript(
    ([key, id]) => localStorage.setItem(key, id),
    [ACTIVE_ENV_KEY, RELAY_ENV_ID]
  );
  const routes = await installRelayRoutes(page, ...args);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}


test.describe("Relay context chip", () => {
  test("[REL-ICTX-01] chip reads \"Using: A · current tab\" and follows a switch to B", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, { kind: "text", text: "OK" });
      await openSavedRequest(page, REQ_A_NAME);

      // Chip should read "Using: A · current tab"
      const autoChipA = chips(page).filter({ has: page.getByText(REQ_A_NAME) });
      await expect(autoChipA.first()).toBeVisible();
      await expect(autoChipA.first()).toContainText("current tab");

      // Switch to request B
      await openSavedRequest(page, REQ_B_NAME);

      // Chip should update to B
      const autoChipB = chips(page).filter({ has: page.getByText(REQ_B_NAME) });
      await expect(autoChipB.first()).toBeVisible();
      await expect(autoChipB.first()).toContainText("current tab");
    }
  );

  test("[REL-ICTX-02] new conversation clears attached items and re-derives chip and suggestions", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, [
        { kind: "text", text: "First reply" },
        { kind: "text", text: "Second reply" },
      ]);
      await openSavedRequest(page, REQ_A_NAME);

      // Verify initial state: chip is present
      const autoChipBefore = chips(page).filter({ has: page.getByText(REQ_A_NAME) });
      await expect(autoChipBefore.first()).toBeVisible();

      // Remove the auto chip for the current turn (set dismissal for this turn)
      await page
        .getByRole("button", { name: new RegExp(`Remove ${REQ_A_NAME} from context`) })
        .click();
      const removedChips = chips(page).filter({ has: page.getByTestId("relay-context-chip-label") });
      await expect(removedChips).toHaveCount(0);

      // Send a message (dismissal persists for this turn)
      await sendMessage(page, "hello");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // Start a new conversation (dismissal is cleared, attachments are cleared)
      await page.getByTestId("relay-new-thread").click();
      await expect(page.getByTestId("relay-composer")).toHaveValue("");

      // The auto chip should reappear for request A WITHOUT re-opening it
      // (A is still the active tab, dismissal was cleared on new thread)
      const autoChipAfter = chips(page).filter({ has: page.getByText(REQ_A_NAME) });
      await expect(autoChipAfter.first()).toBeVisible();
      await expect(autoChipAfter.first()).toContainText("current tab");

      // Suggestions should be re-derived: look for relay-suggestions element
      await expect(page.getByTestId("relay-suggestions")).toBeVisible();
    }
  );

  test("[REL-ICTX-06] removing the auto chip leaves it out of the next send only", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
      const routes = await openWithRoutes(page, [
        { kind: "text", text: "First" },
        { kind: "text", text: "Second" },
      ]);
      await openSavedRequest(page, REQ_A_NAME);

      // Verify auto chip is there
      const autoChipBtn = chips(page).filter({ has: page.getByText(REQ_A_NAME) });
      await expect(autoChipBtn.first()).toBeVisible();

      // Remove the auto chip
      await page
        .getByRole("button", { name: new RegExp(`Remove ${REQ_A_NAME} from context`) })
        .click();
      await expect(autoChipBtn).toHaveCount(0);

      // Send a message - the chip should be removed for this send
      await sendMessage(page, "first message");
      // Wait for the first request body to be captured (the mocked route responds)
      await expect.poll(
        async () => routes.requestBodies.length >= 1,
        { timeout: 5000 },
      ).toBe(true);

      // Verify the first request body does NOT include the auto chip for request A
      const firstBody = routes.requestBodies[0] as Record<string, unknown>;
      const context = firstBody?.context as Record<string, unknown>;
      const firstChips = context?.chips as Array<Record<string, unknown>> | undefined;
      // Should not have a request chip for request A (which would have kind: "request")
      const hasAutoChipInFirst = firstChips?.some(
        (c: Record<string, unknown>) => c.kind === "request" && String(c.label).includes(REQ_A_NAME)
      );
      await expect(hasAutoChipInFirst).toBe(false);

      // After sending, the chip comes back (dismissal is cleared)
      await expect(autoChipBtn.first()).toBeVisible();

      // Send another message - the chip should be included now
      await sendMessage(page, "second message");
      // Wait for the second request body to be captured (the mocked route responds)
      await expect.poll(
        async () => routes.requestBodies.length >= 2,
        { timeout: 5000 },
      ).toBe(true);

      // Verify the second request body INCLUDES the auto chip for request A again
      const secondBody = routes.requestBodies[1] as Record<string, unknown>;
      const context2 = secondBody?.context as Record<string, unknown>;
      const secondChips = context2?.chips as Array<Record<string, unknown>> | undefined;
      // Should have a request chip for request A
      const hasAutoChipInSecond = secondChips?.some(
        (c: Record<string, unknown>) => c.kind === "request" && String(c.label).includes(REQ_A_NAME)
      );
      await expect(hasAutoChipInSecond).toBe(true);
    }
  );

  test("[REL-ICTX-07] a utility page with no request tab shows no chip", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, { kind: "text", text: "OK" });

      // Without opening any request tab, there should be no auto chip
      const autoChipBtn = chips(page).filter({ has: page.getByTestId("relay-context-chip-label") });
      await expect(autoChipBtn).toHaveCount(0);
    }
  );

  test("[REL-ICTX-08] reloading with request B open restores the chip for B", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, { kind: "text", text: "OK" });
      await openSavedRequest(page, REQ_B_NAME);

      // Verify auto chip is there
      const autoChipBtn = chips(page).filter({ has: page.getByTestId("relay-context-chip-label") });
      await expect(autoChipBtn).toContainText(REQ_B_NAME);

      // Reload the page
      await page.reload();

      // Dock should still be open
      await expect(page.getByTestId("relay-dock")).toBeVisible();

      // Auto chip should still show request B
      await expect(autoChipBtn).toContainText(REQ_B_NAME);
    }
  );
});
