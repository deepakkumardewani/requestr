import type { Page } from "@playwright/test";
import {
  attachCurrentTab,
  openLauncher,
  openRelayEditor,
  typeAndSend,
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

const chips = (page: Page) => page.getByTestId("relay-composer-pill");

type ChatBody = { context?: { chips?: Array<{ kind: string; label: string }> } };
const sentChips = (body: unknown) => (body as ChatBody).context?.chips ?? [];

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
  await openRelayEditor(page);
  return routes;
}


test.describe("Relay context chip", () => {
  test("[REL-ICTX-01] nothing is attached by default; the Current tab row attaches request A and a tab switch adds nothing", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
    await openWithRoutes(page, { kind: "text", text: "OK" });
    await openSavedRequest(page, REQ_A_NAME);

    // Opening a request attaches nothing implicitly.
    await expect(chips(page)).toHaveCount(0);

    await attachCurrentTab(page);
    await expect(chips(page)).toHaveCount(1);
    await expect(chips(page).first()).toContainText(REQ_A_NAME);

    // Switching tabs never adds or rewrites a chip.
    await openSavedRequest(page, REQ_B_NAME);
    await expect(chips(page)).toHaveCount(1);
    await expect(chips(page).first()).toContainText(REQ_A_NAME);
    await expect(chips(page).filter({ hasText: REQ_B_NAME })).toHaveCount(0);
  });

  test("[REL-ICTX-02] new conversation clears attached items", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
    await openWithRoutes(page, [
      { kind: "text", text: "First reply" },
      { kind: "text", text: "Second reply" },
    ]);
    await openSavedRequest(page, REQ_A_NAME);
    await attachCurrentTab(page);
    await expect(chips(page)).toHaveCount(1);

    await typeAndSend(page, "hello");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

    await page.getByTestId("relay-new-thread").click();
    await expect(page.getByTestId("relay-composer")).toHaveText("");

    // Request A is still the open tab, yet nothing is re-attached.
    await expect(chips(page)).toHaveCount(0);
  });

  test("[REL-ICTX-06] removing an attached chip leaves it out of every later send", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
    const routes = await openWithRoutes(page, [
      { kind: "text", text: "First" },
      { kind: "text", text: "Second" },
    ]);
    await openSavedRequest(page, REQ_A_NAME);
    await attachCurrentTab(page);
    await expect(chips(page)).toHaveCount(1);

    // The pill is inline now: attaching leaves one trailing space, then Backspace removes the pill whole.
    await page.getByTestId("relay-composer").focus();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Backspace");
    await expect(chips(page)).toHaveCount(1);
    await page.keyboard.press("Backspace");
    await expect(chips(page)).toHaveCount(0);

    await typeAndSend(page, "first message");
    await expect.poll(() => routes.requestBodies.length).toBe(1);
    expect(sentChips(routes.requestBodies[0])).toEqual([]);

    // The chip does not come back on its own for the next turn.
    await expect(chips(page)).toHaveCount(0);
    await expect(page.getByTestId("relay-message-assistant")).toHaveCount(1);
    await typeAndSend(page, "second message");
    await expect.poll(() => routes.requestBodies.length).toBe(2);
    expect(sentChips(routes.requestBodies[1])).toEqual([]);
  });

  test("[REL-ICTX-07] a utility page with no request tab shows no chip", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
    await openWithRoutes(page, { kind: "text", text: "OK" });

    await expect(chips(page)).toHaveCount(0);
    await openLauncher(page);
    const row = page.locator(
      '[data-testid="relay-launcher-row"][data-row="attach:currentTab"]',
    );
    await expect(row).toBeDisabled();
    await expect(row).toContainText("No tab open");
  });

  test("[REL-ICTX-08] reloading with request B open keeps the dock open and attaches nothing", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
    await openWithRoutes(page, { kind: "text", text: "OK" });
    await openSavedRequest(page, REQ_B_NAME);
    await expect(chips(page)).toHaveCount(0);

    await page.reload();

    await expect(page.getByTestId("relay-dock")).toBeVisible();
    await expect(page.getByTestId("relay-composer")).toBeVisible();
    await expect(chips(page)).toHaveCount(0);
  });
});
