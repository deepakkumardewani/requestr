import type { Locator, Page } from "@playwright/test";
import { HTTP_METHODS } from "../../../src/lib/constants";
import { expect, test } from "../../fixtures/qa";
import { openTab } from "../../fixtures/qaHelpers";

const WORKSPACE_PATH = "/app";
const SEEDED_ENV_NAME = "QA Environment";
const NO_ENV_LABEL = "No Environment";
const MIN_HIT_TARGET_PX = 28;
const ZOOM_100 = "1";
const ZOOM_125 = "1.25";
const NESTED_COLLECTION_ID = "qa-pk-nested";
const FOLDER_ID = "qa-pk-f-a";
const SUBFOLDER_ID = "qa-pk-f-a1";
const SIDEBAR_SECTION = /^collections$/i;

const desktop = (page: Page) => page.getByTestId("desktop-layout");
const iconOf = (scope: Locator, name: string) =>
  scope.locator(`svg.lucide-${name}`);

async function expectDisclosure(trigger: Locator, open: boolean) {
  await expect(trigger).toHaveAttribute("aria-expanded", String(open));
  await expect(iconOf(trigger, "chevron-right")).toBeVisible({
    visible: !open,
  });
  await expect(iconOf(trigger, "chevron-down")).toBeVisible({ visible: open });
}

async function setZoom(page: Page, zoom: string) {
  await page.evaluate((value) => {
    document.documentElement.style.zoom = value;
  }, zoom);
}

type MenuMetrics = {
  badgeOverflow: boolean;
  badgeText: string;
  intersectsCheck: boolean;
};

/** Measures every method badge in the open menu against the selected item's check mark. */
async function measureMethodMenu(page: Page): Promise<MenuMetrics[]> {
  const items = page.locator('[data-slot="select-item"]');
  await expect(items).toHaveCount(HTTP_METHODS.length);
  // Guards against a vacuous intersection check: exactly one check mark must be present.
  await expect(items.locator("svg.lucide-check")).toHaveCount(1);
  return items.evaluateAll((nodes) => {
    const check = document.querySelector(
      '[data-slot="select-item"] svg.lucide-check',
    );
    const checkBox = check?.getBoundingClientRect();
    return nodes.map((node) => {
      // The badge is the only leaf span carrying the method text.
      const badge = Array.from(node.querySelectorAll("span")).find(
        (span) => span.children.length === 0 && !!span.textContent,
      ) as HTMLElement;
      const box = badge.getBoundingClientRect();
      const intersectsCheck =
        !!checkBox &&
        box.left < checkBox.right &&
        box.right > checkBox.left &&
        box.top < checkBox.bottom &&
        box.bottom > checkBox.top;
      return {
        badgeText: badge.textContent ?? "",
        badgeOverflow: badge.scrollWidth > badge.clientWidth,
        intersectsCheck,
      };
    });
  });
}

async function expectMethodMenuFits(page: Page, zoom: string) {
  await page.goto(WORKSPACE_PATH);
  await openTab(page);
  await setZoom(page, zoom);
  const trigger = desktop(page).getByTestId("method-selector");
  // Select each method in turn so the check mark sits beside every badge once, OPTIONS included.
  for (const method of HTTP_METHODS) {
    await trigger.click();
    await page.getByTestId(`method-${method.toLowerCase()}`).click();
    await expect(trigger).toContainText(method);
    await trigger.click();
    const metrics = await measureMethodMenu(page);
    expect(metrics.map((m) => m.badgeText)).toEqual(HTTP_METHODS);
    for (const metric of metrics) {
      expect(metric.badgeOverflow, `${metric.badgeText} overflows`).toBe(false);
      expect(metric.intersectsCheck, `${metric.badgeText} hits check`).toBe(
        false,
      );
    }
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
}

test.describe("Relay v2 UI bug fixes @qa", () => {
  test('[REL-V2-BUGSUI-01] the env menu "..." has no arrow, opens the actions, and clicking it does not select the environment',
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await page.goto(WORKSPACE_PATH);
      const trigger = desktop(page).getByTestId("env-selector-trigger");
      await expect(trigger).toContainText(NO_ENV_LABEL);
      await trigger.click();

      const row = page.getByTestId(`env-selector-item-${SEEDED_ENV_NAME}`);
      await expect(row).toBeVisible();
      await row.hover();
      const more = page.getByTestId(`env-selector-more-${SEEDED_ENV_NAME}`);
      await expect(more).toBeVisible();
      // No arrow of any kind inside the row; only the "..." icon.
      await expect(iconOf(row, "chevron-right")).toHaveCount(0);
      await expect(iconOf(row, "chevron-down")).toHaveCount(0);
      await expect(row.locator("svg")).toHaveCount(1);

      await more.click();
      await expect(page.getByRole("menuitem", { name: "Rename" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
      await snap("01-env-actions");

      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(trigger).toContainText(NO_ENV_LABEL);
      await expect(trigger).not.toContainText(SEEDED_ENV_NAME);
    },
  );

  test('[REL-V2-BUGSUI-02] the History "..." button bounding box is at least 28 px in both dimensions and the export submenu has a separator before the redaction note',
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await page.goto(WORKSPACE_PATH);
      await page.getByTestId("sidebar-tab-history").click();
      await expect(page.getByTestId("history-list")).toBeVisible();

      const button = page.getByTestId("history-actions-btn");
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(MIN_HIT_TARGET_PX);
      expect(box?.height).toBeGreaterThanOrEqual(MIN_HIT_TARGET_PX);

      await button.click();
      await page.getByTestId("history-export-trigger").click();
      const note = page.getByTestId("history-export-note");
      const separator = page.getByTestId("history-export-separator");
      await expect(note).toBeVisible();
      await expect(separator).toBeVisible();
      const [sepBox, noteBox, csvBox] = await Promise.all([
        separator.boundingBox(),
        note.boundingBox(),
        page.getByTestId("history-export-csv").boundingBox(),
      ]);
      expect(sepBox!.y).toBeGreaterThanOrEqual(csvBox!.y + csvBox!.height);
      expect(sepBox!.y + sepBox!.height).toBeLessThanOrEqual(noteBox!.y);
      await snap("02-history-export");
    },
  );

  test("[REL-V2-BUGSUI-03] at 100% zoom every method badge has scrollWidth <= clientWidth and does not intersect the check mark",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await expectMethodMenuFits(page, ZOOM_100);
      await snap("03-method-menu-100");
    },
  );

  test("[REL-V2-BUGSUI-04] at 125% zoom the same method-menu checks hold",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await expectMethodMenuFits(page, ZOOM_125);
      await snap("04-method-menu-125");
    },
  );

  test("[REL-V2-BUGSUI-05] sidebar section headers show a right chevron closed and a down chevron open",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await page.goto(WORKSPACE_PATH);
      const header = desktop(page).getByRole("button", { name: SIDEBAR_SECTION });
      await expectDisclosure(header, true);
      await snap("05-section-open");

      await header.click();
      await expectDisclosure(header, false);
      await snap("05-section-closed");

      await header.click();
      await expectDisclosure(header, true);
    },
  );

  test("[REL-V2-BUGSUI-06] a collection folder shows the open-folder icon when expanded, in the tree and in a subfolder",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await page.goto(WORKSPACE_PATH);
      const collection = desktop(page).getByTestId(
        `collection-item-${NESTED_COLLECTION_ID}`,
      );
      const collectionTrigger = collection.locator(
        '[data-slot="accordion-trigger"]',
      );
      await expect(collectionTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(iconOf(collectionTrigger, "folder")).toBeVisible();
      await expect(iconOf(collectionTrigger, "folder-open")).toBeHidden();

      await collectionTrigger.click();
      await expect(collectionTrigger).toHaveAttribute("aria-expanded", "true");
      await expect(iconOf(collectionTrigger, "folder-open")).toBeVisible();
      await expect(iconOf(collectionTrigger, "folder")).toBeHidden();

      for (const id of [FOLDER_ID, SUBFOLDER_ID]) {
        const folder = desktop(page).getByTestId(`folder-item-${id}`);
        await expect(iconOf(folder, "folder-open")).toBeVisible();
        await expect(iconOf(folder, "folder")).toHaveCount(0);
        await expect(iconOf(folder, "chevron-down")).toBeVisible();
      }
      await snap("06-folders-open");

      const subfolder = desktop(page).getByTestId(`folder-item-${SUBFOLDER_ID}`);
      await subfolder.click();
      await expect(iconOf(subfolder, "folder")).toBeVisible();
      await expect(iconOf(subfolder, "folder-open")).toHaveCount(0);
      await expect(iconOf(subfolder, "chevron-right")).toBeVisible();
    },
  );

  test("[REL-V2-BUGSUI-07] the expanded or collapsed state persists after reload",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await page.goto(WORKSPACE_PATH);
      const header = desktop(page).getByRole("button", { name: SIDEBAR_SECTION });
      await header.click();
      await expectDisclosure(header, false);

      await page.reload();
      await expectDisclosure(
        desktop(page).getByRole("button", { name: SIDEBAR_SECTION }),
        false,
      );

      // Re-open the section and collapse a folder; both survive a reload.
      await desktop(page).getByRole("button", { name: SIDEBAR_SECTION }).click();
      const collectionTrigger = desktop(page)
        .getByTestId(`collection-item-${NESTED_COLLECTION_ID}`)
        .locator('[data-slot="accordion-trigger"]');
      await collectionTrigger.click();
      const folder = desktop(page).getByTestId(`folder-item-${FOLDER_ID}`);
      await folder.click();
      await expect(iconOf(folder, "chevron-right")).toBeVisible();

      await page.reload();
      await desktop(page)
        .getByTestId(`collection-item-${NESTED_COLLECTION_ID}`)
        .locator('[data-slot="accordion-trigger"]')
        .click();
      const reloaded = desktop(page).getByTestId(`folder-item-${FOLDER_ID}`);
      await expect(iconOf(reloaded, "chevron-right")).toBeVisible();
      await expect(iconOf(reloaded, "folder")).toBeVisible();
    },
  );
});
