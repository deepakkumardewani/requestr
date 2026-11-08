import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { RELAY_SCENARIOS } from "../../../src/components/landing/relay/scenarios";

const LANDING_PATH = "/";
const THEME_KEY = "theme";
const THEMES = ["light", "dark"] as const;
const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const STEP_MS = 1500;
// Longer than any single scenario (about 8 s), so a running demo must change.
const LONG_WAIT_MS = 20_000;
const TEST_TIMEOUT_MS = 90_000;
const SETTLE_STEPS = 5;
const SETTLE_STEP_MS = 100;
const CYCLE_BUDGET_STEPS = 40;

/** The deterministic page clock lets a 25 s loop run in milliseconds. */
async function openLanding(page: Page, theme?: string) {
  await page.clock.install();
  if (theme) {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [THEME_KEY, theme]
    );
  }
  await page.goto(LANDING_PATH);
}

async function showRelay(page: Page) {
  const section = page.locator("#relay");
  await section.scrollIntoViewIfNeeded();
  await expect(
    section.getByRole("heading", { name: /Ask for the change/ })
  ).toBeVisible();
  return section;
}

const promptOf = (page: Page) =>
  page.locator("#relay").getByRole("group", { name: "Relay prompt" });

function frameOf(page: Page) {
  return page.evaluate(() => {
    const section = document.querySelector("#relay");
    return {
      prompt:
        section?.querySelector('[aria-label="Relay prompt"]')?.textContent ??
        "",
      reply: section?.querySelector("p[aria-live]")?.textContent ?? "",
      cards: section?.querySelectorAll("button").length ?? 0,
    };
  });
}

async function runClock(page: Page, ms: number) {
  await page.clock.runFor(ms);
}

/** Lets the real IntersectionObserver + React state settle, a little clock at a time. */
async function settle(page: Page) {
  for (let i = 0; i < SETTLE_STEPS; i++) await runClock(page, SETTLE_STEP_MS);
}

/** Resolves once the browser has delivered an intersection notification after a scroll. */
function afterIntersectionUpdate(page: Page) {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const target = document.querySelector("#relay");
        if (!target) return resolve();
        const io = new IntersectionObserver(() => {
          io.disconnect();
          resolve();
        });
        io.observe(target);
      })
  );
}

test.describe("P7 Relay section demo @qa", () => {
  test.setTimeout(TEST_TIMEOUT_MS);

  test("@critical scrolling to the Relay section starts the demo and it cycles at least 3 scenarios", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await openLanding(page);
    await showRelay(page);
    await settle(page);

    const seenPrompts = new Set<string>();
    for (
      let step = 0;
      step < CYCLE_BUDGET_STEPS && seenPrompts.size < RELAY_SCENARIOS.length;
      step++
    ) {
      await runClock(page, STEP_MS);
      const { prompt } = await frameOf(page);
      if (RELAY_SCENARIOS.some((s) => s.prompt === prompt)) {
        seenPrompts.add(prompt);
      }
    }

    expect(RELAY_SCENARIOS.length).toBeGreaterThanOrEqual(3);
    expect([...seenPrompts].sort()).toEqual(
      RELAY_SCENARIOS.map((s) => s.prompt).sort()
    );
    await snap("p7-relay-01-cycled");
  });

  test("@critical scrolling away pauses it and it does not advance while hidden", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await openLanding(page);
    await showRelay(page);
    await settle(page);

    // Prove it is playing first: the prompt types out.
    await expect
      .poll(async () => {
        await runClock(page, STEP_MS);
        return (await frameOf(page)).prompt.length;
      })
      .toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await afterIntersectionUpdate(page);
    await settle(page);

    const paused = await frameOf(page);
    await runClock(page, LONG_WAIT_MS);
    expect(await frameOf(page)).toEqual(paused);
    await snap("p7-relay-02-paused-offscreen");

    // Control: scrolling back resumes the same demo.
    await showRelay(page);
    await settle(page);
    await runClock(page, LONG_WAIT_MS);
    expect(await frameOf(page)).not.toEqual(paused);
  });

  test("@high with reduced motion emulated the section shows a static final frame and never animates", async ({
    page,
    snap,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLanding(page);
    await showRelay(page);
    await settle(page);

    const first = RELAY_SCENARIOS[0]!;
    const section = page.locator("#relay");
    await expect(promptOf(page)).toHaveText(first.prompt);
    await expect(section.locator("p[aria-live]")).toHaveText(first.reply);
    await expect(section.getByText(first.cards[0]!.title)).toBeVisible();

    const finalFrame = await frameOf(page);
    await runClock(page, LONG_WAIT_MS);
    expect(await frameOf(page)).toEqual(finalFrame);
    await snap("p7-relay-03-reduced-motion");
  });

  for (const theme of THEMES) {
    test(`@medium the section renders in ${theme} with no horizontal scroll at 375px`, async ({
      page,
      snap,
    }) => {
      await page.setViewportSize(MOBILE);
      await openLanding(page, theme);
      const section = await showRelay(page);
      await settle(page);

      await expect(promptOf(page)).toBeVisible();
      await expect(section.getByRole("button").first()).toBeAttached();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await snap(`p7-relay-04-375-${theme}`);
    });
  }
});
