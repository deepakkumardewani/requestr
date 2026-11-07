import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const LANDING_PATH = "/";
const THEME_KEY = "theme";
const SOURCE_LINK = "comparison-source-link";
const STRIP_LABEL = "Measured Requestr speed";
const BLOCKING_IMPACTS = ["serious", "critical"];
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };
const VIEWPORTS = [MOBILE, TABLET, DESKTOP] as const;
const MIN_TAP_PX = 44;
const TAB_SLACK = 12;
const STAT_COUNT = 4;

async function openCompare(page: Page, theme: Theme) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_KEY, theme]
  );
  await page.goto(LANDING_PATH);
  const section = page.locator("#compare");
  await section.scrollIntoViewIfNeeded();
  await expect(
    section.getByRole("heading", { name: /How Requestr stacks up/ })
  ).toBeVisible();
  return section;
}

/** Minimum opacity over the element and its ancestors. */
function minOpacity(target: Locator) {
  return target.evaluate((el) => {
    let min = 1;
    for (let n: Element | null = el; n; n = n.parentElement) {
      min = Math.min(min, Number(getComputedStyle(n).opacity));
    }
    return min;
  });
}

/** Scroll-reveal wrappers start at opacity 0; wait until fully opaque. */
async function expectRevealed(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await expect.poll(() => minOpacity(target)).toBe(1);
}

/** BlurText words animate opacity/blur per span; axe must not sample them mid-reveal. */
async function expectBlurTextSettled(section: Locator) {
  await expect
    .poll(() =>
      section.evaluate(
        (el) =>
          Array.from(
            el.querySelectorAll<HTMLElement>("[style*='blur']")
          ).filter(
            (n) =>
              Number(getComputedStyle(n).opacity) < 1 ||
              (getComputedStyle(n).filter.includes("blur(") &&
                !getComputedStyle(n).filter.includes("blur(0px)"))
          ).length
      )
    )
    .toBe(0);
}

test.describe("P5b comparison upgrade layout, a11y and motion @qa", () => {
  test("@critical tabbing through every Source link focuses each with a visible indicator and a link color distinct from body text", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    const section = await openCompare(page, "light");
    const links = section.locator("table").getByTestId(SOURCE_LINK);
    const total = await links.count();
    expect(total).toBeGreaterThan(10);

    const header = section.getByRole("columnheader", { name: "Requestr" });
    await expectRevealed(header);
    await header.click();

    const seen = new Map<string, { indicator: string; color: string }>();
    const focused = page.locator(`[data-testid="${SOURCE_LINK}"]:focus`);
    for (let i = 0; i < total + TAB_SLACK && seen.size < total; i++) {
      await page.keyboard.press("Tab");
      if ((await focused.count()) !== 1) continue;
      const info = await focused.evaluate((el) => {
        const cs = getComputedStyle(el);
        const hasOutline =
          cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
        const hasShadow = cs.boxShadow !== "none";
        return {
          label: el.getAttribute("aria-label") ?? "",
          visible: hasOutline || hasShadow,
          color: cs.color,
          body: getComputedStyle(document.body).color,
        };
      });
      expect(info.visible, `${info.label}: no focus indicator`).toBe(true);
      expect(info.color, `${info.label}: link color equals body`).not.toBe(
        info.body
      );
      seen.set(info.label, { indicator: "ok", color: info.color });
    }
    expect(seen.size).toBe(total);
    await snap("p5b-01-focused-source-link");
  });

  for (const theme of THEMES) {
    test(`@critical axe reports zero serious/critical violations on the comparison section in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      const section = await openCompare(page, theme);
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^(?!.*dark)/
      );
      await expectRevealed(section.locator("table"));
      await expectRevealed(section.getByRole("heading", { level: 2 }));
      const strip = page.getByRole("region", { name: STRIP_LABEL });
      await expectRevealed(strip);
      await expectBlurTextSettled(section);

      const { violations, passes } = await new AxeBuilder({ page })
        .include("#compare")
        .include(`section[aria-label="${STRIP_LABEL}"]`)
        .analyze();
      // Guards against a vacuous scan: color-contrast must actually have run.
      expect(passes.map((p) => p.id)).toContain("color-contrast");
      const blocking = violations
        .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))
        .map(
          (v) =>
            `${theme} ${v.id}: ${v.nodes
              .map((n) => n.html.slice(0, 120))
              .join(" | ")}`
        );
      expect(blocking).toEqual([]);
    });
  }

  test("@critical at 375px the table scrolls inside its container, the strip is 2x2 and Source links are tappable", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    const section = await openCompare(page, "light");
    const table = section.locator("table");
    await expectRevealed(table);

    const scroller = table.locator("xpath=..");
    const dims = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(dims.scrollWidth).toBeGreaterThan(dims.clientWidth);
    const page_ = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(page_.scrollWidth).toBeLessThanOrEqual(page_.innerWidth);

    const strip = page.getByRole("region", { name: STRIP_LABEL });
    await expectRevealed(strip);
    const cards = strip.locator("dl > div");
    await expect(cards).toHaveCount(STAT_COUNT);
    const boxes = [];
    for (let i = 0; i < STAT_COUNT; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box!);
    }
    const lefts = new Set(boxes.map((b) => Math.round(b.x)));
    const tops = new Set(boxes.map((b) => Math.round(b.y)));
    expect(lefts.size).toBe(2);
    expect(tops.size).toBe(2);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(MOBILE.width);
    }

    const links = table.getByTestId(SOURCE_LINK);
    const count = await links.count();
    expect(count).toBeGreaterThan(10);
    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box, `link ${i} has no box`).not.toBeNull();
      expect(box!.height, `link ${i} height`).toBeGreaterThanOrEqual(
        MIN_TAP_PX
      );
    }
  });

  test("@high with prefers-reduced-motion the table section and strip have no running animation and content is visible immediately", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP);
    const section = await openCompare(page, "light");
    const strip = page.getByRole("region", { name: STRIP_LABEL });
    await strip.scrollIntoViewIfNeeded();
    await section.scrollIntoViewIfNeeded();

    // Content is opaque right away, with no reveal wait.
    const heading = section.getByRole("heading", { level: 2 });
    expect(await minOpacity(heading)).toBe(1);
    expect(await minOpacity(section.locator("table"))).toBe(1);
    expect(await minOpacity(strip)).toBe(1);
    await expect(section.getByTestId(SOURCE_LINK).first()).toBeVisible();

    for (const target of [section, strip]) {
      const running = await target.evaluate((el) =>
        el
          .getAnimations({ subtree: true })
          .filter(
            (a) =>
              a.playState === "running" &&
              Number(a.effect?.getComputedTiming().duration ?? 0) > 0
          )
          .map((a) => a.id || a.constructor.name)
      );
      expect(running).toEqual([]);
    }
  });

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`@high screenshot at ${viewport.width}px in ${theme}`, async ({
        page,
        snap,
      }) => {
        await page.setViewportSize(viewport);
        const section = await openCompare(page, theme);
        await expect(page.locator("html")).toHaveClass(
          theme === "dark" ? /dark/ : /^(?!.*dark)/
        );
        await expectRevealed(section.locator("table"));
        await expect(section.getByTestId(SOURCE_LINK).first()).toBeAttached();
        // Reveal each block in turn (reveals are one-shot), then frame the top
        // of the strip so the shot shows strip, heading and table header.
        const strip = page.getByRole("region", { name: STRIP_LABEL });
        await expectRevealed(
          section.getByRole("heading", { name: /How Requestr stacks up/ })
        );
        await expectRevealed(strip);
        await expectBlurTextSettled(section);
        await strip.evaluate((el) => {
          const top = el.getBoundingClientRect().top + window.scrollY - 72;
          window.scrollTo({ top, behavior: "instant" });
        });
        await snap(`p5b-${viewport.width}-${theme}`);
      });
    }
  }
});
