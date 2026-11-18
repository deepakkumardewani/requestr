import type { Page } from "@playwright/test";
import {
  expandWorkedGroups,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  startRelayGate,
  type RelayScript,
  type RelayGate,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const SEARCH_TOOL = "search_workspace";
const SEARCH_QUERY = "auth";
const TOOL_CALL_ID = "qa-load-tool-1";
const ANSWER = "Found the auth folder.";

const activity = (page: Page) => page.getByTestId("relay-activity");
const activityDot = (page: Page) => page.getByTestId("relay-working-dot");
const workingHeader = (page: Page) => page.getByTestId("relay-working-header");
const WORKING_TEXT = /^Working for \d+s$/;
const activityLabel = (page: Page) => page.getByTestId("relay-activity-label");

/** Opens the dock with the first chat response held open by a gate; `then` answers later requests. */
async function openWithGate(
  page: Page,
  then: RelayScript[] = [],
): Promise<RelayGate> {
  const gate = await startRelayGate(page);
  await installRelayRoutes(page, [{ kind: "gated", gate }, ...then]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return gate;
}

const animationName = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => getComputedStyle(el).animationName);

test.describe("Relay loading phases", () => {
  test("[REL-LOAD-01] Sending shows the Working header, then the labelled tool step, then the answer and a collapsed Worked group", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
  }) => {
    const gate = await openWithGate(page, [{ kind: "text", text: ANSWER }]);
    await sendMessage(page, "find auth");

    await expect(activity(page)).toHaveAttribute("data-kind", "thinking");
    await expect(workingHeader(page)).toHaveText(WORKING_TEXT);
    await expect(activityLabel(page)).toHaveCount(0);

    await gate.push([
      { type: "tool-input-start", toolCallId: TOOL_CALL_ID, toolName: SEARCH_TOOL },
      {
        type: "tool-input-delta",
        toolCallId: TOOL_CALL_ID,
        inputTextDelta: `{"query":"${SEARCH_QUERY}"`,
      },
    ]);
    await expect(activity(page)).toHaveAttribute("data-kind", "tool");
    await expect(activityLabel(page)).toHaveText(
      `Searching workspace for ${SEARCH_QUERY}…`,
    );

    await gate.push([
      {
        type: "tool-input-available",
        toolCallId: TOOL_CALL_ID,
        toolName: SEARCH_TOOL,
        input: { query: SEARCH_QUERY },
      },
    ]);
    await gate.end();

    await expect(page.getByTestId("relay-message-assistant").last()).toContainText(
      ANSWER,
    );
    await expect(activity(page)).toHaveCount(0);
    await expect(workingHeader(page)).toHaveCount(0);
    await expect(page.getByTestId("relay-worked-group")).toHaveAttribute(
      "data-label",
      "worked",
    );
    await expandWorkedGroups(page);
    await expect(page.getByTestId("relay-tool-row")).toBeVisible();
  });

  test("[REL-LOAD-02] With reduced motion the Working header dot has no running animation but keeps text and dot", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWithGate(page);
    await sendMessage(page, "hello");

    await expect(activityDot(page)).toBeVisible();
    await expect(workingHeader(page)).toHaveText(WORKING_TEXT);
    expect(await animationName(page, "relay-working-dot")).toBe("none");
    expect(await animationName(page, "relay-working-header")).toBe("none");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect
      .poll(() => animationName(page, "relay-working-dot"))
      .not.toBe("none");
    // The text never shimmers: only the dot pulses.
    expect(await animationName(page, "relay-working-header")).toBe("none");
  });

  test("[REL-LOAD-03] The indicator region is role=status with aria-live=polite", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
  }) => {
    await openWithGate(page);
    await sendMessage(page, "hello");

    const status = page.getByRole("status").and(activity(page));
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("aria-live", "polite");
  });

  test("[REL-LOAD-04] A chat route error while thinking clears the indicator and shows the error", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
  }) => {
    const gate = await openWithGate(page);
    await sendMessage(page, "hello");
    await expect(activity(page)).toHaveAttribute("data-kind", "thinking");

    await gate.push([
      {
        type: "error",
        errorText: JSON.stringify({ error: "rate_limited", retryAfterSeconds: 30 }),
      },
    ]);
    await gate.end();

    await expect(activity(page)).toHaveCount(0);
    await expect(page.getByTestId("relay-banner")).toHaveAttribute(
      "data-error-code",
      "rate_limited",
    );
  });
});
