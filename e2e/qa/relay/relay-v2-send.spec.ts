import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  attachFromPicker,
  LOCAL_WORKSPACE,
  openList,
  putThreads,
  readThreads,
  runtimeThread,
  WORKSPACE_PATH,
} from "../../fixtures/relayE2eHelpers";
import { installProxyReply, installRelayRoutes } from "../../fixtures/relayRoutes";

const REQUEST_NAME = "Request A";
const SECOND_REQUEST_NAME = "Request B";
const LEAD_TEXT = "Check";
const TAIL_TEXT = "then";
const COMMAND_ID = "explain";
const DETAIL_OPEN = "<<<untrusted-attachment-detail>>>";
const SAMPLE_REQUEST = "QA E2E Relay - Sample request";
const SAMPLE_COLLECTION_TESTID = "collection-item-qa-collection-1";
const FAILING_STATUS_TEXT = "Client Closed Request";
const LEGACY_TEXT = "legacy question before pills existed";
const EXPECTED_ORDER = [
  `text:${LEAD_TEXT}`,
  "pill:request",
  `text:${TAIL_TEXT}`,
  `cmd:${COMMAND_ID}`,
];

const composer = (page: Page) => page.getByTestId("relay-composer");
const userBubbles = (page: Page) => page.getByTestId("relay-message-user");
const segments = (page: Page) =>
  userBubbles(page).last().getByTestId("relay-message-segments");

/** Reads text runs and pills of a container in document order, so order can be asserted. */
function readOrder(root: Locator): Promise<string[]> {
  return root.evaluate((element) => {
    const describe = (node: Node): string | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? "").trim();
        return text ? `text:${text}` : null;
      }
      if (!(node instanceof HTMLElement)) return null;
      const pill = node.matches("[data-testid]")
        ? node
        : node.querySelector("[data-testid]");
      const id = pill?.getAttribute("data-testid");
      if (id === "relay-composer-pill") return `pill:${pill?.getAttribute("data-kind")}`;
      if (id === "relay-command-pill") return `cmd:${pill?.getAttribute("data-command")}`;
      const text = (node.textContent ?? "").trim();
      return text ? `text:${text}` : null;
    };
    const paragraph = element.matches("p") ? element : element.querySelector("p");
    return Array.from(paragraph?.childNodes ?? []).flatMap((node) => describe(node) ?? []);
  });
}

async function typeAndSlash(page: Page) {
  await composer(page).click();
  await page.keyboard.type(`${LEAD_TEXT} `);
}

async function buildDraft(page: Page) {
  await typeAndSlash(page);
  await attachFromPicker(page, "request", REQUEST_NAME);
  await composer(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type(` ${TAIL_TEXT} /${COMMAND_ID}`);
  await expect(page.getByTestId("relay-slash-option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(composer(page).getByTestId("relay-command-pill")).toHaveCount(1);
}

/** Types after the attached pill (fill would replace the editor content and drop the pill) and sends. */
async function typeAndSend(page: Page, text: string) {
  await composer(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
  await page.getByTestId("relay-send").click();
}

async function sendDraft(page: Page) {
  await page.getByTestId("relay-send").click();
  await expect(userBubbles(page)).toHaveCount(1);
}

/** Opens the dock without asserting focus: focus-on-open is the composer a11y spec's concern, not send's. */
async function openDock(page: Page) {
  const toggle = page.getByTestId("relay-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.getByTestId("relay-dock")).toBeVisible();
  await expect(composer(page)).toBeVisible();
}

async function openWithReply(page: Page, text = "Noted.") {
  const routes = await installRelayRoutes(page, { kind: "text", text });
  await page.goto(WORKSPACE_PATH);
  await openDock(page);
  return routes;
}

test.describe("Relay v2 send and bubble parity @qa", () => {
  test("[REL-V2-SEND-01] type text, insert an attachment and a slash command, send: the bubble shows the pills inline in the same order and the composer is empty", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openWithReply(page);
    await buildDraft(page);
    expect(await readOrder(composer(page))).toEqual(EXPECTED_ORDER);
    await snap("01-composer-before-send");

    await sendDraft(page);

    expect(await readOrder(segments(page))).toEqual(EXPECTED_ORDER);
    await expect(composer(page).getByTestId("relay-composer-pill")).toHaveCount(0);
    await expect(composer(page).getByTestId("relay-command-pill")).toHaveCount(0);
    await expect(composer(page)).toHaveText("");
    await snap("01-bubble-after-send");
  });

  test("[REL-V2-SEND-02] after reload the persisted bubble still shows the same pills in order", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openWithReply(page);
    await buildDraft(page);
    await sendDraft(page);
    await expect(page.getByTestId("relay-message-assistant")).toContainText("Noted.");
    await expect
      .poll(async () => {
        const [thread] = await readThreads(page);
        return JSON.stringify(thread?.messages ?? []).includes('"segments"');
      })
      .toBe(true);

    await page.reload();
    await openDock(page);

    await expect(userBubbles(page)).toHaveCount(1);
    expect(await readOrder(segments(page))).toEqual(EXPECTED_ORDER);
    await snap("02-bubble-after-reload");
  });

  test("[REL-V2-SEND-03] the mocked request body has resolved detail on the last user message only and no segments on older messages", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
  }) => {
    const routes = await openWithReply(page);
    await attachFromPicker(page, "request", REQUEST_NAME);
    await typeAndSend(page, "first turn");
    await expect(page.getByTestId("relay-message-assistant")).toHaveCount(1);
    await attachFromPicker(page, "request", SECOND_REQUEST_NAME);
    await typeAndSend(page, "second turn");
    await expect(page.getByTestId("relay-message-assistant")).toHaveCount(2);

    expect(routes.requestBodies).toHaveLength(2);
    type Message = { role: string; parts: { type: string; text?: string }[]; metadata?: Record<string, unknown> };
    const { messages } = routes.requestBodies[1] as { messages: Message[] };
    const users = messages.filter((message) => message.role === "user");
    expect(users).toHaveLength(2);
    const [older, latest] = users;
    const hasDetail = (message: Message) =>
      message.parts.some((part) => part.text?.includes(DETAIL_OPEN));
    expect(hasDetail(latest)).toBe(true);
    expect(hasDetail(older)).toBe(false);
    expect(older.metadata?.attachments).toBeTruthy();
    expect(older.metadata).not.toHaveProperty("segments");
    expect(latest.metadata).not.toHaveProperty("segments");
  });

  test("[REL-V2-SEND-04] a draft opened through an Open-in-Relay entry keeps its pills and clears on send", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await installProxyReply(page, {
      status: 499,
      statusText: FAILING_STATUS_TEXT,
      body: '{"error":"client_closed"}',
    });
    const routes = await installRelayRoutes(page, { kind: "text", text: "Looked." });
    await page.goto(WORKSPACE_PATH);
    const item = page.getByTestId("request-item").filter({ hasText: SAMPLE_REQUEST });
    if (!(await item.isVisible())) await page.getByTestId(SAMPLE_COLLECTION_TESTID).click();
    await item.click();
    await page.getByTestId("send-request-btn").click();
    await expect(page.getByTestId("response-status-text")).toHaveText(FAILING_STATUS_TEXT);

    await page.getByTestId("error-explainer").getByTestId("open-in-relay-btn").click();

    await expect(page.getByTestId("relay-dock")).toBeVisible();
    const draftPills = composer(page).getByTestId("relay-composer-pill");
    await expect(draftPills).toHaveCount(1);
    await expect(draftPills).toHaveAttribute("data-kind", "request");
    await expect(composer(page)).toContainText("499");
    await snap("04-draft-with-pill");

    await page.getByTestId("relay-send").click();

    await expect(userBubbles(page)).toHaveCount(1);
    await expect(segments(page).getByTestId("relay-composer-pill")).toHaveCount(1);
    await expect(composer(page).getByTestId("relay-composer-pill")).toHaveCount(0);
    await expect(composer(page)).toHaveText("");
    expect(routes.requestBodies).toHaveLength(1);
    await snap("04-sent-and-cleared");
  });

  test("[REL-V2-SEND-05] a legacy text-only message seeded in IDB renders as plain text", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openWithReply(page);
    await putThreads(page, [
      runtimeThread(5, 0, {
        id: "qa-e2e-relay-v2-send-legacy",
        title: "Legacy thread v2 send",
        workspaceId: LOCAL_WORKSPACE,
        messages: [
          {
            id: "qa-e2e-relay-v2-send-legacy-msg",
            role: "user",
            parts: [{ type: "text", text: LEGACY_TEXT }],
          },
        ],
      }),
    ]);
    await openList(page);
    await page.getByTestId("relay-thread-item").filter({ hasText: "Legacy thread v2 send" }).getByTestId("relay-thread-select").click();

    const bubble = userBubbles(page).last();
    await expect(bubble).toContainText(LEGACY_TEXT);
    await expect(bubble.getByTestId("relay-message-segments")).toHaveCount(0);
    await expect(bubble.getByTestId("relay-composer-pill")).toHaveCount(0);
    await expect(bubble.getByTestId("relay-command-pill")).toHaveCount(0);
    await snap("05-legacy-plain-text");
  });
});
