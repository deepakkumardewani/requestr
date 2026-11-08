import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const THEME_KEY = "theme";
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
] as const;
const MOTIONS = ["no-preference", "reduce"] as const;
const AXE_PAGES = ["/", "/features", "/privacy", "/terms"] as const;
const BLOCKING_IMPACTS = ["serious", "critical"];
const SHOT_DIR = "agent_docs/polish-and-landing/qa/p7";
const SECTION_SELECTOR = "main > section";
const EXPECTED_SECTIONS = 8;
const SCROLL_STEP_RATIO = 0.6;
const SUBPIXEL_TOLERANCE = 1;
// Names of AI model vendors / products that must not appear in landing copy (AC-45).
const AI_VENDORS =
  /\b(open\s?ai|chat\s?gpt|gpt-?\d?\w*|anthropic|claude|gemini|copilot|llama|mistral|perplexity|deepseek|cohere)\b/i;
const VENDOR_PAGES = ["/", "/features", "/privacy", "/terms"] as const;
// Known app bugs (reported, not fixed here): remove the matching test.fail() once fixed.
const CONTRAST_BUG_PAGES: readonly string[] = ["/", "/features"];
const VENDOR_BUG_PAGES: readonly string[] = ["/features"];

async function prepare(page: Page, theme: Theme, path: string) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_KEY, theme]
  );
  await page.goto(path);
  await expect(page.locator("html")).toHaveClass(
    theme === "dark" ? /dark/ : /^(?!.*dark)/
  );
}

/** Scrolls the page in viewport-sized steps so every scroll-reveal wrapper fires. */
async function scrollThrough(page: Page) {
  await page.evaluate(async (ratio) => {
    const step = Math.max(200, window.innerHeight * ratio);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.body.scrollHeight);
  }, SCROLL_STEP_RATIO);
}

// Scroll-reveal wrappers hold inline `opacity: 0;` until they enter view. The
// z-indexed ones are the intentionally hidden cards of the comparison deck, and
// empty ones are decorative glow layers, so only text-bearing wrappers count.
const HIDDEN_REVEAL = "[style*='opacity: 0;']:not([style*='z-index'])";

function hiddenRevealCount(scope: Locator) {
  return scope.evaluate(
    (el, selector) =>
      [el, ...el.querySelectorAll<HTMLElement>(selector)].filter(
        (n) => n.matches(selector) && (n.textContent ?? "").trim() !== ""
      ).length,
    HIDDEN_REVEAL
  );
}

/** Scroll the section into view, then wait until none of its reveals is still at opacity 0. */
async function settle(section: Locator) {
  await section.scrollIntoViewIfNeeded();
  await expect.poll(() => hiddenRevealCount(section)).toBe(0);
}

async function settleAll(page: Page) {
  await scrollThrough(page);
  const sections = page.locator(SECTION_SELECTOR);
  const count = await sections.count();
  for (let i = 0; i < count; i++) await settle(sections.nth(i));
  await settle(page.getByRole("contentinfo"));
}

test.describe("P7 landing layout, motion and accessibility @qa", () => {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`@critical every landing section at ${viewport.name} in ${theme} has no horizontal scroll (AC-44)`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await prepare(page, theme, "/");
        await settleAll(page);

        const sections = page.locator(SECTION_SELECTOR);
        // Non-vacuous: every landing section is actually rendered.
        expect(await sections.count()).toBeGreaterThanOrEqual(EXPECTED_SECTIONS);

        const doc = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        }));
        expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
        expect(doc.bodyScrollWidth).toBeLessThanOrEqual(doc.clientWidth);

        const overflowing = await page.evaluate(
          ([selector, tolerance]) => {
            const vw = document.documentElement.clientWidth;
            return Array.from(document.querySelectorAll(selector as string))
              .concat(Array.from(document.querySelectorAll("footer")))
              .filter((s) => {
                const r = s.getBoundingClientRect();
                return (
                  r.right > vw + (tolerance as number) ||
                  r.left < -(tolerance as number)
                );
              })
              .map((s) => s.id || s.getAttribute("aria-label") || s.tagName);
          },
          [SECTION_SELECTOR, SUBPIXEL_TOLERANCE]
        );
        expect(overflowing).toEqual([]);
      });
    }
  }

  for (const path of AXE_PAGES) {
    for (const theme of THEMES) {
      test(`@critical axe reports zero serious/critical violations on ${path} in ${theme} (AC-44)`, async ({
        page,
      }) => {
        test.fail(
          CONTRAST_BUG_PAGES.includes(path),
          "App bug: low-contrast text (text-muted-foreground/50-60, method colors, blue-400/70) fails axe color-contrast on landing and /features"
        );
        await page.setViewportSize({ width: 1440, height: 900 });
        await prepare(page, theme, path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (path === "/") await settleAll(page);
        else await scrollThrough(page);
        await page.evaluate(() => window.scrollTo(0, 0));

        const { violations, passes } = await new AxeBuilder({ page }).analyze();
        // Guards against a vacuous scan: contrast checking must have run.
        expect(passes.map((p) => p.id)).toContain("color-contrast");
        const blocking = violations
          .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))
          .map(
            (v) =>
              `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(" | ")}`
          );
        expect(blocking).toEqual([]);
      });
    }
  }

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const motion of MOTIONS) {
        test(`@high with reduced motion ${motion === "reduce" ? "on" : "off"} every section renders at ${viewport.name} in ${theme} (AC-44)`, async ({
          page,
        }) => {
          await page.emulateMedia({ reducedMotion: motion });
          await page.setViewportSize(viewport);
          await prepare(page, theme, "/");
          await scrollThrough(page);

          const sections = page.locator(SECTION_SELECTOR);
          const count = await sections.count();
          expect(count).toBeGreaterThanOrEqual(EXPECTED_SECTIONS);

          for (let i = 0; i < count; i++) {
            const section = sections.nth(i);
            await settle(section);
            const box = await section.boundingBox();
            expect(box?.height ?? 0).toBeGreaterThan(0);
            await expect(section).toContainText(/\S/);
            const label =
              (await section.getAttribute("id")) ??
              (await section.getAttribute("aria-label"))
                ?.toLowerCase()
                .replace(/\W+/g, "-") ??
              `section-${i}`;
            await section.screenshot({
              path: `${SHOT_DIR}/${viewport.name}-${theme}-${motion}-${String(i).padStart(2, "0")}-${label}.png`,
            });
          }

          const footer = page.getByRole("contentinfo");
          await settle(footer);
          await expect(footer.getByRole("link").first()).toBeVisible();
          await footer.screenshot({
            path: `${SHOT_DIR}/${viewport.name}-${theme}-${motion}-footer.png`,
          });
        });
      }
    }
  }

  for (const path of VENDOR_PAGES) {
    test(`@medium no AI vendor names appear in the copy of ${path} (AC-45)`, async ({
      page,
    }) => {
      test.fail(
        VENDOR_BUG_PAGES.includes(path),
        "App bug: /features copy names OpenAI (src/components/landing/data/features.ts import-collections description)"
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const text = await page.locator("body").innerText();
      // Non-vacuous: substantial copy was read.
      expect(text.length).toBeGreaterThan(200);
      const html = await page.content();
      const attrs = Array.from(
        html.matchAll(/(?:alt|aria-label|title|content)="([^"]*)"/g)
      ).map((m) => m[1]);
      const hit = [text, ...attrs].map((t) => t.match(AI_VENDORS)?.[0]);
      expect(hit.filter(Boolean)).toEqual([]);
    });
  }
});
