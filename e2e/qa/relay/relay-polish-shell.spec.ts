import type { Locator, Page } from "@playwright/test";
import {
  attachFromPicker,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

type KeydownProbeWindow = Window & { __keydownDefault?: boolean | null };

const WORKSPACE_PATH = "/app";
const LANDING_PATH = "/";
const ATTACHED_REQUEST_NAME = "Request B";
/** Sub-pixel layout rounding plus the tab bar's own right padding. */
const RIGHT_EDGE_TOLERANCE_PX = 8;
const TOGGLE_JUMP_TOLERANCE_PX = 1;
/** Enough tabs to overflow the strip at the default 1280px viewport. */
const OVERFLOW_TAB_COUNT = 20;
const TOOLTIP_VISIBLE_BUDGET_MS = 700;
const MIN_CONTRAST_RATIO = 3;
const NEW_CHAT_KEYCAPS = { mac: ["⌘", "Shift", "O"], other: ["Ctrl", "Shift", "O"] };
const CLOSE_KEYCAPS = { mac: ["⌘", "I"], other: ["Ctrl", "Shift", "L"] };

const toggle = (page: Page) => page.getByTestId("relay-toggle");
const dock = (page: Page) => page.getByTestId("relay-dock");
const composer = (page: Page) => page.getByTestId("relay-composer");
const tabBar = (page: Page) => page.getByTestId("tab-bar");
/**
 * Open tooltips whose text matches. Text-scoped because Relay's Esc returns
 * focus to the toggle, whose own "Relay" tooltip then opens; closing tooltips
 * keep `data-closed` while they animate out.
 */
const tooltip = (page: Page, text: RegExp) =>
  page
    .locator('[data-slot="tooltip-content"]:not([data-closed])')
    .filter({ hasText: text });

/** The new-chat empty state puts the capability starters and onboarding buttons between the composer and the header. */
const MAX_TAB_STOPS = 40;

/** Reaches `target` from the composer with real Shift+Tab presses (the user's keyboard path). */
async function focusByShiftTab(page: Page, target: Locator) {
  await composer(page).focus();
  for (let i = 0; i < MAX_TAB_STOPS; i++) {
    await page.keyboard.press("Shift+Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("target was not reachable with Shift+Tab from the composer");
}

/**
 * Pointer away, focus back in the composer and tooltip gone, so the next leg
 * starts clean. Focus must re-enter the dock: Relay's first Esc hands focus
 * out and a second one closes the dock, and focus re-entry disarms that.
 */
async function resetTooltips(page: Page) {
  await page.mouse.move(0, 0);
  await composer(page).focus();
  await expect(page.locator('[data-slot="tooltip-content"]:not([data-closed])')).toHaveCount(0);
}

const detectMac = (page: Page) =>
  page.evaluate(() => /Mac|iPhone|iPad|iPod/.test(navigator.platform));

test.describe("Relay Shell @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installRelayRoutes(page, { kind: "text", text: "ok" });
  });

  test("[REL-POL-SHELL-01] @critical the toggle is at the far right of the tab bar, right of the tab-list chevron, and not in the left sidebar", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    // Open at least one tab so the chevron (tabs-overflow-btn) renders
    const newTabBtn = tabBar(page).locator('[data-testid="new-tab-btn"]');
    await newTabBtn.click();

    await expect(toggle(page)).toBeVisible();
    await expect(tabBar(page)).toBeVisible();

    // Get bounding boxes for toggle, chevron, and tab bar
    const toggleBox = await toggle(page).boundingBox();
    const tabBarBox = await tabBar(page).boundingBox();

    // The chevron is the TabListDropdown trigger with testid "tabs-overflow-btn"
    const chevron = tabBar(page).locator('[data-testid="tabs-overflow-btn"]');
    const chevronBox = await chevron.boundingBox();

    // Get left sidebar nav to verify toggle is not in it
    const leftNav = page.locator('nav[aria-label*="Collections"]');
    const leftNavBox = await leftNav.boundingBox();

    expect(toggleBox).not.toBeNull();
    expect(tabBarBox).not.toBeNull();
    expect(chevronBox).not.toBeNull();
    expect(leftNavBox).not.toBeNull();

    const { toggleRight, tabBarRight, leftNavRight } = {
      toggleRight: toggleBox!.x + toggleBox!.width,
      tabBarRight: tabBarBox!.x + tabBarBox!.width,
      leftNavRight: leftNavBox!.x + leftNavBox!.width,
    };
    // Right of the tab-list chevron
    expect(toggleBox!.x).toBeGreaterThanOrEqual(chevronBox!.x + chevronBox!.width);
    // Not inside the left sidebar
    expect(toggleBox!.x).toBeGreaterThanOrEqual(leftNavRight);
    // Far right: its right edge aligns with the tab bar's right edge
    expect(tabBarRight - toggleRight).toBeGreaterThanOrEqual(0);
    expect(tabBarRight - toggleRight).toBeLessThanOrEqual(RIGHT_EDGE_TOLERANCE_PX);

    await snap("01-toggle-position");
  });

  test("[REL-POL-SHELL-02] @high with zero tabs the toggle is still at the far right and does not jump when a tab opens", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);

    const tabs = tabBar(page).getByTestId("tab");
    const closeButtons = page.getByTestId("tab-close-btn");

    // Close every seeded tab until the bar is empty
    while ((await tabs.count()) > 0) {
      const remaining = await tabs.count();
      await tabs.first().hover();
      await closeButtons.first().click();
      await expect(tabs).toHaveCount(remaining - 1);
    }
    await expect(tabs).toHaveCount(0);

    await expect(toggle(page)).toBeVisible();
    const emptyToggleBox = (await toggle(page).boundingBox())!;
    const emptyBarBox = (await tabBar(page).boundingBox())!;
    expect(emptyBarBox.x + emptyBarBox.width - (emptyToggleBox.x + emptyToggleBox.width))
      .toBeLessThanOrEqual(RIGHT_EDGE_TOLERANCE_PX);
    await snap("02-zero-tabs");

    await tabBar(page).locator('[data-testid="new-tab-btn"]').click();
    await expect(tabs).toHaveCount(1);

    const openedToggleBox = (await toggle(page).boundingBox())!;
    expect(Math.abs(emptyToggleBox.x - openedToggleBox.x)).toBeLessThanOrEqual(
      TOGGLE_JUMP_TOLERANCE_PX,
    );

    await snap("02-one-tab-opened");
  });

  test("[REL-POL-SHELL-03] @high with many tabs (overflow) the toggle stays visible", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);

    const newTabBtn = tabBar(page).locator('[data-testid="new-tab-btn"]');
    for (let i = 0; i < OVERFLOW_TAB_COUNT; i++) {
      await newTabBtn.click();
    }

    // The tab strip must really overflow, otherwise this proves nothing
    const scrollArea = tabBar(page).locator(".overflow-x-auto");
    await expect
      .poll(() => scrollArea.evaluate((el) => el.scrollWidth > el.clientWidth))
      .toBe(true);

    // Pinned outside the scrolling strip, so it cannot scroll away with the tabs
    const insideScrollArea = await toggle(page).evaluate(
      (el) => el.closest(".overflow-x-auto") !== null,
    );
    expect(insideScrollArea).toBe(false);

    await expect(toggle(page)).toBeVisible();
    await expect(toggle(page)).toBeInViewport();

    // Still flush with the tab bar's right edge (a toggle trailing the last tab would miss it)
    const toggleBox = (await toggle(page).boundingBox())!;
    const tabBarBox = (await tabBar(page).boundingBox())!;
    const edgeGap = tabBarBox.x + tabBarBox.width - (toggleBox.x + toggleBox.width);
    expect(edgeGap).toBeGreaterThanOrEqual(0);
    expect(edgeGap).toBeLessThanOrEqual(RIGHT_EDGE_TOLERANCE_PX);

    await snap("01-toggle-visible-overflow");
  });

  test("[REL-POL-SHELL-04] @critical clicking the toggle opens and closes the dock and aria-expanded flips; state survives a reload", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);

    // Initial state should be closed
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(dock(page)).toBeHidden();

    // Click to open
    await toggle(page).click();
    await expect(dock(page)).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await snap("01-dock-open");

    // Click to close
    await toggle(page).click();
    await expect(dock(page)).toBeHidden();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await snap("02-dock-closed");

    // Open again and reload to test persistence
    await toggle(page).click();
    await expect(dock(page)).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

    // Reload the page
    await page.reload();

    // Verify state persisted after reload
    await expect(dock(page)).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await snap("03-state-persisted-after-reload");
  });

  test("[REL-POL-SHELL-05] @high header tooltips appear on hover and on keyboard focus within 700 ms, show keycaps, and Esc dismisses", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    const isOnMac = await detectMac(page);
    const platform = isOnMac ? "mac" : "other";
    const cases = [
      { id: "relay-new-thread", keycaps: NEW_CHAT_KEYCAPS[platform], text: /New chat/i },
      { id: "relay-close", keycaps: CLOSE_KEYCAPS[platform], text: /Close/i },
      { id: "relay-thread-trigger", keycaps: [], text: /Relay conversations/i },
    ];

    for (const { id, keycaps, text } of cases) {
      const button = page.getByTestId(id);
      const tip = tooltip(page, text);

      // Hover leg
      await resetTooltips(page);
      let start = Date.now();
      await button.hover();
      await expect(tip).toBeVisible({ timeout: TOOLTIP_VISIBLE_BUDGET_MS });
      expect(Date.now() - start).toBeLessThan(TOOLTIP_VISIBLE_BUDGET_MS);
      await expect(tip).toContainText(text);
      await expect(tip.locator("kbd")).toHaveText(keycaps);
      await snap(`${id}-hover`);
      await page.keyboard.press("Escape");
      await expect(tip).toBeHidden();

      // Keyboard focus leg
      await resetTooltips(page);
      await focusByShiftTab(page, button);
      start = Date.now();
      await expect(tip).toBeVisible({ timeout: TOOLTIP_VISIBLE_BUDGET_MS });
      expect(Date.now() - start).toBeLessThan(TOOLTIP_VISIBLE_BUDGET_MS);
      await expect(tip).toContainText(text);
      await expect(tip.locator("kbd")).toHaveText(keycaps);
      await snap(`${id}-focus`);
      await page.keyboard.press("Escape");
      await expect(tip).toBeHidden();
    }
  });

  test("[REL-POL-SHELL-06] @medium no header button lacks an accessible name", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    const dockHeader = dock(page).locator("header");
    const buttons = dockHeader.getByRole("button");

    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute("aria-label");
      const title = await button.getAttribute("title");
      const textContent = await button.textContent();

      const hasName =
        (ariaLabel && ariaLabel.trim()) ||
        (title && title.trim()) ||
        (textContent && textContent.trim());

      expect(hasName).toBeTruthy();
    }

    await snap("01-header-buttons-accessible");
  });

  test("[REL-POL-SHELL-07] @critical the new-chat chord pressed in the composer starts an empty focused chat with attachments cleared and is default-prevented; the toggle chord closes an open dock", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    // Page-level listener to prove the chord is default-prevented
    await page.evaluate(() => {
      (window as KeydownProbeWindow).__keydownDefault = null;
      window.addEventListener("keydown", (e) => {
        if (
          (e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "o"
        ) {
          (window as KeydownProbeWindow).__keydownDefault = e.defaultPrevented;
        }
      });
    });
    const isOnMac = await detectMac(page);

    // Build a chat with messages and an attached request chip
    await sendMessage(page, "first message");
    const messages = dock(page).locator('[data-testid^="relay-message-"]');
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
    expect(await messages.count()).toBeGreaterThanOrEqual(2);

    await attachFromPicker(page, "request", ATTACHED_REQUEST_NAME);
    const attachedChip = page
      .locator('[data-testid="relay-composer-pill"][data-kind="request"]')
      .filter({ hasText: ATTACHED_REQUEST_NAME });
    await expect(attachedChip).toBeVisible();
    await expect(composer(page)).toBeFocused();
    await composer(page).pressSequentially("draft");

    await page.keyboard.press(isOnMac ? "Meta+Shift+o" : "Control+Shift+o");

    // Default-prevented, fresh empty thread, attachments cleared, composer focused
    await expect
      .poll(() =>
        page.evaluate(() => (window as KeydownProbeWindow).__keydownDefault),
      )
      .toBe(true);
    await expect(page.getByTestId("relay-empty")).toBeVisible();
    await expect(messages).toHaveCount(0);
    await expect(attachedChip).toHaveCount(0);
    await expect(composer(page)).toBeFocused();
    await expect(dock(page)).toBeVisible();

    await snap("01-new-chat-chord-pressed");

    // Test toggle chord closes dock
    await page.keyboard.press(isOnMac ? "Meta+i" : "Control+Shift+l");

    await expect(dock(page)).toBeHidden();
    await snap("02-toggle-chord-closes-dock");
  });

  test("[REL-POL-SHELL-08] @medium the chords do nothing on the landing route", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(LANDING_PATH);

    // Verify dock doesn't exist on landing page
    await expect(dock(page)).toHaveCount(0);

    const isOnMac = await detectMac(page);

    // Press new-chat chord
    const newChatChord = isOnMac ? "Meta+Shift+o" : "Control+Shift+o";
    await page.keyboard.press(newChatChord);

    // Dock should still not exist
    await expect(dock(page)).toHaveCount(0);
    await snap("01-new-chat-chord-noop");

    // Press toggle chord
    const toggleChord = isOnMac ? "Meta+i" : "Control+Shift+l";
    await page.keyboard.press(toggleChord);

    // Dock should still not exist
    await expect(dock(page)).toHaveCount(0);
    await snap("02-toggle-chord-noop");
  });

  test("[REL-POL-SHELL-09] @high toggle, header and empty state each render the logo test id and the toggle glyph contrasts in light and dark", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);

    // Contrast calculation helper
    const getContrastRatio = async (element: Locator) =>
      element.evaluate((el) => {
        const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const toRgba = (css: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return { r, g, b, a: a / 255 };
        };
        const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
          const [rs, gs, bs] = [r, g, b].map((c) => {
            const v = c / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };
        let background = { r: 255, g: 255, b: 255, a: 1 };
        for (let node: Element | null = el; node; node = node.parentElement) {
          const bg = toRgba(getComputedStyle(node).backgroundColor);
          if (bg.a > 0) {
            background = bg;
            break;
          }
        }
        const glyph = toRgba(getComputedStyle(el).color);
        const l1 = luminance(glyph);
        const l2 = luminance(background);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      });

    const toggleLogo = toggle(page).locator('[data-testid="relay-logo"]');
    const headerLogo = dock(page).locator("header [data-testid='relay-logo']");
    const emptyStateLogo = page.getByTestId("relay-empty").locator('[data-testid="relay-logo"]');
    // Polled: the toggle colour transitions after a theme swap
    const expectContrast = (logo: Locator) =>
      expect.poll(() => getContrastRatio(logo)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);

    for (const theme of ["light", "dark"] as const) {
      // next-themes owns the html class; switch through its storage key and reload
      await page.evaluate((value) => localStorage.setItem("theme", value), theme);
      await page.reload();
      if (theme === "light") {
        await expect(page.locator("html")).not.toHaveClass(/dark/);
      } else {
        await expect(page.locator("html")).toHaveClass(/dark/);
      }

      await expect(toggleLogo).toBeVisible();
      await expectContrast(toggleLogo);
      await snap(`${theme}-toggle-logo`);

      // The dock's open state persists across the reload, so only the first pass opens it
      if (theme === "light") {
        await openRelay(page);
      } else {
        await expect(dock(page)).toBeVisible();
      }
      await expect(headerLogo).toBeVisible();
      await expectContrast(headerLogo);
      await snap(`${theme}-header-logo`);

      await expect(emptyStateLogo).toBeVisible();
      await expectContrast(emptyStateLogo);
      await snap(`${theme}-empty-state-logo`);
    }
  });

  test("[REL-POL-SHELL-10] @medium the shortcuts dialog lists 'New Relay chat' with platform keycaps", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await expect(toggle(page)).toBeVisible();

    // Open shortcuts dialog
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      await page.keyboard.press("ControlOrMeta+Slash");
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Find the "New Relay chat" row by text content
    const newRelayChatRow = dialog.locator("text=/New Relay chat/i").first();
    await expect(newRelayChatRow).toBeVisible();

    // Verify keycaps for the platform in this row
    const isOnMac = await detectMac(page);

    // Keycaps are in the sibling/parent container, find them by navigating the DOM structure
    // The row is a div with label and keycaps, so we need to find kbd elements within the row's parent
    const rowParent = newRelayChatRow.locator('..');
    const kbds = rowParent.locator('kbd');
    const keycapTexts = await kbds.allTextContents();

    if (isOnMac) {
      expect(keycapTexts).toEqual(["⌘", "Shift", "O"]);
    } else {
      expect(keycapTexts).toEqual(["Ctrl", "Shift", "O"]);
    }

    await snap("01-shortcuts-dialog-new-relay-chat");
  });

  test("[REL-POL-SHELL-11] @medium with Relay enabled but a failing dock chunk the toggle still renders and shows an error state instead of crashing", async ({
    seededPage: page,
    snap,
  }) => {
    // Route-abort the Relay dock chunk before navigating
    let chunkAborted = false;
    let chunkUrl = "";
    await page.route("**/_next/static/chunks/*RelayDock*.js", (route) => {
      chunkAborted = true;
      chunkUrl = route.request().url();
      route.abort("aborted");
    });

    await page.goto(WORKSPACE_PATH);

    // Toggle should be visible even before chunk attempt
    await expect(toggle(page)).toBeVisible();

    // Click toggle to attempt opening dock (which will fail to load the chunk)
    await toggle(page).click();

    // The failed chunk must not take the toggle down, and the user is told why
    await expect(page.getByTestId("relay-dock-error")).toBeVisible();
    await expect(toggle(page)).toBeVisible();

    // The error state only appears once the aborted chunk was actually requested
    await expect.poll(() => chunkAborted).toBe(true);
    expect(chunkUrl.length).toBeGreaterThan(0);

    await snap("01-error-state-displayed");
  });
});
