import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  attachFromPicker,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  lastUserMessage,
  type RelayScript,
  startRelayGate,
} from "../../fixtures/relayRoutes";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const REQUEST_NAME = "Request A";
const REQUEST_URL = "https://example.com/api/request-a";
const COLLECTION_BUTTON = /^QA E2E Relay Improvements/;
const DETAIL_OPEN = "<<<untrusted-attachment-detail>>>";
const REPLY_TEXT = "Here is the cURL for that request.";
const SECOND_REPLY = "Second turn done.";
const ASK_QUESTION = "Which environment should I use?";
const ASK_OPTIONS = ["Staging", "Production"];
const TYPED_ANSWER = "Use the sandbox environment";
const COMPOSER_ANSWER = "Staging please";
const SKIPPED_TEXT = "Skipped because the chat moved on";
const STARTER_LABEL = "Export a request as cURL";
const STARTER_HEADER = "Pick a request to export as cURL";
const SEARCH_QUERY = "user";
const SEARCH_MATCHES = ["Get Users", "Get User Detail"];
const NO_MATCH_QUERY = "zzz-no-such-request";
const ASK_TOOL_CALL_ID = "relay-v2-bugs-ask";
const REGISTERED_TOOL_NAMES = /ask_user|get_request|list_collections|delete_request/;

type RecordedPart = { type: string; text?: string; [key: string]: unknown };
type RecordedBody = {
  messages: {
    role: string;
    parts: RecordedPart[];
    metadata?: { attachments?: { id: string; label: string }[] };
  }[];
};

const dock = (page: Page) => page.getByTestId("relay-dock");
const composerPills = (page: Page) => page.getByTestId("relay-composer-pill");
const bubblePills = (page: Page) => page.getByTestId("relay-attachment-pills");
const userBubbles = (page: Page) => page.getByTestId("relay-message-user");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const askCard = (page: Page) => page.getByTestId("relay-ask-card");
const askSend = (page: Page) => page.getByTestId("relay-ask-send");
const mentionSearch = (page: Page) => page.getByTestId("relay-mention-search");
/** The pinned "Current tab" row is also an option, so request rows are selected by kind. */
const requestOptions = (page: Page) =>
  page.locator('[data-testid="relay-mention-option"][data-kind="request"]');

const THREADS_STORE = "relay_threads";
const SAVED_MESSAGES_AFTER_ONE_TURN = 2;

/** Saves are debounced; a reload before the write lands would lose the turn. */
async function savedMessageCount(page: Page): Promise<number> {
  const rows = (await dumpIdbStore(page, THREADS_STORE)) as {
    messages: unknown[];
  }[];
  return Math.max(0, ...rows.map((row) => row.messages.length));
}

const askScript: RelayScript = {
  kind: "askUser",
  question: ASK_QUESTION,
  options: ASK_OPTIONS,
};

async function openWithScripts(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

const textOf = (parts: RecordedPart[]) =>
  parts.map((part) => part.text ?? "").join("\n");

const lastUserOf = (body: unknown) =>
  (body as RecordedBody).messages.findLast((m) => m.role === "user");

/** The recorded tool-result outputs a follow-up request carried back for `toolName`. */
function toolOutputs(body: unknown, toolName: string): unknown[] {
  return (body as RecordedBody).messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === `tool-${toolName}`)
    .map((part) => part.output);
}

async function deleteSidebarRequest(page: Page, name: string) {
  await page.getByRole("button", { name: COLLECTION_BUTTON }).click();
  const row = page.getByTestId("request-item").filter({ hasText: name });
  await row.hover();
  await row.getByTestId("request-item-more-btn").click();
  await page.getByTestId("request-delete-btn").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /delete/i })
    .click();
}

/** Opens the empty-state "Export a request as cURL" starter, which asks for a request. */
async function openStarterPicker(page: Page) {
  await page
    .getByTestId("relay-capability-starter")
    .filter({ hasText: STARTER_LABEL })
    .click();
  await expect(page.getByTestId("relay-mention-menu")).toBeVisible();
  await expect(mentionSearch(page)).toBeFocused();
}

async function sendWithAttachment(page: Page, text: string) {
  await attachFromPicker(page, "request", REQUEST_NAME);
  await expect(composerPills(page)).toHaveCount(1);
  await sendMessage(page, text);
}

test.describe("Relay v2 phase 1 bugs", () => {
  test("[REL-V2-BUGS-01] attach a request and send: the composer is empty, the bubble shows the pill, the mocked /api/relay/chat body has resolved detail on the last user message only, and the reply references the request with no question card",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        { kind: "text", text: REPLY_TEXT },
      ]);
      const prompt = `export this as cURL ${Date.now()}`;
      await sendWithAttachment(page, prompt);

      await expect(assistantBubbles(page)).toContainText(REPLY_TEXT);
      await expect(page.getByTestId("relay-composer")).toHaveValue("");
      await expect(composerPills(page)).toHaveCount(0);
      await expect(bubblePills(page)).toContainText(REQUEST_NAME);
      await expect(askCard(page)).toHaveCount(0);

      expect(routes.requestBodies).toHaveLength(1);
      const body = routes.requestBodies[0] as RecordedBody;
      const userMessages = body.messages.filter((m) => m.role === "user");
      expect(userMessages).toHaveLength(1);
      const last = lastUserMessage(routes.requestBodies, 0);
      const sent = textOf(last.parts);
      expect(sent).toContain(prompt);
      expect(sent).toContain(DETAIL_OPEN);
      expect(sent).toContain(REQUEST_URL);
      expect(last.metadata?.attachments).toEqual([
        expect.objectContaining({ kind: "request", label: REQUEST_NAME }),
      ]);
    },
  );

  test("[REL-V2-BUGS-02] a second turn sent without re-attaching carries no attachments and no turn-1 detail",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        { kind: "text", text: REPLY_TEXT },
        { kind: "text", text: SECOND_REPLY },
      ]);
      await sendWithAttachment(page, "export this as cURL");
      await expect(assistantBubbles(page)).toHaveCount(1);
      await expect(composerPills(page)).toHaveCount(0);

      const followUp = "and what about the headers?";
      await sendMessage(page, followUp);
      await expect(assistantBubbles(page).last()).toContainText(SECOND_REPLY);

      expect(routes.requestBodies).toHaveLength(2);
      const messages = (routes.requestBodies[1] as RecordedBody).messages;
      const [turnOne, , turnTwo] = messages.filter(
        (m) => m.role === "user" || m.role === "assistant",
      );
      expect(textOf(turnTwo.parts)).toBe(followUp);
      expect(turnTwo.metadata?.attachments ?? []).toHaveLength(0);
      // Turn 1 keeps only its reference; the resolved detail is not resent.
      expect(turnOne.metadata?.attachments).toHaveLength(1);
      expect(JSON.stringify(messages)).not.toContain(DETAIL_OPEN);
      expect(JSON.stringify(messages)).not.toContain(REQUEST_URL);
      await expect(userBubbles(page).last().getByTestId("relay-attachment-pills")).toHaveCount(0);
    },
  );

  test("[REL-V2-BUGS-03] an attached request that is deleted before send is sent as a \"no longer exists\" note and the bubble pill renders muted with the tooltip",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        { kind: "text", text: REPLY_TEXT },
      ]);
      await attachFromPicker(page, "request", REQUEST_NAME);
      await expect(composerPills(page)).toHaveAttribute("data-stale", "false");

      await deleteSidebarRequest(page, REQUEST_NAME);
      await expect(composerPills(page)).toHaveAttribute("data-stale", "true");
      await sendMessage(page, "export it anyway");
      await expect(assistantBubbles(page)).toContainText(REPLY_TEXT);

      const sent = textOf(lastUserMessage(routes.requestBodies, 0).parts);
      expect(sent).toContain(`${REQUEST_NAME} no longer exists`);
      expect(sent).not.toContain(REQUEST_URL);

      const deleted = page.getByTestId("relay-attachment-pill-deleted");
      await expect(deleted).toHaveCount(1);
      await expect(deleted).toHaveAttribute(
        "title",
        `${REQUEST_NAME} no longer exists`,
      );
      await expect(deleted).toHaveCSS("opacity", "0.6");
      await expect(deleted.getByRole("link")).toHaveCount(0);
    },
  );

  test("[REL-V2-BUGS-04] after reload the persisted bubble still shows the attachment pill",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWithScripts(page, [{ kind: "text", text: REPLY_TEXT }]);
      await sendWithAttachment(page, "export this as cURL");
      await expect(bubblePills(page)).toContainText(REQUEST_NAME);
      // Saves are debounced: wait for the assistant reply to be written too.
      await expect(assistantBubbles(page)).toContainText(REPLY_TEXT);
      await expect
        .poll(() => savedMessageCount(page))
        .toBe(SAVED_MESSAGES_AFTER_ONE_TURN);

      await page.reload();
      await expect(dock(page)).toBeVisible();
      await expect(userBubbles(page)).toHaveCount(1);
      await expect(bubblePills(page)).toContainText(REQUEST_NAME);
    },
  );

  test("[REL-V2-BUGS-05] the \"Export a request as cURL\" starter shows the header \"Pick a request to export as cURL\"",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWithScripts(page, [{ kind: "text", text: REPLY_TEXT }]);
      await openStarterPicker(page);

      await expect(page.getByTestId("relay-mention-menu")).toContainText(
        STARTER_HEADER,
      );
      await expect(page.getByText("Keep typing to narrow results")).toHaveCount(0);
    },
  );

  test("[REL-V2-BUGS-06] typing \"user\" in the picker search narrows the list to matching items only and arrow keys plus Enter select",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWithScripts(page, [{ kind: "text", text: REPLY_TEXT }]);
      await openStarterPicker(page);
      const unfiltered = await requestOptions(page).count();

      await mentionSearch(page).fill(SEARCH_QUERY);
      await expect(requestOptions(page)).not.toHaveCount(unfiltered);
      const rows = await requestOptions(page).allTextContents();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row).toMatch(/user/i);
      for (const name of SEARCH_MATCHES) {
        await expect(
          requestOptions(page).filter({ hasText: name }),
        ).not.toHaveCount(0);
      }

      const highlighted = requestOptions(page).and(
        page.locator('[aria-selected="true"]'),
      );
      await expect(highlighted).toHaveCount(1);
      const before = await highlighted.textContent();
      await mentionSearch(page).press("ArrowDown");
      await expect(highlighted).toHaveCount(1);
      await expect(highlighted).not.toHaveText(before ?? "");
      const chosen = (await highlighted.textContent()) ?? "";
      await mentionSearch(page).press("Enter");

      await expect(page.getByTestId("relay-mention-menu")).toBeHidden();
      // The chosen request lands as an attachment pill, so the Enter selected it.
      await expect(composerPills(page)).toHaveCount(1);
      const label = await page
        .getByTestId("relay-composer-pill-label")
        .textContent();
      expect(label).toBeTruthy();
      expect(chosen).toContain(label ?? "");
    },
  );

  test("[REL-V2-BUGS-07] a query with no match shows the no-match text and Escape returns focus to the composer",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWithScripts(page, [{ kind: "text", text: REPLY_TEXT }]);
      await openStarterPicker(page);

      await mentionSearch(page).fill(NO_MATCH_QUERY);
      await expect(page.getByTestId("relay-mention-empty")).toHaveText(
        `No requests match "${NO_MATCH_QUERY}"`,
      );
      await expect(requestOptions(page)).toHaveCount(0);

      await mentionSearch(page).press("Escape");
      await expect(page.getByTestId("relay-mention-menu")).toBeHidden();
      await expect(page.getByTestId("relay-composer")).toBeFocused();
    },
  );

  test("[REL-V2-BUGS-08] a mocked ask_user call: select an option, then Send; the tool result sent back equals the option",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        askScript,
        { kind: "text", text: SECOND_REPLY },
      ]);
      await sendMessage(page, "which env?");
      await expect(askCard(page)).toContainText(ASK_QUESTION);
      await expect(askSend(page)).toBeDisabled();

      const option = page
        .getByTestId("relay-ask-option")
        .filter({ hasText: ASK_OPTIONS[0] });
      await option.click();
      await expect(option).toHaveAttribute("aria-pressed", "true");
      await expect(askSend(page)).toBeEnabled();
      // Selecting alone sends nothing.
      expect(routes.requestBodies).toHaveLength(1);

      await askSend(page).click();
      await expect(assistantBubbles(page).last()).toContainText(SECOND_REPLY);
      await expect(page.getByTestId("relay-ask-answer")).toContainText(
        ASK_OPTIONS[0],
      );
      expect(routes.requestBodies).toHaveLength(2);
      expect(JSON.stringify(toolOutputs(routes.requestBodies[1], "ask_user"))).toContain(
        `"choice":"${ASK_OPTIONS[0]}"`,
      );
    },
  );

  test("[REL-V2-BUGS-09] a mocked ask_user call: type your own answer, then Send; the tool result equals the typed value",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        askScript,
        { kind: "text", text: SECOND_REPLY },
      ]);
      await sendMessage(page, "which env?");
      await expect(askCard(page)).toContainText(ASK_QUESTION);

      const option = page
        .getByTestId("relay-ask-option")
        .filter({ hasText: ASK_OPTIONS[1] });
      await option.click();
      await expect(option).toHaveAttribute("aria-pressed", "true");

      // Typing deselects the option.
      await page.getByTestId("relay-ask-input").fill(TYPED_ANSWER);
      await expect(option).toHaveAttribute("aria-pressed", "false");
      await expect(askSend(page)).toBeEnabled();
      expect(routes.requestBodies).toHaveLength(1);

      await askSend(page).click();
      await expect(assistantBubbles(page).last()).toContainText(SECOND_REPLY);
      expect(routes.requestBodies).toHaveLength(2);
      expect(JSON.stringify(toolOutputs(routes.requestBodies[1], "ask_user"))).toContain(
        `"choice":"${TYPED_ANSWER}"`,
      );
    },
  );

  test("[REL-V2-BUGS-10] a composer message sent while a question card is pending is recorded as its answer and the bubble still renders",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        askScript,
        { kind: "text", text: SECOND_REPLY },
      ]);
      await sendMessage(page, "which env?");
      await expect(askCard(page)).toContainText(ASK_QUESTION);

      await sendMessage(page, COMPOSER_ANSWER);

      await expect(page.getByTestId("relay-ask-answer")).toContainText(
        COMPOSER_ANSWER,
      );
      await expect(userBubbles(page).last()).toContainText(COMPOSER_ANSWER);
      await expect(assistantBubbles(page).last()).toContainText(SECOND_REPLY);
      expect(routes.requestBodies).toHaveLength(2);
      expect(JSON.stringify(toolOutputs(routes.requestBodies[1], "ask_user"))).toContain(
        `"choice":"${COMPOSER_ANSWER}"`,
      );
      await expect(page.getByTestId("relay-ask-option")).toHaveCount(0);
    },
  );

  test("[REL-V2-BUGS-11] stopping the turn while a card is pending leaves the muted skipped line; no registered tool name appears in any rendered card",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const gate = await startRelayGate(page);
      await installRelayRoutes(page, [{ kind: "gated", gate }]);
      await page.goto(WORKSPACE_PATH);
      await openRelay(page);

      await sendMessage(page, "which env?");
      await gate.push([
        {
          type: "tool-input-available",
          toolCallId: ASK_TOOL_CALL_ID,
          toolName: "ask_user",
          input: { question: ASK_QUESTION, options: ASK_OPTIONS },
        },
      ]);
      await expect(askCard(page)).toContainText(ASK_QUESTION);
      await expect(page.getByTestId("relay-stop")).toBeVisible();
      await expect(askCard(page)).not.toContainText(REGISTERED_TOOL_NAMES);

      await page.getByTestId("relay-stop").click();

      const skipped = page.getByTestId("relay-confirm-declined");
      await expect(skipped).toContainText(SKIPPED_TEXT);
      await expect(skipped).toHaveAttribute("data-automatic", "true");
      await expect(page.getByTestId("relay-ask-option")).toHaveCount(0);
      await expect(page.getByTestId("relay-ask-send")).toHaveCount(0);
      await expect(page.getByTestId("relay-messages")).not.toContainText(
        REGISTERED_TOOL_NAMES,
      );
    },
  );
});
