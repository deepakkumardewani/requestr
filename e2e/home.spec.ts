import { expect, test } from "@playwright/test";

test.describe("Home Page", () => {
  test("should load and display branding", async ({ page }) => {
    await page.goto("/app");

    // Check page title
    await expect(page).toHaveTitle(/Requestr/);

    // Check for "Requestr" text in the sidebar
    const brandText = page.getByText("Requestr", { exact: true });
    await expect(brandText.first()).toBeVisible();
  });

  test("should navigate to Transform Playground", async ({ page }) => {
    await page.goto("/app");

    // Look for the Transform Playground button by its aria-label
    const transformBtn = page.getByLabel("Transform Playground");
    await expect(transformBtn).toBeVisible();

    await transformBtn.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/transform/);
  });

  test("should navigate to Settings", async ({ page }) => {
    await page.goto("/app");

    // Look for the Settings button by its aria-label
    const settingsBtn = page.getByLabel("Settings");
    await expect(settingsBtn).toBeVisible();

    await settingsBtn.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/settings/);
  });
});
