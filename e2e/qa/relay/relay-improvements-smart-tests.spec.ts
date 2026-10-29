import type { Page } from "@playwright/test";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import {
  attachCurrentTab,
  expandWorkedGroups,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installProxyReply,
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const REQUEST_ID = "qa-e2e-relayimp-req-a";
const REQUEST_NAME = "Request A";
// status + content-type header + the two top-level body fields
const GENERATED_COUNT = 4;
const ASSERT_PROMPT =
  "Write assertions for the attached request and its last response using the test generator.";

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const composer = (page: Page) => page.getByTestId("relay-composer");
const changeCard = (page: Page) => page.getByTestId("relay-change-card");
const assertionRows = (page: Page) =>
  page.getByRole("button", { name: "Delete assertion" });

const generateTests = (): RelayScript => ({
  kind: "clientTools",
  calls: [{ toolName: "generate_tests", input: { requestId: REQUEST_ID } }],
});

/** Opens the request, sends it through the mocked proxy so it has a response, then opens Relay. */
async function openWithResponse(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await installProxyReply(page, {
    status: 200,
    statusText: "OK",
    body: JSON.stringify({ ok: true, count: 3 }),
  });
  await page.goto(WORKSPACE_PATH);
  await openSavedRequest(page, REQUEST_NAME);
  await page.getByTestId("send-request-btn").click();
  await expect(page.getByTestId("response-tab-more")).toBeVisible();
  await openRelay(page);
  return routes;
}

async function openTestsTab(page: Page) {
  await page.getByTestId("response-tab-more").click();
  await page.getByTestId("response-more-tests").click();
}

test.describe("Relay smart tools: generate tests", () => {
  test("[REL-SMART-04] generate_tests adds assertions and Undo restores them; /assert produces the prompt answered with generate_tests",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWithResponse(page, [
        generateTests(),
        { kind: "text", text: "Added assertions to the request." },
      ]);

      await attachCurrentTab(page);
      await composer(page).pressSequentially("/assert");
      await page.getByTestId("relay-slash-option").filter({ hasText: "/assert" }).click();
      // The slash command and the attached request are inline pills; the long prompt is only built on send.
      await expect(composer(page).getByTestId("relay-command-pill")).toHaveAttribute(
        "data-command",
        "assert"
      );
      await expect(composer(page).getByTestId("relay-composer-pill")).toContainText(REQUEST_NAME);
      await page.getByTestId("relay-send").click();

      await expect(assistantBubbles(page)).toContainText(
        "Added assertions to the request."
      );
      expect(JSON.stringify(routes.requestBodies[0])).toContain(ASSERT_PROMPT);
      await expandWorkedGroups(page);
      const card = changeCard(page);
      await expect(card).toContainText(
        `Added ${GENERATED_COUNT} assertions to "${REQUEST_NAME}"`
      );
      await openTestsTab(page);
      await expect(assertionRows(page)).toHaveCount(GENERATED_COUNT);
      await snap("04-assertions-added");

      await card.getByRole("button", { name: "Undo" }).click();

      await expect(card.getByTestId("relay-change-undone")).toBeVisible();
      await expect(assertionRows(page)).toHaveCount(0);
      await snap("04-assertions-undone");
    }
  );

  test("[REL-SMART-08] generated assertions are still on the request after a reload",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      await openWithResponse(page, [
        generateTests(),
        { kind: "text", text: "Added assertions to the request." },
      ]);

      await sendMessage(page, "add assertions");
      await expandWorkedGroups(page);
      await expect(changeCard(page)).toContainText(
        `Added ${GENERATED_COUNT} assertions`
      );
      await openTestsTab(page);
      await expect(assertionRows(page)).toHaveCount(GENERATED_COUNT);
      await page.getByTestId("save-request-btn").click();
      await expect(page.getByText("Request saved")).toBeVisible();

      await page.reload();
      await openSavedRequest(page, REQUEST_NAME);
      // A reload drops the in-memory response; send again so the Tests tab shows.
      await page.getByTestId("send-request-btn").click();
      await openTestsTab(page);

      await expect(assertionRows(page)).toHaveCount(GENERATED_COUNT);
      await snap("08-after-reload");
    }
  );
});
