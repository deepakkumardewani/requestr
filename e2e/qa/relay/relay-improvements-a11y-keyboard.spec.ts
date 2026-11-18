import type { Page } from "@playwright/test";
import { openRelayEditor, typeAndSend } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const REQUEST_A_ID = "qa-e2e-relayimp-req-a";
const REQUEST_A_URL = "https://example.com/api/request-a";
const SLASH_COMMAND_COUNT = 15;
const SLASH_GROUP_COUNT = 6;

const composer = (page: Page) => page.getByTestId("relay-composer");
const pickerTrigger = (page: Page) => page.getByTestId("relay-picker-trigger");
const launcher = (page: Page) => page.getByTestId("relay-launcher");
const slashMenu = (page: Page) => page.getByTestId("relay-slash-menu");
const historyButton = (page: Page) => page.getByTestId("history-actions-btn");

async function openDock(page: Page, text = "OK") {
  await installRelayRoutes(page, { kind: "text", text });
  await page.goto(WORKSPACE_PATH);
  await openRelayEditor(page);
}

async function showHistory(page: Page) {
  await page.getByTestId("sidebar-tab-history").click();
  await expect(historyButton(page)).toBeVisible();
}

test.describe("Relay keyboard walkthrough", () => {
  test("[REL-IA11Y-01] keyboard only: \"+\" picker, slash menu, pill Enter, history ⋯ and Export submenu",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openDock(
        page,
        `See [Request A](relay://request/${REQUEST_A_ID}) for details.`,
      );

      // "+" launcher: first Tab stop after the composer (see relay-improvements-a11y-mic).
      await composer(page).focus();
      await page.keyboard.press("Tab");
      await expect(pickerTrigger(page)).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(launcher(page)).toBeVisible();
      await expect(page.getByTestId("relay-launcher-search")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(launcher(page)).toBeHidden();

      // Slash menu: ArrowDown + Enter picks a command.
      await composer(page).focus();
      await page.keyboard.type("/");
      await expect(slashMenu(page)).toBeVisible();
      await expect(page.getByTestId("relay-slash-group")).toHaveCount(
        SLASH_GROUP_COUNT,
      );
      await expect(page.getByTestId("relay-slash-option")).toHaveCount(
        SLASH_COMMAND_COUNT,
      );
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(slashMenu(page)).toBeHidden();
      // The chosen command becomes an inline command pill; the typed "/" is consumed.
      await expect(page.getByTestId("relay-command-pill")).toHaveCount(1);
      await expect(composer(page)).not.toHaveText("/");
      const mentionMenu = page.getByTestId("relay-mention-menu");
      if (await mentionMenu.isVisible()) {
        await page.keyboard.press("Escape");
        await expect(mentionMenu).toBeHidden();
      }

      // Pill: focus it and activate with Enter.
      await typeAndSend(page, "show request");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
      const pill = page.getByTestId("relay-entity-pill").first();
      await expect(pill).toBeVisible();
      await pill.focus();
      await expect(pill).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("url-input")).toHaveValue(REQUEST_A_URL);

      // History menu: Enter opens on Export, Enter opens the submenu.
      await showHistory(page);
      await historyButton(page).focus();
      await page.keyboard.press("Enter");
      const exportTrigger = page.getByTestId("history-export-trigger");
      await expect(exportTrigger).toBeVisible();
      // Opening with the keyboard lands focus on the first item, "Export".
      await expect(exportTrigger).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("history-export-json")).toBeVisible();
      await expect(page.getByTestId("history-export-json")).toBeFocused();
    },
  );

  test("[REL-IA11Y-06] Esc from the launcher, slash menu and history menu returns focus to the trigger",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      await pickerTrigger(page).focus();
      await page.keyboard.press("Enter");
      await expect(launcher(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(launcher(page)).toBeHidden();
      // By design the launcher returns focus to the trigger button.
      await expect(pickerTrigger(page)).toBeFocused();

      await composer(page).focus();
      await page.keyboard.type("/");
      await expect(slashMenu(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(slashMenu(page)).toBeHidden();
      await expect(composer(page)).toBeFocused();

      await showHistory(page);
      await historyButton(page).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("history-export-trigger")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("history-export-trigger")).toBeHidden();
      await expect(historyButton(page)).toBeFocused();
    },
  );
});
