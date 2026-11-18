import { expect, test } from "../../fixtures/qa";

const LANDING_PATH = "/";
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };
const OK_STATUS = 200;
const OPERATOR = "Deepak Dewani";
const CONTACT_EMAIL = "deepakkumardewani@gmail.com";
const EFFECTIVE_DATE = "8 November 2026";
const NOT_ADVICE = /not legal advice/i;

const LEGAL_PAGES = [
  {
    name: "Privacy",
    path: "/privacy",
    h1: "Privacy Policy",
    // Data-flow terms specific to each page.
    dataFlow: [/proxy/i, /third-party/i, /24 hours/i, /IndexedDB|browser/i],
  },
  {
    name: "Terms",
    path: "/terms",
    h1: "Terms & Conditions",
    dataFlow: [/proxy/i, /third-party/i, /24 hours/i, /browser/i],
  },
] as const;

test.describe("P7 header, footer and legal pages @qa", () => {
  test("@critical header has no Docs link; footer still has Docs (AC-42)", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(LANDING_PATH);

    const header = page.getByRole("navigation", { name: "Main navigation" });
    await expect(header).toBeVisible();
    // Non-vacuous: the header is rendered with real links before asserting absence.
    await expect(
      header.getByRole("link", { name: "Requestr" }).first()
    ).toBeVisible();
    await expect(header.getByRole("link", { name: /docs/i })).toHaveCount(0);

    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    const docs = footer.getByRole("link", { name: "Docs", exact: true });
    await expect(docs).toBeVisible();
    await expect(docs).toHaveAttribute("href", /^https:\/\//);
    await snap("p7-nav-01-footer-docs");
  });

  test("@critical footer Privacy and Terms links navigate to /privacy and /terms and respond 200 (AC-42)", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    for (const legal of LEGAL_PAGES) {
      await page.goto(LANDING_PATH);
      const footer = page.getByRole("contentinfo");
      const link = footer.getByRole("link", { name: legal.name, exact: true });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toHaveAttribute("href", legal.path);

      await link.click();
      await expect(page).toHaveURL(new RegExp(`${legal.path}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: legal.h1 })
      ).toBeVisible();

      const response = await page.request.get(legal.path);
      expect(response.status()).toBe(OK_STATUS);
      await snap(`p7-nav-02-${legal.name.toLowerCase()}-page`);
    }
  });

  test("@high each legal page shows operator, India, contact email, effective date, the not-legal-advice note and the data-flow terms (AC-43)", async ({
    page,
    snap,
  }) => {
    for (const legal of LEGAL_PAGES) {
      await page.goto(legal.path);
      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { level: 1, name: legal.h1 })
      ).toBeVisible();
      await expect(main).toContainText(OPERATOR);
      await expect(main).toContainText("India");
      await expect(
        main.getByRole("link", { name: CONTACT_EMAIL })
      ).toHaveAttribute("href", `mailto:${CONTACT_EMAIL}`);
      await expect(main).toContainText(`Effective date: ${EFFECTIVE_DATE}`);
      await expect(main.getByRole("note")).toHaveText(NOT_ADVICE);
      for (const term of legal.dataFlow) {
        await expect(main).toContainText(term);
      }
      await snap(`p7-nav-03-${legal.name.toLowerCase()}-content`);
    }
  });

  test("@high each legal page has title, description, canonical and OG tags and no noindex (FR-48)", async ({
    page,
  }) => {
    for (const legal of LEGAL_PAGES) {
      await page.goto(legal.path);
      await expect(page).toHaveTitle(
        new RegExp(
          `${legal.name === "Privacy" ? "Privacy Policy" : "Terms"}.*Requestr`
        )
      );

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute("content", /^.{40,}$/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`${legal.path}$`)
      );
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        /Requestr/
      );
      await expect(
        page.locator('meta[property="og:description"]')
      ).toHaveAttribute("content", /^.{40,}$/);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        new RegExp(`${legal.path}$`)
      );
      // No robots meta may contain noindex.
      await expect(
        page.locator('meta[name="robots"][content*="noindex"]')
      ).toHaveCount(0);

      const response = await page.request.get(legal.path);
      expect(response.headers()["x-robots-tag"] ?? "").not.toMatch(/noindex/i);
    }
  });
});
