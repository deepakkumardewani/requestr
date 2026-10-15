import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
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
const activityDot = (page: Page) => page.getByTestId("relay-activity-dot");
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
  test("[REL-LOAD-01] Sending shows Thinking, then the labelled tool step, then the answer and a ToolRow", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
  }) => {
    const gate = await openWithGate(page, [{ kind: "text", text: ANSWER }]);
    await sendMessage(page, "find auth");

    await expect(activity(page)).toHaveAttribute("data-kind", "thinking");
    await expect(activityLabel(page)).toHaveText("Thinking…");

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
    await expect(page.getByTestId("relay-tool-row")).toBeVisible();
  });

  test("[REL-LOAD-02] With reduced motion the indicator has no running animation but keeps text and dot", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWithGate(page);
    await sendMessage(page, "hello");

    await expect(activityDot(page)).toBeVisible();
    await expect(activityLabel(page)).toHaveText("Thinking…");
    expect(await animationName(page, "relay-activity-dot")).toBe("none");
    expect(await animationName(page, "relay-activity-label")).toBe("none");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect
      .poll(() => animationName(page, "relay-activity-dot"))
      .not.toBe("none");
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
