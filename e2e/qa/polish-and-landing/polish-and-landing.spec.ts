import type { Page } from "@playwright/test";
import { IDB_DB_NAME, IDB_VERSION } from "../../../src/lib/idbSchema";
import { expect, test } from "../../fixtures/qa";
import { openTab } from "../../fixtures/qaHelpers";

/**
 * Combined polish-and-landing walkthrough: one test per flow, each short and
 * end-to-end. Detailed edge cases live in the per-phase specs; this file proves
 * the flows hang together. Proof shots go to the walkthrough dir (no personal
 * data: the seed is synthetic).
 */
const WALKTHROUGH_DIR = "agent_docs/polish-and-landing/qa/walkthrough";
const DESKTOP = { width: 1440, height: 900 };
const APP_PATH = "/app";
const LANDING_PATH = "/";
const OPENAI_COLLECTION_ID = "qa-p2sb-openai";
const EXPAND_BUDGET_MS = 1000;
const OPENAI_FIRST_URL = "https://api.example.test/v1/oa/0";
/** Health metrics need >= 5 history entries for the same method + URL. */
const HEALTH_HISTORY_COUNT = 6;
const NOT_ADVICE = /not legal advice/i;
const OPERATOR = "Deepak Dewani";

const LEGAL_PAGES = [
  { name: "Privacy", path: "/privacy", h1: "Privacy Policy" },
  { name: "Terms", path: "/terms", h1: "Terms & Conditions" },
] as const;

/** Saves a proof screenshot; the fixture `snap` targets a different folder. */
function walkSnap(page: Page, name: string) {
  return page.screenshot({ path: `${WALKTHROUGH_DIR}/${name}.png` });
}

/** Adds the history rows the shared seed lacks so the health pill renders. */
async function seedHealthHistory(page: Page) {
  const history = Array.from({ length: HEALTH_HISTORY_COUNT }, (_, i) => ({
    id: `qa-walk-hist-${i}`,
    method: "GET",
    url: OPENAI_FIRST_URL,
    status: 200,
    duration: 100 + i * 10,
    size: 512,
    timestamp: 1_810_000_000_000 + i * 1000,
    request: {},
    response: {},
  }));
  await page.addInitScript(
    (args) => {
      const req = indexedDB.open(args.dbName, args.version);
      req.onsuccess = () => {
        const tx = req.result.transaction("history", "readwrite");
        for (const record of args.history) tx.objectStore("history").put(record);
        tx.oncomplete = () => req.result.close();
      };
    },
    { history, dbName: IDB_DB_NAME, version: IDB_VERSION }
  );
}

const tooltip = (page: Page) => page.locator('[data-slot="tooltip-content"]');

test.describe("Polish and landing walkthrough @qa", () => {
  test.use({ viewport: DESKTOP });

  test("@qa new-request '+' tooltip shows Ctrl+T and the logo returns to /", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    await page.getByTestId("tab-bar").getByTestId("new-tab-btn").hover();
    await expect(tooltip(page)).toContainText("New Request");
    await expect(tooltip(page)).toContainText("Ctrl+T");
    await walkSnap(page, "01-plus-tooltip");

    await page.getByTestId("logo-home-link").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(LANDING_PATH);
  });

  test("@qa Relay icon has a tooltip; Open in Relay is icon-only and absent from the URL bar", async ({
    seededPage: page,
  }) => {
    await page.goto(APP_PATH);
    await page.getByTestId("relay-toggle").hover();
    await expect(tooltip(page)).toContainText("Toggle Relay");
    await walkSnap(page, "02-relay-tooltip");

    await openTab(page);
    await expect(page.getByTestId("send-request-btn")).toBeVisible();
    await expect(page.getByTestId("open-in-relay-btn")).toHaveCount(0);

    await page.goto("/transform");
    const input = page.getByTestId("code-editor").first().getByRole("textbox");
    await input.click();
    await page.keyboard.insertText('{"users":[{"id":1}]}');
    const button = page.getByRole("button", { name: "Open in Relay" });
    await expect(button).toBeVisible();
    await expect(button).toHaveText("");
    await walkSnap(page, "03-open-in-relay-icon-only");
  });

  test("@qa empty state lists shortcuts and its primary action opens a request", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    const layout = page.getByTestId("desktop-layout");
    await expect(layout.getByTestId("empty-state-shortcuts")).toBeVisible();
    await walkSnap(page, "04-empty-state");
    await layout.getByTestId("new-tab-btn").first().click();
    await expect(layout.getByTestId("url-input")).toBeVisible();
  });

  test("@qa health indicator shows a help cursor", async ({
    seededPage: page,
  }) => {
    await seedHealthHistory(page);
    await page.goto(APP_PATH);
    await page.getByTestId(`collection-name-${OPENAI_COLLECTION_ID}`).click();
    const pill = page
      .getByTestId("virtualized-request-list")
      .getByRole("button", { name: /^Last \d+ requests/ })
      .first();
    await expect(pill).toHaveCSS("cursor", "help");
    await walkSnap(page, "05-health-cursor");
  });

  test("@qa 148-request collection expands instantly and the grouped '+' menu lists its groups", async ({
    seededPage: page,
  }) => {
    await page.goto(APP_PATH);
    await page.getByTestId(`collection-name-${OPENAI_COLLECTION_ID}`).click();
    await expect(
      page
        .getByTestId("virtualized-request-list")
        .getByTestId("request-item")
        .first()
    ).toBeVisible({ timeout: EXPAND_BUDGET_MS });
    await walkSnap(page, "06-collection-expanded");

    await page.getByTestId("create-new-dropdown-trigger").click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("group")).toHaveCount(3);
    for (const [i, label] of ["Requests", "Workspace", "Import"].entries()) {
      await expect(menu.getByRole("group").nth(i)).toHaveAccessibleName(label);
    }
    await walkSnap(page, "07-plus-menu-groups");
  });

  test("@qa Settings has no Language tab and #language lands on General", async ({
    page,
  }) => {
    await page.goto("/settings#language");
    await expect(
      page.getByRole("heading", { name: "General", exact: true })
    ).toBeVisible();
    await expect(page.getByTestId("language-select")).toBeVisible();
    await expect(page.getByTestId("nav-language")).toHaveCount(0);
    await walkSnap(page, "08-language-in-general");
  });

  test("@qa Shortcuts tab uses a multi-column layout without vertical scroll", async ({
    page,
  }) => {
    await page.goto("/settings#shortcuts");
    await page.getByTestId("nav-shortcuts").click();
    const groups = page.getByTestId("shortcut-group");
    await expect(groups.first()).toBeVisible();
    const lefts = await groups.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left))
    );
    expect(new Set(lefts).size).toBeGreaterThanOrEqual(2);
    const fits = await page
      .locator("#app-main")
      .evaluate((el) => el.scrollHeight <= el.clientHeight);
    expect(fits).toBe(true);
    await walkSnap(page, "09-shortcuts-columns");
  });

  test("@qa new settings: ask-before-closing and reduced motion are present, clear-history scopes are distinct", async ({
    page,
  }) => {
    await page.goto("/settings#general");
    await expect(
      page
        .getByRole("heading", { name: "Tabs", exact: true })
        .locator("..")
        .getByRole("switch")
    ).toBeChecked();
    await walkSnap(page, "10-ask-before-closing");

    await page.goto("/settings#appearance");
    await expect(page.getByTestId("reduced-motion-select")).toBeVisible();

    await page.goto("/settings#data");
    const requestClear = page.getByTestId("clear-history-btn");
    await expect(requestClear).toBeVisible();
    const requestLabel = await requestClear.innerText();

    await page.goto("/settings#relay");
    const relayClear = page.getByTestId("relay-clear-history-btn");
    await expect(relayClear).toBeVisible();
    expect(requestLabel).not.toBe(await relayClear.innerText());
    await walkSnap(page, "11-clear-history-scopes");
  });

  test("@qa comparison table rows link to sources", async ({ page }) => {
    await page.goto(LANDING_PATH);
    const section = page.locator("#compare");
    await section.scrollIntoViewIfNeeded();
    await expect(
      section.getByRole("heading", { name: /How Requestr stacks up/ })
    ).toBeVisible();
    const links = section.locator("table").getByTestId("comparison-source-link");
    expect(await links.count()).toBeGreaterThan(10);
    await expect(links.first()).toHaveAttribute("href", /^https:\/\//);
    await walkSnap(page, "12-comparison-sources");
  });

  test("@qa chosen hero renders", async ({ page }) => {
    await page.goto(LANDING_PATH);
    await expect(
      page.getByRole("heading", { level: 1, name: /Send the request/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Watch the demo" }).first()
    ).toBeVisible();
    await walkSnap(page, "13-hero");
  });

  test("@qa Relay section shows the poster", async ({ page }) => {
    await page.goto(LANDING_PATH);
    const section = page.locator("#relay");
    await section.scrollIntoViewIfNeeded();
    await expect(
      section.getByRole("heading", { name: /Ask for the change/ })
    ).toBeVisible();
    await expect(
      section.getByRole("img", {
        name: "Relay proposing edits across an API collection",
      })
    ).toBeVisible();
    await walkSnap(page, "14-relay-poster");
  });

  test("@qa Watch-demo modal opens the video and closes", async ({ page }) => {
    await page.goto(LANDING_PATH);
    await page.getByRole("button", { name: "Watch the demo" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Watch the demo" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("video")).toHaveCount(1);
    await walkSnap(page, "15-demo-modal");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("@qa header has no Docs; footer links the legal pages with operator, India and contact content", async ({
    page,
  }) => {
    await page.goto(LANDING_PATH);
    const header = page.getByRole("navigation", { name: "Main navigation" });
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: /docs/i })).toHaveCount(0);

    for (const legal of LEGAL_PAGES) {
      await page.goto(LANDING_PATH);
      const link = page
        .getByRole("contentinfo")
        .getByRole("link", { name: legal.name, exact: true });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${legal.path}$`));
      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { level: 1, name: legal.h1 })
      ).toBeVisible();
      await expect(main).toContainText(OPERATOR);
      await expect(main).toContainText("India");
      await expect(main.getByRole("link", { name: /@/ })).toHaveAttribute(
        "href",
        /^mailto:/
      );
      await expect(main).toContainText(/proxy/i);
      await expect(main.getByRole("note")).toHaveText(NOT_ADVICE);
      await walkSnap(page, `16-${legal.name.toLowerCase()}`);
    }
  });
});
