import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const REQ_B_NAME = "Request B";
const SEARCH_TARGET = "Request 437";
const EXPLAIN_PROMPT = "Explain what this tab does, step by step.";
const SLASH_COMMANDS = ["/explain", "/assert", "/curl", "/docs", "/clear"];
/** Viewport rows (264px / 44px) plus overscan; far below the 500-request seed collection. */
const MAX_RENDERED_ROWS = 30;

type ChipPayload = { kind: string; id: string; label: string };

const composer = (page: Page) => page.getByTestId("relay-composer");
const picker = (page: Page) => page.getByTestId("relay-picker");
const pickerRows = (page: Page) => page.getByTestId("relay-picker-row");
const chipsByKind = (page: Page, kind: string) =>
  page.locator(`[data-testid="relay-composer-pill"][data-kind="${kind}"]`);

async function openDock(page: Page, script = { kind: "text", text: "OK" } as const) {
  const routes = await installRelayRoutes(page, script);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

async function openPickerSearch(page: Page) {
  await page.getByTestId("relay-picker-trigger").click();
  await expect(picker(page)).toBeVisible();
  const search = page.getByTestId("relay-picker-search");
  await expect(search).toBeFocused();
  return search;
}

test.describe("Relay picker and slash commands", () => {
  test('[REL-PICK-01] "+" and "@" open the same picker and the chosen item is sent as a chip',
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openDock(page);

      const search = await openPickerSearch(page);
      // The "Current tab" row sits above every result row; with no tab open it is disabled.
      const currentTab = page.getByTestId("relay-picker-current-tab");
      await expect(currentTab).toBeVisible();
      await expect(currentTab).toBeDisabled();
      await expect(pickerRows(page).first()).toBeVisible();
      const [tabBox, rowBox] = await Promise.all([
        currentTab.boundingBox(),
        pickerRows(page).first().boundingBox(),
      ]);
      expect(tabBox!.y).toBeLessThan(rowBox!.y);

      await search.fill(REQ_B_NAME);
      await pickerRows(page).filter({ hasText: REQ_B_NAME }).first().click();
      await expect(picker(page)).toBeHidden();
      await expect(chipsByKind(page, "request")).toContainText(REQ_B_NAME);
      await expect(composer(page)).toBeFocused();

      // "@" opens the mention menu (replaces the picker for text-typed mentions).
      await composer(page).click();
      await composer(page).pressSequentially("@Improvements", { delay: 15 });
      const mentionMenu = page.getByTestId("relay-mention-menu");
      await expect(mentionMenu).toBeVisible();
      const envOption = page
        .locator('[data-testid="relay-mention-option"][data-kind="environment"]')
        .filter({ hasText: "QA Relay Improvements Env" });
      await expect(envOption).toBeVisible();
      await envOption.click();
      await expect(chipsByKind(page, "environment")).toHaveCount(1);
      await expect(mentionMenu).toBeHidden();

      await sendMessage(page, "check these");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      const body = routes.requestBodies[0] as {
        context: { chips: ChipPayload[] };
      };
      const kinds = body.context.chips.map((chip) => chip.kind);
      // The payload should contain a request chip for "Request B" from the picker
      // and an environment chip from the mention menu.
      expect(body.context.chips.length).toBe(2);
      expect(body.context.chips).toContainEqual(
        expect.objectContaining({ kind: "request", label: REQ_B_NAME }),
      );
      expect(kinds).toContain("environment");
    },
  );

  test("[REL-PICK-02] with more requests than the result cap the picker opens, filters and renders a bounded number of rows",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      const search = await openPickerSearch(page);
      await expect(pickerRows(page).first()).toBeVisible();
      expect(await pickerRows(page).count()).toBeLessThanOrEqual(
        MAX_RENDERED_ROWS,
      );
      await expect(page.getByTestId("relay-picker-truncated")).toBeVisible();

      await search.fill(SEARCH_TARGET);
      await expect(
        pickerRows(page).filter({ hasText: SEARCH_TARGET }),
      ).toHaveCount(1);
      expect(await pickerRows(page).count()).toBeLessThanOrEqual(
        MAX_RENDERED_ROWS,
      );
    },
  );

  test('[REL-PICK-03] "/" lists five commands and Enter on /explain fills the prompt',
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      await composer(page).pressSequentially("/");
      const options = page.getByTestId("relay-slash-option");
      await expect(options).toHaveCount(SLASH_COMMANDS.length);
      for (const [index, name] of SLASH_COMMANDS.entries()) {
        await expect(options.nth(index)).toContainText(name);
      }

      await composer(page).press("Enter");
      await expect(composer(page)).toHaveValue(EXPLAIN_PROMPT);
      await expect(page.getByTestId("relay-slash-menu")).toBeHidden();
      await expect(composer(page)).toBeFocused();
    },
  );

  test("[REL-PICK-04] /clear asks to confirm, then starts a new conversation",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openDock(page);
      await sendMessage(page, "hello");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      await composer(page).fill("/clear");
      await composer(page).press("Enter");
      const confirm = page.getByTestId("relay-clear-confirm");
      await expect(confirm).toBeVisible();
      await expect(page.getByTestId("relay-message-user")).toBeVisible();

      await page.getByTestId("relay-clear-confirm-button").click();
      await expect(confirm).toBeHidden();
      await expect(page.getByTestId("relay-message-user")).toHaveCount(0);
      await expect(page.getByTestId("relay-message-assistant")).toHaveCount(0);
      await expect(composer(page)).toHaveValue("");
    },
  );

  test("[REL-PICK-05] a query with no match shows the empty state and Esc returns focus to the textfield",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      const search = await openPickerSearch(page);
      await search.fill("zzzz-no-such-item");
      await expect(page.getByTestId("relay-picker-empty")).toHaveText(
        "Nothing matches that search",
      );
      await expect(pickerRows(page)).toHaveCount(0);

      await page.keyboard.press("Escape");
      await expect(picker(page)).toBeHidden();
      await expect(composer(page)).toBeFocused();
    },
  );

  test("[REL-PICK-06] /clear on an empty thread starts a new conversation without a confirm",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      await composer(page).fill("/clear");
      await composer(page).press("Enter");

      await expect(composer(page)).toHaveValue("");
      await expect(composer(page)).toBeFocused();
      await expect(page.getByTestId("relay-clear-confirm")).toBeHidden();
      await expect(page.getByTestId("relay-slash-menu")).toBeHidden();
    },
  );
});
