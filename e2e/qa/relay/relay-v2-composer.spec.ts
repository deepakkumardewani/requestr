import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  installRelayRoutes,
  lastUserMessage,
} from "../../fixtures/relayRoutes";
import {
  emitSpeech,
  installSpeechStub,
} from "../../fixtures/speechStub";

const WORKSPACE_PATH = "/app";
const REQUEST_NAME = "Request A";
const REQUEST_QUERY = "request-a";
const COLLECTION_PREFIX = /^QA E2E Relay Improvements/;
const REPLY = "Noted.";

const composer = (page: Page) => page.getByTestId("relay-composer");
const attachmentPills = (page: Page) =>
  composer(page).getByTestId("relay-composer-pill");
const commandPills = (page: Page) =>
  composer(page).getByTestId("relay-command-pill");
const mentionMenu = (page: Page) => page.getByTestId("relay-mention-menu");
const slashMenu = (page: Page) => page.getByTestId("relay-slash-menu");
const sendButton = (page: Page) => page.getByTestId("relay-send");

/**
 * Opens the dock and clicks into the editor. Not `openRelay`: that helper asserts the composer
 * is auto-focused on open, which the tiptap editor does not do yet (reported as an app bug).
 */
async function openDock(page: Page) {
  await page.getByTestId("relay-toggle").click();
  await expect(page.getByTestId("relay-dock")).toBeVisible();
  await composer(page).click();
  await expect(composer(page)).toBeFocused();
}

async function openComposer(page: Page) {
  const routes = await installRelayRoutes(page, { kind: "text", text: REPLY });
  await page.goto(WORKSPACE_PATH);
  await openDock(page);
  return routes;
}

/**
 * Types `@` then picks the request by clicking its option; the caret ends up after the pill.
 * The query is the request's URL slug: a space ends the mention trigger, and a plain "Request"
 * query is buried among hundreds of seeded requests in the virtualized list.
 */
async function mentionRequest(page: Page, name: string) {
  await page.keyboard.type("@");
  await expect(mentionMenu(page)).toBeVisible();
  await page.keyboard.type(REQUEST_QUERY);
  const option = page
    .getByTestId("relay-mention-option")
    .filter({ hasText: new RegExp(`^${name}`) })
    .first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(mentionMenu(page)).toBeHidden();
}

test.describe("Relay v2 composer editing", () => {
  test("[REL-V2-COMPOSER-01] @ opens the picker and choosing a request inserts an inline pill at the caret", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openComposer(page);
    await page.keyboard.type("compare  with the other");
    // Park the caret between the two spaces, in the middle of the sentence.
    for (let i = 0; i < " with the other".length; i++) {
      await page.keyboard.press("ArrowLeft");
    }
    await mentionRequest(page, REQUEST_NAME);

    await expect(attachmentPills(page)).toHaveCount(1);
    await expect(attachmentPills(page)).toContainText(REQUEST_NAME);
    // The pill sits inside the sentence, not in a separate row.
    await expect(composer(page)).toContainText("compare");
    await expect(composer(page)).toContainText("with the other");
    const order = await composer(page).evaluate((el) => {
      const text = el.textContent ?? "";
      return {
        before: text.indexOf("compare"),
        pill: text.indexOf("Request A"),
        after: text.indexOf("with the other"),
      };
    });
    expect(order.before).toBeLessThan(order.pill);
    expect(order.pill).toBeLessThan(order.after);
    await snap("01-inline-pill");
  });

  test("[REL-V2-COMPOSER-02] Backspace right after a pill deletes the whole pill and the attachment", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openComposer(page);
    await page.keyboard.type("look at ");
    await mentionRequest(page, REQUEST_NAME);
    await expect(attachmentPills(page)).toHaveCount(1);

    // Selecting inserts a trailing space: the first Backspace removes it (pill must survive),
    // which leaves the caret right after the pill for the second.
    await page.keyboard.press("Backspace");
    await expect(attachmentPills(page)).toHaveCount(1);
    await page.keyboard.press("Backspace");
    await expect(attachmentPills(page)).toHaveCount(0);
    await snap("02-pill-deleted");

    await page.keyboard.type("done");
    await sendButton(page).click();
    await expect(page.getByTestId("relay-message-user")).toBeVisible();
    expect(lastUserMessage(routes.requestBodies).metadata?.attachments).toBeUndefined();
    const { context } = routes.requestBodies[0] as {
      context: { chips: unknown[] };
    };
    expect(context.chips).toEqual([]);
  });

  test("[REL-V2-COMPOSER-03] a slash command inserts a command pill mid-sentence", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openComposer(page);
    await page.keyboard.type("please ");
    await page.keyboard.type("/explain");
    await expect(slashMenu(page)).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(commandPills(page)).toHaveCount(1);
    await expect(commandPills(page)).toHaveAttribute("data-command", "explain");
    await expect(composer(page)).toContainText("please");
    await expect(slashMenu(page)).toBeHidden();
    await snap("03-command-pill");
  });

  test("[REL-V2-COMPOSER-04] a target-needing command opens the picker and the chosen target pill follows the command pill", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openComposer(page);
    await page.keyboard.type("/run");
    await expect(slashMenu(page)).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(mentionMenu(page)).toBeVisible();
    await page.keyboard.type(REQUEST_QUERY);
    const option = page
      .getByTestId("relay-mention-option")
      .filter({ hasText: new RegExp(`^${REQUEST_NAME}`) })
      .first();
    await expect(option).toBeVisible();
    await option.click();

    await expect(commandPills(page)).toHaveCount(1);
    await expect(attachmentPills(page)).toHaveCount(1);
    const commandPrecedesTarget = await commandPills(page).evaluate(
      (command, targetSelector) => {
        const target = command.ownerDocument.querySelector(targetSelector);
        return Boolean(
          target &&
            command.compareDocumentPosition(target) &
              Node.DOCUMENT_POSITION_FOLLOWING,
        );
      },
      '[data-testid="relay-composer"] [data-testid="relay-composer-pill"]',
    );
    expect(commandPrecedesTarget).toBe(true);
    await snap("04-target-after-command");
  });

  test("[REL-V2-COMPOSER-05] Enter sends and Shift+Enter inserts a newline", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openComposer(page);
    await page.keyboard.type("line one");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("line two");
    expect(routes.requestBodies).toHaveLength(0);
    await expect(composer(page).locator("br")).not.toHaveCount(0);
    await snap("05-newline");

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("relay-message-assistant")).toContainText(REPLY);
    expect(routes.requestBodies).toHaveLength(1);
    const sent = lastUserMessage(routes.requestBodies)
      .parts.map((part) => part.text ?? "")
      .join("");
    expect(sent).toBe("line one\nline two");
    await expect(composer(page)).toHaveText("");
  });

  test("[REL-V2-COMPOSER-06] whitespace-only content cannot be sent but a lone pill can", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openComposer(page);
    await expect(sendButton(page)).toBeDisabled();
    await page.keyboard.type("   ");
    await expect(sendButton(page)).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(routes.requestBodies).toHaveLength(0);
    await snap("06-whitespace-blocked");

    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await mentionRequest(page, REQUEST_NAME);
    await expect(attachmentPills(page)).toHaveCount(1);
    await expect(sendButton(page)).toBeEnabled();
    await sendButton(page).click();
    await expect(page.getByTestId("relay-message-assistant")).toContainText(REPLY);
    expect(routes.requestBodies).toHaveLength(1);
  });

  test("[REL-V2-COMPOSER-07] a pasted rich-text snippet arrives as plain text", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openComposer(page);
    await composer(page).focus();
    await composer(page).evaluate((el) => {
      const data = new DataTransfer();
      data.setData("text/plain", "plain words");
      data.setData("text/html", "<b>plain</b> <i>words</i><script>1</script>");
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await expect(composer(page)).toHaveText("plain words");
    await expect(composer(page).locator("b, i, strong, em")).toHaveCount(0);
    await snap("07-pasted-plain");
  });

  test("[REL-V2-COMPOSER-08] dictated text (mocked) lands at the caret without disturbing the pills", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await installSpeechStub(page);
    await openComposer(page);
    await page.keyboard.type("check ");
    await mentionRequest(page, REQUEST_NAME);
    await page.keyboard.type(" now");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");

    await page.getByTestId("relay-mic").click();
    await expect(page.getByTestId("relay-mic")).toHaveAttribute("aria-pressed", "true");
    await emitSpeech(page, [{ transcript: "dictated words", isFinal: true }]);

    await expect(composer(page)).toContainText("dictated words");
    await expect(attachmentPills(page)).toHaveCount(1);
    await expect(attachmentPills(page)).toContainText(REQUEST_NAME);
    await expect(composer(page)).toContainText("check");
    await expect(composer(page)).toContainText("now");
    await snap("08-dictation-at-caret");
  });

  test("[REL-V2-COMPOSER-09] a pill whose request was deleted renders as deleted", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openComposer(page);
    await page.keyboard.type("about ");
    await mentionRequest(page, REQUEST_NAME);
    const pill = attachmentPills(page);
    await expect(pill).toHaveAttribute("data-stale", "false");

    // Delete through the sidebar so the in-memory store, not just IndexedDB, changes.
    await page.getByRole("button", { name: COLLECTION_PREFIX }).click();
    const row = page.getByTestId("request-item").filter({ hasText: REQUEST_NAME });
    await row.hover();
    await row.getByTestId("request-item-more-btn").click();
    await page.getByTestId("request-delete-btn").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /delete/i })
      .click();

    await expect(pill).toHaveAttribute("data-stale", "true");
    await expect(pill).toBeVisible();
    await expect(pill).toHaveCSS("opacity", "0.6");
    await snap("09-deleted-pill");
  });
});
