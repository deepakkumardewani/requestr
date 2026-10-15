import type { Page } from "@playwright/test";
import en from "../../../messages/en/relay.json";
import {
  openRelay,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  installProxyReply,
} from "../../fixtures/relayRoutes";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const REQ_500_NAME = "500 Error Request";
const REQ_GRAPHQL_NAME = "GraphQL Query";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const RELAY_ENV_ID = "qa-e2e-relayimp-env";

/**
 * Opens the workspace with the environment active and routes installed.
 */
async function openWithRoutes(
  page: Page,
  ...args: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R
    : never
) {
  await page.addInitScript(
    ([key, id]) => localStorage.setItem(key, id),
    [ACTIVE_ENV_KEY, RELAY_ENV_ID]
  );
  const routes = await installRelayRoutes(page, ...args);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

test.describe("Relay contextual suggestions", () => {
  test("[REL-ICTX-03] a tab with a 500 response suggests \"Why did this fail?\"", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      // Await the proxy installation before opening the workspace
      await installProxyReply(page, {
        status: 500,
        statusText: "Internal Server Error",
        body: JSON.stringify({ error: "Server error" }),
      });

      await openWithRoutes(page, { kind: "text", text: "OK" });
      await openSavedRequest(page, REQ_500_NAME);

      // Send the request to populate the response store
      await page.getByTestId("send-request-btn").click();
      await expect(page.getByTestId("response-status-text")).toHaveText(
        "Internal Server Error"
      );

      // The empty state should be visible
      const empty = page.getByTestId("relay-empty");
      await expect(empty).toBeVisible();

      // The "Why did this fail?" suggestion should be visible in the suggestions area
      const failedSuggestion = page
        .getByTestId("relay-suggestions")
        .getByRole("button", { name: en.suggestions.whyDidThisFail })
        .first();
      await expect(failedSuggestion).toBeVisible();
    }
  );

  test("[REL-ICTX-09] an empty workspace with no tab suggests \"Create a request\"", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
      // Do not open any saved request, so there's no active tab
      await openWithRoutes(page, { kind: "text", text: "OK" });

      // With no tab open, the suggestion should be to create a request
      const empty = page.getByTestId("relay-empty");
      await expect(empty).toBeVisible();
      const suggestionButton = page
        .getByTestId("relay-suggestions")
        .getByRole("button", { name: en.suggestions.createRequest })
        .first();
      await expect(suggestionButton).toBeVisible();
    }
  );

  test("[REL-ICTX-10] switching from the 500 tab to a GraphQL tab replaces the suggestions", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      // Await the proxy installation
      await installProxyReply(page, {
        status: 500,
        statusText: "Internal Server Error",
        body: JSON.stringify({ error: "Server error" }),
      });

      await openWithRoutes(page, { kind: "text", text: "OK" });

      const empty = page.getByTestId("relay-empty");

      // First, open the 500 error request (HTTP tab)
      await openSavedRequest(page, REQ_500_NAME);
      await expect(empty).toBeVisible();

      // Send the request to get the 500 response
      await page.getByTestId("send-request-btn").click();
      await expect(page.getByTestId("response-status-text")).toHaveText(
        "Internal Server Error"
      );

      // Assert "Why did this fail?" is visible for the 500 error
      const failedSuggestion500 = page
        .getByTestId("relay-suggestions")
        .getByRole("button", { name: en.suggestions.whyDidThisFail })
        .first();
      await expect(failedSuggestion500).toBeVisible();

      // Create a new GraphQL tab via the "Create New" dropdown
      await page.getByTestId("create-new-dropdown-trigger").click();
      // Wait for the dropdown menu to appear
      await expect(
        page.getByRole("menuitem", { name: "GraphQL" })
      ).toBeVisible();
      await page.getByRole("menuitem", { name: "GraphQL" }).click();

      // The empty state should still be visible (new tab has no messages)
      await expect(empty).toBeVisible();

      // Assert GraphQL-specific suggestion is now visible
      const graphqlSuggestion = page
        .getByTestId("relay-suggestions")
        .getByRole("button", { name: en.suggestions.graphqlExplainQuery })
        .first();
      await expect(graphqlSuggestion).toBeVisible();

      // Assert "Why did this fail?" is no longer visible (GraphQL with no error)
      const failedSuggestionAfter = page
        .getByTestId("relay-suggestions")
        .getByRole("button", { name: en.suggestions.whyDidThisFail })
        .first();
      await expect(failedSuggestionAfter).not.toBeVisible();
    }
  );
});
