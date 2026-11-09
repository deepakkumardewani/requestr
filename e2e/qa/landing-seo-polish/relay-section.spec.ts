import type { Page } from "@playwright/test";
import { test as base } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// The marketing root lives at the origin root, not under the /app basePath.
const originUrl = (baseURL: string | undefined, path: string) =>
  new URL(path, new URL(baseURL as string).origin).toString();

const LOOP_URL = "**/media/relay/relay-loop.*";
const FULL_CUT_PATTERN = /\/media\/relay\/relay-full\./;
const LAYOUT_SHIFT_LIMIT = 0.1;
const RELAY_HEADLINE = "An AI built into the app. It does what you do.";

async function gotoLanding(page: Page, baseURL: string | undefined) {
  await page.goto(originUrl(baseURL, "/"));
  // Relay is code-split; wait for it to attach before using it.
  await expect(page.locator("main > section#relay")).toBeAttached();
}

/** Sums non-input-driven layout shifts from the moment `window.__cls` is reset. */
async function trackLayoutShift(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) w.__cls += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: false });
  });
}

const readLayoutShift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cls: number }).__cls);

function trackRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (req) => urls.push(req.url()));
  return {
    fullCut: () => urls.filter((u) => FULL_CUT_PATTERN.test(u)),
    scripts: () => urls.filter((u) => /\.js(\?|$)/.test(u)),
  };
}

test.describe("Relay section media and demo modal @qa", () => {
  test("@critical Relay section is directly after Hero; the loop is muted, looping, playsInline and plays", async ({
    page,
    baseURL,
    snap,
  }) => {
    await gotoLanding(page, baseURL);

    const ids = await page
      .locator("main > section")
      .evaluateAll((els) => els.map((el) => el.id));
    expect(ids.indexOf("relay")).toBe(ids.indexOf("hero") + 1);

    const relay = page.locator("#relay");
    await relay.scrollIntoViewIfNeeded();
    const loop = relay.locator("video");
    await expect(loop).toBeAttached();

    await expect(loop).toHaveJSProperty("muted", true);
    await expect(loop).toHaveJSProperty("loop", true);
    await expect(loop).toHaveJSProperty("playsInline", true);
    await expect(loop).toHaveJSProperty("autoplay", true);
    await expect
      .poll(() =>
        loop.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)
      )
      .toBe(true);
    // Fully faded in only once actually playing.
    await expect(loop).toHaveCSS("opacity", "1");

    await snap("01-relay-loop-playing");
  });

  test("@critical Watch demo opens the modal; the full cut is not requested before open and plays after explicit Play", async ({
    page,
    baseURL,
    snap,
  }) => {
    const requests = trackRequests(page);
    await gotoLanding(page, baseURL);
    await page.locator("#relay").scrollIntoViewIfNeeded();
    await expect(page.locator("#relay video")).toBeAttached();
    expect(requests.fullCut()).toEqual([]);

    await page
      .locator("#relay")
      .getByRole("button", { name: "Watch the demo" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Watch the demo" });
    await expect(dialog).toBeVisible();
    await expect.poll(() => requests.fullCut().length).toBeGreaterThan(0);

    const full = dialog.locator("video");
    await expect(full).toHaveJSProperty("paused", true);
    await snap("02-modal-open-before-play");

    await dialog.getByRole("button", { name: "Play", exact: true }).click();
    await expect
      .poll(() =>
        full.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)
      )
      .toBe(true);
    await expect(full).toHaveAttribute("controls", "");

    await snap("03-modal-playing");
  });

  test.describe("reduced motion", () => {
    test("@high headline fully visible at once and the loop does not autoplay", async ({
      page,
      baseURL,
      snap,
    }) => {
      const requests: string[] = [];
      page.on("request", (req) => requests.push(req.url()));
      // Set before navigation: the `reducedMotion` test option is not applied here.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await gotoLanding(page, baseURL);

      const relay = page.locator("#relay");
      await relay.scrollIntoViewIfNeeded();

      const headline = relay.getByRole("heading", { level: 2 });
      await expect(headline).toHaveText(RELAY_HEADLINE);
      await expect(headline).toBeVisible();
      // No per-word animated spans: the static fallback renders.
      await expect(headline.locator("[aria-hidden]")).toHaveCount(0);
      await expect(headline).toHaveCSS("opacity", "1");

      await expect(relay.getByRole("img")).toBeVisible();
      await expect(relay.locator("video")).toHaveCount(0);
      expect(requests.filter((u) => /relay-loop\./.test(u))).toEqual([]);

      await snap("05-reduced-motion");
    });
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    for (const theme of ["light", "dark"] as const) {
      test(`@medium ${viewport.width} px ${theme}: no horizontal scroll, headline and CTA above the fold`, async ({
        page,
        baseURL,
        snap,
      }) => {
        await page.addInitScript((value) => {
          localStorage.setItem("theme", value);
        }, theme);
        await page.setViewportSize(viewport);
        await gotoLanding(page, baseURL);
        await expect(page.locator("html")).toHaveClass(
          new RegExp(`\\b${theme}\\b`)
        );

        const hero = page.locator("#hero");
        const h1 = hero.getByRole("heading", { level: 1 });
        const cta = hero.getByRole("button", { name: "Watch the demo" });
        await expect(h1).toBeInViewport();
        await expect(cta).toBeInViewport();

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);

        await page.locator("#relay").scrollIntoViewIfNeeded();
        const relayOverflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        );
        expect(relayOverflow).toBeLessThanOrEqual(0);

        await snap(`06-fold-${viewport.width}-${theme}`);
      });
    }
  }

  test("@medium before the modal opens no modal chunk or full-cut media is requested; after open both load", async ({
    page,
    baseURL,
    snap,
  }) => {
    const requests = trackRequests(page);
    await gotoLanding(page, baseURL);
    const relay = page.locator("#relay");
    await relay.scrollIntoViewIfNeeded();
    await expect(relay.locator("video")).toBeAttached();
    await expect(
      relay.getByRole("button", { name: "Watch the demo" })
    ).toBeVisible();

    const scriptsBefore = requests.scripts();
    expect(scriptsBefore.filter((u) => /DemoModal/i.test(u))).toEqual([]);
    expect(requests.fullCut()).toEqual([]);

    await relay.getByRole("button", { name: "Watch the demo" }).click();
    await expect(
      page.getByRole("dialog", { name: "Watch the demo" })
    ).toBeVisible();

    // Prod chunk names are hashed, so also require that a new script loaded.
    await expect
      .poll(() => requests.scripts().length)
      .toBeGreaterThan(scriptsBefore.length);
    await expect.poll(() => requests.fullCut().length).toBeGreaterThan(0);

    await snap("07-lazy-modal-loaded");
  });
});

// Aborting the media requests makes Chromium log "Failed to load resource" per
// aborted source. The shared consoleGuard has no allowlist for that, so this
// test uses the plain Playwright test with an equally strict scoped guard:
// only those aborted-media errors are tolerated, anything else fails.
base.describe("Relay loop blocked @qa", () => {
  base(
    "@high video request blocked: poster stays, no layout shift (CLS < 0.1)",
    async ({ page, baseURL }) => {
      const consoleIssues: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "warning") consoleIssues.push(msg.text());
        if (
          msg.type() === "error" &&
          msg.text() !== "Failed to load resource: net::ERR_FAILED"
        ) {
          consoleIssues.push(msg.text());
        }
      });
      page.on("pageerror", (err) => consoleIssues.push(err.message));

      let blocked = 0;
      await page.route(LOOP_URL, (route) => {
        blocked += 1;
        return route.abort();
      });
      await gotoLanding(page, baseURL);

      const relay = page.locator("#relay");
      const poster = relay.getByRole("img");
      const before = await poster.boundingBox();
      await trackLayoutShift(page);
      await relay.scrollIntoViewIfNeeded();

      // The player unmounts itself once no source loads; the poster remains.
      await expect.poll(() => blocked).toBeGreaterThan(0);
      await expect(relay.locator("video")).toHaveCount(0);
      await expect(poster).toBeVisible();
      await expect(poster).toHaveJSProperty("complete", true);
      expect(
        await poster.evaluate((i: HTMLImageElement) => i.naturalWidth)
      ).toBeGreaterThan(0);

      const after = await poster.boundingBox();
      expect(after?.height).toBe(before?.height);
      expect(await readLayoutShift(page)).toBeLessThan(LAYOUT_SHIFT_LIMIT);
      expect(consoleIssues).toEqual([]);

      await page.screenshot({
        path: "agent_docs/qa/relay-section/04-loop-blocked-poster.png",
      });
    }
  );
});
