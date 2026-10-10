import { expect, type Locator, type Page, test } from "@playwright/test";
import { GRAPHQL_PATH } from "./support/mock-server/graphqlRoutes";
import { MOCK_BASE_URL } from "./support/mock-server/mockBaseUrl";

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

async function sendGraphQL(page: Page, testId: string) {
  const layout = getLayout(page);
  await layout
    .getByTestId("url-input")
    .fill(`${MOCK_BASE_URL}${GRAPHQL_PATH}?testId=${testId}`);
  await page.keyboard.press("Escape");
  await layout.getByTestId("send-request-btn").click();
}

async function addHeader(page: Page, key: string, value: string) {
  await page.getByTestId("request-tab-headers").click();
  await page
    .locator(':visible [data-testid="headers-draft-row-key"]')
    .first()
    .fill(key);
  await page
    .locator(':visible [data-testid="headers-draft-row-value"]')
    .first()
    .fill(value);
  await page.keyboard.press("Enter");
}

async function expectPrettyBody(page: Page) {
  await page.getByTestId("view-mode-pretty").click();
  const viewer = page.getByTestId("response-pretty-viewer");
  await expect(viewer).toBeVisible();
  return viewer;
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
    await typeInGraphQLQueryEditor(page, "{ hello }");
    await sendGraphQL(page, "gql-send");

    await expect(page.getByTestId("response-status-badge")).toHaveText("200");
    await expect(await expectPrettyBody(page)).toContainText("hello world");
  });

  test("sends variables and resolves them in the response", async ({
    page,
  }) => {
    await typeInGraphQLQueryEditor(
      page,
      "query ($name: String) { hello(name: $name) }",
    );
    await page.getByTestId("request-tab-graphql-variables").click();
    await typeInGraphQLVariablesEditor(page, '{"name": "Brazil"}');
    await sendGraphQL(page, "gql-vars");

    await expect(await expectPrettyBody(page)).toContainText("hello Brazil");
  });

  test("E-RT-05: Custom GraphQL headers are sent to the endpoint", async ({
    page,
    request,
  }) => {
    const testId = "e-rt-05";
    await typeInGraphQLQueryEditor(page, "{ headers }");
    await addHeader(page, "x-custom-e2e", "abc123");
    await sendGraphQL(page, testId);

    await expect(page.getByTestId("response-status-badge")).toHaveText("200");
    await expect(await expectPrettyBody(page)).toContainText("abc123");

    await expect
      .poll(async () => {
        const res = await request.get(
          `${MOCK_BASE_URL}/__requests?testId=${testId}`,
        );
        const { requests } = await res.json();
        return requests.some(
          (r: { path?: string; headers?: Record<string, string> }) =>
            r.path === GRAPHQL_PATH && r.headers?.["x-custom-e2e"] === "abc123",
        );
      })
      .toBe(true);
  });

  test("E-RT-06: Schema explorer lists Query fields and clicking a field inserts a snippet", async ({
    page,
  }) => {
    await getLayout(page)
      .getByTestId("url-input")
      .fill(`${MOCK_BASE_URL}${GRAPHQL_PATH}?testId=e-rt-06`);
    await page.keyboard.press("Escape");

    await page.getByTestId("graphql-schema-toggle").click();
    const explorer = page.getByTestId("graphql-schema-explorer");
    await explorer.getByTestId("fetch-schema-btn").click();

    await expect(explorer.getByText("Queries")).toBeVisible();
    for (const name of ["hello", "user", "users", "headers"]) {
      await expect(
        explorer.getByRole("button", { name, exact: false }).first(),
      ).toBeVisible();
    }

    await explorer.getByRole("button", { name: /^hello/ }).click();
    await expect(
      page.getByTestId("graphql-query-editor").locator(".cm-content"),
    ).toContainText("hello");

    await explorer.getByPlaceholder("Search fields…").fill("user");
    await expect(explorer.getByRole("button", { name: /^users/ })).toBeVisible();
    await expect(explorer.getByRole("button", { name: /^user/ }).first()).toBeVisible();
    await expect(explorer.getByRole("button", { name: /^hello/ })).toHaveCount(0);
    await expect(explorer.getByRole("button", { name: /^headers/ })).toHaveCount(0);
  });

  test("E-RT-07: GraphQL errors and 400 responses are displayed", async ({
    page,
  }) => {
    // The UI exposes no operationName input, so force failures via mock headers.
    await typeInGraphQLQueryEditor(page, "{ hello }");
    await addHeader(page, "x-mock-errors", "1");
    await sendGraphQL(page, "e-rt-07a");
    await expect(page.getByTestId("response-status-badge")).toHaveText("200");
    await expect(await expectPrettyBody(page)).toContainText(
      "Forced GraphQL error",
    );

    await addHeader(page, "x-mock-status", "400");
    await sendGraphQL(page, "e-rt-07b");
    await expect(page.getByTestId("response-status-badge")).toHaveText("400");
    await expect(await expectPrettyBody(page)).toContainText(
      "Bad request (forced)",
    );
  });
});
