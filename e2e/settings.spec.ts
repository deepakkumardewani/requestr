import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { IDB_DB_NAME, IDB_STORES, IDB_VERSION } from "../src/lib/idbSchema";
import { seedQaData } from "./fixtures/qaSeed";
import {
  MOCK_BASE_URL,
  MOCK_HTTPS_URL,
  TEST_ID_HEADER,
} from "./support/mock-server/mockBaseUrl";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEEDED_REQUEST_URL = "{{baseUrl}}/users";
const HEALTH_ENTRY_COUNT = 5;
const RESPONSE_TIMEOUT_MS = 15_000;
const BLUE_ACCENT = { r: 96, g: 165, b: 250 };

/** Seed enough history for the seeded "Get Users" request to show a health dot. */
async function seedHealthHistory(page: Page) {
  await page.addInitScript(
    (args) => {
      const FLAG = "e2e-settings-history-seeded";
      if (sessionStorage.getItem(FLAG)) return;
      sessionStorage.setItem(FLAG, "1");
      const req = indexedDB.open(args.dbName, args.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of args.stores) {
          if (db.objectStoreNames.contains(store.name)) continue;
          const os = store.keyPath
            ? db.createObjectStore(store.name, { keyPath: store.keyPath })
            : db.createObjectStore(store.name);
          for (const idx of store.indexes ?? [])
            os.createIndex(idx.name, idx.keyPath);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");
        for (let i = 0; i < args.count; i++) {
          store.put({
            id: `e2e-set-health-${i}`,
            method: "GET",
            url: args.url,
            status: 200,
            duration: 100 + i,
            size: 10,
            timestamp: 1_700_000_000_000 + i,
            request: {},
            response: {},
          });
        }
        tx.oncomplete = () => db.close();
      };
    },
    {
      dbName: IDB_DB_NAME,
      version: IDB_VERSION,
      stores: IDB_STORES,
      count: HEALTH_ENTRY_COUNT,
      url: SEEDED_REQUEST_URL,
    },
  );
}

/** Settings persist asynchronously; wait for IndexedDB before reloading. */
async function expectSettingsPersisted(
  page: Page,
  expected: Record<string, unknown>,
) {
  await expect
    .poll(() =>
      page.evaluate(
        (dbName) =>
          new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
            const open = indexedDB.open(dbName);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const get = db.transaction("settings").objectStore("settings").get("app");
              get.onsuccess = () => {
                db.close();
                resolve(get.result);
              };
              get.onerror = () => reject(get.error);
            };
          }),
        IDB_DB_NAME,
      ),
    )
    .toMatchObject(expected);
}

function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

async function gotoSettings(page: Page) {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
}

async function backToWorkspace(page: Page) {
  await page.getByRole("link", { name: "Home" }).click();
  await expect(getLayout(page)).toBeVisible();
}

const FEATURE_SWITCH_TESTID = {
  "Health indicators": "health-indicators-switch",
  "Code generation panel": "code-gen-panel-switch",
} as const;

/** The General "Features" switch with the given label. */
function featureSwitch(
  page: Page,
  label: keyof typeof FEATURE_SWITCH_TESTID,
): Locator {
  return page.getByTestId(FEATURE_SWITCH_TESTID[label]);
}

async function openNewTab(page: Page) {
  await getLayout(page).getByTestId("new-tab-btn").first().click();
  await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
}

async function addRequestHeader(page: Page, name: string, value: string) {
  await page.getByTestId("request-tab-headers").click();
  await page
    .locator(':visible [data-testid="headers-draft-row-key"]')
    .first()
    .fill(name);
  await page
    .locator(':visible [data-testid="headers-draft-row-value"]')
    .first()
    .fill(value);
  await page.keyboard.press("Escape");
}

/** Types the URL and sends; resolves once the response status badge shows. */
async function sendUrl(page: Page, url: string) {
  const layout = getLayout(page);
  await layout.getByTestId("url-input").fill(url);
  await page.keyboard.press("Escape");
  await layout.getByTestId("send-request-btn").click();
}

async function resetLog(request: APIRequestContext, testId: string) {
  await request.get(`${MOCK_BASE_URL}/__reset`, {
    headers: { [TEST_ID_HEADER]: testId },
  });
}

async function loggedRequests(request: APIRequestContext, testId: string) {
  const res = await request.get(`${MOCK_BASE_URL}/__requests`, {
    headers: { [TEST_ID_HEADER]: testId },
  });
  const body = (await res.json()) as {
    requests: { path?: string; headers?: Record<string, string> }[];
  };
  return body.requests;
}

// ---------------------------------------------------------------------------
// Test Suite: Settings
// ---------------------------------------------------------------------------

test.describe("Settings", () => {
  test("Toggle dark mode", { tag: "@high" }, async ({ page }) => {
    await gotoSettings(page);
    await page.getByTestId("nav-appearance").click();

    await page.getByTestId("theme-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByTestId("theme-light").click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // System follows the emulated OS scheme; assert both directions.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByTestId("theme-system").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("Set a custom proxy URL", { tag: "@medium" }, async ({ page }) => {
    await gotoSettings(page);
    await page.getByTestId("nav-proxy").click();

    const proxyInput = page.getByTestId("proxy-url-input");
    await proxyInput.fill("http://127.0.0.1:8080");
    await expect(proxyInput).toHaveValue("http://127.0.0.1:8080");
  });

  test("View keyboard shortcuts", { tag: "@medium" }, async ({ page }) => {
    await gotoSettings(page);
    await page.getByTestId("nav-shortcuts").click();

    const labels = page.getByTestId("shortcut-group-label");
    await expect(labels.first()).toBeVisible();
    // Required groups only; extra groups must not break this test.
    for (const group of [
      "General",
      "Request",
      "Workspace",
      "Tabs",
      "Chain canvas",
    ]) {
      await expect(labels.filter({ hasText: group }).first()).toBeVisible();
    }
  });

  test("E-SET-01: Health indicators toggle hides and restores the health dot", async ({
    page,
  }) => {
    await seedQaData(page);
    await seedHealthHistory(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();

    const healthDot = () =>
      getLayout(page).getByRole("button", { name: /Last \d+ requests/ });
    const usersRow = () =>
      getLayout(page)
        .getByTestId("request-item")
        .filter({ hasText: "Get Users" });

    const expandCollection = async () => {
      await getLayout(page).getByText("QA Collection").first().click();
      await expect(usersRow()).toBeVisible();
    };
    await expandCollection();
    await expect(healthDot().first()).toBeVisible();

    await page.getByTestId("sidebar-settings-btn").first().click();
    const healthSwitch = featureSwitch(page, "Health indicators");
    await expect(healthSwitch).toBeChecked();
    await healthSwitch.click();
    await expect(healthSwitch).not.toBeChecked();

    await backToWorkspace(page);
    await expandCollection();
    await expect(healthDot()).toHaveCount(0);

    await page.getByTestId("sidebar-settings-btn").first().click();
    await featureSwitch(page, "Health indicators").click();
    await expect(featureSwitch(page, "Health indicators")).toBeChecked();

    await backToWorkspace(page);
    await expandCollection();
    await expect(healthDot().first()).toBeVisible();
  });

  test("E-SET-02: Code generation panel toggle shows and hides the panel", async ({
    page,
  }) => {
    // App bug: showCodeGen only drives the unused "dock" CodeGenPanel variant, so the toggle has no visible effect.
    test.fail();
    const testId = "e-set-02";
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openNewTab(page);
    await addRequestHeader(page, TEST_ID_HEADER, testId);
    await sendUrl(page, `${MOCK_BASE_URL}/echo`);
    await expect(page.getByTestId("response-status-badge")).toHaveText("200", {
      timeout: RESPONSE_TIMEOUT_MS,
    });
    await expect(page.getByTestId("code-gen-panel")).toHaveCount(0);

    await page.getByTestId("sidebar-settings-btn").first().click();
    const codeGenSwitch = featureSwitch(page, "Code generation panel");
    await expect(codeGenSwitch).not.toBeChecked();
    await codeGenSwitch.click();
    await expect(codeGenSwitch).toBeChecked();

    await backToWorkspace(page);
    const panel = page.getByTestId("code-gen-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("curl");
    await expect(panel).toContainText(`${MOCK_BASE_URL}/echo`);

    await page.getByTestId("code-gen-lang-select").click();
    await page.getByRole("option", { name: "Python" }).click();
    await expect(panel).toContainText("requests");

    await page.getByTestId("sidebar-settings-btn").first().click();
    await featureSwitch(page, "Code generation panel").click();
    await backToWorkspace(page);
    await expect(page.getByTestId("code-gen-panel")).toHaveCount(0);
  });

  test("E-SET-03: Theme, accent colour and feature toggles persist after reload", async ({
    page,
  }) => {
    await gotoSettings(page);
    await page.getByTestId("nav-appearance").click();
    await page.getByTestId("theme-dark").click();
    await page.getByTestId("accent-blue").click();

    await page.getByTestId("nav-general").click();
    const health = featureSwitch(page, "Health indicators");
    const codeGen = featureSwitch(page, "Code generation panel");
    await health.click();
    await codeGen.click();
    await expect(health).not.toBeChecked();
    await expect(codeGen).toBeChecked();
    await expectSettingsPersisted(page, {
      theme: "dark",
      accentColor: BLUE_ACCENT,
      showHealthMonitor: false,
      showCodeGen: true,
    });

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(featureSwitch(page, "Health indicators")).not.toBeChecked();
    await expect(featureSwitch(page, "Code generation panel")).toBeChecked();

    await page.getByTestId("nav-appearance").click();
    // The active swatch renders a check icon; inactive ones render nothing.
    await expect(page.getByTestId("accent-blue").locator("svg")).toBeVisible();
    await expect(page.getByTestId("accent-emerald").locator("svg")).toHaveCount(
      0,
    );
  });

  test("E-SET-04: Clear History confirms to empty the History tab and Cancel keeps entries", async ({
    page,
  }) => {
    await seedQaData(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await getLayout(page).getByTestId("sidebar-tab-history").click();
    const items = getLayout(page).getByTestId("history-item");
    await expect(items.first()).toBeVisible();
    const entryCount = await items.count();

    await page.getByTestId("sidebar-settings-btn").first().click();
    await page.getByTestId("clear-history-btn").click();
    const dialog = page.getByRole("dialog", { name: "Clear History" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await backToWorkspace(page);
    await getLayout(page).getByTestId("sidebar-tab-history").click();
    await expect(items).toHaveCount(entryCount);

    await page.getByTestId("sidebar-settings-btn").first().click();
    await page.getByTestId("clear-history-btn").click();
    await page.getByTestId("confirm-clear-history-btn").click();
    await expect(dialog).toBeHidden();

    await backToWorkspace(page);
    await getLayout(page).getByTestId("sidebar-tab-history").click();
    await expect(getLayout(page).getByTestId("history-item")).toHaveCount(0);
  });

  test("E-SET-05: Switching language to Francais persists after reload with html lang=\"fr\"", async ({
    page,
  }) => {
    await gotoSettings(page);
    await page.getByTestId("nav-language").click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Français" }).click();
    // The UI re-renders from the store once the choice is applied and persisted.
    await expect(page.getByTestId("nav-general")).toContainText("Général");
    await expectSettingsPersisted(page, { locale: "fr" });

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      page.getByRole("heading", { name: "Paramètres", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("nav-general")).toContainText("Général");
  });

  test("E-SET-07: Settings General does not show a Restart Tour button", async ({
    page,
  }) => {
    await gotoSettings(page);
    await expect(
      page.getByRole("heading", { name: "General", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /restart tour/i })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("restart-tour-btn")).toHaveCount(0);
    for (const group of ["Features", "Chain execution", "Data Management"]) {
      await expect(
        page.getByRole("heading", { name: group, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
  });

  test("E-SET-08: Global base URL and header apply to a relative-URL request", async ({
    page,
    request,
  }) => {
    const globalId = "e-set-08-global";
    const ownId = "e-set-08-own";
    await resetLog(request, globalId);
    await resetLog(request, ownId);
    await gotoSettings(page);
    await page.getByTestId("nav-global").click();
    await page.getByTestId("global-base-url-input").fill(MOCK_BASE_URL);
    await page.getByPlaceholder("Header").first().fill(TEST_ID_HEADER);
    await page.getByPlaceholder("Value").first().fill(globalId);

    await backToWorkspace(page);
    await openNewTab(page);
    await sendUrl(page, "/echo");
    await expect(page.getByTestId("response-status-badge")).toHaveText("200", {
      timeout: RESPONSE_TIMEOUT_MS,
    });
    await expect
      .poll(async () =>
        (await loggedRequests(request, globalId)).filter(
          (r) => r.path === "/echo",
        ).length,
      )
      .toBe(1);

    await addRequestHeader(page, TEST_ID_HEADER, ownId);
    await getLayout(page).getByTestId("send-request-btn").click();
    await expect
      .poll(async () =>
        (await loggedRequests(request, ownId)).filter((r) => r.path === "/echo")
          .length,
      )
      .toBe(1);
    expect(
      (await loggedRequests(request, globalId)).filter((r) => r.path === "/echo"),
    ).toHaveLength(1);
  });

  test("E-SET-09: Custom proxy URL is included in the /api/proxy payload", async ({
    page,
  }) => {
    // App bug: settings.proxyUrl is stored but never added to the /api/proxy payload.
    test.fail();
    const testId = "e-set-09";
    const proxyUrl = "http://127.0.0.1:8080";
    await gotoSettings(page);
    await page.getByTestId("nav-proxy").click();
    await page.getByTestId("proxy-url-input").fill(proxyUrl);

    await backToWorkspace(page);
    await openNewTab(page);
    await addRequestHeader(page, TEST_ID_HEADER, testId);

    const proxyCall = page.waitForRequest("**/api/proxy");
    await sendUrl(page, `${MOCK_BASE_URL}/echo`);
    const payload = JSON.parse((await proxyCall).postData() ?? "{}");
    expect(payload.proxyUrl).toBe(proxyUrl);
  });

  test("E-SET-10: Sidebar utility icons navigate to the JSON tools and render pasted JSON", async ({
    page,
  }) => {
    const json = '{"name":"requestly","items":[1,2]}';
    const otherJson = '{"name":"other","items":[1,3]}';
    const editor = (index = 0) => page.locator(".cm-content").nth(index);
    // The editors load lazily; retry replace-all so an early keystroke is not lost.
    const pasteJson = async (index: number, text: string, marker: string) => {
      await expect(async () => {
        await editor(index).click();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.insertText(text);
        await expect(editor(index)).toContainText(marker, { timeout: 1000 });
      }).toPass();
    };
    const openTool = async (name: string, url: RegExp) => {
      await page.goto("/app");
      await expect(getLayout(page)).toBeVisible();
      await getLayout(page).getByRole("button", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(editor()).toBeVisible();
    };

    await openTool("Transform Playground", /\/transform$/);
    await pasteJson(0, json, "requestly");
    await expect(page.getByText("requestly").first()).toBeVisible();

    await openTool("JSON Visualize", /\/json-visualize$/);
    await pasteJson(0, json, "requestly");
    await page.getByRole("button", { name: "Visualize", exact: true }).click();
    await expect(page.getByText("requestly").last()).toBeVisible();

    await openTool("JSON Compare", /\/json-compare$/);
    await pasteJson(0, json, "requestly");
    await pasteJson(1, otherJson, "other");
    await expect(page.getByTestId("diff-tree")).toBeVisible();
  });

  test("E-SET-11: SSL verification fails against a self-signed HTTPS server when on and succeeds when off", async ({
    page,
  }) => {
    // App bug: the global sslVerify setting is never applied to HTTP requests (only the per-tab override is).
    test.fail();
    const testId = "e-set-11";
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openNewTab(page);
    await addRequestHeader(page, TEST_ID_HEADER, testId);
    await sendUrl(page, `${MOCK_HTTPS_URL}/echo`);
    await expect(page.getByTestId("response-error-state")).toBeVisible({
      timeout: RESPONSE_TIMEOUT_MS,
    });
    await expect(page.getByTestId("response-status-badge")).toHaveCount(0);

    await page.getByTestId("sidebar-settings-btn").first().click();
    await page.getByTestId("nav-proxy").click();
    const sslSwitch = page.getByTestId("ssl-verification-switch");
    await expect(sslSwitch).toBeChecked();
    await sslSwitch.click();
    await expect(sslSwitch).not.toBeChecked();

    await backToWorkspace(page);
    await getLayout(page).getByTestId("send-request-btn").click();
    await expect(page.getByTestId("response-status-badge")).toHaveText("200", {
      timeout: RESPONSE_TIMEOUT_MS,
    });
  });
});
