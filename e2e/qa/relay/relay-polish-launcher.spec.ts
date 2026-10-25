import type { Page } from "@playwright/test";
import {
  dragDockToWidth,
  expectDockWidth,
  openLauncher,
  openRelay,
  sendMessage,
  WORKSPACE_PATH,
} from "../../fixtures/relayE2eHelpers";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const COMPOSER_BOX = "relay-composer-box";
const LAUNCHER_TRIGGER = "relay-picker-trigger";
const LAUNCHER = "relay-launcher";
const LAUNCHER_SEARCH = "relay-launcher-search";
const LAUNCHER_SECTION_RECENT = "relay-launcher-section-recent";
const LAUNCHER_SECTION_ATTACH = "relay-launcher-section-attach";
const LAUNCHER_SECTION_ACTIONS = "relay-launcher-section-actions";
const LAUNCHER_ROW = "relay-launcher-row";
const LAUNCHER_EMPTY = "relay-launcher-empty";
const LAUNCHER_BACK = "relay-launcher-back";
const NARROW_DOCK_WIDTH_PX = 320;
const COMPOSER = "relay-composer";
const COMPOSER_PILL = "relay-composer-pill";
const REQUEST_A = "Request A";
const RECENT_STORAGE_KEY = "rq_relay_recent";
const SEEDED_RECENT = { kind: "request", id: "seeded-recent", name: "Seeded Recent" };

const launcher = (page: Page) => page.getByTestId(LAUNCHER);
const launcherSearch = (page: Page) => page.getByTestId(LAUNCHER_SEARCH);
const launcherTrigger = (page: Page) => page.getByTestId(LAUNCHER_TRIGGER);
const launcherRows = (page: Page) => page.getByTestId(LAUNCHER_ROW);
const composer = (page: Page) => page.getByTestId(COMPOSER);
const pills = (page: Page) => page.getByTestId(COMPOSER_PILL);

async function expectLauncherClosed(page: Page): Promise<void> {
  await expect(launcher(page)).toBeHidden();
}

async function openWithRoutes(
  page: Page,
  ...args: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R
    : never
) {
  const routes = await installRelayRoutes(page, ...args);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

test.describe("Relay Polish: Launcher @qa", () => {
  test("[REL-POL-LAUNCHER-01] clicking + opens a box-wide panel above the composer with Recent, Attach and Actions in that relative order @critical", async ({
    seededPage: page,
    snap,
  }) => {
    // Seed Recent so all three sections are always present and ordered.
    await page.addInitScript(
      ([key, item]) => localStorage.setItem(key, JSON.stringify([item])),
      [RECENT_STORAGE_KEY, SEEDED_RECENT] as const,
    );
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    // Verify the launcher appears and is above the composer
    await expect(launcher(page)).toBeVisible();
    const composerBox = await page.getByTestId(COMPOSER_BOX).boundingBox();
    const launcherBox = await launcher(page).boundingBox();
    expect(composerBox).toBeTruthy();
    expect(launcherBox).toBeTruthy();
    // Panel is box-wide (same width as composer box)
    expect(Math.abs(launcherBox!.width - composerBox!.width)).toBeLessThan(8);
    // Panel is above the composer (panel bottom <= composer top)
    expect(launcherBox!.y + launcherBox!.height).toBeLessThanOrEqual(composerBox!.y);

    // Sections render top to bottom: Recent, Attach, Actions.
    const [recentBox, attachBox, actionsBox] = await Promise.all(
      [LAUNCHER_SECTION_RECENT, LAUNCHER_SECTION_ATTACH, LAUNCHER_SECTION_ACTIONS].map(
        async (id) => {
          const section = page.getByTestId(id);
          await expect(section).toBeVisible();
          return section.boundingBox();
        },
      ),
    );
    expect(recentBox).toBeTruthy();
    expect(attachBox).toBeTruthy();
    expect(actionsBox).toBeTruthy();
    expect(recentBox!.y).toBeLessThan(attachBox!.y);
    expect(attachBox!.y).toBeLessThan(actionsBox!.y);

    await snap("01-launcher-open");
  });

  test("[REL-POL-LAUNCHER-02] typing \"run\" filters to matching rows across sections @critical", async ({
    seededPage: page,
    snap,
  }) => {
    // Seed a recent containing "run" to ensure we match across sections
    const runRecent = { kind: "request", id: "seeded-run-recent", name: "Run report" };
    await page.addInitScript(
      ([key, item]) => localStorage.setItem(key, JSON.stringify([item])),
      [RECENT_STORAGE_KEY, runRecent] as const,
    );
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    // Type "run" to filter
    await launcherSearch(page).fill("run");

    // Wait for matching rows to appear
    const runMatchRow = launcherRows(page).filter({ hasText: /run/i }).first();
    await expect(runMatchRow).toBeVisible();

    // Verify filtered rows contain "run" (case-insensitive)
    const visibleRows = await launcherRows(page).all();
    for (const row of visibleRows) {
      const text = await row.textContent();
      expect(text?.toLowerCase()).toContain("run");
    }

    // Verify there are matches across at least 2 different sections (Recent and Actions)
    const sections = new Set<string>();
    for (const row of visibleRows) {
      const dataSection = await row.getAttribute("data-section");
      if (dataSection) sections.add(dataSection);
    }
    expect(sections.size).toBeGreaterThanOrEqual(2);

    await snap("02-filter-run");
  });

  test("[REL-POL-LAUNCHER-03] Enter on Request shows a request search list; selecting one attaches a pill @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    // The keyboard-highlighted row is the one Enter activates.
    const requestRow = launcherRows(page)
      .filter({ has: page.getByText(/^Request$/) })
      .first();
    await expect(launcherSearch(page)).toBeFocused();
    await expect(requestRow).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("Enter");

    // Verify we are in the list view (Request picker)
    await expect(launcher(page)).toHaveAttribute("data-view", "list");
    await expect(page.getByTestId(LAUNCHER_BACK)).toBeVisible();

    // Wait for at least one mention option (request) to appear in the list
    await expect(page.getByTestId("relay-mention-option").first()).toBeVisible();

    // Focus the search field and navigate to the first request
    await launcherSearch(page).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Verify launcher closed and a pill was attached with data-kind="request"
    await expectLauncherClosed(page);
    await expect(pills(page)).toHaveCount(1);
    await expect(pills(page).first()).toHaveAttribute("data-kind", "request");

    await snap("03-request-attached");
  });

  test("[REL-POL-LAUNCHER-04] Current tab attaches a pill and closes the panel @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "OK" });
    await openSavedRequest(page, REQUEST_A);

    // Open launcher and select Current tab
    await openLauncher(page);
    const currentTabRow = launcherRows(page)
      .filter({ has: page.getByText(/Current tab/) })
      .first();
    await currentTabRow.click();

    // Verify launcher closed and a pill was attached with the tab name
    await expectLauncherClosed(page);
    await expect(pills(page)).toHaveCount(1);
    await expect(pills(page).first()).toContainText(REQUEST_A);
    await expect(pills(page).first()).toHaveAttribute("data-kind", "tab");

    await snap("04-current-tab-attached");
  });

  test("[REL-POL-LAUNCHER-05] Esc closes the panel and focus returns to + @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);
    await expect(launcher(page)).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expectLauncherClosed(page);

    // Verify focus is back on the trigger
    await expect(launcherTrigger(page)).toBeFocused();

    await snap("05-esc-closes");
  });

  test("[REL-POL-LAUNCHER-06] a search with no match shows \"No results\" @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    // Type text that matches nothing
    await launcherSearch(page).fill("xyzno-match-xyz");

    // Verify no-results message appears
    await expect(page.getByTestId(LAUNCHER_EMPTY)).toBeVisible();
    await expect(page.getByTestId(LAUNCHER_EMPTY)).toContainText(/no results/i);

    await snap("06-no-results");
  });

  test("[REL-POL-LAUNCHER-07] Paste cURL puts \"/import \" in the composer and focuses it @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    // Find and click Paste cURL in the Attach section
    const pasteCurlRow = launcherRows(page)
      .filter({ has: page.getByText(/Paste cURL|paste/) })
      .first();
    await pasteCurlRow.click();

    // Verify launcher closed and composer contains "/import "
    await expectLauncherClosed(page);
    await expect(composer(page)).toHaveValue(/^\/import /);
    await expect(composer(page)).toBeFocused();

    await snap("07-paste-curl");
  });

  test("[REL-POL-LAUNCHER-08] an attached item appears under Recent after a reload and re-attaches on select @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    // Attach a request from the Request list using keyboard navigation
    const requestRow = launcherRows(page)
      .filter({ has: page.getByText(/^Request$/) })
      .first();
    await requestRow.click();

    // Wait for list to open
    await expect(launcher(page)).toHaveAttribute("data-view", "list");
    // Wait for at least one mention option (request) to be visible in the list
    await expect(page.getByTestId("relay-mention-option").first()).toBeVisible();

    // Use arrow down to navigate and select the first request
    await launcherSearch(page).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expectLauncherClosed(page);

    // Get the attached pill name
    const pillName = await pills(page).first().textContent();

    // Reload the page
    await page.reload();
    await expect(composer(page)).toBeVisible();

    // Open launcher and verify the recently attached item appears in Recent
    await openLauncher(page);
    const recentSection = page.getByTestId(LAUNCHER_SECTION_RECENT);
    await expect(recentSection).toBeVisible();
    const recentRow = recentSection
      .getByTestId(LAUNCHER_ROW)
      .filter({ hasText: pillName! })
      .first();
    await expect(recentRow).toBeVisible();

    // Click the recent item to re-attach it
    await recentRow.click();
    await expectLauncherClosed(page);
    await expect(pills(page)).toHaveCount(1);

    await snap("08-recent-persistence");
  });

  test("[REL-POL-LAUNCHER-09] at the 320px panel width nothing is clipped and there is no horizontal scroll @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await openWithRoutes(page, { kind: "text", text: "init" });
    await dragDockToWidth(page, NARROW_DOCK_WIDTH_PX);

    await openLauncher(page);
    await expect(launcher(page)).toBeVisible();
    await expectDockWidth(page, NARROW_DOCK_WIDTH_PX);

    const rows = launcherRows(page);
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let index = 0; index < rowCount; index++) {
      const row = rows.nth(index);
      await expect(row).toBeVisible();
      // Long labels truncate by design; the row itself must not overflow its panel.
      const clipped = await row.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `row ${index} overflows horizontally`).toBe(false);
    }

    const { scrollWidth, clientWidth } = await launcher(page).evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await snap("09-narrow-320px");
  });

  test("[REL-POL-LAUNCHER-10] opening, typing and selecting produce zero /api/relay/* or other-host requests @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    const blocked: string[] = [];
    const appOrigin = new URL(page.url()).origin;
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (
        url.pathname.startsWith("/api/relay/") ||
        url.origin !== appOrigin
      ) {
        blocked.push(req.url());
      }
    });

    await openRelay(page);
    await openLauncher(page);

    // Type to filter - just typing doesn't make network calls
    await launcherSearch(page).fill("request");
    // Wait for at least one matching row to be visible
    await expect(launcherRows(page).filter({ hasText: /request/i }).first()).toBeVisible();

    // Click on the Request attach row to open the list
    const attachSection = page.getByTestId(LAUNCHER_SECTION_ATTACH);
    const requestAttachRow = attachSection
      .getByTestId(LAUNCHER_ROW)
      .filter({ has: page.getByText(/^Request$/) })
      .first();
    await expect(requestAttachRow).toBeVisible();
    await requestAttachRow.click();

    // Launcher is now in list view; wait for a mention option to be visible
    await expect(launcher(page)).toHaveAttribute("data-view", "list");
    // The first mention option should be auto-selected, so just focus the search and press ArrowDown then Enter
    await launcherSearch(page).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expectLauncherClosed(page);
    await expect(pills(page)).toHaveCount(1);

    // Verify no network requests were made until Send
    expect(blocked).toHaveLength(0);
    await snap("10-no-network-before-send");

    // Send a message to verify network calls happen after Send
    await sendMessage(page, "describe");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
    expect(blocked.some((u) => u.includes("/api/relay/chat"))).toBe(true);
    await snap("10-after-send");
  });
});
