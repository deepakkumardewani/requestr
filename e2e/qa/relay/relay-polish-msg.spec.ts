import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  expandWorkedGroups,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  startRelayGate,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";

const THREADS_STORE = "relay_threads";
const OLD_THREAD_TITLE = "QA old stored thread";
const OLD_FIRST_TEXT = "Let me look that up.";
const OLD_SECOND_TEXT = "Here is what I found.";
const OLD_THREAD_TIME_MS = 1_700_000_100_000;

const EMPTY_ASSISTANT_THREAD_TITLE = "QA thread with user message only";
const USER_ONLY_MESSAGE = "What is machine learning?";
const USER_ONLY_THREAD_TIME_MS = 1_700_000_200_000;

/** A thread saved before parts were rendered in order: step-start parts, text -> tool -> text. */
const OLD_THREAD = {
  id: "qa-e2e-relay-thread-old-order",
  title: OLD_THREAD_TITLE,
  workspaceId: "local",
  createdAt: OLD_THREAD_TIME_MS,
  updatedAt: OLD_THREAD_TIME_MS,
  interruptedMessageId: null,
  messages: [
    {
      id: "qa-e2e-relay-old-user",
      role: "user",
      parts: [{ type: "text", text: "Look this up" }],
    },
    {
      id: "qa-e2e-relay-old-assistant",
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "text", text: OLD_FIRST_TEXT },
        {
          type: "tool-web_search",
          toolCallId: "qa-e2e-relay-old-tool",
          state: "output-available",
          input: { query: "test" },
          output: { results: [] },
        },
        { type: "step-start" },
        { type: "text", text: OLD_SECOND_TEXT },
      ],
    },
  ],
};

/** A thread with only a user message, representing a conversation with no assistant response yet. */
const USER_ONLY_THREAD = {
  id: "qa-e2e-relay-thread-user-only",
  title: EMPTY_ASSISTANT_THREAD_TITLE,
  workspaceId: "local",
  createdAt: USER_ONLY_THREAD_TIME_MS,
  updatedAt: USER_ONLY_THREAD_TIME_MS,
  interruptedMessageId: null,
  messages: [
    {
      id: "qa-e2e-relay-user-only",
      role: "user",
      parts: [{ type: "text", text: USER_ONLY_MESSAGE }],
    },
  ],
};

/** Writes a thread straight into IndexedDB, the way an earlier session left it. */
async function putStoredThread(
  page: Page,
  thread: typeof OLD_THREAD,
): Promise<void> {
  await page.evaluate(
    ({ dbName, store, row }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(row);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, store: THREADS_STORE, row: thread },
  );
}

// Named constants for expected counts
const EXPECTED_ACTION_COUNT = 2; // Copy and Regenerate only

// The server ends a step after a tool result and opens the next one for the
// follow-up text. Without the boundary the client sees a completed tool call
// as the last step and auto-resubmits, so the turn never settles.
const NEXT_STEP_CHUNKS = [
  { type: "finish-step" },
  { type: "start-step" },
] as const;

/**
 * Asserts that element A precedes element B in document order.
 * Specifically, A must come before B without containment relationships.
 */
async function expectBefore(
  page: Page,
  a: Locator,
  b: Locator,
): Promise<void> {
  const aHandle = await a.elementHandle();
  const bHandle = await b.elementHandle();
  if (!aHandle || !bHandle) {
    throw new Error("expectBefore: one or both elements not found");
  }

  const result = await page.evaluate(
    ([aElem, bElem]: Node[]) => {
      const pos = aElem.compareDocumentPosition(bElem);
      // FOLLOWING (4): a precedes b
      // CONTAINED_BY (16): a is inside b (invalid for this check)
      // CONTAINS (8): a contains b (invalid for this check)
      // Must be FOLLOWING but not CONTAINS or CONTAINED_BY
      const isFollowing = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const isContainedOrContains =
        (pos & (Node.DOCUMENT_POSITION_CONTAINS | Node.DOCUMENT_POSITION_CONTAINED_BY)) !== 0;
      return isFollowing && !isContainedOrContains;
    },
    [aHandle, bHandle],
  );

  expect(result).toBe(true);
}

/**
 * Seeds a stored thread into IndexedDB, reloads the page, and selects the thread from the list.
 * Asserts that the dock becomes visible after selection.
 */
async function seedAndOpenThread(
  page: Page,
  thread: typeof OLD_THREAD,
  threadTitle: string,
): Promise<void> {
  await putStoredThread(page, thread);
  await page.reload();
  await expect(page.getByTestId("relay-dock")).toBeVisible();

  await page.getByTestId("relay-thread-trigger").click();
  await page
    .getByTestId("relay-thread-item")
    .filter({ hasText: threadTitle })
    .getByTestId("relay-thread-select")
    .click();

  await expect(page.getByTestId("relay-dock")).toBeVisible();
}

test.describe("Relay: message order, Copy and actions @qa", () => {
  test("[REL-POL-MSG-01] text, tool, text renders two paragraphs with the tool row between and never glues at.Here's @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await startRelayGate(page);

    await installRelayRoutes(page, {
      kind: "gated",
      gate,
    });

    await page.goto("/app");
    await openRelay(page);
    await sendMessage(page, "test message");

    // Push first text part (ends with "at.")
    await gate.push([
      { type: "text-start", id: "relay-text-1" },
      { type: "text-delta", id: "relay-text-1", delta: "I'm looking at." },
      { type: "text-end", id: "relay-text-1" },
    ]);

    // Wait for first text to render
    const text1 = page.getByText("I'm looking at.", { exact: true });
    await expect(text1).toBeVisible();
    await expect(text1).toHaveCount(1);

    // Push tool part
    await gate.push([
      { type: "tool-input-available", toolCallId: "relay-tool-1", toolName: "web_search", input: { query: "test" } },
      { type: "tool-output-available", toolCallId: "relay-tool-1", output: { results: [] } },
      ...NEXT_STEP_CHUNKS,
    ]);

    // Verify tool group is visible
    const toolGroup = page.getByTestId("relay-tool-group");
    await expect(toolGroup).toBeVisible();

    // Push second text part (starts with "Here's")
    await gate.push([
      { type: "text-start", id: "relay-text-2" },
      { type: "text-delta", id: "relay-text-2", delta: "Here's the result." },
      { type: "text-end", id: "relay-text-2" },
    ]);

    // Wait for both text blocks to render
    const text2 = page.getByText("Here's the result.", { exact: true });
    await expect(text2).toBeVisible();
    await expect(text2).toHaveCount(1);

    // While streaming, the blocks sit in stream order: text1 < tool < text2
    await expectBefore(page, text1, toolGroup);
    await expectBefore(page, toolGroup, text2);

    // Finish the stream: the steps fold into the Worked group, the final text stays below it
    await gate.end();
    await expect(page.getByTestId("relay-worked-group")).toBeVisible();
    await expandWorkedGroups(page);
    await expect(text1).toBeVisible();
    await expectBefore(page, text1, toolGroup);
    await expectBefore(page, toolGroup, text2);

    // Verify no text gluing: "at." + "Here's" must not appear
    const glueText = page.getByText("at.Here's");
    await expect(glueText).toHaveCount(0);

    await snap("01-text-tool-text-order");
  });

  test("[REL-POL-MSG-02] text then ask_user shows the question above the AskUser card @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await startRelayGate(page);

    await installRelayRoutes(page, {
      kind: "gated",
      gate,
    });

    await page.goto("/app");
    await openRelay(page);
    await sendMessage(page, "test message");

    // Push text part
    await gate.push([
      { type: "text-start", id: "relay-text-1" },
      { type: "text-delta", id: "relay-text-1", delta: "Check this item." },
      { type: "text-end", id: "relay-text-1" },
    ]);

    const textPart = page.getByText("Check this item.", { exact: true });
    await expect(textPart).toBeVisible();

    // Push ask_user tool part
    await gate.push([
      {
        type: "tool-input-available",
        toolCallId: "relay-ask-1",
        toolName: "ask_user",
        input: {
          question: "Do you approve?",
          options: ["Yes", "No"],
        },
      },
    ]);

    const askCard = page.getByTestId("relay-ask-card");
    await expect(askCard).toBeVisible();
    await expect(askCard).toContainText("Do you approve?");

    // Finish the stream cleanly
    await gate.end();

    // Check order: text comes before ask card
    await expectBefore(page, textPart, askCard);

    await snap("02-text-ask_user-order");
  });

  test("[REL-POL-MSG-03] tool then text shows the tool row above the text @high", async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await startRelayGate(page);

    await installRelayRoutes(page, {
      kind: "gated",
      gate,
    });

    await page.goto("/app");
    await openRelay(page);
    await sendMessage(page, "test message");

    // Push tool part first
    await gate.push([
      { type: "tool-input-available", toolCallId: "relay-tool-1", toolName: "web_search", input: { query: "test" } },
      { type: "tool-output-available", toolCallId: "relay-tool-1", output: { results: [] } },
      ...NEXT_STEP_CHUNKS,
    ]);

    const toolGroup = page.getByTestId("relay-tool-group");
    await expect(toolGroup).toBeVisible();

    // Push text part after tool
    await gate.push([
      { type: "text-start", id: "relay-text-1" },
      { type: "text-delta", id: "relay-text-1", delta: "Tool completed successfully." },
      { type: "text-end", id: "relay-text-1" },
    ]);

    const textPart = page.getByText("Tool completed successfully.", { exact: true });
    await expect(textPart).toBeVisible();
    await expect(textPart).toHaveCount(1);

    // Verify tool is above text using document position, live and once folded
    await expectBefore(page, toolGroup, textPart);

    await gate.end();
    await expandWorkedGroups(page);
    await expect(toolGroup).toBeVisible();
    await expectBefore(page, toolGroup, textPart);

    await snap("03-tool-then-text-order");
  });

  test("[REL-POL-MSG-04] Copy returns the two texts separated by a blank line @high", async ({
    seededPage: page,
    snap,
    context,
  }) => {
    // Grant clipboard permissions (Chromium only)
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const gate = await startRelayGate(page);

    await installRelayRoutes(page, {
      kind: "gated",
      gate,
    });

    await page.goto("/app");
    await openRelay(page);
    await sendMessage(page, "test message");

    // Push first text part
    await gate.push([
      { type: "text-start", id: "relay-text-1" },
      { type: "text-delta", id: "relay-text-1", delta: "First paragraph." },
      { type: "text-end", id: "relay-text-1" },
    ]);

    const text1 = page.getByText("First paragraph.", { exact: true });
    await expect(text1).toBeVisible();

    // Push tool part
    await gate.push([
      { type: "tool-input-available", toolCallId: "relay-tool-1", toolName: "web_search", input: { query: "test" } },
      { type: "tool-output-available", toolCallId: "relay-tool-1", output: { results: [] } },
      ...NEXT_STEP_CHUNKS,
    ]);

    await expect(page.getByTestId("relay-tool-group")).toBeVisible();

    // Push second text part
    await gate.push([
      { type: "text-start", id: "relay-text-2" },
      { type: "text-delta", id: "relay-text-2", delta: "Second paragraph." },
      { type: "text-end", id: "relay-text-2" },
    ]);

    const text2 = page.getByText("Second paragraph.", { exact: true });
    await expect(text2).toBeVisible();

    // Finish the stream so Copy button appears
    await gate.end();

    // Wait for assistant message to be fully rendered
    const assistantMessage = page.getByTestId("relay-message-assistant");
    await expect(assistantMessage).toBeVisible();

    // Hover over the message to reveal action buttons
    await assistantMessage.hover();

    // Click Copy button - it appears on hover
    const copyButton = page.getByTestId("relay-copy-message");
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // Copy should return the two texts separated by blank line, tool omitted
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("First paragraph.\n\nSecond paragraph.");

    await snap("04-copy-text-separation");
  });

  test("[REL-POL-MSG-05] assistant message exposes only Copy and Regenerate actions @high", async ({
    seededPage: page,
    snap,
  }) => {
    const scripts: RelayScript = {
      kind: "text",
      text: "This is an assistant response.",
    };

    await installRelayRoutes(page, scripts);
    await page.goto("/app");
    await openRelay(page);
    await sendMessage(page, "test message");

    await expect(page.getByText("This is an assistant response.", { exact: true })).toBeVisible();

    // Check for Copy and Regenerate buttons
    const copyButton = page.getByTestId("relay-copy-message").first();
    const regenerateButton = page.getByTestId("relay-regenerate").first();

    await expect(copyButton).toBeVisible();
    await expect(regenerateButton).toBeVisible();

    // Verify exactly two action buttons (Copy and Regenerate) in the answer actions
    const actionButtons = page.getByTestId("relay-answer-actions").locator("button");
    await expect(actionButtons).toHaveCount(EXPECTED_ACTION_COUNT);

    // Verify no thumbs-related data-testids exist
    await expect(page.locator("[data-testid*='thumb']")).toHaveCount(0);

    await snap("05-actions-copy-regenerate-only");
  });

  test("[REL-POL-MSG-06] an old persisted thread (text, tool, text with step-start parts) renders in order after reload @high", async ({
    seededPage: page,
    snap,
  }) => {
    await installRelayRoutes(page, { kind: "text", text: "unused" });
    await page.goto("/app");
    await openRelay(page);

    // A fresh load reads the thread back from IndexedDB, as after an old session.
    // Select the thread from the list after reload.
    await seedAndOpenThread(page, OLD_THREAD, OLD_THREAD_TITLE);

    const text1 = page.getByText(OLD_FIRST_TEXT, { exact: true });
    const text2 = page.getByText(OLD_SECOND_TEXT, { exact: true });
    const toolGroup = page.getByTestId("relay-tool-group");
    // A persisted turn with no timing folds into a legacy "Worked" group.
    await expect(page.getByTestId("relay-worked-group")).toHaveAttribute(
      "data-label",
      "legacy"
    );
    await expandWorkedGroups(page);
    await expect(text1).toBeVisible();
    await expect(toolGroup).toBeVisible();
    await expect(text2).toBeVisible();
    await expectBefore(page, text1, toolGroup);
    await expectBefore(page, toolGroup, text2);

    await snap("06-persisted-thread-order");
  });

  test("[REL-POL-MSG-07] a long streamed reply keeps earlier blocks mounted @medium", async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await startRelayGate(page);

    await installRelayRoutes(page, {
      kind: "gated",
      gate,
    });

    await page.goto("/app");
    await openRelay(page);
    await sendMessage(page, "test message");

    // Push first text chunk
    await gate.push([
      { type: "text-start", id: "relay-text-1" },
      { type: "text-delta", id: "relay-text-1", delta: "First" },
      { type: "text-delta", id: "relay-text-1", delta: " block" },
      { type: "text-end", id: "relay-text-1" },
    ]);

    // Verify first block is mounted
    const firstBlock = page.getByText("First block", { exact: true }).first();
    await expect(firstBlock).toBeVisible();

    // Get and retain the element handle
    const firstBlockHandle = await firstBlock.elementHandle();
    if (!firstBlockHandle) throw new Error("Failed to get element handle");

    // Push tool chunk
    await gate.push([
      { type: "tool-input-available", toolCallId: "relay-tool-1", toolName: "web_search", input: { query: "test" } },
      { type: "tool-output-available", toolCallId: "relay-tool-1", output: { results: [] } },
      ...NEXT_STEP_CHUNKS,
    ]);

    // Verify tool group is visible
    await expect(page.getByTestId("relay-tool-group")).toBeVisible();

    // Verify first block is still mounted and connected
    const isStillConnected = await page.evaluate((el) => {
      return el.isConnected;
    }, firstBlockHandle);

    expect(isStillConnected).toBe(true);

    // Push more text
    await gate.push([
      { type: "text-start", id: "relay-text-2" },
      { type: "text-delta", id: "relay-text-2", delta: "More" },
      { type: "text-delta", id: "relay-text-2", delta: " text" },
      { type: "text-end", id: "relay-text-2" },
    ]);

    // Verify both blocks are visible, and the first is still the same connected node
    // after all chunks while the stream is live
    await expect(firstBlock).toBeVisible();
    await expect(page.getByText("More text", { exact: true }).first()).toBeVisible();
    const stillConnected = await page.evaluate((el) => {
      return el.isConnected;
    }, firstBlockHandle);
    expect(stillConnected).toBe(true);

    // Once the stream ends the first block folds into the Worked group (by design) and the
    // final text stays visible below it
    await gate.end();
    await expandWorkedGroups(page);
    await expect(page.getByText("First block", { exact: true })).toBeVisible();
    await expect(page.getByText("More text", { exact: true })).toBeVisible();

    await snap("07-long-stream-blocks-mounted");
  });

  test("[REL-POL-MSG-08] stream error after first text keeps earlier text and shows error bubble @high", async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await startRelayGate(page);

    await installRelayRoutes(page, {
      kind: "gated",
      gate,
    });

    await page.goto("/app");
    await openRelay(page);
    await sendMessage(page, "test message");

    // Push text part
    await gate.push([
      { type: "text-start", id: "relay-text-1" },
      { type: "text-delta", id: "relay-text-1", delta: "Retrieved data." },
      { type: "text-end", id: "relay-text-1" },
    ]);

    const textPart = page.getByText("Retrieved data.", { exact: true });
    await expect(textPart).toBeVisible();

    // Push error after the text
    // The gate writes an error chunk to the response stream
    await gate.push([
      { type: "error", errorText: JSON.stringify({ error: "server_error" }) },
    ]);

    // End the gate cleanly (not destroy the socket)
    await gate.end();

    // Verify text is still there after error
    await expect(textPart).toBeVisible();
    await expect(textPart).toHaveCount(1);

    // Verify the error banner is visible and positioned after the text
    const banner = page.getByTestId("relay-banner");
    await expect(banner).toBeVisible();
    await expectBefore(page, textPart, banner);

    // Verify the assistant message is still in the dock
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

    await snap("08-text-with-error");
  });

  test("[REL-POL-MSG-09] thread with no messages shows no actions @high", async ({
    seededPage: page,
    snap,
  }) => {
    // Install response script first
    await installRelayRoutes(page, {
      kind: "text",
      text: "Here is the response.",
    });

    await page.goto("/app");
    await openRelay(page);

    // Load the stored thread containing only a user message (no assistant response)
    await seedAndOpenThread(page, USER_ONLY_THREAD, EMPTY_ASSISTANT_THREAD_TITLE);

    // Verify the user message is displayed
    const userMessage = page.getByTestId("relay-message-user");
    await expect(userMessage).toBeVisible();
    await expect(userMessage).toContainText(USER_ONLY_MESSAGE);

    // Verify no answer actions are visible (no assistant message yet)
    await expect(page.getByTestId("relay-answer-actions")).toHaveCount(0);
    await expect(page.getByTestId("relay-message-assistant")).toHaveCount(0);

    // Send a message and wait for assistant response
    await sendMessage(page, "test message");

    // Wait for assistant message to appear
    const assistantMessage = page.getByTestId("relay-message-assistant");
    await expect(assistantMessage).toBeVisible();

    // Now there should be exactly two action buttons (Copy and Regenerate)
    const answerActions = page.getByTestId("relay-answer-actions");
    await expect(answerActions).toHaveCount(1);
    const actionButtons = answerActions.locator("button");
    await expect(actionButtons).toHaveCount(EXPECTED_ACTION_COUNT);

    await snap("09-empty-then-with-response");
  });
});
