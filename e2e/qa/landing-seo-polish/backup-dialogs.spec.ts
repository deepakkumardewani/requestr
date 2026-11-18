import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { countIdbRecords } from "../../fixtures/qaHelpers";
import { downloadCapture, twoContexts } from "../../fixtures/relayV2Helpers";

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 800 };
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const RELOAD_TIMEOUT_MS = 15_000;
const SEED_COLLECTION_ID = "qa-collection-1";
const KEY_PRESSES_PER_DIRECTION = 16;
// Choose mode lists every collection, folder and request before the secrets switch.
const MAX_TABS_TO_CONTROL = 400;
const LABELLED_ROLES = ["button", "radio", "switch", "checkbox", "textbox"] as const;

const uid = () => Math.random().toString(36).slice(2, 8);
const exportDialog = (page: Page) => page.getByTestId("backup-export-dialog");
const importDialog = (page: Page) => page.getByTestId("backup-import-dialog");
const replaceDialog = (page: Page) => page.getByTestId("backup-replace-confirm");

function backupFile(id: string) {
  const stamp = 1700000000000;
  return {
    app: "requestr-backup",
    schemaVersion: 1,
    idbVersion: 6,
    exportedAt: "2026-03-04T10:30:00.000Z",
    appVersion: "0.0.0-e2e",
    includesSecrets: false,
    sections: ["collections"],
    data: {
      collections: [
        { id: `bkd-${id}`, name: `BKD ${id}`, description: "", createdAt: stamp, updatedAt: stamp },
      ],
      folders: [],
      requests: [],
      chainConfigs: [],
    },
  };
}

async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
}

async function openDataSection(page: Page) {
  await page.setViewportSize(DESKTOP);
  await page.goto("/settings");
  await page.getByTestId("nav-data").click();
}

async function openExport(page: Page) {
  await page.getByTestId("backup-export-btn").click();
  await expect(exportDialog(page)).toBeVisible();
  await expect(page.getByTestId("backup-download-btn")).toBeEnabled();
}

/** Number in the dangling-links headline, 0 when the notice is absent. */
async function danglingCount(page: Page): Promise<number> {
  const notice = page.getByTestId("backup-dangling");
  if ((await notice.count()) === 0) return 0;
  const text = (await notice.textContent()) ?? "";
  return Number(/^(\d+) link/.exec(text)?.[1] ?? 0);
}

async function feedFile(page: Page, content: unknown) {
  await page.getByTestId("backup-file-input").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(content)),
  });
}

async function openImportPreview(page: Page, id = uid()) {
  await page.getByTestId("backup-import-btn").click();
  await expect(importDialog(page)).toBeVisible();
  await feedFile(page, backupFile(id));
  await expect(page.getByTestId("backup-preview")).toBeVisible();
}

async function openReplaceConfirm(page: Page) {
  await openImportPreview(page);
  await page.getByTestId("backup-mode-replace").check();
  await page.getByTestId("backup-restore-btn").click();
  await expect(replaceDialog(page)).toBeVisible();
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

async function expectFitsMobile(page: Page, dialog: Locator, buttons: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE.width);
  const inner = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(inner).toBeLessThanOrEqual(0);
  for (const name of buttons) {
    const button = dialog.getByRole("button", { name, exact: true }).last();
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
    const b = await button.boundingBox();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(MOBILE.width);
  }
}

async function expectLabelled(dialog: Locator) {
  for (const role of LABELLED_ROLES) {
    for (const control of await dialog.getByRole(role).all()) {
      await expect(control).toHaveAccessibleName(/\S/);
    }
  }
}

async function pressUntilFocused(page: Page, target: Locator, key = "Tab") {
  for (let i = 0; i < MAX_TABS_TO_CONTROL; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

/** Page controls reached by Tab and Shift+Tab that sit outside every open dialog. */
async function controlsBehindModal(page: Page): Promise<string[]> {
  const reached: string[] = [];
  const read = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      if (el.closest('[role="dialog"]')) return null;
      if (el.hasAttribute("data-base-ui-focus-guard")) return null;
      if (el.tagName === "NEXTJS-PORTAL") return null;
      return el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName;
    });
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < KEY_PRESSES_PER_DIRECTION; i++) {
      await page.keyboard.press(key);
      const control = await read();
      if (control) reached.push(`${key}: ${control}`);
    }
  }
  return reached;
}

test.describe("Backup dialogs @qa", () => {
  test("@critical export dialog explains dangling links when a selection excludes linked collections, and the secrets switch consequence", async ({
    seededPage: page,
    snap,
  }) => {
    await openDataSection(page);
    await openExport(page);
    const dialog = exportDialog(page);
    const secrets = page.getByTestId("backup-secrets-toggle");
    const warning = page.getByTestId("backup-secrets-warning");

    // Secrets off (default): the consequence is spelled out.
    await expect(secrets).not.toBeChecked();
    await expect(warning).not.toContainText("Anyone with this file can read your secrets");
    await expect(warning).toContainText("tokens, passwords and secret headers are left blank in the file");
    await expect(warning).toContainText("enter them again after restoring");
    // The QA seed already holds a few unresolved links; remember the baseline.
    const baseline = await danglingCount(page);

    // Untick every collection so the chains that call their requests lose them.
    await page.getByTestId("backup-mode-choose").click();
    const items = page.getByTestId("backup-items-collections").getByTestId(/^backup-item-collections-/);
    await expect(items.first()).toBeVisible();
    for (const box of await items.all()) await box.click();

    const dangling = page.getByTestId("backup-dangling");
    await expect(dangling).toBeVisible();
    await expect(dangling).toContainText(/\d+ (link points to an item|links point to items) that (is|are) not in this backup\./);
    expect(await danglingCount(page)).toBeGreaterThan(baseline);
    await expect(dangling).toContainText("A link joins one item to another, such as a chain step that calls a saved request.");
    await expect(dangling).toContainText("also include the collections, folders, requests or chains they point to");
    await dangling.scrollIntoViewIfNeeded();
    await snap("01-export-dangling");

    // Secrets on: the consequence text changes.
    await secrets.click();
    await expect(secrets).toBeChecked();
    await expect(warning).toContainText("Anyone with this file can read your secrets. Store it securely.");
    await expect(warning).toContainText("Secret values are saved in the file as they are.");
    await expect(warning).toContainText("Saved responses in history may also contain secrets.");
    await expect(warning).not.toContainText("left blank in the file");
    await snap("02-export-secrets-on");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Export", exact: true })).toBeVisible();
  });

  test("@critical import dialog: Merge says what is kept, Replace says what is deleted, the confirm dialog names the deletion; Restore and Cancel labels are consistent", async ({
    seededPage: page,
    snap,
  }) => {
    await openDataSection(page);
    const before = await countIdbRecords(page, "collections");
    expect(before).toBeGreaterThan(0);
    await openImportPreview(page);
    const dialog = importDialog(page);

    // Merge (default) keeps everything.
    const merge = page.getByTestId("backup-mode-merge");
    const replace = page.getByTestId("backup-mode-replace");
    await expect(merge).toBeChecked();
    await expect(dialog).toContainText("Adds what is missing and keeps everything you already have.");
    await expect(dialog).toContainText("Nothing in your workspace is overwritten or deleted.");

    // Replace says what is deleted.
    await replace.check();
    await expect(dialog).toContainText("Deletes your current local data for every section in this file");
    await expect(dialog).toContainText("Sections that are not in the file are left alone.");
    await snap("03-import-replace-description");

    // Labels on the import dialog: Cancel and Restore.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    const restore = dialog.getByRole("button", { name: "Restore", exact: true });
    await expect(restore).toBeVisible();

    await restore.click();
    const confirm = replaceDialog(page);
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole("heading", { name: "Delete current data and restore?" })).toBeVisible();
    await expect(confirm).toContainText("Replace deletes the data listed below from this device first");
    await expect(page.getByTestId("backup-replace-count-collections")).toHaveText(
      `Collections: ${before} ${before === 1 ? "item will" : "items will"} be deleted`,
    );
    // Same Cancel and Restore labels as the import dialog.
    await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await expect(confirm.getByTestId("backup-replace-confirm-btn")).toHaveText("Restore");
    // Let the open animation finish so the shot is not captured mid-fade.
    await expect
      .poll(() => confirm.evaluate((el) => el.getAnimations().length === 0 && getComputedStyle(el).opacity === "1"))
      .toBe(true);
    await snap("04-replace-confirm");

    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(confirm).toHaveCount(0);
    await expect(page.getByTestId("backup-preview")).toBeVisible();
    expect(await countIdbRecords(page, "collections")).toBe(before);
  });

  test("@high labelled controls and full keyboard operation in all three backup dialogs", async ({
    seededPage: page,
    snap,
  }) => {
    await openDataSection(page);

    // Export: keyboard toggles mode and the secrets switch; Escape closes.
    await openExport(page);
    await expectLabelled(exportDialog(page));
    await expect(page.getByRole("switch", { name: "Include secret values" })).not.toBeChecked();
    await pressUntilFocused(page, page.getByTestId("backup-mode-choose"));
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("backup-mode-choose")).toHaveAttribute("aria-checked", "true");
    await expectLabelled(exportDialog(page));
    await pressUntilFocused(page, page.getByRole("switch", { name: "Include secret values" }));
    await page.keyboard.press("Space");
    await expect(page.getByRole("switch", { name: "Include secret values" })).toBeChecked();
    await pressUntilFocused(page, page.getByTestId("backup-download-btn"));
    await snap("05-export-keyboard");
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toBeHidden();

    // Import: arrow keys switch radios, Enter on Restore reaches the confirm dialog.
    await openImportPreview(page);
    await expectLabelled(importDialog(page));
    await page.getByTestId("backup-mode-merge").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("backup-mode-replace")).toBeChecked();
    await pressUntilFocused(page, page.getByTestId("backup-restore-btn"));
    await page.keyboard.press("Enter");
    await expect(replaceDialog(page)).toBeVisible();
    await expectLabelled(replaceDialog(page));

    // Replace confirm: Cancel has initial focus; Escape closes only this dialog.
    await expect(replaceDialog(page).getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await snap("06-replace-keyboard");
    await page.keyboard.press("Escape");
    await expect(replaceDialog(page)).toHaveCount(0);
    await expect(importDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(importDialog(page)).toBeHidden();
  });

  // SPEC criterion 19: Tab / Shift+Tab never leave the open dialog.
  test("@high keyboard focus stays trapped inside each open backup dialog", async ({
    seededPage: page,
  }) => {
    await openDataSection(page);
    const reached: string[] = [];

    await openExport(page);
    reached.push(...(await controlsBehindModal(page)).map((c) => `export ${c}`));
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toBeHidden();

    await openReplaceConfirm(page);
    reached.push(...(await controlsBehindModal(page)).map((c) => `replace ${c}`));
    expect(reached, "page controls reached behind the modal").toEqual([]);
  });

  for (const theme of THEMES) {
    test(`@high 375 px ${theme}: no overflow in the export, import and replace-confirm dialogs`, async ({
      seededPage: page,
      snap,
    }) => {
      await setTheme(page, theme);
      // Below md the app shows "Best on desktop", so each dialog opens at 1280 px
      // and the viewport then shrinks, as a narrow window would.
      await openDataSection(page);
      await openExport(page);
      await page.getByTestId("backup-mode-choose").click();
      await page.setViewportSize(MOBILE);
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      await expectFitsMobile(page, exportDialog(page), ["Cancel", "Export"]);
      await snap(`07-export-375-${theme}`);

      await page.setViewportSize(DESKTOP);
      await page.keyboard.press("Escape");
      await expect(exportDialog(page)).toBeHidden();
      await openImportPreview(page);
      await page.getByTestId("backup-mode-replace").check();
      await page.setViewportSize(MOBILE);
      await expectFitsMobile(page, importDialog(page), ["Cancel", "Restore"]);
      await snap(`08-import-375-${theme}`);

      await page.setViewportSize(DESKTOP);
      await page.getByTestId("backup-restore-btn").click();
      await expect(replaceDialog(page)).toBeVisible();
      await page.setViewportSize(MOBILE);
      await expectFitsMobile(page, replaceDialog(page), ["Cancel", "Restore"]);
      await snap(`09-replace-375-${theme}`);
    });
  }

  test("@medium an export then restore round trip still works unchanged", async ({
    browser,
  }) => {
    const pair = await twoContexts(browser);
    try {
      await openDataSection(pair.source);
      await openExport(pair.source);
      const file = await downloadCapture(pair.source, () =>
        pair.source.getByTestId("backup-download-btn").click(),
      );
      const exported = file.json<{ app: string; data: { collections: { id: string }[] } }>();
      expect(exported.app).toBe("requestr-backup");
      expect(exported.data.collections.map((c) => c.id)).toContain(SEED_COLLECTION_ID);
      const sourceCount = await countIdbRecords(pair.source, "collections");

      await openDataSection(pair.target);
      expect(await countIdbRecords(pair.target, "collections")).toBe(0);
      await pair.target.getByTestId("backup-import-btn").click();
      await pair.target.getByTestId("backup-file-input").setInputFiles({
        name: file.filename,
        mimeType: "application/json",
        buffer: Buffer.from(file.text),
      });
      await expect(pair.target.getByTestId("backup-preview-collections")).toContainText(
        `${sourceCount} ${sourceCount === 1 ? "item" : "items"}`,
      );
      const reloaded = pair.target.waitForEvent("load", { timeout: RELOAD_TIMEOUT_MS });
      await pair.target.getByTestId("backup-restore-btn").click();
      await expect(pair.target.getByTestId("backup-summary")).toContainText("added");
      await reloaded;

      expect(await countIdbRecords(pair.target, "collections")).toBe(sourceCount);
    } finally {
      await pair.close();
    }
  });
});
