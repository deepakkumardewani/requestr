import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const COLLECTION_TESTID = "collection-item-qa-e2e-relayimp-col";
const SEEDED_REQUEST = "GraphQL Query";
const SEEDED_URL = "https://example.com/graphql";
const SEEDED_BODY = '{"query": "query GetUser { user { id name } }"}';

const JSON_CODE = '{"name": "relay", "count": 2}';
const INVALID_JSON_CODE = "{ not json";
const WS_CODE = "hello from relay";

const fenced = (language: string, code: string) =>
  `Here you go:\n\n\`\`\`${language}\n${code}\n\`\`\`\n`;

const codeBlocks = (page: Page) => page.getByTestId("relay-code-block");
const applyButton = (page: Page, index = 0) =>
  codeBlocks(page).nth(index).getByTestId("relay-apply-code");
const confirmCard = (page: Page) => page.getByTestId("relay-apply-confirm");
const bodyEditor = (page: Page) =>
  page.getByTestId("body-editor").locator(".cm-content");

async function openWith(page: Page, ...replies: string[]) {
  await installRelayRoutes(
    page,
    replies.map((text) => ({ kind: "text" as const, text })),
  );
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

/** Sends a prompt and waits until the reply's code block count reaches `expected`. */
async function ask(page: Page, expected: number) {
  await sendMessage(page, "give me code");
  await expect(codeBlocks(page)).toHaveCount(expected);
}

async function openSeededRequest(page: Page) {
  const collection = page.getByTestId(COLLECTION_TESTID);
  await expect(collection).toBeVisible();
  const trigger = collection.getByRole("button").first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await collection
    .getByTestId("request-item")
    .filter({ hasText: SEEDED_REQUEST })
    .click();
  await expect(page.getByTestId("url-input")).toHaveValue(SEEDED_URL);
}

async function openNewTab(page: Page, kind: "GraphQL" | "WebSocket") {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByRole("menuitem", { name: kind }).click();
}

/** Counts requests that would mean the app executed the request. */
function trackSends(page: Page) {
  const sent: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("example.com") || url.includes("/api/proxy")) {
      sent.push(url);
    }
  });
  return sent;
}

test.describe("Relay Code Blocks @qa", () => {
  test("[REL-CODE-01] a fenced json block is highlighted and Copy puts the code on the clipboard", { tag: ["@qa", "@high"] },
    async ({ seededPage: page, context, snap }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await openWith(page, fenced("json", JSON_CODE));
      await ask(page, 1);

      const code = codeBlocks(page).first().locator("code");
      await expect(code).toHaveAttribute("data-highlighted", "true");
      await expect(code).toHaveClass(/language-json/);
      await expect(code).toHaveText(JSON_CODE);
      await snap("01-highlighted");

      const copy = page.getByTestId("relay-copy-code").first();
      await copy.click();
      await expect(copy).toHaveAccessibleName("Copied");
      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(JSON_CODE);
      await snap("01-copied");
    },
  );

  test("[REL-CODE-02] on an HTTP tab Apply as body confirms and updates only the body; nothing is sent", { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openWith(page, fenced("json", JSON_CODE));
      await openSeededRequest(page);
      await ask(page, 1);
      const sent = trackSends(page);

      await expect(applyButton(page)).toBeEnabled();
      await expect(applyButton(page)).toHaveText("Apply as body");
      await applyButton(page).click();
      await expect(confirmCard(page)).toContainText(
        "Replace the body of this request?",
      );
      await snap("02-confirm");
      await page.getByTestId("relay-apply-confirm-button").click();

      await expect(page.getByTestId("relay-change-card")).toBeVisible();
      await page.getByTestId("request-tab-body").click();
      await expect(bodyEditor(page)).toContainText(JSON_CODE);
      await expect(page.getByTestId("url-input")).toHaveValue(SEEDED_URL);
      expect(sent).toEqual([]);
      await snap("02-applied");
    },
  );

  test("[REL-CODE-03] Apply as variables works for valid JSON and is disabled for invalid JSON; Apply as message fills the WebSocket draft", { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openWith(
        page,
        fenced("json", JSON_CODE),
        fenced("json", INVALID_JSON_CODE),
        fenced("text", WS_CODE),
      );
      await openNewTab(page, "GraphQL");
      await ask(page, 1);
      await ask(page, 2);

      await expect(applyButton(page, 1)).toBeDisabled();
      await expect(applyButton(page, 1)).toHaveText("Apply as variables");
      await expect(applyButton(page, 1).locator("..")).toHaveAttribute(
        "title",
        "Invalid JSON",
      );
      await snap("03-invalid-disabled");

      await expect(applyButton(page, 0)).toBeEnabled();
      await applyButton(page, 0).click();
      await expect(confirmCard(page)).toContainText(
        "Replace the variables of this query?",
      );
      await page.getByTestId("relay-apply-confirm-button").click();
      await expect(page.getByTestId("relay-change-card")).toBeVisible();
      await page.getByTestId("request-tab-graphql-variables").click();
      await expect(
        page.getByTestId("graphql-variables-editor").locator(".cm-content"),
      ).toContainText(JSON_CODE);

      await openNewTab(page, "WebSocket");
      await ask(page, 3);
      await expect(applyButton(page, 2)).toHaveText("Apply as message");
      await applyButton(page, 2).click();
      await expect(confirmCard(page)).toContainText(
        "Replace the message draft?",
      );
      await page.getByTestId("relay-apply-confirm-button").click();
      await expect(page.getByTestId("ws-message-input")).toHaveValue(WS_CODE);
      await expect(page.getByTestId("ws-log-entry")).toHaveCount(0);
      await snap("03-ws-draft");
    },
  );

  test("[REL-CODE-04] with no request tab the apply button is disabled with a tooltip", { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      await openWith(page, fenced("json", JSON_CODE));
      await expect(page.getByTestId("tab")).toHaveCount(0);
      await ask(page, 1);

      await expect(applyButton(page)).toBeDisabled();
      await expect(applyButton(page).locator("..")).toHaveAttribute(
        "title",
        "Open a request tab to apply this",
      );
      await snap("04-no-tab");
    },
  );

  test("[REL-CODE-05] Undo after Apply as body restores the previous body", { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      await openWith(page, fenced("json", JSON_CODE));
      await openSeededRequest(page);
      await page.getByTestId("request-tab-body").click();
      await expect(bodyEditor(page)).toContainText("GetUser");
      await ask(page, 1);

      await applyButton(page).click();
      await page.getByTestId("relay-apply-confirm-button").click();
      await expect(bodyEditor(page)).toContainText(JSON_CODE);
      await expect(bodyEditor(page)).not.toContainText("GetUser");

      await page
        .getByTestId("relay-change-card")
        .getByRole("button", { name: "Undo" })
        .click();
      await expect(page.getByTestId("relay-change-undone")).toBeVisible();
      await expect(bodyEditor(page)).toContainText("GetUser");
      await expect(bodyEditor(page)).not.toContainText(JSON_CODE);
      await snap("05-undone");
    },
  );
});
