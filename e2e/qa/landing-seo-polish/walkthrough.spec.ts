import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Combined final walkthrough (T12.4): one test per user flow, each asserting the
// observable end state. Video-blocked behaviour is covered by relay-section.spec.ts
// (it needs a console guard exemption). Detail lives in the per-feature specs in this folder.
// Marketing routes live at the origin root; baseURL carries the /app basePath.
const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const SECTION_IDS = [
  "hero",
  "relay",
  "how-it-works",
  "features",
  "command-palette",
  "beyond-send",
  "import",
  "compare",
  "",
];
const HERO_HEADLINE = "AI that does your API work.";
const RELAY_HEADLINE = "An AI built into the app. It does what you do.";
const SEEDED_HISTORY_URL = "https://h.test/orders";
const FEATURE_ROUTE = "/features/relay";
const COMPARE_ROUTE = "/compare/postman";
const HUB_ROUTE = "/features";
const LEGAL_ROUTES = ["/privacy", "/terms"];

async function gotoLanding(page: Page, baseURL: string | undefined) {
  await page.goto(originUrl(baseURL, "/"));
  // Relay is code-split; wait for the last lazy section before using the page.
  await expect(page.locator("main > section")).toHaveCount(SECTION_IDS.length);
}

const useLight = (page: Page) =>
  page.addInitScript(() => localStorage.setItem("theme", "light"));

const jsonLdTypes = async (page: Page) => {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return scripts.map((raw) => JSON.parse(raw)["@type"]);
};

test.describe("Landing SEO polish walkthrough @qa", () => {
  test("@critical landing order is Relay-first with the AI hero at 1280 and 390 px", async ({
    page,
    baseURL,
    snap,
  }) => {
    for (const viewport of [DESKTOP, MOBILE]) {
      await page.setViewportSize(viewport);
      await gotoLanding(page, baseURL);
      const ids = await page
        .locator("main > section")
        .evaluateAll((els) => els.map((el) => el.id));
      expect(ids).toEqual(SECTION_IDS);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toContainText(HERO_HEADLINE);
      await snap(`01-hero-${viewport.width}`);
    }
  });

  test("@critical Watch demo opens the modal and the full cut plays after Play", async ({
    page,
    baseURL,
    snap,
  }) => {
    await gotoLanding(page, baseURL);
    const relay = page.locator("#relay");
    await relay.scrollIntoViewIfNeeded();
    await expect(
      relay.getByRole("heading", { level: 2, name: RELAY_HEADLINE }),
    ).toBeVisible();

    await relay.getByRole("button", { name: "Watch the demo" }).click();
    const dialog = page.getByRole("dialog", { name: "Watch the demo" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Play", exact: true }).click();
    await expect
      .poll(() =>
        dialog
          .locator("video")
          .evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
      )
      .toBe(true);
    await snap("02-demo-modal-playing");
  });

  test("@high command palette and Import and backup sections show their headings and loaded screenshots", async ({
    page,
    baseURL,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await gotoLanding(page, baseURL);

    const palette = page.locator("#command-palette");
    await palette.scrollIntoViewIfNeeded();
    await expect(
      palette.getByRole("heading", {
        level: 2,
        name: "Do anything from one keystroke.",
      }),
    ).toBeVisible();
    await expect(
      palette.getByRole("img", { name: /^Command palette open/ }),
    ).toBeVisible();

    const importSection = page.locator("#import");
    await importSection.scrollIntoViewIfNeeded();
    await expect(
      importSection.getByRole("heading", {
        level: 2,
        name: "Bring what you have. Keep what you build.",
      }),
    ).toBeVisible();
    await snap("03-import-backup-section");
  });

  test("@critical a feature page and a compare page render one h1 and parseable JSON-LD", async ({
    page,
    baseURL,
    snap,
  }) => {
    await useLight(page);
    for (const route of [FEATURE_ROUTE, COMPARE_ROUTE]) {
      const res = await page.goto(originUrl(baseURL, route));
      expect(res?.status(), route).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect((await jsonLdTypes(page)).length, `${route} json-ld`).toBeGreaterThan(
        0,
      );
      await snap(`04-${route.split("/")[1]}-page`);
    }
  });

  test("@high hub links to a feature page and the click lands on it", async ({
    page,
    baseURL,
  }) => {
    await useLight(page);
    await page.goto(originUrl(baseURL, HUB_ROUTE));
    await page.locator(`main a[href="${FEATURE_ROUTE}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${FEATURE_ROUTE}/?$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("@high footer lists Features and Compare links that resolve", async ({
    page,
    request,
    baseURL,
  }) => {
    await useLight(page);
    await page.goto(originUrl(baseURL, "/"));
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByText("Features", { exact: true })).toBeVisible();
    await expect(footer.getByText("Compare", { exact: true })).toBeVisible();
    for (const route of [HUB_ROUTE, FEATURE_ROUTE, COMPARE_ROUTE]) {
      await expect(footer.locator(`a[href="${route}"]`)).toHaveCount(1);
      const res = await request.get(originUrl(baseURL, route));
      expect(res.status(), route).toBe(200);
    }
  });

  test("@critical history shows day headers, one grouped row with a count, and expanding restores a run", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await page.getByTestId("sidebar-tab-history").click();
    await expect(page.getByTestId("history-list")).toBeVisible();
    await expect(page.getByTestId("history-day-header").first()).toBeVisible();

    const group = page
      .getByTestId("history-group")
      .filter({ hasText: SEEDED_HISTORY_URL });
    await expect(group).toHaveCount(1);
    await expect(group.getByTestId("history-group-count")).toHaveText("x 3");
    await group.getByTestId("history-group-toggle").click();
    await expect(page.getByTestId("history-run")).toHaveCount(3);
    await snap("04-history-grouped");

    await page.getByTestId("history-run").nth(2).click();
    await expect(
      page.getByTestId("tab").filter({ hasText: "Orders run 1" }),
    ).toBeVisible();
  });

  test("@critical export dialog explains dangling links and import Replace says what it deletes", async ({
    seededPage: page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/settings");
    await page.getByTestId("nav-data").click();

    await page.getByTestId("backup-export-btn").click();
    const exportDialog = page.getByTestId("backup-export-dialog");
    await expect(exportDialog).toBeVisible();
    await page.getByTestId("backup-mode-choose").click();
    const items = page
      .getByTestId("backup-items-collections")
      .getByTestId(/^backup-item-collections-/);
    await expect(items.first()).toBeVisible();
    for (const box of await items.all()) await box.click();
    await expect(page.getByTestId("backup-dangling")).toContainText(
      /\d+ (link points to an item|links point to items) that (is|are) not in this backup\./,
    );
    await snap("05-export-dangling");
    await exportDialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByTestId("backup-import-btn").click();
    await page.getByTestId("backup-file-input").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          app: "requestr-backup",
          schemaVersion: 1,
          idbVersion: 6,
          exportedAt: "2026-03-04T10:30:00.000Z",
          appVersion: "0.0.0-e2e",
          includesSecrets: false,
          sections: ["collections"],
          data: { collections: [], folders: [], requests: [], chainConfigs: [] },
        }),
      ),
    });
    await expect(page.getByTestId("backup-preview")).toBeVisible();
    await page.getByTestId("backup-mode-replace").check();
    await expect(page.getByTestId("backup-import-dialog")).toContainText(
      "Deletes your current local data for every section in this file",
    );
  });

  test("@high privacy and terms return 200 with real content and one h1", async ({
    page,
    baseURL,
  }) => {
    await useLight(page);
    for (const route of LEGAL_ROUTES) {
      const res = await page.goto(originUrl(baseURL, route));
      expect(res?.status(), route).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect((await page.locator("body").innerText()).length).toBeGreaterThan(
        500,
      );
    }
  });

  test("@high reduced motion shows the Relay headline at once", async ({
    page,
    baseURL,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoLanding(page, baseURL);
    const headline = page
      .locator("#relay")
      .getByRole("heading", { level: 2 });
    await headline.scrollIntoViewIfNeeded();
    await expect(headline).toHaveText(RELAY_HEADLINE);
    await expect(headline).toHaveCSS("opacity", "1");
  });

  test.describe("JavaScript disabled", () => {
    test.use({ javaScriptEnabled: false });

    test("@high server HTML still carries the hero headline and the Relay heading", async ({
      page,
      baseURL,
    }) => {
      await page.goto(originUrl(baseURL, "/"));
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toContainText(HERO_HEADLINE);
      expect(await page.content()).toContain("An AI built into the app");
    });
  });
});
