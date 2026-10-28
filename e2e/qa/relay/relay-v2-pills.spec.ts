import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  attachFromPicker,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import {
  computedColor,
  parseRgb,
  resolveCssColor,
  textContrast,
} from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const MIN_TEXT_CONTRAST = 4.5;
const REQUEST_NAME = "Request A";
const REQUEST_ID = "qa-e2e-relayimp-req-a";
const COLLECTION_ID = "qa-e2e-relayimp-col";
const INLINE_CODE = "GET /api/request-a";
const REPLY = `See [${REQUEST_NAME}](relay://request/${REQUEST_ID}) and [Mocks](relay://collection/${COLLECTION_ID}); run \`${INLINE_CODE}\` to check.`;

const assistant = (page: Page) => page.getByTestId("relay-message-assistant").last();
const replyPills = (page: Page) => assistant(page).locator("[data-relay-pill]");
const inlineCode = (page: Page) => assistant(page).locator("code").filter({ hasText: INLINE_CODE });

/** next-themes reads this key on load, so setting it before navigation fixes the theme. */
async function openInTheme(page: Page, theme: Theme, reply: string) {
  await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
  await installRelayRoutes(page, { kind: "text", text: reply });
  await page.goto(WORKSPACE_PATH);
  await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/);
  await openRelay(page);
}

async function expectNotPrimary(target: Locator) {
  const primary = parseRgb(await resolveCssColor(target, "var(--primary)"));
  const actual = parseRgb(await computedColor(target, "color"));
  expect(actual).not.toEqual(primary);
}

async function expectReplyNeutral(page: Page) {
  await expect(replyPills(page)).toHaveCount(2);
  await expect(inlineCode(page)).toHaveCount(1);
  for (const pill of await replyPills(page).all()) await expectNotPrimary(pill);
  await expectNotPrimary(inlineCode(page));
}

test.describe("Relay v2 neutral pills", () => {
  test("[REL-V2-PILLS-01] light theme: the computed color of every [data-relay-pill] and inline code differs from a var(--primary) probe", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openInTheme(page, "light", REPLY);
    await sendMessage(page, "pills light");
    await expectReplyNeutral(page);
    await snap("01-light-neutral-pills");
  });

  test("[REL-V2-PILLS-02] dark theme: the same comparison holds", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openInTheme(page, "dark", REPLY);
    await sendMessage(page, "pills dark");
    await expectReplyNeutral(page);
    await snap("02-dark-neutral-pills");
  });

  test("[REL-V2-PILLS-03] contrast of pill text against its background is at least 4.5:1 in both themes", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openInTheme(page, "light", REPLY);
    await sendMessage(page, "contrast");
    await expect(replyPills(page)).toHaveCount(2);
    for (const theme of THEMES) {
      // The same rendered reply is re-measured: the theme tokens are class-scoped CSS variables.
      await page.evaluate((value) => {
        document.documentElement.classList.toggle("dark", value === "dark");
      }, theme);
      for (const pill of await replyPills(page).all()) {
        await expect
          .poll(() => textContrast(pill))
          .toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
      await snap(`03-${theme}-contrast`);
    }
  });

  test("[REL-V2-PILLS-04] the user bubble attachment pills are neutral and method badges keep their colour", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await installRelayRoutes(page, { kind: "text", text: "Noted." });
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);
    await attachFromPicker(page, "request", REQUEST_NAME);
    await sendMessage(page, "with attachment");

    const pills = page.getByTestId("relay-message-user").last().getByTestId("relay-attachment-pills").locator("[data-relay-pill]");
    await expect(pills).toHaveCount(1);
    await expectNotPrimary(pills.first());

    const badge = pills.first().getByTestId("relay-pill-method");
    await expect(badge).toHaveText("GET");
    const badgeColor = parseRgb(await computedColor(badge, "color"));
    expect(badgeColor).not.toEqual(parseRgb(await computedColor(pills.first(), "color")));
    expect(Math.max(...badgeColor) - Math.min(...badgeColor)).toBeGreaterThan(20);
    await snap("04-user-bubble-pills");
  });
});
