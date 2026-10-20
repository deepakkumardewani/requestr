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
const MIN_WIDTH_PX = 320;
const MIN_WIDTH_VW = 0.3;
const DEFAULT_WIDTH_VW = 0.3;
const MAX_WIDTH_VW = 0.4;
const KEY_STEP_PX = 16;
const STORAGE_KEY = "rq_relay_width";

const dock = (page: Page) => page.getByTestId("relay-dock");
const handle = (page: Page) => page.getByTestId("relay-resize-handle");

/** Saves a screenshot to the task-required location. */
async function snapTaskRequired(
  page: Page,
  viewportWidth: number,
): Promise<void> {
  // Switch to light theme before capturing
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    // Force repaint by triggering a layout recalculation
    void document.body.offsetHeight;
  });

  // Verify light theme is applied
  await expect(page.locator("html")).toHaveClass(/light/);

  const dirname = "agent_docs/qa/relay-polish";
  const filename = `p3-dock-${viewportWidth}`;
  await page.screenshot({ path: `${dirname}/${filename}-light.png` });
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

/** Gets the computed padding-right of document.body. */
async function getBodyPaddingRight(page: Page): Promise<number> {
  const padding = await page.evaluate(
    () =>
      Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0,
  );
  return padding;
}

/** Checks if the page has horizontal scroll. */
async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test.describe("Relay dock width limits (polish) @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installRelayRoutes(page, { kind: "text", text: "ok" });
  });

  test("[REL-POL-PANEL-01] at 1440px with no saved width the open dock is 30vw (432px)", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await page.goto(WORKSPACE_PATH);

    await openRelay(page);
    const expectedWidth = Math.round(viewport.width * DEFAULT_WIDTH_VW);
    await expectDockWidth(page, expectedWidth);

    await snap("01-1440px-default-width");
    await snapTaskRequired(page, 1440);
  });

  test("[REL-POL-PANEL-02] at 1100px the dock is 330px and at 900px it is 320px; at 780px the 320px floor wins over 40vw; never below 320px after drag-to-minimum or after shrinking the window with the dock open", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport1100 = { width: 1100, height: 900 };
    const viewport900 = { width: 900, height: 900 };
    const viewport780 = { width: 780, height: 900 };

    // Test at 1100px with no saved width (fresh load)
    await page.setViewportSize(viewport1100);
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);
    const expectedWidth1100 = Math.round(viewport1100.width * DEFAULT_WIDTH_VW);
    // At 1100px: 30vw = 330px (no clamping needed)
    await expectDockWidth(page, expectedWidth1100); // 330px
    await snap("00-1100px-fresh-load-330px");
    await snapTaskRequired(page, 1100);

    // Close relay before changing viewport to avoid state issues
    await closeRelay(page);

    // Fresh load at 900px with no saved width - should get 320px (30vw=270px clamped to floor)
    await page.setViewportSize(viewport900);
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);
    await expectDockWidth(page, MIN_WIDTH_PX); // 320px (min floor at 900px)
    await snap("00a-900px-fresh-load-320px");
    await snapTaskRequired(page, 900);

    // Close relay and reload to test resize behavior
    await closeRelay(page);

    // Now test resize from 1100px to 900px - width stays within [320, 360] range
    await page.setViewportSize(viewport1100);
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);
    await expectDockWidth(page, expectedWidth1100); // 330px
    await snap("00b-1100px-fresh-load-330px");

    // Resize to 900px (without reloading) - width stays within [320, 360] range
    await page.setViewportSize(viewport900);
    // Width 330px is still within [320, 360] range at 900px, so it stays 330px
    // (doesn't auto-adjust to 30vw of new viewport)
    await expectDockWidth(page, expectedWidth1100); // Still 330px
    await snap("01-resized-to-900px-width-unchanged");

    // Drag handle to the right edge to test minimum constraint at 900px
    await dragHandleTo(page, viewport900.width);
    await expectDockWidth(page, MIN_WIDTH_PX); // Should clamp to 320px (can't go below min)
    await snap("02-dragged-to-minimum-320px");

    // Resize to 780px with dock open
    // At 780px: min=320, max=320 (floor wins: floor(780*0.4)=312, but min=320)
    // The 320px should persist and not shrink
    await page.setViewportSize(viewport780);
    await expectDockWidth(page, MIN_WIDTH_PX); // Still 320px
    await snap("03-resized-to-780px-floor-wins");
    await snapTaskRequired(page, 780);
  });

  test("[REL-POL-PANEL-03] dragging the handle clamps between 30vw (432px) and 40vw (576px) at 1440px", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    const minWidth = Math.round(viewport.width * MIN_WIDTH_VW);
    const maxWidth = Math.round(viewport.width * MAX_WIDTH_VW);

    // Drag to left edge (clientX = 0) -> should clamp to max
    await dragHandleTo(page, 0);
    await expectDockWidth(page, maxWidth); // 576px
    await snap("01-dragged-to-max-576px");

    // Try to drag further left -> should stay at max
    await dragHandleTo(page, -100);
    await expectDockWidth(page, maxWidth); // Still 576px
    await snap("02-cannot-exceed-max");

    // Drag to right edge -> should clamp to min
    await dragHandleTo(page, viewport.width);
    await expectDockWidth(page, minWidth); // 432px
    await snap("03-dragged-to-min-432px");

    // Try to drag further right -> should stay at min
    await dragHandleTo(page, viewport.width + 100);
    await expectDockWidth(page, minWidth); // Still 432px
  });

  test("[REL-POL-PANEL-04] reload keeps the clamped width; a saved 700px (rq_relay_width) is clamped to 576px on reload and after a window resize", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport1440 = { width: 1440, height: 900 };
    const viewport900 = { width: 900, height: 900 };

    // Set up with saved 700px (which exceeds max)
    await page.addInitScript(({ key, value }) => {
      localStorage.setItem(key, value);
    }, { key: STORAGE_KEY, value: "700" });

    await page.setViewportSize(viewport1440);
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    // Should be clamped to max width
    const maxWidth1440 = Math.round(viewport1440.width * MAX_WIDTH_VW);
    await expectDockWidth(page, maxWidth1440); // 576px
    await snap("01-saved-700px-clamped-to-576px");

    // Reload and verify it stays clamped
    await page.reload();
    await expectDockWidth(page, maxWidth1440); // Still 576px
    await snap("02-after-reload-still-clamped");

    // Resize window to 900px
    await page.setViewportSize(viewport900);
    const maxWidth900 = Math.round(viewport900.width * MAX_WIDTH_VW);
    // The app should clamp to the new bounds
    await expectDockWidth(page, maxWidth900); // Should be clamped to new max: 360px
    await snap("03-after-window-resize-new-bounds");

    // Reload at new viewport size
    await page.reload();
    // After reload, it should respect the new bounds
    await expectDockWidth(page, Math.max(MIN_WIDTH_PX, maxWidth900));
  });

  test("[REL-POL-PANEL-05] keyboard: the focused handle resizes with ArrowLeft/ArrowRight in 16px steps, stops at the bounds, and aria-valuemin/aria-valuemax match the effective range", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    const minWidth = Math.round(viewport.width * MIN_WIDTH_VW);
    const maxWidth = Math.round(viewport.width * MAX_WIDTH_VW);
    const midWidth = 500; // A width in the middle of the allowed range

    // Focus the handle and verify aria attributes
    await handle(page).focus();
    const ariaValueMin = await handle(page).getAttribute("aria-valuemin");
    const ariaValueMax = await handle(page).getAttribute("aria-valuemax");

    expect(ariaValueMin).toBe(String(minWidth)); // 432
    expect(ariaValueMax).toBe(String(maxWidth)); // 576
    await snap("01-aria-attributes-match-bounds");

    // Drag to a mid-range width to test keyboard from a neutral position
    await dragHandleTo(page, viewport.width - midWidth);
    await expectDockWidth(page, midWidth);

    // Press ArrowLeft (increase width)
    await handle(page).focus();
    await page.keyboard.press("ArrowLeft");
    await expectDockWidth(page, midWidth + KEY_STEP_PX); // 516px
    await snap("02-arrow-left-increases-16px");

    // Press ArrowRight (decrease width)
    await page.keyboard.press("ArrowRight");
    await expectDockWidth(page, midWidth); // Back to 500px
    await snap("03-arrow-right-decreases-16px");

    // Go to max and try ArrowLeft
    await dragHandleTo(page, 0);
    await expectDockWidth(page, maxWidth); // 576px
    await handle(page).focus();
    await page.keyboard.press("ArrowLeft");
    await expectDockWidth(page, maxWidth); // Should stay at max, can't go further
    await snap("04-at-max-arrow-left-does-nothing");

    // Go to min and try ArrowRight
    await dragHandleTo(page, viewport.width);
    await expectDockWidth(page, minWidth); // 432px
    await handle(page).focus();
    await page.keyboard.press("ArrowRight");
    await expectDockWidth(page, minWidth); // Should stay at min, can't go further
  });

  test("[REL-POL-PANEL-06] page content is not covered: the body reserve tracks the dock width, the content stays visible beside the dock and the page has no horizontal scroll", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await page.goto(WORKSPACE_PATH);

    // Before opening, body should have no padding
    let bodyPaddingRight = await getBodyPaddingRight(page);
    expect(bodyPaddingRight).toBe(0);

    await openRelay(page);
    const defaultWidth = Math.round(viewport.width * DEFAULT_WIDTH_VW);

    // After opening, body padding should match dock width
    bodyPaddingRight = await getBodyPaddingRight(page);
    expect(Math.round(bodyPaddingRight)).toBe(defaultWidth);

    // No horizontal scroll
    let scroll = await hasHorizontalScroll(page);
    expect(scroll).toBe(false);

    // Content is visible beside the dock (dock's left edge >= content's right edge)
    const dockBox = await dock(page).boundingBox();
    const contentBox = await page.getByRole("main").boundingBox();
    expect(dockBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    if (dockBox && contentBox) {
      expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(dockBox.x);
    }
    await snap("01-default-width-no-scroll");

    // Drag to wider (576px)
    const maxWidth = Math.round(viewport.width * MAX_WIDTH_VW);
    await dragHandleTo(page, 0);
    await expectDockWidth(page, maxWidth);

    // Body padding should update
    bodyPaddingRight = await getBodyPaddingRight(page);
    expect(Math.round(bodyPaddingRight)).toBe(maxWidth);

    // Still no scroll
    scroll = await hasHorizontalScroll(page);
    expect(scroll).toBe(false);
    await snap("02-wider-width-still-no-scroll");

    // Close the dock
    await closeRelay(page);

    // Padding should be removed
    bodyPaddingRight = await getBodyPaddingRight(page);
    expect(bodyPaddingRight).toBe(0);

    // Now content can use full width
    scroll = await hasHorizontalScroll(page);
    expect(scroll).toBe(false);
    await snap("03-closed-padding-removed");
  });

  test("[REL-POL-PANEL-07] closing the dock releases the reserved space and reopening restores the saved width", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport = { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    await page.goto(WORKSPACE_PATH);

    await openRelay(page);
    const defaultWidth = Math.round(viewport.width * DEFAULT_WIDTH_VW);
    await expectDockWidth(page, defaultWidth);

    // Drag to a custom width
    const targetWidth = 500;
    await dragHandleTo(page, viewport.width - targetWidth);
    await expectDockWidth(page, targetWidth);

    // Verify body padding matches
    let bodyPaddingRight = await getBodyPaddingRight(page);
    expect(Math.round(bodyPaddingRight)).toBe(targetWidth);
    await snap("01-custom-width-500px");

    // Close the dock
    await closeRelay(page);

    // Padding should be 0
    bodyPaddingRight = await getBodyPaddingRight(page);
    expect(bodyPaddingRight).toBe(0);
    await snap("02-closed-padding-removed");

    // Reopen - should restore the saved width
    // Don't use openRelay() here as it expects focus; just click the toggle
    const toggle = page.getByTestId("relay-toggle");
    await toggle.click();
    await expect(dock(page)).toBeVisible();
    await expectDockWidth(page, targetWidth);

    // Verify body padding is restored
    bodyPaddingRight = await getBodyPaddingRight(page);
    expect(Math.round(bodyPaddingRight)).toBe(targetWidth);
    await snap("03-reopened-width-restored");
  });

  test("[REL-POL-PANEL-08] below 768px the sheet variant opens at the full viewport width and is unchanged", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport600 = { width: 600, height: 800 };
    const viewport320 = { width: 320, height: 800 };
    await page.setViewportSize(viewport600);
    await page.goto(WORKSPACE_PATH);

    // Use the platform-aware shortcut helper
    await pressRelayShortcut(page);
    await expect(dock(page)).toBeVisible();
    await expectDockWidth(page, viewport600.width); // Full width
    await snap("01-600px-sheet-full-width");

    // Resize to 400px
    const viewport400 = { width: 400, height: 800 };
    await page.setViewportSize(viewport400);
    await expectDockWidth(page, viewport400.width); // Follows viewport
    await snap("02-400px-sheet-follows-viewport");

    // Verify resize handle is not present on mobile sheets
    const resizeHandle = page.getByTestId("relay-resize-handle");
    await expect(resizeHandle).not.toBeVisible();
    await snap("03-sheet-no-resize-handle");

    // Resize to 320px
    await page.setViewportSize(viewport320);
    await expectDockWidth(page, viewport320.width); // Follows viewport at 320px
    await snap("04-320px-sheet-full-width");
    await snapTaskRequired(page, 320);

    // Resize back to 600px
    await page.setViewportSize(viewport600);
    await expectDockWidth(page, viewport600.width);
  });

  test("[REL-POL-PANEL-09] a corrupt rq_relay_width value (\"abc\", empty) falls back to the 30vw default", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const viewport = { width: 1440, height: 900 };
    const expectedDefault = Math.round(viewport.width * DEFAULT_WIDTH_VW);

    // Test with non-numeric value "abc"
    await page.addInitScript(({ key, value }) => {
      if (!sessionStorage.getItem("_seeded_abc")) {
        localStorage.setItem(key, value);
        sessionStorage.setItem("_seeded_abc", "1");
      }
    }, { key: STORAGE_KEY, value: "abc" });

    await page.setViewportSize(viewport);
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    await expectDockWidth(page, expectedDefault); // Falls back to default
    await snap("01-corrupt-value-abc-falls-back");

    // Close relay before testing empty string
    await closeRelay(page);

    // Test with empty string on the same page
    await page.evaluate(
      (key: string) => {
        localStorage.setItem(key, "");
      },
      STORAGE_KEY,
    );
    await page.reload();
    await openRelay(page);

    await expectDockWidth(page, expectedDefault); // Falls back to default
    await snap("02-empty-value-falls-back");
  });
});
