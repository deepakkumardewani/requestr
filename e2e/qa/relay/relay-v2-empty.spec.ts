import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay } from "../../fixtures/relayE2eHelpers";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import { installRelayRoutes, lastUserText } from "../../fixtures/relayRoutes";
import { waitCanvasReady } from "../../fixtures/chainE2eHelpers";

const WORKSPACE_PATH = "/app";
const REQUEST_NAME = "Request A";
const CHAIN_ID = "qa-e2e-relay-edit-chain";
const ENV_ID = "qa-e2e-relayimp-env";
const ENV_NAME = "QA Relay Improvements Env";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const MIN_SUGGESTIONS = 3;
const MAX_SUGGESTIONS = 4;

const suggestions = (page: Page) => page.getByTestId("relay-suggestion");
const empty = (page: Page) => page.getByTestId("relay-empty");
const suggestionIds = async (page: Page) =>
  suggestions(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-suggestion")),
  );

async function expectCount(page: Page) {
  await expect(suggestions(page).first()).toBeVisible();
  const count = await suggestions(page).count();
  expect(count).toBeGreaterThanOrEqual(MIN_SUGGESTIONS);
  expect(count).toBeLessThanOrEqual(MAX_SUGGESTIONS);
}

test.describe("Relay v2 context-aware empty state", () => {
  test("[REL-V2-EMPTY-01] with a request open the empty state shows 3 to 4 suggestions including \"Explain <request name>\"", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    await installRelayRoutes(page, { kind: "text", text: "OK" });
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);
    await openSavedRequest(page, REQUEST_NAME);

    await expectCount(page);
    await expect(
      suggestions(page).filter({ hasText: `Explain ${REQUEST_NAME}` }),
    ).toHaveCount(1);
    expect((await suggestionIds(page)).every((id) => id?.startsWith("request-"))).toBe(true);
    await snap("01-request-suggestions");
  });

  test("[REL-V2-EMPTY-02] with a chain open the suggestions are chain-oriented", { tag: ["@qa", "@high"] }, async ({ seededPage: page, snap }) => {
    await installRelayRoutes(page, { kind: "text", text: "OK" });
    await page.goto(`/chain/${CHAIN_ID}`);
    await waitCanvasReady(page);
    await page.keyboard.press("ControlOrMeta+i");
    await expect(page.getByTestId("relay-dock")).toBeVisible();

    await expectCount(page);
    expect((await suggestionIds(page)).every((id) => id?.startsWith("chain-"))).toBe(true);
    await expect(suggestions(page).filter({ hasText: /^Explain / })).toHaveCount(1);
    await expect(suggestions(page).filter({ hasText: /^Add a step to / })).toHaveCount(1);
    await snap("02-chain-suggestions");
  });

  test("[REL-V2-EMPTY-03] with an environment open the suggestions are env-oriented", { tag: ["@qa", "@high"] }, async ({ seededPage: page, snap }) => {
    await page.addInitScript(
      ([key, id]) => localStorage.setItem(key, id),
      [ACTIVE_ENV_KEY, ENV_ID],
    );
    await installRelayRoutes(page, { kind: "text", text: "OK" });
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    await expectCount(page);
    expect((await suggestionIds(page)).every((id) => id?.startsWith("environment-"))).toBe(true);
    await expect(
      suggestions(page).filter({ hasText: `Explain ${ENV_NAME}` }),
    ).toHaveCount(1);
    await expect(suggestions(page).filter({ hasText: /^Summarize / })).toHaveCount(1);
    await snap("03-env-suggestions");
  });

  test("[REL-V2-EMPTY-04] with nothing open the generic starters are shown", { tag: ["@qa", "@high"] }, async ({ seededPage: page, snap }) => {
    await installRelayRoutes(page, { kind: "text", text: "OK" });
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    await expectCount(page);
    await expect(suggestions(page)).toHaveText([
      "Create a new request",
      "Import a cURL command",
      "Explore my workspace",
      "Explain a request",
    ]);
    await snap("04-generic-starters");
  });

  test("[REL-V2-EMPTY-05] clicking a known-target suggestion inserts the command plus pill and sends", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    const routes = await installRelayRoutes(page, { kind: "text", text: "Explained." });
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);
    await openSavedRequest(page, REQUEST_NAME);

    await suggestions(page).filter({ hasText: `Explain ${REQUEST_NAME}` }).click();

    const userMessage = page.getByTestId("relay-message-user").last();
    await expect(userMessage).toBeVisible();
    await expect(userMessage.locator("[data-relay-pill]")).toHaveCount(1);
    await expect(userMessage.locator("[data-relay-pill]")).toContainText(REQUEST_NAME);
    await expect(userMessage).toContainText("/explain");
    await expect(page.getByText("Explained.")).toBeVisible();
    await expect(empty(page)).toHaveCount(0);
    expect(lastUserText(routes.requestBodies)).toContain(REQUEST_NAME);
    await snap("05-sent-with-pill");
  });

  test("[REL-V2-EMPTY-06] clicking a generic starter opens the picker, and \"See everything Relay can do\" opens the popover", { tag: ["@qa", "@high"] }, async ({ seededPage: page, snap }) => {
    await installRelayRoutes(page, { kind: "text", text: "OK" });
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    await suggestions(page).filter({ hasText: "Explain a request" }).click();
    await expect(page.getByTestId("relay-mention-menu")).toBeVisible();
    await expect(page.getByTestId("relay-message-user")).toHaveCount(0);
    await snap("06a-picker-open");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("relay-mention-menu")).toBeHidden();

    await page.getByTestId("relay-see-everything").click();
    await expect(page.getByTestId("relay-capabilities-popover")).toBeVisible();
    // No large capability grid remains in the empty state; the full list lives in the popover (EMPTY-02).
    await expect(empty(page)).toBeVisible();
    await expect(empty(page).getByTestId("relay-capability-list")).toHaveCount(0);
    await snap("06b-see-everything-popover");
  });
});
