import type { Page } from "@playwright/test";
import { RELAY_MAX_STEPS } from "../../../src/lib/relay/constants";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayGate,
  type RelayScript,
  startRelayGate,
} from "../../fixtures/relayRoutes";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const THREADS_STORE = "relay_threads";
const REASONING_ID = "conv-reasoning";
const NARRATION_ID = "conv-narration";
const ANSWER_ID = "conv-answer";
const ASK_CALL_ID = "conv-ask";
const ASK_QUESTION = "Which environment should I use?";
const ASK_OPTIONS = ["Staging", "Production"];
const SKIPPED_TEXT = "Skipped because the chat moved on";
const FINAL_ANSWER = "Here is what I found.";
const NARRATION = "Now searching the workspace.";
const PLAIN_ANSWER = "No tools were needed for this.";
const STREAM_ERROR_CODE = "server_error";
const BANNER_ERROR_CODE = "relay_unavailable";
/** Page time the question card stays pending; the Worked label must not include it. */
const PENDING_WAIT_MS = 2200;
const WORKING_AFTER_ONE_SECOND = /^Working for [1-9]\d*s$/;
/** Two whole seconds since send guarantees a step opened right after it ran for at least one. */
const WORKING_AFTER_TWO_SECONDS = /^Working for ([2-9]|\d{2,})s$/;
/** A real read tool: an unknown tool name makes the client fail the step. */
const READ_TOOL = "search_workspace";
const READ_INPUT = { query: "orders", kinds: ["collection"], limit: 5 };
const WORKED_LABEL = /^Worked for \d+s$/;

const header = (page: Page) => page.getByTestId("relay-working-header");
const group = (page: Page) => page.getByTestId("relay-worked-group");
const groupToggle = (page: Page) => group(page).getByRole("button");
const groupBody = (page: Page) => page.getByTestId("relay-worked-group-body");
const toolRows = (page: Page) => page.getByTestId("relay-tool-row");
const assistant = (page: Page) => page.getByTestId("relay-message-assistant");
const dock = (page: Page) => page.getByTestId("relay-dock");
const messageList = (page: Page) => page.getByTestId("relay-messages");

async function openWithGate(page: Page, then: RelayScript[] = []) {
  const gate = await startRelayGate(page);
  await installRelayRoutes(page, [{ kind: "gated", gate }, ...then]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return gate;
}

async function openWithScripts(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

const toolInput = (id: string, toolName: string, input: unknown) => ({
  type: "tool-input-available",
  toolCallId: id,
  toolName,
  input,
});
const toolOutput = (id: string, output: unknown) => ({
  type: "tool-output-available",
  toolCallId: id,
  output,
});
const stepSeam = [{ type: "finish-step" }, { type: "start-step" }];
const textBlock = (id: string, text: string) => [
  { type: "text-start", id },
  { type: "text-delta", id, delta: text },
  { type: "text-end", id },
];

/** Streams one read step, finishes the turn with `answer` and ends the stream. */
async function finishWithOneRead(gate: RelayGate, answer: string) {
  await gate.push([
    toolOutput("conv-read-1", { collections: [] }),
    ...stepSeam,
    ...textBlock(ANSWER_ID, answer),
  ]);
  await gate.end();
}

/** Sends a prompt, streams a read call and waits until the live header has ticked past a second. */
async function startSlowReadTurn(page: Page, gate: RelayGate) {
  await sendMessage(page, `look around ${Date.now()}`);
  await gate.push([toolInput("conv-read-1", READ_TOOL, READ_INPUT)]);
  await expect(toolRows(page)).toHaveCount(1);
  await expect(header(page)).toHaveText(WORKING_AFTER_ONE_SECOND);
}

/** The assistant message as saved to IndexedDB (saves are debounced). */
async function savedTurnStatus(page: Page): Promise<string | undefined> {
  const rows = (await dumpIdbStore(page, THREADS_STORE)) as {
    messages: { role: string; metadata?: { turn?: { status?: string } } }[];
  }[];
  return rows
    .flatMap((row) => row.messages)
    .find((message) => message.role === "assistant")?.metadata?.turn?.status;
}

test.describe("Relay v2 conversation", () => {
  test("[REL-V2-CONV-01] a slow scripted turn shows \"Working for Ns\" ticking beneath step rows, then folds into a collapsed \"Worked for Ns\" row", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await openWithGate(page);
    await sendMessage(page, "slow turn");

    await expect(header(page)).toHaveText(/^Working for \d+s$/);
    await gate.push([toolInput("conv-read-1", READ_TOOL, READ_INPUT)]);
    await expect(toolRows(page)).toHaveCount(1);
    await expect(page.getByTestId("relay-activity")).toContainText("Working for");

    await expect(header(page)).toHaveText(WORKING_AFTER_ONE_SECOND);
    const firstReading = (await header(page).textContent()) ?? "";
    await expect(header(page)).not.toHaveText(firstReading);
    await snap("01-working-ticking");

    await finishWithOneRead(gate, FINAL_ANSWER);

    await expect(group(page)).toBeVisible();
    await expect(groupToggle(page)).toHaveText(WORKED_LABEL);
    await expect(groupToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(group(page)).toHaveAttribute("data-label", "worked");
    await expect(groupBody(page)).toHaveCount(0);
    await expect(header(page)).toHaveCount(0);
    await snap("02-worked-collapsed");
  });

  test("[REL-V2-CONV-02] after the fold only the final answer and the changes summary are visible", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const collectionName = `Conv fold ${Date.now()}`;
    await openWithScripts(page, [
      {
        kind: "clientTools",
        calls: [
          {
            toolName: "create_collection",
            input: { name: collectionName, parentId: null },
          },
        ],
      },
      { kind: "text", text: FINAL_ANSWER },
    ]);
    await sendMessage(page, "create a collection");

    await expect(group(page)).toBeVisible();
    await expect(assistant(page).last()).toContainText(FINAL_ANSWER);
    await expect(page.getByTestId("relay-turn-changes")).toBeVisible();
    await expect(page.getByTestId("relay-turn-changes")).toContainText(
      collectionName,
    );
    // Folded: neither the step rows nor the per-change cards are shown.
    await expect(groupToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("relay-tool-row")).toHaveCount(0);
    await expect(page.getByTestId("relay-change-card")).toHaveCount(0);
    await snap("01-answer-and-summary");
  });

  test("[REL-V2-CONV-03] after reload the \"Worked for\" duration equals the value before the reload", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await openWithGate(page);
    await startSlowReadTurn(page, gate);
    await finishWithOneRead(gate, FINAL_ANSWER);
    await expect(groupToggle(page)).toHaveText(WORKED_LABEL);
    const before = await groupToggle(page).textContent();
    expect(before).not.toBe("Worked for 0s");
    await expect.poll(() => savedTurnStatus(page)).toBe("done");

    await page.reload();

    await expect(dock(page)).toBeVisible();
    await expect(groupToggle(page)).toHaveText(before ?? "");
    await snap("01-after-reload");
  });

  test("[REL-V2-CONV-04] a pending question card shows \"Waiting for you\" and the timer pauses", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    // A fake clock jumps the wait instead of idling in real time, which would
    // outlast Chrome's "preloaded but not used" warning and trip the console guard.
    await page.clock.install();
    await openWithScripts(page, [
      { kind: "askUser", question: ASK_QUESTION, options: ASK_OPTIONS },
      { kind: "text", text: FINAL_ANSWER },
    ]);
    await sendMessage(page, "ask me");

    await expect(page.getByTestId("relay-ask-card")).toContainText(
      ASK_QUESTION,
    );
    await expect(header(page)).toHaveText("Waiting for you");
    await expect(header(page)).toHaveAttribute("data-waiting", "true");
    await snap("01-waiting");

    // Let page time pass while the card is pending; none of it may be counted.
    await page.clock.fastForward(PENDING_WAIT_MS);
    await expect(header(page)).toHaveText("Waiting for you");

    await page.getByTestId("relay-ask-option").first().click();
    await page.getByTestId("relay-ask-send").click();

    await expect(groupToggle(page)).toHaveText(/^Worked for [01]s$/);
  });

  test("[REL-V2-CONV-05] expanding the group shows ordered steps, grouped read summaries and per-step durations", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await openWithGate(page);
    await sendMessage(page, "explore and search");
    // Read tools run in the client and finish in milliseconds, so the timed
    // step here is a reasoning step held open past a second.
    await gate.push([
      { type: "reasoning-start", id: REASONING_ID },
      { type: "reasoning-delta", id: REASONING_ID, delta: "Planning." },
    ]);
    await expect(header(page)).toHaveText(WORKING_AFTER_TWO_SECONDS);
    await gate.push([
      { type: "reasoning-end", id: REASONING_ID },
      toolInput("conv-read-1", "get_collection", { id: "a" }),
      toolOutput("conv-read-1", { ok: true }),
      ...stepSeam,
      toolInput("conv-read-2", "get_collection", { id: "b" }),
      toolOutput("conv-read-2", { ok: true }),
      ...stepSeam,
      ...textBlock(NARRATION_ID, NARRATION),
      ...stepSeam,
      toolInput("conv-read-3", "search_workspace", { query: "orders" }),
      toolOutput("conv-read-3", { ok: true }),
      ...stepSeam,
      ...textBlock(ANSWER_ID, FINAL_ANSWER),
    ]);
    await gate.end();

    await expect(groupToggle(page)).toHaveText(WORKED_LABEL);
    await groupToggle(page).click();
    await expect(groupToggle(page)).toHaveAttribute("aria-expanded", "true");

    const lines = page.getByTestId("relay-reads-line");
    await expect(lines).toHaveCount(2);
    await expect(lines.first()).toContainText("Explored 2 collections");
    await expect(lines.last()).toContainText("Searched 1 time");
    await expect(groupBody(page)).toContainText(NARRATION);
    // Order: the thought, the exploration, the narration, then the search.
    await expect(groupBody(page)).toHaveText(
      /Thought[\s\S]*Explored 2 collections[\s\S]*Now searching the workspace\.[\s\S]*Searched 1 time/,
    );
    await expect(page.getByTestId("relay-thought-line")).toHaveText(
      /^Thought [1-9]\d*s$/,
    );
    // Read steps under a second show no duration of their own.
    await expect(page.getByTestId("relay-step-duration")).toHaveCount(0);
    await snap("01-expanded");
  });

  test("[REL-V2-CONV-06] a turn with no tool steps shows the answer and no \"Worked for\" row", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openWithScripts(page, [{ kind: "text", text: PLAIN_ANSWER }]);
    await sendMessage(page, "just answer");

    await expect(assistant(page).last()).toContainText(PLAIN_ANSWER);
    await expect(page.getByTestId("relay-send")).toBeVisible();
    await expect(group(page)).toHaveCount(0);
    await expect(dock(page)).not.toContainText(/Worked for/);
    await snap("01-no-group");
  });

  test("[REL-V2-CONV-07] Stop shows \"Stopped after Ns\" and a stale card inside the group shows the skipped line", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await openWithGate(page);
    await sendMessage(page, "which env?");
    await gate.push([
      toolInput(ASK_CALL_ID, "ask_user", {
        question: ASK_QUESTION,
        options: ASK_OPTIONS,
      }),
    ]);
    await expect(page.getByTestId("relay-ask-card")).toBeVisible();

    await page.getByTestId("relay-stop").click();

    await expect(group(page)).toHaveAttribute("data-label", "stopped");
    await expect(groupToggle(page)).toHaveText(/^Stopped after \d+s$/);
    // The skipped line lives inside the group, not dangling under the message.
    await expect(page.getByTestId("relay-confirm-declined")).toHaveCount(0);
    await groupToggle(page).click();
    await expect(
      groupBody(page).getByTestId("relay-confirm-declined"),
    ).toContainText(SKIPPED_TEXT);
    await snap("01-stopped-skipped");
  });

  test("[REL-V2-CONV-08] a scripted error shows \"Failed after Ns\" and keeps the error message visible", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await openWithGate(page);
    await sendMessage(page, "this will fail");
    await gate.push([
      toolInput("conv-read-1", READ_TOOL, READ_INPUT),
      toolOutput("conv-read-1", { collections: [] }),
      {
        type: "error",
        errorText: JSON.stringify({ error: STREAM_ERROR_CODE }),
      },
    ]);
    await gate.end();

    await expect(group(page)).toHaveAttribute("data-label", "failed");
    await expect(groupToggle(page)).toHaveText(/^Failed after \d+s$/);
    const banner = page.getByTestId("relay-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-error-code", BANNER_ERROR_CODE);
    await expect(page.getByTestId("relay-send")).toBeVisible();
    await snap("01-failed");
  });

  test("[REL-V2-CONV-09] no \"Show details\" or \"Step N of\" text appears and the step-limit notice appears only when the scripted turn hits the cap", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const noLegacyText = async () => {
      // The message list only: the onboarding tour has its own "Step 1 of 3".
      await expect(messageList(page)).not.toContainText(/Show details/i);
      await expect(messageList(page)).not.toContainText(/Step \d+ of \d+/);
    };
    await openWithScripts(page, [
      {
        kind: "steps",
        steps: [
          { toolName: "list_collections", input: {}, output: { collections: [] } },
          { toolName: "list_environments", input: {}, output: { environments: [] } },
        ],
        text: FINAL_ANSWER,
      },
      { kind: "stepCap", steps: RELAY_MAX_STEPS },
    ]);

    await sendMessage(page, "two steps");
    await expect(group(page)).toHaveCount(1);
    await expect(page.getByTestId("relay-send")).toBeVisible();
    await expect(page.getByTestId("relay-step-limit")).toHaveCount(0);
    await noLegacyText();
    await groupToggle(page).click();
    await noLegacyText();

    await sendMessage(page, "hit the cap");
    const notice = page.getByTestId("relay-step-limit");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/step limit/i);
    await expect(page.getByTestId("relay-send")).toBeVisible();
    await noLegacyText();
    await snap("01-step-limit");
  });

  test("[REL-V2-CONV-10] the group toggle is keyboard accessible with aria-expanded", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await openWithGate(page);
    await sendMessage(page, "keyboard turn");
    await gate.push([toolInput("conv-read-1", READ_TOOL, READ_INPUT)]);
    await finishWithOneRead(gate, FINAL_ANSWER);
    await expect(groupToggle(page)).toHaveText(WORKED_LABEL);

    await groupToggle(page).focus();
    await expect(groupToggle(page)).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(groupToggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(groupBody(page)).toBeVisible();
    await snap("01-expanded-by-keyboard");

    await page.keyboard.press("Space");
    await expect(groupToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(groupBody(page)).toHaveCount(0);
    await expect(groupToggle(page)).toBeFocused();
  });
});
