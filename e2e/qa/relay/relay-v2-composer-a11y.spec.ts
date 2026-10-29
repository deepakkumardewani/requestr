import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { RELAY_MAX_BODY_BYTES } from "@/lib/relay/tokenBudget";
import { expect, test } from "../../fixtures/qa";
import {
  attachFromPicker,
  openList,
  putThreads,
  runtimeThread,
  WORKSPACE_PATH,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  lastUserMessage,
  lastUserText,
} from "../../fixtures/relayRoutes";

const EDITOR_LABEL = "Message Relay";
const REPLY = "Done.";
const THEMES = ["light", "dark"] as const;
const BLOCKING_IMPACTS = ["serious", "critical"];
const ATTACHMENT_COUNT = 10;
const HISTORY_MESSAGES = 150;
const HISTORY_MESSAGE_CHARS = 4000;
const PILL_NAME = "Bulk Payload 01";
const HISTORY_THREAD_TITLE = "QA long history thread";

const composer = (page: Page) => page.getByTestId("relay-composer");
const pills = (page: Page) => page.getByTestId("relay-composer-pill");

/**
 * Opens the dock and focuses the editor by hand. The shared `openRelay` also asserts
 * focus-on-open, which the dock currently misses on first open (reported as an app bug);
 * these scenarios are about the editor's semantics, not that contract.
 */
async function openDock(page: Page) {
  const routes = await installRelayRoutes(page, { kind: "text", text: REPLY });
  await page.goto(WORKSPACE_PATH);
  await page.getByTestId("relay-toggle").click();
  await expect(page.getByTestId("relay-dock")).toBeVisible();
  await composer(page).focus();
  await expect(composer(page)).toBeFocused();
  return routes;
}

function bulkName(index: number) {
  return `Bulk Payload ${String(index).padStart(2, "0")}`;
}

test.describe("Relay v2 composer accessibility and request budget", () => {
  test("[REL-V2-COMPA11Y-01] the editor exposes role textbox with an accessible label and pills have accessible names", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openDock(page);
    const editor = page.getByRole("textbox", { name: EDITOR_LABEL });
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("aria-multiline", "true");
    await expect(editor).toHaveAccessibleName(EDITOR_LABEL);

    await attachFromPicker(page, "request", PILL_NAME);
    await expect(pills(page)).toHaveCount(1);
    const pill = page.getByRole("img", { name: `Request: ${PILL_NAME}` });
    await expect(pill).toHaveCount(1);
    await expect(pill).toHaveAccessibleName(`Request: ${PILL_NAME}`);
    await snap("01-textbox-and-pill-names");
  });

  test("[REL-V2-COMPA11Y-02] keyboard only: type, open the picker, pick with arrows and Enter, and send", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openDock(page);
    await page.keyboard.type("Check ");
    await page.keyboard.type("@Bulk");
    const menu = page.getByTestId("relay-mention-menu");
    await expect(menu).toBeVisible();
    const options = page.getByTestId("relay-mention-option");
    await expect(options.first()).toBeVisible();
    await expect(composer(page)).toBeFocused();

    await page.keyboard.press("ArrowDown");
    const active = options.and(page.locator('[aria-selected="true"]'));
    await expect(active).toHaveCount(1);
    const activeId = await active.getAttribute("id");
    expect(activeId).toBeTruthy();
    await expect(composer(page)).toHaveAttribute(
      "aria-activedescendant",
      activeId as string,
    );
    await snap("02-arrow-highlight");

    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(pills(page)).toHaveCount(1);
    await expect(composer(page)).toBeFocused();

    await page.keyboard.type(" please summarise");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("relay-message-assistant")).toContainText(
      REPLY,
    );
    expect(routes.requestBodies).toHaveLength(1);
    expect(lastUserText(routes.requestBodies)).toContain("please summarise");
    await expect(page.getByTestId("relay-message-user").last()).toContainText(
      "please summarise",
    );
  });

  test("[REL-V2-COMPA11Y-03] axe reports no serious or critical violations on the composer with attachment and command pills in both themes", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openDock(page);
    await attachFromPicker(page, "request", PILL_NAME);
    await page.keyboard.type("hello /explain");
    await page.keyboard.press("Enter");
    await expect(pills(page)).toHaveCount(1);
    await expect(page.getByTestId("relay-command-pill")).toHaveCount(1);

    // Theme switches fade via transition-colors; axe sampling mid-fade reads a half-light background.
    await page.addStyleTag({
      content: "*, *::before, *::after { transition: none !important; }",
    });
    for (const theme of THEMES) {
      await page.evaluate((value) => {
        document.documentElement.classList.toggle("dark", value === "dark");
      }, theme);
      const { violations, passes } = await new AxeBuilder({ page })
        .include('[data-testid="relay-composer-box"]')
        .analyze();
      // A vacuous scan (selector matched nothing) would have no passes.
      expect(passes.length).toBeGreaterThan(0);
      await snap(`03-axe-scan-${theme}`);
      const blocking = violations
        .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))
        .map((v) => ({
          id: v.id,
          impact: v.impact,
          theme,
          targets: v.nodes.map((n) => n.target.join(" ")),
          measured: v.nodes.map((n) => n.any[0]?.data),
        }));
      expect(blocking).toEqual([]);
    }
  });

  test("[REL-V2-COMPA11Y-04] with 10 large attachments and a long history the captured request body stays under 256 KB and the turn is sent", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openDock(page);
    const filler = "history filler ".repeat(
      Math.ceil(HISTORY_MESSAGE_CHARS / "history filler ".length),
    );
    const messages = Array.from({ length: HISTORY_MESSAGES }, (_, i) => ({
      id: `qa-e2e-compa11y-hist-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `${i} ${filler}` }],
    }));
    // The stored history alone must exceed the cap, or the budget proves nothing.
    expect(JSON.stringify(messages).length).toBeGreaterThan(
      RELAY_MAX_BODY_BYTES,
    );
    await putThreads(page, [
      runtimeThread(1, 0, { title: HISTORY_THREAD_TITLE, messages }),
    ]);
    await openList(page);
    await page
      .getByTestId("relay-thread-item")
      .filter({ hasText: HISTORY_THREAD_TITLE })
      .getByTestId("relay-thread-select")
      .click();
    await expect(page.getByTestId("relay-message-user")).not.toHaveCount(0);

    for (let i = 1; i <= ATTACHMENT_COUNT; i++) {
      await attachFromPicker(page, "request", bulkName(i));
    }
    await expect(pills(page)).toHaveCount(ATTACHMENT_COUNT);
    await snap("04-ten-attachments");

    await composer(page).pressSequentially("summarise all of these");
    await expect(pills(page)).toHaveCount(ATTACHMENT_COUNT);
    await page.getByTestId("relay-send").click();
    await expect(
      page.getByTestId("relay-message-assistant").last(),
    ).toContainText(REPLY);

    expect(routes.requestBodies).toHaveLength(1);
    const bytes = new TextEncoder().encode(
      JSON.stringify(routes.requestBodies[0]),
    ).byteLength;
    expect(bytes).toBeLessThan(RELAY_MAX_BODY_BYTES);
    // Non-vacuity: the attachment detail did travel, and the history was trimmed.
    expect(JSON.stringify(lastUserMessage(routes.requestBodies).parts)).toContain(
      "untrusted-attachment-detail",
    );
    const sent = (routes.requestBodies[0] as { messages: unknown[] }).messages;
    expect(sent.length).toBeLessThan(HISTORY_MESSAGES);
  });
});
