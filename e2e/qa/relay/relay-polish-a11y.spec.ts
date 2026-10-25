import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  dragDockToWidth,
  openList,
  openLauncher,
  openWithRoutes,
  putThreads,
  runtimeThread,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const NARROW_VIEWPORT_WIDTH = 900;
const MIN_PANEL_WIDTH_PX = 320;
const BLOCKING_IMPACTS = ["serious", "critical"];

async function scanElements(page: Page, selectors: string[]) {
  const builder = new AxeBuilder({ page });
  for (const selector of selectors) {
    builder.include(selector);
  }
  const { violations, passes } = await builder.analyze();
  // Guards against a vacuous scan (selector matched nothing).
  expect(passes.length).toBeGreaterThan(0);
  return violations
    .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")),
    }));
}

async function scanDock(page: Page) {
  return scanElements(page, ['[data-testid="relay-dock"]']);
}

async function scanDockWithElement(page: Page, elementSelector: string) {
  return scanElements(page, [
    '[data-testid="relay-dock"]',
    elementSelector,
  ]);
}

test.describe("Relay polish accessibility with every menu open @qa", () => {
  test("[REL-POL-A11Y-01] axe finds no serious or critical violations with the conversations overlay open", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, "Hello from Relay");
      await sendMessage(page, "test message");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // Open the conversations overlay
      await openList(page);
      await expect(page.getByTestId("relay-thread-overlay")).toBeVisible();

      // Scan the dock and overlay together
      const violations = await scanElements(page, [
        '[data-testid="relay-dock"]',
        '[data-testid="relay-thread-overlay"]',
      ]);
      expect(violations).toEqual([]);
    },
  );

  test("[REL-POL-A11Y-02] axe is clean with a thread row menu open", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, "Hello from Relay");
      await putThreads(page, [runtimeThread(1, 0, { title: "Test Thread" })]);

      // Open the conversations overlay and hover over a thread row
      await openList(page);
      const threadRow = page.getByTestId("relay-thread-item").first();
      await threadRow.hover();

      // Click the menu trigger
      const menuTrigger = threadRow.getByTestId("relay-thread-menu-trigger");
      await menuTrigger.click();
      await expect(page.getByTestId("relay-thread-menu-rename")).toBeVisible();

      // Scan the dock, overlay, and menu together
      const violations = await scanElements(page, [
        '[data-testid="relay-dock"]',
        '[data-testid="relay-thread-overlay"]',
        '[data-testid="relay-thread-item"]',
        '[role="menu"]',
        '[data-slot="dropdown-menu-content"]',
      ]);
      expect(violations).toEqual([]);
    },
  );

  test("[REL-POL-A11Y-03] axe is clean with the @ mention menu open", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, "Hello from Relay");

      // Open the mention menu by typing @
      const composer = page.getByTestId("relay-composer");
      await composer.fill("@");
      await expect(page.getByTestId("relay-mention-menu")).toBeVisible();

      const violations = await scanDockWithElement(
        page,
        '[data-testid="relay-mention-menu"]',
      );
      expect(violations).toEqual([]);
    },
  );

  test("[REL-POL-A11Y-04] axe is clean with the / slash menu open", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, "Hello from Relay");

      // Open the slash menu by typing /
      const composer = page.getByTestId("relay-composer");
      await composer.fill("/");
      await expect(page.getByTestId("relay-slash-menu")).toBeVisible();

      const violations = await scanDockWithElement(
        page,
        '[data-testid="relay-slash-menu"]',
      );
      expect(violations).toEqual([]);
    },
  );

  test("[REL-POL-A11Y-05] axe is clean with the + launcher open", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      await openWithRoutes(page, "Hello from Relay");

      // Open the launcher
      await openLauncher(page);
      await expect(page.getByTestId("relay-launcher")).toBeVisible();

      const violations = await scanDockWithElement(
        page,
        '[data-testid="relay-launcher"]',
      );
      expect(violations).toEqual([]);
    },
  );

  test("[REL-POL-A11Y-06] axe is clean with the shield popover open in each of the three modes (including the warning tone contrast)", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      const modes = ["review", "always-ask", "skip"];

      for (const mode of modes) {
        // Install routes and navigate
        await installRelayRoutes(page, { kind: "text", text: "Ready." });
        await page.goto(WORKSPACE_PATH);

        // Set the permission mode via page.evaluate after navigation, then reload
        await page.evaluate((mode: string) => {
          localStorage.setItem("rq_relay_permission_mode", mode);
        }, mode);

        // Reload to pick up the permission mode change
        await page.reload();
        await page.waitForLoadState("networkidle");

        // The dock open state persists across reloads and is not refocused on
        // load, so open it only when needed instead of asserting composer focus.
        const toggle = page.getByTestId("relay-toggle");
        if ((await toggle.getAttribute("aria-expanded")) !== "true") {
          await toggle.click();
        }
        await expect(page.getByTestId("relay-dock")).toBeVisible();

        // Open the shield popover
        const selectedMode = page.getByTestId(`relay-permission-option-${mode}`);
        const shield = page.getByTestId("relay-permission-trigger");
        await shield.click();
        const popover = page.getByTestId("relay-permission-popover");
        await expect(popover).toBeVisible();

        // Wait for the popover animation to settle
        await expect(popover).toHaveCSS("opacity", "1");
        // Proves this mode's tone (incl. warning) is what gets scanned.
        await expect(selectedMode).toHaveAttribute("aria-checked", "true");

        const violations = await scanDockWithElement(
          page,
          '[data-testid="relay-permission-popover"]',
        );
        expect(violations, `Shield popover violations found in ${mode} mode`).toEqual([]);
      }
    },
  );

  test("[REL-POL-A11Y-07] axe is clean with the capabilities popover open and with the empty state", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      // Test with capabilities popover open
      await openWithRoutes(page, "Hello from Relay");
      const capabilitiesTrigger = page.getByTestId("relay-header-capabilities");
      await capabilitiesTrigger.click();
      const capabilitiesPopover = page.getByTestId(
        "relay-capabilities-popover",
      );
      await expect(capabilitiesPopover).toBeVisible();

      // Wait for the popover animation to settle
      await expect(capabilitiesPopover).toHaveCSS("opacity", "1");

      let violations = await scanDockWithElement(
        page,
        '[data-testid="relay-capabilities-popover"]',
      );
      expect(violations, "Violations found with popover open").toEqual([]);

      // Close and test with empty state
      await page.keyboard.press("Escape");
      await expect(capabilitiesPopover).toBeHidden();

      // A new chat with no messages renders the empty state.
      await expect(page.getByTestId("relay-empty")).toBeVisible();
      violations = await scanDockWithElement(
        page,
        '[data-testid="relay-empty"]',
      );
      expect(violations, "Violations found with empty state").toEqual([]);
    },
  );

  test("[REL-POL-A11Y-08] axe is clean in dark mode at the 320px panel width with the launcher open", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      // RP-110: the dock minimum is max(30vw, 320px), so 320px is only
      // reachable on viewports <= ~1066px wide. Use a 900px viewport.
      await page.setViewportSize({ width: NARROW_VIEWPORT_WIDTH, height: 800 });
      await openWithRoutes(page, "Hello from Relay");

      // Switch to dark mode
      await page.evaluate(() => {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      });
      await expect(page.locator("html")).toHaveClass(/dark/);

      // Set the dock to narrow width
      await dragDockToWidth(page, MIN_PANEL_WIDTH_PX);

      // Open the launcher
      await openLauncher(page);
      await expect(page.getByTestId("relay-launcher")).toBeVisible();

      const violations = await scanDockWithElement(
        page,
        '[data-testid="relay-launcher"]',
      );
      expect(violations).toEqual([]);
    },
  );
});
