import type { Page } from "@playwright/test";
import {
  closeRelay,
  expectDockWidth,
  openRelay,
  pressRelayShortcut,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const DEFAULT_WIDTH_PX = 400;
const MIN_WIDTH_PX = 320;
const MAX_WIDTH_VW = 0.6;
const KEY_STEP_PX = 16;
const MOBILE_VIEWPORT = { width: 375, height: 800 };
const PALETTE_ENTRY = "Open Relay";

const dock = (page: Page) => page.getByTestId("relay-dock");
const toggle = (page: Page) => page.getByTestId("relay-toggle");
const composer = (page: Page) => page.getByTestId("relay-composer");
const handle = (page: Page) => page.getByTestId("relay-resize-handle");

function viewportWidth(page: Page): number {
  const size = page.viewportSize();
  if (!size) throw new Error("Expected the page to have a viewport size");
  return size.width;
}

/** Drags the resize handle so the dock's left edge lands at `clientX`. */
async function dragHandleTo(page: Page, clientX: number): Promise<void> {
  const box = await handle(page).boundingBox();
  if (!box) throw new Error("Resize handle is not rendered");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(clientX, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
}

test.describe("Relay shell @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installRelayRoutes(page, { kind: "text", text: "ok" });
  });

  test("[REL-SHELL-01] The shortcut toggles the dock and moves focus to the composer", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    const previous = page.getByTestId("sidebar-settings-btn");
    await previous.focus();

    await pressRelayShortcut(page);
    await expect(dock(page)).toBeVisible();
    await expect(composer(page)).toBeFocused();
    await snap("01-open-composer-focused");

    await pressRelayShortcut(page);
    await expect(dock(page)).toBeHidden();
    await expect(previous).toBeFocused();
    await snap("02-closed-focus-restored");
  });

  test("[REL-SHELL-02] The header button and the command palette open and close the dock, and the state persists", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await expect(dock(page)).toHaveCount(0);

    await openRelay(page);

    await page.reload();
    await expect(dock(page)).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

    await page.getByTestId("sidebar-settings-btn").click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(dock(page)).toBeVisible();
    await snap("01-open-after-route-change");

    // The palette only exists on the workspace routes, so go back to one.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${WORKSPACE_PATH}$`));
    await expect(dock(page)).toBeVisible();

    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("option", { name: PALETTE_ENTRY }).click();
    await expect(dock(page)).toBeHidden();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await snap("02-closed-from-palette");
  });

  test("[REL-SHELL-03] Dragging or using the arrow keys resizes the dock within its bounds and the width persists", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);
    await expectDockWidth(page, DEFAULT_WIDTH_PX);

    const viewport = viewportWidth(page);
    await dragHandleTo(page, viewport - 500);
    await expectDockWidth(page, 500);
    await snap("01-dragged-wider");

    await dragHandleTo(page, 0);
    await expectDockWidth(page, Math.round(viewport * MAX_WIDTH_VW));

    await dragHandleTo(page, viewport);
    await expectDockWidth(page, MIN_WIDTH_PX);

    await handle(page).focus();
    await page.keyboard.press("ArrowLeft");
    await expectDockWidth(page, MIN_WIDTH_PX + KEY_STEP_PX);

    await page.reload();
    await expectDockWidth(page, MIN_WIDTH_PX + KEY_STEP_PX);
    await snap("02-width-persisted");
  });

  test("[REL-SHELL-04] Under 768px the dock is a full-width sheet without horizontal scroll", async ({
    seededPage: page,
    snap,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(WORKSPACE_PATH);

    await pressRelayShortcut(page);
    await expect(dock(page)).toBeVisible();
    await expectDockWidth(page, MOBILE_VIEWPORT.width);
    const hasHorizontalScroll = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
    await snap("01-mobile-sheet");

    await closeRelay(page);
  });

  test("[REL-SHELL-05] The toggle exposes its state and Escape returns focus before closing", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");

    await openRelay(page);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(dock(page)).toBeVisible();
    await expect(toggle(page)).toBeFocused();
    await snap("01-focus-returned-dock-open");

    await page.keyboard.press("Escape");
    await expect(dock(page)).toBeHidden();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  });
});
