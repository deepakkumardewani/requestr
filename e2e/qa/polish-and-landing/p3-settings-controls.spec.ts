import type { Page } from "@playwright/test";
import settingsMessages from "../../../messages/en/settings.json";
import relayMessages from "../../../messages/en/relay.json";
import { expect, test } from "../../fixtures/qa";

const SETTINGS_GENERAL = "/settings#general";
const SETTINGS_APPEARANCE = "/settings#appearance";
const SETTINGS_DATA = "/settings#data";
const SETTINGS_RELAY = "/settings#relay";
const DIRTY_URL = "https://example.com/dirty";
const REDUCED_MOTION_ATTR = "data-reduced-motion";

const reduceMotion = settingsMessages.appearance.reduceMotion;
const clearRequests = settingsMessages.clearHistory;
const clearRelay = relayMessages.settings.clearHistory;

/** Reads the persisted `app` settings record straight from IndexedDB. */
async function readPersistedSettings(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result
            .transaction("settings", "readonly")
            .objectStore("settings")
            .get("app");
          get.onsuccess = () => resolve(get.result ?? null);
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

/** Overwrites the persisted `app` settings record, as an older build would have left it. */
async function writePersistedSettings(
  page: Page,
  record: Record<string, unknown>,
) {
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("settings", "readwrite");
          tx.objectStore("settings").put(value, "app");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    record,
  );
}

/** The marker must be applied app-wide: on /app (not Settings), after hydrate and across reload. */
async function expectMarkerOnMainApp(page: Page, value: string | null) {
  const html = page.locator("html");
  const check = async () => {
    await expect(page.getByTestId("desktop-layout")).toBeVisible();
    if (value === null) {
      await expect(html).not.toHaveAttribute(REDUCED_MOTION_ATTR, /.*/);
    } else {
      await expect(html).toHaveAttribute(REDUCED_MOTION_ATTR, value);
    }
  };
  await page.goto("/app");
  await check();
  await page.reload();
  await check();
}

function confirmCloseSwitch(page: Page) {
  return page
    .getByRole("heading", { name: "Tabs", exact: true })
    .locator("..")
    .getByRole("switch");
}

async function openDirtyTab(page: Page) {
  await page.goto("/app");
  const layout = page.getByTestId("desktop-layout");
  await layout.getByTestId("new-tab-btn").first().click();
  await layout.getByTestId("url-input").fill(DIRTY_URL);
  const tab = layout.getByTestId("tab").first();
  await expect(tab).toBeVisible();
  return { layout, tab };
}

async function closeFirstTab(page: Page) {
  const tab = page.getByTestId("desktop-layout").getByTestId("tab").first();
  await tab.hover();
  await tab.getByTestId("tab-close-btn").click({ force: true });
}

test.describe("P3 settings controls @qa", () => {
  test("@critical ask-before-closing defaults ON, prompts, and OFF closes immediately and persists", async ({
    page,
    snap,
  }) => {
    // Default ON: closing a dirty tab prompts.
    const { tab } = await openDirtyTab(page);
    await closeFirstTab(page);
    const dialog = page.getByTestId("close-tab-dialog");
    await expect(
      dialog.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();
    await snap("01-prompt-default-on");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(tab).toBeVisible();

    // Default state in Settings is ON.
    await page.goto(SETTINGS_GENERAL);
    const toggle = confirmCloseSwitch(page);
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect
      .poll(async () => (await readPersistedSettings(page))?.confirmCloseUnsavedTabs)
      .toBe(false);

    // Persists across reload.
    await page.reload();
    await expect(confirmCloseSwitch(page)).not.toBeChecked();
    await snap("02-toggle-off-persisted");

    // OFF: a dirty tab closes with no prompt.
    await page.goto("/app");
    const layout = page.getByTestId("desktop-layout");
    // The tab from the first phase is restored from IndexedDB; waiting for it
    // avoids racing hydration with the edit below.
    await expect(layout.getByTestId("tab")).toHaveCount(1);
    await layout.getByTestId("url-input").fill(DIRTY_URL);
    await closeFirstTab(page);
    await expect(layout.getByTestId("tab")).toHaveCount(0);
    await expect(page.getByTestId("close-tab-dialog")).toHaveCount(0);
    await snap("03-closed-without-prompt");
  });

  test("@high reduced-motion override on/off/system persists across reload and sets the html marker", async ({
    page,
    snap,
  }) => {
    const html = page.locator("html");
    const select = page.getByTestId("reduced-motion-select");
    await page.goto(SETTINGS_APPEARANCE);
    await expect(select).toContainText(reduceMotion.system);
    await expect(html).not.toHaveAttribute(REDUCED_MOTION_ATTR, /.*/);

    const cases = [
      { label: reduceMotion.on, value: "on" },
      { label: reduceMotion.off, value: "off" },
    ];
    for (const { label, value } of cases) {
      await select.click();
      await page.getByRole("option", { name: label }).click();
      await expect(html).toHaveAttribute(REDUCED_MOTION_ATTR, value);
      await expect
        .poll(async () => (await readPersistedSettings(page))?.reducedMotion)
        .toBe(value);

      await page.reload();
      await expect(page.getByTestId("reduced-motion-select")).toContainText(label);
      await expect(html).toHaveAttribute(REDUCED_MOTION_ATTR, value);
      await snap(`04-reduced-motion-${value}`);
      await expectMarkerOnMainApp(page, value);
      await page.goto(SETTINGS_APPEARANCE);
    }

    await select.click();
    await page.getByRole("option", { name: reduceMotion.system }).click();
    await expect(html).not.toHaveAttribute(REDUCED_MOTION_ATTR, /.*/);
    await expect
      .poll(async () => (await readPersistedSettings(page))?.reducedMotion)
      .toBe("system");
    await page.reload();
    await expect(page.getByTestId("reduced-motion-select")).toContainText(
      reduceMotion.system,
    );
    await expect(html).not.toHaveAttribute(REDUCED_MOTION_ATTR, /.*/);
    await expectMarkerOnMainApp(page, null);
  });

  test("@high request-history and Relay-conversation clear actions have distinct labels and dialogs naming what is deleted", async ({
    page,
    snap,
  }) => {
    await page.goto(SETTINGS_DATA);
    const requestBtn = page.getByTestId("clear-history-btn");
    await expect(requestBtn).toHaveText(clearRequests.button);
    await requestBtn.click();
    const requestDialog = page.getByRole("dialog");
    await expect(
      requestDialog.getByRole("heading", { name: clearRequests.title }),
    ).toBeVisible();
    await expect(requestDialog).toContainText("request history");
    await expect(requestDialog).not.toContainText("Relay");
    await snap("05-clear-request-history-dialog");
    await requestDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(requestDialog).toHaveCount(0);

    await page.goto(SETTINGS_RELAY);
    const relayBtn = page.getByTestId("relay-clear-history-btn");
    await expect(relayBtn).toHaveText(clearRelay.button);
    await relayBtn.click();
    const relayDialog = page.getByRole("dialog");
    await expect(
      relayDialog.getByRole("heading", { name: clearRelay.confirmTitle }),
    ).toBeVisible();
    await expect(relayDialog).toContainText("Relay conversation");
    await expect(relayDialog).not.toContainText("request history");
    await snap("06-clear-relay-conversations-dialog");

    expect(clearRequests.button).not.toBe(clearRelay.button);
  });

  test("@medium legacy persisted settings without the new fields load with defaults and no console error", async ({
    page,
    snap,
  }) => {
    await page.goto("/app");
    await expect(page.getByTestId("desktop-layout")).toBeVisible();
    await writePersistedSettings(page, {
      theme: "dark",
      proxyUrl: "",
      sslVerify: true,
      followRedirects: true,
      showHealthMonitor: true,
      showCodeGen: false,
      codeGenLang: "cURL",
      autoExpandExplainer: true,
      locale: "en",
      globalBaseUrl: "",
      globalHeaders: [],
      pinnedRequestIds: [],
      accentColor: { r: 52, g: 211, b: 153 },
      chainMigrationV5: false,
    });

    await page.goto(SETTINGS_GENERAL);
    await page.reload();
    await expect(confirmCloseSwitch(page)).toBeChecked();
    await snap("07-legacy-general-defaults");

    await page.goto(SETTINGS_APPEARANCE);
    await page.reload();
    await expect(page.getByTestId("reduced-motion-select")).toContainText(
      reduceMotion.system,
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      REDUCED_MOTION_ATTR,
      /.*/,
    );
  });
});
