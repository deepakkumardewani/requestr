import type { Page } from "@playwright/test";
import {
  attachFromPicker,
  openRelayEditor,
  typeAndSend,
} from "../../fixtures/relayE2eHelpers";
import {
  attachmentDetailSections,
  installRelayRoutes,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const RELAY_ENV_ID = "qa-e2e-relayimp-env";
const HOST_VALUE = "qa-relayimp-host-value";
const ENV_NAME = "QA Relay Improvements Env";
const COLLECTION_500_ID = "qa-e2e-relayimp-col-500";

const composer = (page: Page) => page.getByTestId("relay-composer");
// Scoped to the composer: sent messages reuse the pill test id and a restored thread would double-count.
const chips = (page: Page) =>
  composer(page).getByTestId("relay-composer-pill");

/** Attaches through the picker and confirms exactly one chip of that kind appears. */
async function attachAndExpectChip(
  page: Page,
  kind: "environment" | "collection",
  search: string,
) {
  await attachFromPicker(page, kind, search);
  await expect(chips(page).and(page.locator(`[data-kind="${kind}"]`))).toHaveCount(
    1,
  );
}

/**
 * Opens the workspace with environment active and routes installed.
 */
async function openWithRoutes(
  page: Page,
  shareValues: boolean,
  scripts: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R[0]
    : never,
) {
  await page.addInitScript(
    ({ activeEnvKey, envId, shareKey, shareVal }) => {
      localStorage.setItem(activeEnvKey, envId);
      localStorage.setItem(shareKey, shareVal ? "true" : "false");
    },
    {
      activeEnvKey: ACTIVE_ENV_KEY,
      envId: RELAY_ENV_ID,
      shareKey: "rq_relay_share_values",
      shareVal: shareValues,
    },
  );
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelayEditor(page);
  return routes;
}

test.describe("Relay context payload safety", () => {
  test("[REL-ICTX-04] env with Share off sends names only; Share on sends non-secret values and [redacted] for the secret", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      // Test with Share off
      const routes = await openWithRoutes(page, false, {
        kind: "text",
        text: "Reply",
      });

      await attachAndExpectChip(page, "environment", ENV_NAME);

      // Send a message with Share off
      await typeAndSend(page, "test with share off");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // The environment travels as resolved detail on the user message (BUG-01).
      const [offSection] = attachmentDetailSections(routes.requestBodies);
      expect(offSection).toMatchObject({ kind: "environment", id: RELAY_ENV_ID });
      const varsShareOff = (offSection.data as { variables: Array<Record<string, unknown>> })
        .variables;

      // With Share OFF: names + secret flags only, never a value field
      expect(varsShareOff).toHaveLength(2);
      const offSecret = varsShareOff.find((v) => v.key === "relaySecret");
      const offHost = varsShareOff.find((v) => v.key === "relayHost");
      expect(offSecret?.isSecret).toBe(true);
      expect(offHost?.isSecret).toBe(false);
      expect(Object.keys(offSecret ?? {})).not.toContain("value");
      expect(Object.keys(offHost ?? {})).not.toContain("value");

      const bodyShareOff = routes.requestBodies[0];
      // Verify no values are sent when Share is off
      const payloadStr = JSON.stringify(bodyShareOff);
      // Secret values should not appear at all when Share is OFF
      expect(payloadStr).not.toContain("qa-relayimp-secret");
      expect(payloadStr).not.toContain(HOST_VALUE);

      // Now test with Share ON using a fresh navigation with shareValues enabled
      // Set up the shareValues setting before navigating
      await page.addInitScript(
        ({ shareKey, shareVal }) => {
          localStorage.setItem(shareKey, shareVal ? "true" : "false");
        },
        {
          shareKey: "rq_relay_share_values",
          shareVal: true,
        },
      );
      // Install routes for the second message
      const routesShareOn = await installRelayRoutes(page, {
        kind: "text",
        text: "Reply",
      });
      // Navigate to the workspace
      await page.goto(WORKSPACE_PATH);
      // Open the relay manually without expecting auto-focus
      const toggle = page.getByTestId("relay-toggle");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") {
        await toggle.click();
      }
      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await page.getByTestId("relay-composer").click();

      await attachAndExpectChip(page, "environment", ENV_NAME);

      // Send a message with Share on
      await typeAndSend(page, "test with share on");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      const [onSection] = attachmentDetailSections(routesShareOn.requestBodies);
      expect(onSection).toMatchObject({ kind: "environment", id: RELAY_ENV_ID });
      const varsShareOn = (onSection.data as { variables: Array<Record<string, unknown>> })
        .variables;

      // With Share ON: the non-secret value is sent; the secret never carries a value
      expect(varsShareOn).toHaveLength(2);
      const onSecret = varsShareOn.find((v) => v.key === "relaySecret");
      const onHost = varsShareOn.find((v) => v.key === "relayHost");
      expect(onSecret?.isSecret).toBe(true);
      expect(Object.keys(onSecret ?? {})).not.toContain("value");
      expect(onHost?.isSecret).toBe(false);
      expect(onHost?.value).toBe(HOST_VALUE);
      const bodyShareOn = routesShareOn.requestBodies[0];

      // Verify the actual secret value does NOT appear anywhere in the payload
      const payloadOnStr = JSON.stringify(bodyShareOn);
      expect(payloadOnStr).not.toContain("qa-relayimp-secret-value");
    },
  );

  test('[REL-ICTX-05] a 500-request collection sends at most 50 entries plus "…and 450 more"', { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      const routes = await openWithRoutes(page, false, {
        kind: "text",
        text: "OK",
      });

      await attachAndExpectChip(page, "collection", "500-Request");

      // Send a message
      await typeAndSend(page, "analyze this collection");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // Assert on the request body
      // The collection travels as resolved detail on the user message, one section per attachment.
      const [section] = attachmentDetailSections(routes.requestBodies);
      expect(section).toMatchObject({ kind: "collection", id: COLLECTION_500_ID });
      const collection = section.data as {
        requests: Array<Record<string, unknown> | string>;
      };

      // At most 50 entries, then one trailing "...450 more" marker for the other 450.
      const items = collection.requests.slice(0, -1) as Array<
        Record<string, unknown>
      >;
      expect(items).toHaveLength(50);
      expect(collection.requests.at(-1)).toBe("...450 more omitted");

      items.forEach((item) => {
        expect(item.name).toBeTruthy();
        expect(item.method).toBeTruthy();
      });
    },
  );

  test("[REL-ICTX-11] a 500 from the chat route keeps the attachments and shows a retryable error", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
      // Use serverError to simulate a server error from the chat route
      const routesError = await installRelayRoutes(page, {
        kind: "serverError",
      });

      // Set environment active
      await page.addInitScript(
        ({ activeEnvKey, envId }) => {
          localStorage.setItem(activeEnvKey, envId);
        },
        {
          activeEnvKey: ACTIVE_ENV_KEY,
          envId: RELAY_ENV_ID,
        },
      );

      await page.goto(WORKSPACE_PATH);
      await openRelayEditor(page);

      await attachAndExpectChip(page, "environment", ENV_NAME);
      // Page-wide on purpose: after send the pill lives in the user bubble, not the composer.
      const envChip = page
        .getByTestId("relay-composer-pill")
        .filter({ hasText: ENV_NAME });
      await expect(envChip.first()).toBeVisible();

      // Send a message - this will get a server error
      await typeAndSend(page, "test message");

      // Wait for the error to be displayed
      const banner = page.getByTestId("relay-banner");
      await expect(banner).toBeVisible({ timeout: 5000 });

      // Assert the error banner shows the actual error message
      await expect(banner).toContainText("Relay is unavailable right now. Try again.");

      // The environment chip should still be visible after the error
      await expect(envChip.first()).toBeVisible();

      // The composer should be visible for retry
      await expect(composer(page)).toBeVisible();

      // Find and click the retry button
      const retryButton = page.getByTestId("relay-retry");
      await expect(retryButton).toBeVisible();

      // Reinstall routes with a successful response before clicking retry
      const routesSuccess = await installRelayRoutes(page, {
        kind: "text",
        text: "Retry successful",
      });

      // Click the retry button
      await retryButton.click();

      // Wait for the successful response
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible({
        timeout: 5000,
      });

      // Assert the retried request still has the environment attachment
      expect(attachmentDetailSections(routesSuccess.requestBodies)).toEqual([
        expect.objectContaining({ kind: "environment", id: RELAY_ENV_ID }),
      ]);

      // The attachment chip should still be there after successful retry
      await expect(envChip.first()).toBeVisible();
    },
  );
});
