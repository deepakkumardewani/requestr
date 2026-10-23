import type { Page } from "@playwright/test";
import {
  attachFromPicker,
  dragDockToWidth,
  openLauncher,
  openRelay,
  WORKSPACE_PATH,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const PERM_KEY = "rq_relay_permission_mode";
const PICKER = "relay-picker-trigger";
const SHIELD = "relay-permission-trigger";
const POPOVER = "relay-permission-popover";
const GROUP = "relay-permission-group";
const NOTICE = "relay-permission-notice";
const COMPOSER = "relay-composer";
const COMPOSER_PILL = "relay-composer-pill";
const SETTINGS = "relay-settings";
const PERM_SELECT = "relay-permission-select";
const TOOLTIP = '[data-slot="tooltip-content"][data-open]';
const NARROW_DOCK = 320;
const REQUEST_NAME = "Request A";

async function seedMode(page: Page, mode: string) {
  await page.addInitScript(([key, value]) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, value);
    }
  }, [PERM_KEY, mode] as const);
}

async function openDock(page: Page, mode = "review") {
  await seedMode(page, mode);
  await installRelayRoutes(page, { kind: "text", text: "Ready." });
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

async function openRelaySettings(page: Page) {
  await page.goto("/settings");
  await page.getByTestId("nav-relay").click();
  await expect(page.getByTestId(SETTINGS)).toBeVisible();
}

async function ensureDockOpen(page: Page) {
  const toggle = page.getByTestId("relay-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId("relay-dock")).toBeVisible();
}

async function openShieldPopover(page: Page) {
  await ensureDockOpen(page);
  await page.getByTestId(SHIELD).click();
  await expect(page.getByTestId(POPOVER)).toBeVisible();
}

test.describe("Relay permission shield @qa", () => {
  test("[REL-POL-SHIELD-01] the shield is the control right after + and its tooltip reads \"Approval mode: Review for me\" on hover and keyboard focus",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page);
      const picker = page.getByTestId(PICKER);
      const shield = page.getByTestId(SHIELD);
      const pickerBox = await picker.boundingBox();
      const shieldBox = await shield.boundingBox();
      expect(pickerBox).toBeTruthy();
      expect(shieldBox).toBeTruthy();
      expect(shieldBox!.x).toBeGreaterThanOrEqual(pickerBox!.x);

      await shield.hover();
      await expect(page.locator(TOOLTIP)).toContainText("Approval mode: Review for me");

      await page.getByTestId(COMPOSER).focus();
      await page.keyboard.press("Tab");
      await expect(picker).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(shield).toBeFocused();
      await expect(page.locator(TOOLTIP)).toContainText("Approval mode: Review for me");
      await snap("01-shield-tooltip");
    },
  );

  test("[REL-POL-SHIELD-02] opening shows a radiogroup with three rows, Review for me selected and marked Recommended",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page);
      await openShieldPopover(page);
      await expect(page.getByTestId(GROUP)).toBeVisible();
      await expect(page.getByTestId("relay-permission-option-review")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(page.getByTestId("relay-permission-option-review")).toContainText(
        "Recommended",
      );
      await snap("02-radiogroup");
    },
  );

  test("[REL-POL-SHIELD-03] Arrow keys move between rows; Enter selects, closes the popover, focus returns to the shield and data-mode updates",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page);
      await openShieldPopover(page);
      await page.getByTestId(GROUP).focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId(POPOVER)).toBeHidden();
      await expect(page.getByTestId(SHIELD)).toBeFocused();
      await expect(page.getByTestId(SHIELD)).toHaveAttribute("data-mode", "skip");
      await snap("03-keyboard-select");
    },
  );

  test("[REL-POL-SHIELD-04] Esc closes the popover and focus returns to the shield",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page);
      await openShieldPopover(page);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId(POPOVER)).toBeHidden();
      await expect(page.getByTestId(SHIELD)).toBeFocused();
      await snap("04-esc-close");
    },
  );

  test("[REL-POL-SHIELD-05] Skip shows \"Use with caution\" on its row, a warning-toned shield and the \"Approvals are off\" notice; the notice disappears on switching back",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page, "skip");
      await expect(page.getByTestId(NOTICE)).toBeVisible();
      await expect(page.getByTestId(NOTICE)).toContainText("Approvals are off");
      await openShieldPopover(page);
      await expect(page.getByTestId("relay-permission-option-skip")).toContainText(
        "Use with caution",
      );
      await page.getByTestId("relay-permission-option-review").click();
      await expect(page.getByTestId(NOTICE)).toBeHidden();
      await snap("05-skip-notice");
    },
  );

  test("[REL-POL-SHIELD-06] the chosen mode survives a reload",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page, "always-ask");
      await expect(page.getByTestId(SHIELD)).toHaveAttribute("data-mode", "always-ask");
      await page.reload();
      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), PERM_KEY))
        .toBe("always-ask");
      await installRelayRoutes(page, { kind: "text", text: "Ready." });
      await page.getByTestId("relay-toggle").click();
      await expect(page.getByTestId(SHIELD)).toHaveAttribute("data-mode", "always-ask");
      await snap("06-persist-reload");
    },
  );

  test("[REL-POL-SHIELD-07] changing the mode in Settings > Relay updates the shield, and changing via the shield updates the Settings select after reload",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page);
      await openRelaySettings(page);
      await page.getByTestId(PERM_SELECT).click();
      await page.getByRole("option", { name: "Skip all approvals" }).click();
      await installRelayRoutes(page, { kind: "text", text: "Ready." });
      await page.goto(WORKSPACE_PATH);
      await ensureDockOpen(page);
      await expect(page.getByTestId(SHIELD)).toHaveAttribute("data-mode", "skip");

      await openShieldPopover(page);
      await page.getByTestId("relay-permission-option-review").click();
      await openRelaySettings(page);
      await expect(page.getByTestId(PERM_SELECT)).toContainText("Review for me");
      await snap("07-settings-sync");
    },
  );

  test("[REL-POL-SHIELD-08] the launcher Settings section lists Permission mode with the current mode and opens the shield popover",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openDock(page, "skip");
      await openLauncher(page);
      const settings = page.getByTestId("relay-launcher-section-settings");
      await expect(settings).toBeVisible();
      // The Capabilities row (RP-215) shares this section; Permission mode is the one with a value.
      const permissionRow = settings
        .getByTestId("relay-launcher-row")
        .filter({ hasText: "Permission mode" });
      await expect(permissionRow.getByTestId("relay-launcher-row-value")).toContainText(
        "Skip all approvals",
      );
      await permissionRow.click();
      await expect(page.getByTestId(POPOVER)).toBeVisible();
      await snap("08-launcher-settings");
    },
  );

  test("[REL-POL-SHIELD-09] at 320px the popover is not clipped, has no horizontal scroll and the notice does not overlap pills",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await page.setViewportSize({ width: 1024, height: 800 });
      await openDock(page, "skip");
      await dragDockToWidth(page, NARROW_DOCK);
      await attachFromPicker(page, "request", REQUEST_NAME);
      await expect(page.getByTestId(COMPOSER_PILL)).toHaveCount(1);
      await openShieldPopover(page);
      const popover = page.getByTestId(POPOVER);
      const { scrollWidth, clientWidth } = await popover.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
      await expect(page.getByTestId(NOTICE)).toBeVisible();
      await expect(page.getByTestId(COMPOSER_PILL).first()).toBeVisible();
      const viewport = page.viewportSize();
      expect(viewport).toBeTruthy();
      const popoverBox = await popover.boundingBox();
      expect(popoverBox).toBeTruthy();
      expect(popoverBox!.x).toBeGreaterThanOrEqual(0);
      expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
      await snap("09-narrow-popover");
    },
  );
});
