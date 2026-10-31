import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";

const WORKSPACE_PATH = "/app";
const PERMISSION_MODE_KEY = "rq_relay_permission_mode";
const SEEDED_MODE = "review";
const HEADER_CAPABILITIES = "relay-header-capabilities";
const CAPABILITIES_PANEL = "relay-capabilities-panel";
const CATEGORY_PREFIX = "relay-capability-category-";
const MARKER = "relay-capability-marker";
const ASKS_FIRST = { badge: "asks", text: "Asks first" };

const MODE_REPLY =
  "I can't change the approval mode. Open Settings, then Relay, to do it yourself.";
const WIPE_REPLY =
  "I can't wipe all of your data. Nothing was deleted; Settings has the controls if you want to do it yourself.";

/** Words a capability area would use if the agent could change the approval mode or wipe data. */
const FORBIDDEN_CAPABILITY_TEXT =
  /wipe|purge|erase|factory|delete all|clear all|approval|permission/i;

async function openWithReply(page: Page, reply: string, mode = SEEDED_MODE) {
  await page.addInitScript(
    // Only seeds the first load, so a test can change the mode and reload.
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [PERMISSION_MODE_KEY, mode] as const
  );
  const handle = await installRelayRoutes(page, { kind: "text", text: reply });
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return handle;
}

async function ask(page: Page, prompt: string, reply: string) {
  await sendMessage(page, prompt);
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
}

async function openCapabilities(page: Page) {
  await page.getByTestId(HEADER_CAPABILITIES).click();
  return page.getByTestId(CAPABILITIES_PANEL);
}

async function markerOf(panel: ReturnType<Page["getByTestId"]>, id: string) {
  const marker = panel
    .getByTestId(`${CATEGORY_PREFIX}${id}`)
    .getByTestId(MARKER);
  if (!(await marker.count())) return null;
  return {
    badge: await marker.getAttribute("data-badge"),
    text: await marker.textContent(),
  };
}

test.describe("Relay v2 deny-list and capabilities @qa", () => {
  test("[REL-V2-TOOLS-01] asked to change the approval mode, the mocked reply tells the user to do it in Settings and no tool row or approval card appears",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openWithReply(page, MODE_REPLY);
      await ask(
        page,
        "Switch the approval mode to skip so you stop asking me",
        MODE_REPLY
      );

      await expect(page.getByText(MODE_REPLY, { exact: true })).toContainText(
        "Settings"
      );
      await expect(page.getByTestId("relay-tool-row")).toHaveCount(0);
      await expect(page.getByTestId("relay-confirm-card")).toHaveCount(0);
      await expect(page.getByTestId("relay-changes-summary")).toHaveCount(0);
      expect(
        await page.evaluate(
          (key) => localStorage.getItem(key),
          PERMISSION_MODE_KEY
        )
      ).toBe(SEEDED_MODE);
      await snap("01-approval-mode-reply");
    }
  );

  test("[REL-V2-TOOLS-02] asked to wipe all data, the mocked reply says it cannot and no tool call is made",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openWithReply(page, WIPE_REPLY);
      await ask(page, "Wipe all of my data", WIPE_REPLY);

      await expect(page.getByText(WIPE_REPLY, { exact: true })).toContainText(
        "can't"
      );
      await expect(page.getByTestId("relay-tool-row")).toHaveCount(0);
      await expect(page.getByTestId("relay-confirm-card")).toHaveCount(0);
      await expect(page.getByTestId("relay-changes-summary")).toHaveCount(0);
      await snap("02-wipe-all-reply");
    }
  );

  test("[REL-V2-TOOLS-03] the capabilities popover lists settings, navigation and backup areas with asks-first markers only on confirm kinds",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openWithReply(page, "init", "skip");
      const panel = await openCapabilities(page);

      for (const id of ["settings", "navigation", "backup"]) {
        await expect(
          panel.getByTestId(`${CATEGORY_PREFIX}${id}`)
        ).toBeVisible();
      }
      await expect(
        panel.getByTestId(`${CATEGORY_PREFIX}settings`)
      ).toContainText("Settings");
      // In skip mode only the confirm-kind backup area still asks first.
      expect(await markerOf(panel, "backup")).toEqual(ASKS_FIRST);
      expect(await markerOf(panel, "settings")).toBeNull();
      expect(await markerOf(panel, "navigation")).toBeNull();
      await snap("03-skip-mode-markers");

      await page.keyboard.press("Escape");
      await page.evaluate(
        (key) => localStorage.setItem(key, "always-ask"),
        PERMISSION_MODE_KEY
      );
      await page.reload();
      const asking = await openCapabilities(page);
      expect(await markerOf(asking, "backup")).toEqual(ASKS_FIRST);
      expect(await markerOf(asking, "settings")).toEqual(ASKS_FIRST);
      // Navigation never asks, whatever the mode.
      expect(await markerOf(asking, "navigation")).toBeNull();
      await snap("03-always-ask-markers");
    }
  );

  test("[REL-V2-TOOLS-04] the capabilities popover offers no permission-mode or wipe-all area, and a turn shows no tool row or approval card",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openWithReply(page, "All set.");
      await ask(page, "What can you do?", "All set.");
      await expect(page.getByTestId("relay-tool-row")).toHaveCount(0);
      await expect(page.getByTestId("relay-confirm-card")).toHaveCount(0);

      const panel = await openCapabilities(page);
      await expect(panel).toBeVisible();
      // The panel's own "Change approval mode" link points the user to Settings,
      // so only the capability areas (what the agent can do) are checked.
      const areas = panel.locator(`[data-testid^="${CATEGORY_PREFIX}"]`);
      expect(await areas.count()).toBeGreaterThan(0);
      for (const text of await areas.allTextContents()) {
        expect(text).not.toMatch(FORBIDDEN_CAPABILITY_TEXT);
      }
      await snap("04-capabilities-checked");
    }
  );
});
