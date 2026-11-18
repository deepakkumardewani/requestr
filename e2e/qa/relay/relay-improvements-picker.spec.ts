import type { Page } from "@playwright/test";
import { openRelayEditor, typeAndSend } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes, lastUserMessage, lastUserText } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const REQ_B_NAME = "Request B";
const SEARCH_TARGET = "Request 437";
const EXPLAIN_PROMPT =
  "Explain what is attached or open in my tab. Use the active context and last response tools to inspect it, then walk through it step by step.";
const SLASH_GROUP_LABELS = [
  "Understand",
  "Build",
  "Test",
  "Run",
  "Share",
  "Chat",
] as const;
const SLASH_COMMANDS = [
  "/explain",
  "/summarize",
  "/docs",
  "/new",
  "/import",
  "/chain",
  "/env",
  "/assert",
  "/tests",
  "/run",
  "/fix",
  "/diff",
  "/curl",
  "/export",
  "/clear",
] as const;
/** Viewport rows (264px / 44px) plus overscan; far below the 500-request seed collection. */
const MAX_RENDERED_ROWS = 30;

type ChipPayload = { kind: string; id: string; label: string };

const composer = (page: Page) => page.getByTestId("relay-composer");
const launcher = (page: Page) => page.getByTestId("relay-launcher");
const mentionMenu = (page: Page) => page.getByTestId("relay-mention-menu");
const mentionOptions = (page: Page) => page.getByTestId("relay-mention-option");
const chipsByKind = (page: Page, kind: string) =>
  page.locator(`[data-testid="relay-composer-pill"][data-kind="${kind}"]`);

async function openDock(page: Page, script = { kind: "text", text: "OK" } as const) {
  const routes = await installRelayRoutes(page, script);
  await page.goto(WORKSPACE_PATH);
  await openRelayEditor(page);
  return routes;
}

async function openLauncherRequestList(page: Page) {
  await page.getByTestId("relay-picker-trigger").click();
  await expect(launcher(page)).toBeVisible();
  // Click the "request" attach row to open the list view
  const requestRow = page
    .getByTestId("relay-launcher-row")
    .filter({ has: page.getByText(/request/i) })
    .first();
  await requestRow.click();
  // Now in list view with mention menu visible
  await expect(mentionMenu(page)).toBeVisible();
  const search = page.getByTestId("relay-launcher-search");
  await expect(search).toBeFocused();
  return search;
}

test.describe("Relay picker and slash commands", () => {
  test('[REL-PICK-01] "+" and "@" open the launcher; items are attached as pills',
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openDock(page);

      const search = await openLauncherRequestList(page);
      // In list view, all requests are shown via mention menu
      await expect(mentionOptions(page).first()).toBeVisible();

      await search.fill(REQ_B_NAME);
      await mentionOptions(page).filter({ hasText: REQ_B_NAME }).first().click();
      await expect(launcher(page)).toBeHidden();
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

      await typeAndSend(page, "check these");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // Attachments travel on the user message that carried them, never in the shared context (BUG-01).
      const attachments = lastUserMessage(routes.requestBodies).metadata
        ?.attachments as ChipPayload[];
      expect(attachments).toHaveLength(2);
      expect(attachments).toContainEqual(
        expect.objectContaining({ kind: "request", label: REQ_B_NAME }),
      );
      expect(attachments.map((chip) => chip.kind)).toContain("environment");
      expect(
        (routes.requestBodies[0] as { context: { chips: unknown[] } }).context.chips,
      ).toEqual([]);
    },
  );

  test("[REL-PICK-02] with more requests than the result cap the launcher opens, filters and renders a bounded number of rows",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      const search = await openLauncherRequestList(page);
      await expect(mentionOptions(page).first()).toBeVisible();
      expect(await mentionOptions(page).count()).toBeLessThanOrEqual(
        MAX_RENDERED_ROWS,
      );
      // The list scrolls and virtualizes instead of showing a truncation footer.
      await expect(page.getByTestId("relay-mention-truncated")).toHaveCount(0);

      await search.fill(SEARCH_TARGET);
      await expect(
        mentionOptions(page).filter({ hasText: SEARCH_TARGET }),
      ).toHaveCount(1);
      expect(await mentionOptions(page).count()).toBeLessThanOrEqual(
        MAX_RENDERED_ROWS,
      );
    },
  );

  test('[REL-PICK-03] "/" lists fifteen grouped commands and Enter on /explain inserts a command pill',
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const routes = await openDock(page);

      const search = await openLauncherRequestList(page);
      await search.fill(REQ_B_NAME);
      await mentionOptions(page).filter({ hasText: REQ_B_NAME }).first().click();
      await expect(launcher(page)).toBeHidden();

      await composer(page).pressSequentially("/");
      const groups = page.getByTestId("relay-slash-group");
      const options = page.getByTestId("relay-slash-option");
      await expect(groups).toHaveCount(SLASH_GROUP_LABELS.length);
      for (const [index, label] of SLASH_GROUP_LABELS.entries()) {
        await expect(groups.nth(index)).toContainText(label);
      }
      await expect(options).toHaveCount(SLASH_COMMANDS.length);
      for (const [index, name] of SLASH_COMMANDS.entries()) {
        await expect(options.nth(index)).toContainText(name);
      }

      // Enter runs the keyboard-highlighted /explain even with the pointer resting on the menu.
      await expect(options.first()).toHaveAttribute("aria-selected", "true");
      await composer(page).press("Enter");
      // /explain is an inline command pill now; the prompt text is built on send.
      const commandPill = page.getByTestId("relay-command-pill");
      await expect(commandPill).toHaveCount(1);
      await expect(commandPill).toHaveAttribute("data-command", "explain");
      await expect(chipsByKind(page, "request")).toContainText(REQ_B_NAME);
      await expect(page.getByTestId("relay-slash-menu")).toBeHidden();
      await expect(composer(page)).toBeFocused();

      await page.getByTestId("relay-send").click();
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
      expect(lastUserText(routes.requestBodies)).toContain(EXPLAIN_PROMPT);
    },
  );

  test("[REL-PICK-04] /clear asks to confirm, then starts a new conversation",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openDock(page);
      await typeAndSend(page, "hello");
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
      await expect(composer(page)).toHaveText("");
    },
  );

  test("[REL-PICK-05] a query with no match shows the empty state; Esc steps back then closes",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      const search = await openLauncherRequestList(page);
      await search.fill("zzzz-no-such-item");
      await expect(page.getByTestId("relay-mention-empty")).toHaveText(
        "Nothing matches that search",
      );
      await expect(mentionOptions(page)).toHaveCount(0);

      // Esc in list view steps back to root
      await page.keyboard.press("Escape");
      await expect(launcher(page)).toHaveAttribute("data-view", "root");
      // Esc in root view closes and returns focus to the trigger
      await page.keyboard.press("Escape");
      await expect(launcher(page)).toBeHidden();
      // Focus returns to the trigger, not the composer
      await expect(page.getByTestId("relay-picker-trigger")).toBeFocused();
    },
  );

  test("[REL-PICK-06] /clear on an empty thread starts a new conversation without a confirm",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openDock(page);

      await composer(page).fill("/clear");
      await composer(page).press("Enter");

      await expect(composer(page)).toHaveText("");
      await expect(composer(page)).toBeFocused();
      await expect(page.getByTestId("relay-clear-confirm")).toBeHidden();
      await expect(page.getByTestId("relay-slash-menu")).toBeHidden();
    },
  );
});
