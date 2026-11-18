import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const MIN_SIDEBAR_PX = 240;
const WIDTH_TOLERANCE_PX = 1;
const MAX_TOLERANCE_PX = 2;
const MAX_SIDEBAR_RATIO = 0.5;
const WIDE_VIEWPORT = { width: 1440, height: 900 };
const DRAG_STEPS = 12;
const HUB_SLUG = "qa-v2sb-provider";
const SEEDED_COLLECTION_ID = "qa-v2sb-col";
const SEEDED_REQUEST_NAME = /Seeded long request name number 1 /;
const HUB_PROVIDER_NAME =
  "A Hub provider with an exceptionally long display name for the narrow sidebar";

const desktop = (page: Page) => page.getByTestId("desktop-layout");
const sidebarPanel = (page: Page) =>
  desktop(page).locator('[data-slot="resizable-panel"]').first();

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error("[relay-v2-sidebar] element has no box");
  return result;
}

/** Drags the sidebar resize handle with the mouse until the pointer reaches `targetX`. */
async function dragHandleTo(page: Page, targetX: number) {
  const handle = desktop(page).locator('[data-slot="resizable-handle"][aria-orientation="vertical"]');
  await expect(handle).toBeVisible();
  const handleBox = await box(handle);
  const y = handleBox.y + handleBox.height / 2;
  await page.mouse.move(handleBox.x + handleBox.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(targetX, y, { steps: DRAG_STEPS });
  await page.mouse.up();
}

async function sidebarWidth(page: Page) {
  return (await box(sidebarPanel(page))).width;
}

async function dragFullyLeft(page: Page) {
  await dragHandleTo(page, 0);
  await expect
    .poll(() => sidebarWidth(page))
    .toBeLessThanOrEqual(MIN_SIDEBAR_PX + WIDTH_TOLERANCE_PX);
}

async function mockHub(page: Page) {
  await page.route("**/api/hub", (route) =>
    route.fulfill({ json: { slugs: [HUB_SLUG] } }),
  );
  await page.route(`**/data/hub/${HUB_SLUG}/meta.json`, (route) =>
    route.fulfill({
      json: {
        name: HUB_PROVIDER_NAME,
        providerName: HUB_SLUG,
        description: "Mocked provider used to check footer wrapping.",
        category: "E-commerce",
        logoUrl: "",
        docsUrl: "",
        requestCount: 1234,
      },
    }),
  );
}

/** Opens the seeded collection (closed by default) so its folder and requests render. */
async function expandSeededCollection(page: Page) {
  const trigger = page
    .getByTestId(`collection-item-${SEEDED_COLLECTION_ID}`)
    .getByRole("button")
    .first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByTestId("request-item").filter({ hasText: SEEDED_REQUEST_NAME }),
  ).toBeVisible();
}

async function openSidebarTab(page: Page, name: string | RegExp) {
  await desktop(page).getByRole("tab", { name }).click();
}

/** True when `a` and `b` overlap by more than a sub-pixel sliver. */
function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > 0.5 && overlapY > 0.5;
}

function within(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) {
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}

/**
 * Innermost elements inside `root` (and root itself) that overflow horizontally
 * without an ellipsis. Ancestors are skipped so a single culprit is reported once.
 */
function findOverflowing(root: HTMLElement) {
  const overflows = (node: HTMLElement) =>
    node.scrollWidth > node.clientWidth &&
    getComputedStyle(node).textOverflow !== "ellipsis";
  const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  return all
    .filter(
      (node) =>
        overflows(node) &&
        !Array.from(node.querySelectorAll<HTMLElement>("*")).some(overflows),
    )
    .map(
      (node) =>
        `${node.tagName.toLowerCase()}[${node.getAttribute("data-testid") ?? node.className.toString().slice(0, 60)}] ${node.scrollWidth}>${node.clientWidth} "${(node.textContent ?? "").slice(0, 30)}"`,
    );
}

test.describe("Relay v2 sidebar bounds and truncation @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await mockHub(page);
    await page.goto(WORKSPACE_PATH);
    await expect(
      page.getByTestId(`collection-name-${SEEDED_COLLECTION_ID}`),
    ).toBeVisible();
  });

  // biome-ignore format: e2e/scenarios/relay/check-ids.sh needs the title on the test( line
  test("[REL-V2-SIDEBAR-01] dragging the handle fully left gives a sidebar width of 240 plus or minus 1 px", { tag: "@critical" }, async ({ seededPage: page, snap }) => {
      // Guard against a vacuous pass: the sidebar starts wider than the minimum.
      expect(await sidebarWidth(page)).toBeGreaterThan(
        MIN_SIDEBAR_PX + WIDTH_TOLERANCE_PX,
      );
      await dragFullyLeft(page);
      expect(Math.abs((await sidebarWidth(page)) - MIN_SIDEBAR_PX)).toBeLessThanOrEqual(
        WIDTH_TOLERANCE_PX,
      );
      await snap("01-min-width");
  });

  // biome-ignore format: e2e/scenarios/relay/check-ids.sh needs the title on the test( line
  test("[REL-V2-SIDEBAR-02] at 240 px no tab (Collections, History, Hub) has scrollWidth greater than clientWidth", { tag: "@critical" }, async ({ seededPage: page, snap }) => {
      await dragFullyLeft(page);
      const tabs = [
        { name: "Collections", ready: `collection-name-${SEEDED_COLLECTION_ID}` },
        { name: "History", ready: "history-list" },
        { name: "API Hub", ready: "" },
      ];
      for (const tab of tabs) {
        await openSidebarTab(page, tab.name);
        if (tab.name === "Collections") await expandSeededCollection(page);
        // Base UI keeps the outgoing panel mounted briefly, so pin to the active one.
        const panel = desktop(page).locator(
          '[role="tabpanel"]:not([data-hidden])',
        );
        await expect(panel).toHaveCount(1);
        await expect(panel).toBeVisible();
        if (tab.ready) await expect(page.getByTestId(tab.ready)).toBeVisible();
        else
          await expect(
            panel.getByText(HUB_PROVIDER_NAME),
          ).toBeVisible();
        const offenders = await Promise.all([
          sidebarPanel(page).evaluate(findOverflowing),
          panel.evaluate(findOverflowing),
        ]);
        expect.soft(offenders.flat(), `${tab.name} overflows`).toEqual([]);
        await snap(`02-${tab.name.toLowerCase().replace(" ", "-")}`);
      }
  });

  // biome-ignore format: e2e/scenarios/relay/check-ids.sh needs the title on the test( line
  test("[REL-V2-SIDEBAR-03] at a 1440 px viewport dragging fully right puts the sidebar within 2 px of 50% of the layout width and the URL bar is still visible", { tag: "@critical" }, async ({ seededPage: page, snap }) => {
      await page.setViewportSize(WIDE_VIEWPORT);
      await expandSeededCollection(page);
      await page
        .getByTestId("request-item")
        .filter({ hasText: SEEDED_REQUEST_NAME })
        .click();
      const urlInput = page.getByTestId("url-input").first();
      await expect(urlInput).toBeVisible();

      await dragHandleTo(page, WIDE_VIEWPORT.width - 1);
      const layoutWidth = (await box(desktop(page))).width;
      const expected = layoutWidth * MAX_SIDEBAR_RATIO;
      await expect
        .poll(async () => Math.abs((await sidebarWidth(page)) - expected))
        .toBeLessThanOrEqual(MAX_TOLERANCE_PX);
      await expect(urlInput).toBeVisible();
      const urlBox = await box(urlInput);
      expect(urlBox.width).toBeGreaterThan(0);
      expect(urlBox.x + urlBox.width).toBeLessThanOrEqual(WIDE_VIEWPORT.width);
      await snap("03-max-width");
  });

  // biome-ignore format: e2e/scenarios/relay/check-ids.sh needs the title on the test( line
  test("[REL-V2-SIDEBAR-04] at 240 px seeded long names and URLs truncate with an ellipsis in Collections and History", { tag: "@high" }, async ({ seededPage: page, snap }) => {
      await dragFullyLeft(page);
      await expandSeededCollection(page);

      const collectionName = page.getByTestId(
        `collection-name-${SEEDED_COLLECTION_ID}`,
      );
      const requestName = page
        .getByTestId("request-item")
        .filter({ hasText: SEEDED_REQUEST_NAME })
        .locator("span.truncate");
      const folderName = page
        .getByTestId("folder-item-qa-v2sb-folder")
        .locator("span.truncate");
      for (const cell of [collectionName, requestName, folderName]) {
        await expect(cell).toBeVisible();
        const metrics = await cell.evaluate((el) => ({
          overflowing: el.scrollWidth > el.clientWidth,
          ellipsis: getComputedStyle(el).textOverflow === "ellipsis",
        }));
        expect.soft(metrics, String(await cell.textContent())).toEqual({
          overflowing: true,
          ellipsis: true,
        });
      }

      await openSidebarTab(page, "History");
      const url = page.getByTestId("history-item-url").first();
      await expect(url).toBeVisible();
      const metrics = await url.evaluate((el) => ({
        overflowing: el.scrollWidth > el.clientWidth,
        ellipsis: getComputedStyle(el).textOverflow === "ellipsis",
        hasFullUrl: el.textContent?.includes("?filter=") ?? false,
      }));
      // The full URL stays in the DOM: truncation is CSS, not a JS slice.
      expect(metrics).toEqual({
        overflowing: true,
        ellipsis: true,
        hasFullUrl: true,
      });
      await snap("04-truncation");
  });

  // biome-ignore format: e2e/scenarios/relay/check-ids.sh needs the title on the test( line
  test("[REL-V2-SIDEBAR-05] at 240 px method badges and action buttons are fully visible and their bounding boxes do not intersect", { tag: "@high" }, async ({ seededPage: page, snap }) => {
      await dragFullyLeft(page);

      // Collections: badge, name, more button.
      await expandSeededCollection(page);
      const requestRow = page
        .getByTestId("request-item")
        .filter({ hasText: SEEDED_REQUEST_NAME });
      await requestRow.hover();
      const more = requestRow.getByTestId("request-item-more-btn");
      await expect(more).toBeVisible();
      const badge = requestRow.getByText("GET", { exact: true });
      await expect(badge).toBeVisible();
      // Poll: the accordion and hover transitions are still settling when first measured.
      await expect(async () => {
        const [rowBox, badgeBox, nameBox, moreBox] = await Promise.all([
          box(requestRow),
          box(badge),
          box(requestRow.locator("span.truncate")),
          box(more),
        ]);
        for (const part of [badgeBox, nameBox, moreBox]) {
          expect(within(part, rowBox)).toBe(true);
        }
        expect(intersects(badgeBox, nameBox)).toBe(false);
        expect(intersects(nameBox, moreBox)).toBe(false);
        expect(intersects(badgeBox, moreBox)).toBe(false);
      }).toPass();

      // History: badge, status badge, delete button.
      await openSidebarTab(page, "History");
      const item = page.getByTestId("history-item").first();
      await expect(item).toBeVisible();
      await item.hover();
      const del = page.getByTestId("history-item-delete").first();
      await expect(del).toBeVisible();
      const status = item.getByTestId("history-item-status");
      await expect(status).toBeVisible();
      const methodBadge = item.getByText(/^(GET|POST|DELETE)$/);
      await expect(methodBadge).toBeVisible();
      await expect(async () => {
        const [hRow, hBadge, hUrl, hStatus, hDel] = await Promise.all([
          // The delete button is a sibling of the clickable item, so the row is its parent.
          box(item.locator("xpath=..")),
          box(methodBadge),
          box(item.getByTestId("history-item-url")),
          box(status),
          box(del),
        ]);
        for (const part of [hBadge, hUrl, hStatus, hDel]) {
          expect(within(part, hRow)).toBe(true);
        }
        expect(intersects(hBadge, hUrl)).toBe(false);
        expect(intersects(hUrl, hStatus)).toBe(false);
        expect(intersects(hBadge, hStatus)).toBe(false);
        expect(intersects(hStatus, hDel)).toBe(false);
        expect(intersects(hUrl, hDel)).toBe(false);
      }).toPass();
      await snap("05-no-collisions");
  });

  // biome-ignore format: e2e/scenarios/relay/check-ids.sh needs the title on the test( line
  test("[REL-V2-SIDEBAR-06] at 240 px the Hub card footer buttons wrap and stay visible", { tag: "@medium" }, async ({ seededPage: page, snap }) => {
      await dragFullyLeft(page);
      await openSidebarTab(page, "API Hub");
      const importButton = page.getByRole("button", { name: /^Import/ });
      await expect(importButton).toBeVisible();
      const card = page
        .getByTestId("desktop-layout")
        .getByRole("tabpanel")
        .getByText(HUB_PROVIDER_NAME)
        .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
      const [cardBox, buttonBox, sidebarBox] = await Promise.all([
        box(card),
        box(importButton),
        box(sidebarPanel(page)),
      ]);
      expect(within(buttonBox, cardBox)).toBe(true);
      expect(within(buttonBox, sidebarBox)).toBe(true);
      const footerOverflow = await card.evaluate(findOverflowing);
      expect(footerOverflow).toEqual([]);
      await snap("06-hub-footer");
  });
});
