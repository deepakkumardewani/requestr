import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const MOBILE = { width: 375, height: 800 };
const DESKTOP = { width: 1280, height: 800 };
const FORMATS = ["Postman", "Insomnia", "OpenAPI", "Swagger", "cURL"];

// Below md the app swaps the workspace for a "Best on desktop" notice, so the
// sidebar menu is unreachable at 375 px. The dialog is opened at desktop width
// and then the viewport shrinks, which is how a narrow window shows it.
async function openImportDialog(page: Page, theme: "light" | "dark" = "dark") {
  await page.addInitScript((value) => {
    localStorage.setItem("theme", value);
  }, theme);
  await page.goto("/app");
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByRole("menuitem", { name: "Import" }).click();
  const dialog = page.getByRole("dialog", { name: "Import" });
  await expect(dialog).toBeVisible();
  return dialog;
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe("Import dialog @qa", () => {
  test("@high Import dialog opens, shows Scan and Cancel, File and cURL tabs, trust warning, format chips; keyboard-operable", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    const dialog = await openImportDialog(page);

    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Scan" })).toBeDisabled();
    await expect(dialog.getByRole("tab", { name: "File" })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "cURL" })).toBeVisible();
    await expect(
      dialog.getByText("Only import files and commands from a source you trust."),
    ).toBeVisible();
    await expect(dialog.getByText("Supported formats")).toBeVisible();
    for (const label of FORMATS) {
      await expect(dialog.getByText(label, { exact: true }).last()).toBeVisible();
    }
    await snap("01-dialog-desktop");

    // Arrow keys move between tabs and Enter selects; the cURL tab shows the textarea.
    await dialog.getByRole("tab", { name: "File" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("tab", { name: "cURL" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("tab", { name: "cURL" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(dialog.getByRole("textbox")).toBeVisible();

    // Escape closes the dialog.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  // SPEC criterion 19: Tab / Shift+Tab never leave the open dialog.
  test("@high keyboard focus stays trapped inside the open Import dialog", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const dialog = await openImportDialog(page);
    await expect(dialog).toBeVisible();

    // Focus guards, <body> and the Next dev portal are focus plumbing, not
    // page controls; anything else is a control behind the modal.
    const behindControl = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        if (el.closest('[role="dialog"]')) return null;
        if (el.hasAttribute("data-base-ui-focus-guard")) return null;
        if (el.tagName === "NEXTJS-PORTAL") return null;
        return el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName;
      });

    const reached: string[] = [];
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press(key);
        const control = await behindControl();
        if (control) reached.push(`${key}: ${control}`);
      }
    }
    expect(reached, "page controls reached behind the modal").toEqual([]);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`@high 375 px ${theme}: no horizontal overflow, buttons reachable`, async ({
      page,
      snap,
    }) => {
      await page.setViewportSize(DESKTOP);
      const dialog = await openImportDialog(page, theme);
      await page.setViewportSize(MOBILE);
      await expect(dialog).toBeVisible();
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${theme}\\b`),
      );

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE.width);

      for (const name of ["Cancel", "Scan"]) {
        const button = dialog.getByRole("button", { name });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport();
        const b = await button.boundingBox();
        expect(b!.x).toBeGreaterThanOrEqual(0);
        expect(b!.x + b!.width).toBeLessThanOrEqual(MOBILE.width);
      }
      await snap(`02-dialog-375-${theme}`);
    });
  }

  test("@medium pasting a cURL command and pressing Scan still detects the request", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    const dialog = await openImportDialog(page);
    await dialog.getByRole("tab", { name: "cURL" }).click();
    const scan = dialog.getByRole("button", { name: "Scan" });
    await expect(scan).toBeDisabled();

    await dialog
      .getByRole("textbox")
      .fill(
        "curl -X POST 'https://dummyjson.com/auth/login' -H 'Content-Type: application/json' -d '{\"username\":\"emilys\"}'",
      );
    await scan.click();

    await expect(
      dialog.getByRole("heading", { name: "Review import" }),
    ).toBeVisible();
    await expect(dialog.getByText("1 request", { exact: true })).toBeVisible();
    await expect(dialog.getByText("dummyjson.com", { exact: false }).first()).toBeVisible();
    await snap("03-curl-review");

    await dialog.getByRole("button", { name: "Import" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("cURL imported — opened in new tab").first()).toBeVisible();
  });
});
