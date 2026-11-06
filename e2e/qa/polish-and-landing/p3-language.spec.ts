import { expect, test } from "../../fixtures/qa";

const SETTINGS_PATH = "/settings";
const LANGUAGE_SELECT = "language-select";

test.describe("P3 language in General @qa", () => {
  test("@critical Settings nav has no Language tab; General has a language row", async ({
    page,
    snap,
  }) => {
    await page.goto(`${SETTINGS_PATH}#general`);

    await expect(page.getByTestId("nav-general")).toBeVisible();
    await expect(page.getByTestId("nav-language")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Language", exact: true }),
    ).toHaveCount(0);

    await expect(
      page.getByRole("heading", { name: "General", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Language", { exact: true })).toBeVisible();
    await expect(page.getByTestId(LANGUAGE_SELECT)).toContainText("English");
    await snap("01-general-language-row");
  });

  test("@critical changing language from General persists across reload", async ({
    page,
    snap,
  }) => {
    await page.goto(`${SETTINGS_PATH}#general`);
    const select = page.getByTestId(LANGUAGE_SELECT);
    await expect(select).toContainText("English");

    await select.click();
    await page.getByRole("option", { name: "Français" }).click();
    await expect(select).toContainText("Français");
    // The UI re-renders in French, proving the change took effect.
    await expect(page.getByText("Langue", { exact: true })).toBeVisible();
    await snap("02-french-selected");

    await page.reload();
    await expect(page.getByTestId(LANGUAGE_SELECT)).toContainText("Français");
    await expect(page.getByText("Langue", { exact: true })).toBeVisible();
    await snap("03-french-after-reload");
  });

  test("@high /settings#language lands on General without console errors", async ({
    page,
  }) => {
    // consoleGuard (auto fixture) fails the test on any console error/warning.
    await page.goto(`${SETTINGS_PATH}#language`);

    await expect(
      page.getByRole("heading", { name: "General", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId(LANGUAGE_SELECT)).toBeVisible();
    await expect(page.getByTestId("nav-general")).toBeVisible();
  });

  test("@medium the old Global hash redirects to its new location", async ({
    page,
  }) => {
    await page.goto(`${SETTINGS_PATH}#global`);

    await expect(
      page.getByRole("heading", { name: "Request defaults", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("global-base-url-input")).toBeVisible();
    await expect(page.getByTestId("nav-global")).toHaveText("Request defaults");
    await expect(page.getByTestId(LANGUAGE_SELECT)).toHaveCount(0);
  });
});
