import { expect, test } from "../fixtures/qa";
import { openTab } from "../fixtures/qaHelpers";
import { MOCK_BASE_URL } from "../support/mock-server/mockBaseUrl";

// ---------------------------------------------------------------------------
// Seeded-QA regression coverage for the UI-visible Phase 1 bug fixes
// (B1, B2, B5, B6, B8, B10).
//
// Not covered here on purpose: B3 (proxy sslVerify), B4 (pre-script env.set
// reaching {{var}}), B7 (closing a tab disconnects its socket) and B9 (failed
// requests recorded in history). Those are verified by their unit tests and
// by the E-* scenarios in the Phase 3 e2e specs.
// ---------------------------------------------------------------------------

const SEEDED_ENV_NAME = "QA Environment";
const DUPLICATE_ENV_INPUT = "  qa environment ";

test.describe("Bugfix regressions @qa", () => {
  test("B1: choosing Francais switches html lang and persists across reload", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/settings");
    await page.getByTestId("nav-language").click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Français" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      page.getByRole("heading", { name: "Paramètres", exact: true }),
    ).toBeVisible();

    // The IndexedDB write is async; reloading before it lands rehydrates the old locale.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<string | undefined>((resolve, reject) => {
              const open = indexedDB.open("requestly");
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const db = open.result;
                const get = db
                  .transaction("settings")
                  .objectStore("settings")
                  .get("app");
                get.onsuccess = () => {
                  db.close();
                  resolve(get.result?.locale);
                };
                get.onerror = () => reject(get.error);
              };
            }),
        ),
      )
      .toBe("fr");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      page.getByRole("heading", { name: "Paramètres", exact: true }),
    ).toBeVisible();

    await snap("b1-french-after-reload");
  });

  test("B2: Settings > General has no Restart Tour button", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/settings");
    await page.getByTestId("nav-general").click();

    await expect(page.getByTestId("clear-history-btn")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /restart tour/i }),
    ).toHaveCount(0);

    await snap("b2-general-no-restart-tour");
  });

  test("B5: tab dropdown search is empty after selecting a tab and after Close all", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    const layout = page.getByTestId("desktop-layout");
    await openTab(page);
    await openTab(page);

    const search = page.getByTestId("tabs-search-input");
    await layout.getByTestId("tabs-overflow-btn").click();
    await search.fill("New");
    await page.getByTestId("tab-list-item").first().click();
    await expect(page.getByTestId("tabs-popover-content")).toBeHidden();

    await layout.getByTestId("tabs-overflow-btn").click();
    await expect(search).toHaveValue("");
    await snap("b5-search-empty-after-select");

    await search.fill("New");
    await page.getByRole("button", { name: "Close all" }).click();
    await openTab(page);
    await layout.getByTestId("tabs-overflow-btn").click();
    await expect(search).toHaveValue("");
  });

  test("B6: Socket.IO connect error stays visible and Connect is re-enabled", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    const layout = page.getByTestId("desktop-layout");
    await page.getByTestId("create-new-dropdown-trigger").click();
    await page.getByRole("menuitem", { name: "Socket.IO" }).click();

    await layout.getByTestId("url-input").fill(`${MOCK_BASE_URL}?fail=1`);
    await layout.getByTestId("connect-btn").click();

    await expect(layout.getByTestId("socketio-error")).toBeVisible();
    await expect(layout.getByTestId("connect-btn")).toBeEnabled();

    await snap("b6-connect-error-visible");
  });

  test("B8: Settings opens on the General section", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/settings");

    await expect(page.getByTestId("chain-concurrency-input")).toBeVisible();
    await expect(page.getByTestId("clear-history-btn")).toBeVisible();

    await snap("b8-settings-opens-on-general");
  });

  test("B10: duplicate env name shows an inline error in the sidebar and the env manager", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    const layout = page.getByTestId("desktop-layout");

    await page.getByTestId("create-new-dropdown-trigger").click();
    await page.getByRole("menuitem", { name: "Environment", exact: true }).click();
    await page.getByPlaceholder("Environment name").fill(DUPLICATE_ENV_INPUT);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("env-create-name-error")).toBeVisible();
    await snap("b10-sidebar-duplicate-error");
    await page.keyboard.press("Escape");

    await layout.getByTestId("env-selector-trigger").click();
    await page.getByTestId("env-selector-manage-btn").click();
    await expect(page.getByTestId("env-manager-dialog")).toBeVisible();
    await page.getByTestId("add-env-btn").click();
    await page.getByTestId("env-item-rename-input").fill(DUPLICATE_ENV_INPUT);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("env-name-error")).toBeVisible();
    await expect(
      page.getByTestId(`env-list-item-${SEEDED_ENV_NAME}`),
    ).toHaveCount(1);

    await snap("b10-manager-duplicate-error");
  });
});
