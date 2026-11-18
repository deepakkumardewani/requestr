import type { Locator, Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const SEED_COLLECTION_TESTID = "collection-item-qa-collection-1";
const IMPORT_URL = "https://api.example.com/smart-import/orders";
const IMPORT_NAME = "POST api.example.com/smart-import/orders";
const SAMPLE_CURL = `curl -X POST '${IMPORT_URL}' -H 'Content-Type: application/json' -d '{"item":"book"}'`;
const MALFORMED_TEXT = "this is not a curl command";
const MALFORMED_ERROR = "the command must start with curl";

const changeCards = (page: Page) => page.getByTestId("relay-change-card");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const requestItem = (page: Page, name: string) =>
  page.getByTestId("request-item").filter({ hasText: name });

const importCurl = (curl: string): RelayScript => ({
  kind: "clientTools",
  calls: [{ toolName: "import_curl", input: { curl, collectionId: null } }],
});

async function openWith(page: Page, scripts: RelayScript[]) {
  await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

async function expandSeedCollection(page: Page, probe: Locator) {
  if (!(await probe.isVisible())) {
    await page.getByTestId(SEED_COLLECTION_TESTID).click();
  }
}

test.describe("Relay smart tools: curl import", () => {
  test("[REL-SMART-01] import_curl with a sample curl creates the matching request",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openWith(page, [
        importCurl(SAMPLE_CURL),
        { kind: "text", text: "Imported the curl as a request." },
      ]);

      await sendMessage(page, "import this curl");

      await expect(assistantBubbles(page)).toContainText(
        "Imported the curl as a request."
      );
      await expect(changeCards(page)).toHaveCount(1);
      await expect(changeCards(page)).toContainText(`Created POST "${IMPORT_NAME}"`);

      const created = requestItem(page, IMPORT_NAME);
      await expandSeedCollection(page, created);
      await expect(created).toHaveCount(1);
      await expect(created).toContainText("POST");
      await snap("01-curl-imported");
    }
  );

  test("[REL-SMART-05] a malformed curl returns a recoverable error and creates nothing",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      await openWith(page, [
        importCurl(MALFORMED_TEXT),
        { kind: "text", text: "That was not a curl command." },
        { kind: "text", text: "Ready for another try." },
      ]);

      await sendMessage(page, "import this");

      await expect(
        page.getByRole("alert").filter({ hasText: MALFORMED_ERROR })
      ).toBeVisible();
      await expect(assistantBubbles(page)).toContainText(
        "That was not a curl command."
      );
      await expect(changeCards(page)).toHaveCount(0);
      await expandSeedCollection(page, page.getByTestId("request-item").first());
      await expect(requestItem(page, "smart-import")).toHaveCount(0);
      await snap("05-malformed-curl");

      await sendMessage(page, "try again");
      await expect(assistantBubbles(page).last()).toContainText(
        "Ready for another try."
      );
    }
  );
});
