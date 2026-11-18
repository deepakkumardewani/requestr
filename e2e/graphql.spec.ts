import { expect, type Locator, type Page, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearTabsDB(page: Page) {
  await page.addInitScript(async () => {
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("tabs")) {
        const tx = db.transaction("tabs", "readwrite");
        tx.objectStore("tabs").clear();
      }
    };
  });
}

function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

async function openGraphQLTab(page: Page) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByRole("menuitem", { name: "GraphQL" }).click();
}

async function typeInGraphQLQueryEditor(page: Page, text: string) {
  const cm = page.getByTestId("graphql-query-editor").locator(".cm-content");
  await cm.waitFor({ state: "visible" });
  await cm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text, { delay: 15 });
}

async function typeInGraphQLVariablesEditor(page: Page, text: string) {
  const cm = page
    .getByTestId("graphql-variables-editor")
    .locator(".cm-content");
  await cm.waitFor({ state: "visible" });
  await cm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text, { delay: 15 });
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

test.describe("GraphQL", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openGraphQLTab(page);
  });

  test("GraphQL tab shows Query, Variables, Headers, and Auth tabs", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await expect(layout.getByTestId("request-tab-graphql-query")).toBeVisible();
    await expect(
      layout.getByTestId("request-tab-graphql-variables"),
    ).toBeVisible();
    await expect(layout.getByTestId("request-tab-headers")).toBeVisible();
    await expect(layout.getByTestId("request-tab-auth")).toBeVisible();
  });

  test("sends a query and shows JSON in the response panel", async ({
    page,
  }) => {
    await typeInGraphQLQueryEditor(page, "{ countries { code name } }");

    const layout = getLayout(page);
    await layout
      .getByTestId("url-input")
      .fill("https://countries.trevorblades.com/");
    await page.keyboard.press("Escape");
    await layout.getByTestId("send-request-btn").click();

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 30_000 });
    await expect(badge).toHaveText("200");

    await page.getByTestId("view-mode-pretty").click();
    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible({ timeout: 15_000 });
    await expect(prettyViewer).toContainText("countries");
  });

  test("sends variables and resolves them in the response", async ({
    page,
  }) => {
    await typeInGraphQLQueryEditor(
      page,
      "query ($code: ID!) { country(code: $code) { name } }",
    );

    await page.getByTestId("request-tab-graphql-variables").click();
    await typeInGraphQLVariablesEditor(page, '{"code": "BR"}');

    const layout = getLayout(page);
    await layout
      .getByTestId("url-input")
      .fill("https://countries.trevorblades.com/");
    await page.keyboard.press("Escape");
    await layout.getByTestId("send-request-btn").click();

    await page.getByTestId("view-mode-pretty").click();
    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible({ timeout: 30_000 });
    await expect(prettyViewer).toContainText("Brazil");
  });
});
