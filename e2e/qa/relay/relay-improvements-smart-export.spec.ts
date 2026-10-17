import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const SECRET_REQUEST_ID = "qa-e2e-relay-ctx-req";
const EXPORT_URL_PREFIX = "https://example.com/api/orders";
const UNKNOWN_REQUEST_ID = "qa-no-such-request";
const SECRET_VALUES = [
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxYS1yZWxheSJ9.c2lnbmF0dXJlLXZhbHVl",
  "qa-relay-cookie-3b9e",
  "qa-relay-query-key-55",
  "qa-relay-env-secret-7c1d",
];

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");

const exportCurl = (requestId: string): RelayScript => ({
  kind: "readTool",
  toolName: "export_curl",
  input: { requestId },
});

async function openWith(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

test.describe("Relay smart tools: curl export", () => {
  test("[REL-SMART-02] export_curl replies with the curl and the secret header redacted",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWith(page, [
        exportCurl(SECRET_REQUEST_ID),
        { kind: "text", text: "Here is the curl." },
      ]);

      await sendMessage(page, "give me this request as curl");

      await expect(assistantBubbles(page)).toContainText("Here is the curl.");
      await expect(page.getByTestId("relay-tool-row")).toHaveAttribute(
        "data-state",
        "done"
      );
      await snap("02-curl-exported");

      expect(routes.requestBodies).toHaveLength(2);
      const followUp = JSON.stringify(routes.requestBodies[1]);
      expect(followUp).toContain("curl -X GET");
      expect(followUp).toContain(EXPORT_URL_PREFIX);
      expect(followUp).toContain("[redacted]");
      for (const secret of SECRET_VALUES) {
        expect(JSON.stringify(routes.requestBodies)).not.toContain(secret);
      }
    }
  );

  test("[REL-SMART-06] export_curl for an unknown request id shows a recoverable error",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      await openWith(page, [
        exportCurl(UNKNOWN_REQUEST_ID),
        { kind: "text", text: "I could not find that request." },
        { kind: "text", text: "Ready for another try." },
      ]);

      await sendMessage(page, "export a missing request");

      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: `request not found: ${UNKNOWN_REQUEST_ID}` })
      ).toBeVisible();
      await expect(assistantBubbles(page)).toContainText(
        "I could not find that request."
      );
      await snap("06-unknown-request");

      await sendMessage(page, "try again");
      await expect(assistantBubbles(page).last()).toContainText(
        "Ready for another try."
      );
    }
  );
});
