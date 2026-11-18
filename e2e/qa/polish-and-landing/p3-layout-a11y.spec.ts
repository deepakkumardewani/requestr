import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import shortcutMessages from "../../../messages/en/shortcuts.json";
import { expect, test } from "../../fixtures/qa";

const SETTINGS_PATH = "/settings";
const RELAY_ENABLED_KEY = "rq_relay_enabled";
const THEME_KEY = "theme";
const TABS = [
  "general",
  "global",
  "appearance",
  "proxy",
  "shortcuts",
  "data",
  "relay",
] as const;
type Tab = (typeof TABS)[number];
const THEMES = ["light", "dark"] as const;
const DESKTOP_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const;
const MOBILE_VIEWPORT = { width: 375, height: 700 };
const BLOCKING_IMPACTS = ["serious", "critical"];
const MAX_TAB_PRESSES = 60;

async function openTab(page: Page, tab: Tab) {
  await page.goto(`${SETTINGS_PATH}#${tab}`);
  const nav = page.getByTestId(`nav-${tab}`);
  await expect(nav).toBeVisible();
  await nav.click();
  await expect(page.locator("#app-main")).not.toBeEmpty();
}

async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_KEY, theme]
  );
}

/** Evidence PNG in the per-task (gitignored) output dir, not the repo tree. */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test.describe("P3 settings layout and accessibility @qa", () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`@critical Shortcuts at ${viewport.width}x${viewport.height} has no vertical scroll`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await openTab(page, "shortcuts");
      const groups = page.getByTestId("shortcut-group");
      await expect(groups.first()).toBeVisible();
      expect(await groups.count()).toBeGreaterThan(1);

      const main = page.locator("#app-main");
      const metrics = await main.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        docScrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
      expect(metrics.docScrollHeight).toBeLessThanOrEqual(metrics.innerHeight);
      await shot(
        page,
        testInfo,
        `shortcuts-${viewport.width}x${viewport.height}`
      );
    });
  }

  for (const theme of THEMES) {
    test(`@critical every tab has zero serious/critical axe violations in ${theme}`, async ({
      page,
    }, testInfo) => {
      await setTheme(page, theme);
      await page.setViewportSize(DESKTOP_VIEWPORTS[0]);
      const failures: string[] = [];
      for (const tab of TABS) {
        await openTab(page, tab);
        await expect(page.locator("html")).toHaveClass(
          theme === "dark" ? /dark/ : /^(?!.*dark)/
        );
        const { violations, passes } = await new AxeBuilder({ page })
          .include("body")
          .analyze();
        // Guards against a vacuous scan.
        expect(passes.length, `${tab}: axe ran nothing`).toBeGreaterThan(0);
        const blocking = violations
          .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))
          .map(
            (v) =>
              `${tab} (${theme}) ${v.id}: ${v.nodes
                .map((n) => n.html.slice(0, 120))
                .join(" | ")}`
          );
        failures.push(...blocking);
        if (tab === "shortcuts")
          await shot(page, testInfo, `axe-${theme}-${tab}`);
      }
      expect(failures).toEqual([]);
    });
  }

  test("@high every tab at 375px has no horizontal scroll and visible focus rings", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    const failures: string[] = [];
    for (const tab of TABS) {
      await openTab(page, tab);
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth - window.innerWidth,
        main:
          (document.getElementById("app-main")?.scrollWidth ?? 0) -
          (document.getElementById("app-main")?.clientWidth ?? 0),
      }));
      if (overflow.doc > 0 || overflow.main > 0) {
        failures.push(
          `${tab}: horizontal overflow doc=${overflow.doc}px main=${overflow.main}px`
        );
      }
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur()
      );
      let focusedCount = 0;
      for (let i = 0; i < MAX_TAB_PRESSES; i++) {
        await page.keyboard.press("Tab");
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          // Next.js dev-overlay host, not app UI.
          if (el.tagName.toLowerCase() === "nextjs-portal")
            return { skip: true };
          const s = getComputedStyle(el);
          const hasOutline =
            s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
          const hasShadow = s.boxShadow !== "none";
          const name = `${el.tagName.toLowerCase()}${
            el.getAttribute("data-testid")
              ? `[${el.getAttribute("data-testid")}]`
              : ""
          }${el.id ? `#${el.id}` : ""}`;
          return { name, ring: hasOutline || hasShadow };
        });
        if (!state) break;
        if ("skip" in state) continue;
        focusedCount++;
        if (!state.ring)
          failures.push(`${tab}: no focus ring on ${state.name}`);
      }
      expect(focusedCount, `${tab}: nothing focusable`).toBeGreaterThan(0);
      if (tab === "shortcuts") await shot(page, testInfo, `mobile-${tab}`);
    }
    expect(failures).toEqual([]);
  });

  test("@medium Relay disabled: Relay tab shows its disabled state and Shortcuts hides the Relay toggle row", async ({
    page,
  }, testInfo) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "false");
    }, RELAY_ENABLED_KEY);
    await page.setViewportSize(DESKTOP_VIEWPORTS[0]);

    await openTab(page, "relay");
    await expect(page.getByTestId("nav-relay-off")).toBeVisible();
    await expect(page.getByTestId("relay-settings")).toHaveAttribute(
      "data-relay-enabled",
      "false"
    );
    await expect(page.getByTestId("relay-enabled-switch")).not.toBeChecked();
    await expect(page.getByTestId("relay-share-values-switch")).toBeDisabled();
    await expect(page.getByTestId("relay-permission-select")).toBeDisabled();
    await shot(page, testInfo, "relay-off-tab");

    await openTab(page, "shortcuts");
    await expect(page.getByTestId("shortcut-group").first()).toBeVisible();
    const label = (shortcutMessages as Record<string, string>).relayToggle;
    await expect(
      page.getByTestId("shortcut-groups").getByText(label, { exact: true })
    ).toHaveCount(0);
    await shot(page, testInfo, "shortcuts-relay-off");
  });
});
