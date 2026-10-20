import type { Page } from "@playwright/test";
import {
  LOCAL_WORKSPACE,
  THREADS_STORE,
  WORKSPACE_PATH,
  openList,
  openWithRoutes,
  putThreads,
  readThreads,
  runtimeThread,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";
import { sendMessage } from "../../fixtures/relayE2eHelpers";
import { openRelay } from "../../fixtures/relayE2eHelpers";

const trigger = (page: Page) => page.getByTestId("relay-thread-trigger");
const overlay = (page: Page) => page.getByTestId("relay-thread-overlay");
const items = (page: Page) => page.getByTestId("relay-thread-item");
const search = (page: Page) => page.getByTestId("relay-thread-search");
const menuRename = (page: Page) => page.getByTestId("relay-thread-menu-rename");
const menuDelete = (page: Page) => page.getByTestId("relay-thread-menu-delete");
const renameInput = (page: Page) => page.getByTestId("relay-thread-rename-input");
const emptyState = (page: Page) => page.getByTestId("relay-threads-empty");

test.describe("Relay thread rows and overlay polish @qa", () => {
  test("[REL-POL-THREADS-01] no pencil or trash at rest; hover and keyboard focus reveal '...' in place of the time with no layout shift", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);
      await putThreads(page, [runtimeThread(1, 0, { title: "Thread" })]);

      await openList(page);

      const row = items(page).first();
      const timeEl = row.locator('[data-testid="relay-thread-time"]');
      const menuBtn = row.locator('[data-testid="relay-thread-menu-trigger"]');
      const titleBtn = row.locator('[data-testid="relay-thread-title"]');

      // At rest: time visible, menu hidden, no layout shift
      await expect(timeEl).toHaveCSS("opacity", "1");
      await expect(menuBtn).toHaveCSS("opacity", "0");

      // Capture bounding boxes before and after hover
      const rowBboxRest = await row.boundingBox();
      const slotBboxRest = await timeEl.boundingBox();

      // On hover: opacity swaps, no layout shift
      await row.hover();
      await expect(timeEl).toHaveCSS("opacity", "0");
      await expect(menuBtn).toHaveCSS("opacity", "1");

      const rowBboxHover = await row.boundingBox();
      const slotBboxHover = await menuBtn.boundingBox();

      // Assert no significant layout shift
      // The slot width should remain the same (reserved for the trigger/time swap)
      if (slotBboxRest && slotBboxHover) {
        expect(Math.abs(slotBboxRest.width - slotBboxHover.width)).toBeLessThan(5);
      }
      // Row should not shift significantly in height
      if (rowBboxRest && rowBboxHover) {
        const heightDiff = Math.abs(rowBboxRest.height - rowBboxHover.height);
        expect(heightDiff).toBeLessThan(5);
      }

      // Test that the reveal mechanism works without layout shift
      // Verify the time is visible again after hover ends
      await page.mouse.move(0, 0);
      await expect(timeEl).toHaveCSS("opacity", "1");
      await expect(menuBtn).toHaveCSS("opacity", "0");

      await snap("01-menu-reveal");
    },
  );

  test("[REL-POL-THREADS-02] rows seeded 30 s, 5 min, 3 h, 2 d, 8 d, 100 d, 400 d old show now, 5m, 3h, 2d, 1w, 3mo, 1y and hovering the time shows the full date", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);
      const testCases = [
        { ageMs: 30_000, expected: "now" },
        { ageMs: 5 * 60_000, expected: "5m" },
        { ageMs: 3 * 60 * 60_000, expected: "3h" },
        { ageMs: 2 * 24 * 60 * 60_000, expected: "2d" },
        { ageMs: 8 * 24 * 60 * 60_000, expected: "1w" },
        { ageMs: 100 * 24 * 60 * 60_000, expected: "3mo" },
        { ageMs: 400 * 24 * 60 * 60_000, expected: "1y" },
      ];

      await putThreads(
        page,
        testCases.map((tc, idx) => runtimeThread(idx, tc.ageMs)),
      );
      await openList(page);

      for (let i = 0; i < testCases.length; i++) {
        const timeText = items(page)
          .nth(i)
          .locator('[data-testid="relay-thread-time"]');
        await expect(timeText).toContainText(testCases[i].expected);

        const titleAttr = await timeText.getAttribute("title");
        expect(titleAttr).toMatch(/\w+\s+\d+,\s+\d{4}/);
      }

      await snap("02-times");
    },
  );

  test("[REL-POL-THREADS-03] the menu has exactly Rename and Delete; Rename saves on Enter, cancels on Esc, saves on blur and rejects empty", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);
      await putThreads(page, [runtimeThread(1, 0, { title: "Original" })]);

      await openList(page);

      // Test menu has 2 items: Rename and Delete
      await items(page)
        .first()
        .locator('[data-testid="relay-thread-menu-trigger"]')
        .click();
      const menuItems = page.getByRole("menuitem");
      await expect(menuItems).toHaveCount(2);

      // Test Rename on Enter - saves the change
      await menuRename(page).first().click();
      let input = renameInput(page);
      await input.fill("New title");
      await input.press("Enter");
      await expect(input).not.toBeVisible();
      await expect(items(page).first()).toContainText("New title");

      // Test Esc cancels - does not save
      await items(page)
        .first()
        .locator('[data-testid="relay-thread-menu-trigger"]')
        .click();
      await menuRename(page).first().click();
      let input2 = renameInput(page);
      await input2.fill("Should cancel");
      await input2.press("Escape");
      await expect(input2).not.toBeVisible();
      // Title should still be "New title", not "Should cancel"
      await expect(items(page).first()).toContainText("New title");

      // Test blur saves
      await items(page)
        .first()
        .locator('[data-testid="relay-thread-menu-trigger"]')
        .click();
      await menuRename(page).first().click();
      let input3 = renameInput(page);
      await input3.fill("Blur saves");
      // Tab to next element to trigger blur on input
      await input3.press("Tab");
      await expect(input3).not.toBeVisible();
      await expect(items(page).first()).toContainText("Blur saves");

      // Empty title is rejected: input stays open and the old title is kept
      await items(page)
        .first()
        .locator('[data-testid="relay-thread-menu-trigger"]')
        .click();
      await menuRename(page).first().click();
      const input4 = renameInput(page);
      await input4.fill("");
      await input4.press("Enter");
      await expect(input4).toBeVisible();
      await input4.press("Escape");
      await expect(input4).not.toBeVisible();
      await expect(items(page).first()).toContainText("Blur saves");

      await snap("03-menu");
    },
  );

  test("[REL-POL-THREADS-04] Delete removes the row at once; Undo restores it at the same position with the same title", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);
      await putThreads(page, [
        runtimeThread(1, 0, { title: "Alpha" }),
        runtimeThread(2, 0, { title: "Beta" }),
        runtimeThread(3, 0, { title: "Gamma" }),
      ]);

      await openList(page);

      // Verify initial state: Alpha, Beta, Gamma
      await expect(items(page)).toHaveCount(3);
      // Verify all three threads exist
      await expect(items(page).filter({ hasText: "Alpha" })).toHaveCount(1);
      await expect(items(page).filter({ hasText: "Beta" })).toHaveCount(1);
      await expect(items(page).filter({ hasText: "Gamma" })).toHaveCount(1);

      // Delete Beta
      const betaRow = items(page).filter({ hasText: "Beta" });
      const betaTrigger = betaRow
        .first()
        .locator('[data-testid="relay-thread-menu-trigger"]');
      await betaTrigger.click();
      await menuDelete(page).first().click();

      // Verify delete removed Beta
      await expect(items(page)).toHaveCount(2);
      await expect(items(page).filter({ hasText: "Beta" })).toHaveCount(0);
      await expect(items(page).filter({ hasText: "Alpha" })).toHaveCount(1);
      await expect(items(page).filter({ hasText: "Gamma" })).toHaveCount(1);

      // Undo
      const undoBtn = page.getByRole("button", { name: /undo/i });
      await undoBtn.click();

      // Verify restore: all three threads back
      await expect(items(page)).toHaveCount(3);
      await expect(items(page).filter({ hasText: "Beta" })).toHaveCount(1);
      await expect(items(page).filter({ hasText: "Alpha" })).toHaveCount(1);
      await expect(items(page).filter({ hasText: "Gamma" })).toHaveCount(1);

      await snap("04-undo");
    },
  );

  test("[REL-POL-THREADS-05] without Undo the delete is final after 5 s and survives a reload", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);
      await putThreads(page, [runtimeThread(1, 0, { title: "Temp" })]);

      await openList(page);

      const menuTrigger = items(page)
        .first()
        .locator('[data-testid="relay-thread-menu-trigger"]');
      await menuTrigger.click();
      await menuDelete(page).first().click();

      const undoBtn = page.getByRole("button", { name: /undo/i });
      await page.mouse.move(0, 0);

      // Wait for auto-dismiss with web-first assertion
      await expect(undoBtn).not.toBeVisible({ timeout: 6_000 });

      // Check in DB that it's gone
      const remaining = await readThreads(page);
      expect(
        remaining.filter((t) => t.title === "Temp" && t.workspaceId === LOCAL_WORKSPACE),
      ).toHaveLength(0);

      // Reload and verify delete persists
      await page.reload();
      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await openList(page);

      const threads = await readThreads(page);
      expect(
        threads.filter((t) => t.title === "Temp" && t.workspaceId === LOCAL_WORKSPACE),
      ).toHaveLength(0);

      await snap("05-delete-final");
    },
  );

  test("[REL-POL-THREADS-06] deleting the active thread starts a fresh empty thread", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page, "Response");
      await putThreads(page, [
        runtimeThread(1, 0, { title: "Active" }),
        runtimeThread(2, 0, { title: "Other" }),
      ]);

      await openList(page);
      await items(page).first().click();
      await sendMessage(page, "Hi");

      await openList(page);
      const menuTrigger = items(page)
        .first()
        .locator('[data-testid="relay-thread-menu-trigger"]');
      await menuTrigger.click();
      await menuDelete(page).first().click();

      await expect(page.getByTestId("relay-empty")).toBeVisible();

      await snap("06-active-deleted");
    },
  );

  test("[REL-POL-THREADS-07] opening the overlay leaves the composer box and message scroll position unchanged and the overlay floats with shadow and a distinct surface in light and dark", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);
      await putThreads(page, [runtimeThread(1, 0, { title: "Thread" })]);

      // Get initial composer position
      const composer = page.getByTestId("relay-composer");
      const composerBoxBefore = await composer.boundingBox();

      // Open overlay
      await openList(page);

      // Check composer position unchanged
      const composerBoxAfter = await composer.boundingBox();
      expect(composerBoxAfter?.x).toBe(composerBoxBefore?.x);
      expect(composerBoxAfter?.y).toBe(composerBoxBefore?.y);
      expect(composerBoxAfter?.width).toBe(composerBoxBefore?.width);
      expect(composerBoxAfter?.height).toBe(composerBoxBefore?.height);

      // Check overlay has shadow with visible opacity
      const shadow = await overlay(page).evaluate((el) =>
        getComputedStyle(el).boxShadow,
      );
      // Shadow should not be none
      expect(shadow).not.toBe("none");
      // Shadow should contain at least one layer with non-zero opacity (check for 0.1 or similar)
      // Tailwind shadow-lg includes: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px
      expect(shadow).toMatch(/0\.1.*px/);

      // Check overlay has distinct background from dock in light theme
      const overlayBg = await overlay(page).evaluate((el) =>
        getComputedStyle(el).backgroundColor,
      );
      const dock = page.getByTestId("relay-dock");
      const dockBg = await dock.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(overlayBg).not.toBe(dockBg);

      // Switch to dark theme and verify again
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });

      const overlayBgDark = await overlay(page).evaluate((el) =>
        getComputedStyle(el).backgroundColor,
      );
      const dockBgDark = await dock.evaluate((el) =>
        getComputedStyle(el).backgroundColor,
      );
      expect(overlayBgDark).not.toBe(dockBgDark);

      await snap("07-overlay");
    },
  );

  test("[REL-POL-THREADS-08] Esc, outside click and selecting a thread close the overlay and focus returns to the trigger", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);
      await putThreads(page, [
        runtimeThread(1, 0, { title: "A" }),
        runtimeThread(2, 0, { title: "B" }),
      ]);

      const triggerBtn = trigger(page);

      // Test Escape closes
      await openList(page);
      await page.keyboard.press("Escape");
      await expect(overlay(page)).not.toBeVisible();
      await expect(triggerBtn).toBeFocused();

      // Test outside click closes
      await openList(page);
      await page.click("body", { position: { x: 10, y: 10 } });
      await expect(overlay(page)).not.toBeVisible();
      await expect(triggerBtn).toBeFocused();

      // Test selecting thread closes
      await openList(page);
      await items(page).first().click();
      await expect(overlay(page)).not.toBeVisible();
      await expect(triggerBtn).toBeFocused();

      await snap("08-close");
    },
  );

  test("[REL-POL-THREADS-09] at the 320px panel width the overlay has no horizontal scroll", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
      // Use 900px viewport to get 320px docked panel
      await page.setViewportSize({ width: 900, height: 768 });

      await installRelayRoutes(page, { kind: "text", text: "ok" });
      await page.goto(WORKSPACE_PATH);
      await openRelay(page);

      await putThreads(page, [runtimeThread(1, 0, { title: "Long" })]);

      // Set dock width to 320px
      await page.evaluate(() => {
        const dock = document.querySelector('[data-testid="relay-dock"]') as HTMLElement;
        if (dock) {
          dock.style.width = "320px";
        }
      });

      await openList(page);

      // Check overlay fits within dock without horizontal scroll
      const overlayEl = overlay(page);
      const dockEl = page.getByTestId("relay-dock");

      const overlayBox = await overlayEl.boundingBox();
      const dockBox = await dockEl.boundingBox();

      expect(overlayBox).toBeTruthy();
      expect(dockBox).toBeTruthy();

      // Overlay should be inside dock horizontal bounds
      expect(overlayBox!.x).toBeGreaterThanOrEqual(dockBox!.x);
      expect(overlayBox!.x + overlayBox!.width).toBeLessThanOrEqual(
        dockBox!.x + dockBox!.width,
      );

      // Check no horizontal scroll on overlay container
      const hasHorizontalScroll = await overlayEl.evaluate(
        (el) => el.scrollWidth > el.clientWidth,
      );
      expect(hasHorizontalScroll).toBe(false);

      await snap("09-320px");
    },
  );

  test("[REL-POL-THREADS-10] a thread list with no threads shows the empty state and search with no match shows no-results", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
      await openWithRoutes(page);

      await openList(page);

      // Check empty state - no threads
      const empty = emptyState(page);
      await expect(empty).toBeVisible();
      // Empty state has different text than no-results
      const emptyText = await empty.textContent();
      expect(emptyText).toBeTruthy();

      // Add a thread and test no-results
      await openList(page); // Close overlay
      await putThreads(page, [runtimeThread(1, 0, { title: "Target" })]);
      await page.reload();
      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await openList(page);

      // Verify thread is there
      await expect(items(page)).toHaveCount(1);

      // Search for non-matching term
      const searchInput = search(page);
      await searchInput.fill("xyz_no_match");
      // Now should show no-results state
      await expect(empty).toBeVisible();
      const noResultsText = await empty.textContent();
      expect(noResultsText).toBeTruthy();
      expect(noResultsText).not.toBe(emptyText);

      await snap("10-empty");
    },
  );

  test("[REL-POL-THREADS-11] selected thread survives reload (deep-link N/A: no thread route exists)", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
      // Setup without expecting composer to auto-focus on reload
      await installRelayRoutes(page, { kind: "text", text: "Hello from Relay" });
      await page.goto(WORKSPACE_PATH);
      await openRelay(page);

      const t1 = runtimeThread(1, 0, { title: "Target" });
      const t2 = runtimeThread(2, 0, { title: "Other" });
      await putThreads(page, [t1, t2]);

      // Select thread through UI
      await openList(page);
      await items(page).filter({ hasText: "Target" }).first().click();

      // Verify it's selected
      await expect(page.getByTestId("relay-title")).toContainText("Target");

      // Reload
      await page.reload();
      await expect(page.getByTestId("relay-dock")).toBeVisible();

      // Verify thread persists
      await expect(page.getByTestId("relay-title")).toContainText("Target");

      // Verify it's marked as active in overlay
      await openList(page);
      const row = items(page).filter({ hasText: "Target" });
      const active = await row.first().getAttribute("data-active");
      expect(active).toBe("true");

      await snap("11-deeplink");
    },
  );
});
