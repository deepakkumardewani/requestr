/**
 * Chain e2e specs: medium tier (two or three block types combined).
 * Source of truth: e2e/scenarios/chain/chain-medium.feature.md
 * Seed data: e2e/fixtures/seed/chain-e2e-medium.json (qa-e2e-med-*)
 */
import type { Page } from "@playwright/test";
import { installChainRoutes } from "../fixtures/chainRoutes";
import {
  collapseRunLog,
  openNodePanel,
  runChain,
  stopChain,
  expectNode,
  expectRunSummary,
  expectStepState,
  nodeBadge,
  openChain,
  waitCanvasReady,
  openDetailTab,
  openRunLog,
  openStepDetail,
  runAndOpenLog,
  runCards,
  setFilter,
  stepRow,
  waitRunDone,
} from "../fixtures/chainE2eHelpers";
import { expect, test } from "../fixtures/qa";

const SINGLE = "qa-e2e-req-single";
const FAIL = "qa-e2e-req-fail500";
const TOKEN = "qa-e2e-req-token";
const ECHO = "qa-e2e-req-echo";
const USERS = "qa-e2e-req-users";
const ITEM = "qa-e2e-req-item";
const FAST_DOWN = "qa-e2e-req-delay-downstream";
const THREE_REQUESTS = "qa-e2e-med-three-requests";
const LIST = "qa-e2e-req-list";
const LOOP_INDEX = "qa-e2e-req-loop-index";
const LOOP_TAIL = "qa-e2e-req-loop-tail";
const LOOP_DELAY_MS = 200;
const ECHO_TOKEN = "qa-e2e-med-req-echo-token";
const MEDIUM = "qa-e2e-med-req-medium";

const strip = (page: Page) => page.getByTestId("run-log-strip");

function detailPanel(page: Page) {
  return page.locator("[data-slot='tabs-content']:not([inert])");
}

/** Open a step's detail panel on the given tab. */
async function openStepTab(
  page: Page,
  nodeId: string,
  tab: Parameters<typeof openDetailTab>[1],
) {
  await openStepDetail(page, nodeId);
  await openDetailTab(page, tab);
}

/** Run a subset from the middle request's context menu (e.g. `context-menu-run-up-to`). */
async function runSubset(page: Page, menuItemTestId: string) {
  await nodeBadge(page, TOKEN).click({ button: "right" });
  await page.getByTestId(menuItemTestId).click();
  await waitRunDone(page);
  await openRunLog(page);
}

/** Assert the collapsed bar summarises the last run with the given status text and counts. */
async function expectBar(page: Page, status: RegExp, counts: string[]) {
  await collapseRunLog(page);
  await expect(strip(page)).toContainText(status);
  for (const count of counts) await expect(strip(page)).toContainText(count);
  await openRunLog(page);
}

/** Assert a skipped step's Error tab explains the skip. */
async function expectSkipReason(page: Page, nodeId: string) {
  await openStepTab(page, nodeId, "Error");
  await expect(detailPanel(page)).toContainText(/upstream|skipped/i);
}

/** Set the global chain concurrency through settings. */
async function setConcurrency(page: Page, value: number) {
  await page.goto("/settings");
  await page.getByTestId("nav-general").click();
  const input = page.getByTestId("chain-concurrency-input");
  await input.fill(String(value));
  await expect(input).toHaveValue(String(value));
}

/** Expand a Loop iteration group in the run log unless a child step is already shown. */
async function expandIteration(page: Page, groupId: string, iteration: number, childStepId: string) {
  const toggle = page.getByTestId(`iteration-toggle-${groupId}-${iteration}`);
  await expect(toggle).toBeVisible();
  if ((await stepRow(page, childStepId).count()) === 0) await toggle.click();
  await expect(stepRow(page, childStepId)).toBeVisible();
}

/** Assert no unresolved-variable warning is shown on any step or canvas node. */
async function expectNoUnresolved(page: Page) {
  await expect(page.getByText(/unresolved/i)).toHaveCount(0);
}

/** Node id of a block in a `qa-e2e-med-<chain>` seed. */
const blockId = (chain: string, key: string) => `qa-e2e-med-${chain}-${key}`;

/** Run through the "Run with inputs" popover with one Start input overridden. */
async function runWithInput(page: Page, value: string) {
  await page.getByTestId("run-with-inputs-btn").click();
  const popover = page.getByTestId("run-with-inputs-popover");
  await popover.locator("input").first().fill(value);
  await popover.getByRole("button", { name: /run/i }).click();
  await waitRunDone(page);
  await openRunLog(page);
}

/** Assert the Condition took `label` on the canvas and in its run log step. */
async function expectBranchTaken(page: Page, condId: string, label: string) {
  await expectNode(page, condId, "passed");
  await expect(nodeBadge(page, condId).locator(".text-emerald-400")).toHaveText(
    label,
  );
  await expect(stepRow(page, condId)).toBeVisible();
}

/** Assert which of a Condition's targets passed and which were skipped, canvas and log. */
async function expectBranchTargets(
  page: Page,
  passed: string[],
  skipped: string[],
) {
  for (const id of passed) {
    await expectNode(page, id, "passed");
    await expectStepState(page, id, "passed");
  }
  for (const id of skipped) {
    await expectNode(page, id, "skipped");
    await expectStepState(page, id, "skipped");
  }
}

function parseDurationMs(text: string): number {
  const ms = text.match(/(\d+)\s*ms/);
  if (ms) return Number(ms[1]);
  const seconds = text.match(/(\d+\.\d+)\s*s/);
  return seconds ? Math.round(Number(seconds[1]) * 1000) : 0;
}

test.describe("Chain E2E — Medium combinations @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-M-01] A list response feeds a detail request through a path injection", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-users-detail");
    await runAndOpenLog(page);
    await expectNode(page, USERS, "passed");
    await expectNode(page, ITEM, "passed");
    await expectStepState(page, USERS, "passed");
    await expectStepState(page, ITEM, "passed");
    await expectRunSummary(page, { passed: 2 });
    await openStepTab(page, ITEM, "Input");
    await expect(detailPanel(page)).toContainText("/api/item/1");
    await openDetailTab(page, "Extracted");
    await expect(detailPanel(page)).toContainText("$[0].id");
    await snap("chn-m-01-path-injection");
  });

  test("[CHN-M-02] One token feeds a header and a query parameter", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-token-echo");
    await runAndOpenLog(page);
    await expectNode(page, TOKEN, "passed");
    await expectNode(page, ECHO_TOKEN, "passed");
    await expectRunSummary(page, { passed: 2 });
    await openStepTab(page, ECHO_TOKEN, "Input");
    const input = detailPanel(page);
    await expect(input).toContainText("X-Token");
    await expect(input).toContainText("k=secret-token-abc");
    // header, the appended query parameter, and the `{{k}}` alias used in the URL.
    await expect(input.getByTestId("injected-value")).toHaveCount(3);
    await expect(input.getByTestId("injected-value").first()).toHaveText(
      "secret-token-abc",
    );
    await snap("chn-m-02-header-and-query");
  });

  test("[CHN-M-03] A failed request skips its success-routed follower", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-fail-echo");
    await runAndOpenLog(page);
    await expectNode(page, FAIL, "failed");
    await expectNode(page, ECHO, "skipped");
    await expectStepState(page, FAIL, "failed");
    await expectStepState(page, ECHO, "skipped");
    await expectRunSummary(page, { failed: 1, skipped: 1 });
    await expectSkipReason(page, ECHO);
    await expectBar(page, /Last run failed/i, ["1 failed", "1 skipped"]);
    await snap("chn-m-03-failed-skips-follower");
  });

  test("[CHN-M-04a] A fail handle routes to a recovery request", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-fail-recovery");
    await expect(page.getByTestId("edge-status-label")).toHaveText([
      /fail/i,
      /success/i,
    ]);
    await runAndOpenLog(page);
    await expectNode(page, FAIL, "failed");
    await expectNode(page, ECHO, "passed");
    await expectStepState(page, ECHO, "passed");
    const order = await page
      .locator("[data-step-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-step-id")));
    expect(order.indexOf(FAIL)).toBeLessThan(order.indexOf(ECHO));
    await snap("chn-m-04a-fail-handle-recovery");
  });

  test("[CHN-M-04b] A success edge from a failed request is skipped", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-fail-recovery");
    await runAndOpenLog(page);
    await expectNode(page, SINGLE, "skipped");
    await expectStepState(page, SINGLE, "skipped");
    await setFilter(page, "skipped");
    await expect(stepRow(page, SINGLE)).toBeVisible();
    await expectSkipReason(page, SINGLE);
    await snap("chn-m-04b-success-edge-skipped");
  });

  test("[CHN-M-05] A fail handle on a passing request is not taken", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-success-vs-fail");
    await runAndOpenLog(page);
    await expectNode(page, SINGLE, "passed");
    await expectNode(page, ECHO, "passed");
    await expectNode(page, USERS, "skipped");
    await expectStepState(page, ECHO, "passed");
    await expectStepState(page, USERS, "skipped");
    await expectRunSummary(page, { passed: 2, skipped: 1 });
    await expectSkipReason(page, USERS);
    await snap("chn-m-05-success-vs-fail");
  });

  test("[CHN-M-06] Independent requests report their own outcomes", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-parallel-mixed");
    await runAndOpenLog(page);
    await expectNode(page, FAIL, "failed");
    await expectNode(page, SINGLE, "passed");
    await expectRunSummary(page, { passed: 1, failed: 1 });
    await expect(page.locator("[data-run-id]").first()).toContainText("Failed");
    await setFilter(page, "passed");
    await expect(stepRow(page, SINGLE)).toBeVisible();
    await expect(stepRow(page, FAIL)).toHaveCount(0);
    await setFilter(page, "failed");
    await expect(stepRow(page, FAIL)).toBeVisible();
    await expect(stepRow(page, SINGLE)).toHaveCount(0);
    await expect(nodeBadge(page, SINGLE)).toBeVisible();
    await snap("chn-m-06-independent-outcomes");
  });

  test("[CHN-M-07] A high score takes the first branch", async ({
    seededPage: page,
    snap,
  }) => {
    const cond = blockId("score-branch", "cond");
    await openChain(page, "qa-e2e-med-score-branch");
    await runAndOpenLog(page);
    await expectBranchTaken(page, cond, "high");
    await expectBranchTargets(page, [SINGLE], [ECHO]);
    await expectRunSummary(page, { passed: 3, skipped: 1 });
    await snap("chn-m-07-high-score");
  });

  test("[CHN-M-08] Overriding the input at run time takes the other branch", async ({
    seededPage: page,
    snap,
  }) => {
    const cond = blockId("score-branch", "cond");
    const start = blockId("score-branch", "start");
    await openChain(page, "qa-e2e-med-score-branch");
    await runAndOpenLog(page);
    await expectBranchTaken(page, cond, "high");
    await runWithInput(page, "1");
    await expectBranchTaken(page, cond, "low");
    await expectBranchTargets(page, [ECHO], [SINGLE]);
    await expect(runCards(page)).toHaveCount(2);
    await expect(runCards(page).first()).toContainText("Passed");
    await openStepTab(page, start, "Input");
    await expect(detailPanel(page)).toContainText("1");
    await snap("chn-m-08-override-input");
  });

  test("[CHN-M-09] A Delay between requests keeps the order", async ({
    seededPage: page,
    snap,
  }) => {
    const delayId = blockId("delay-chain", "delay");
    await openChain(page, "qa-e2e-med-delay-chain");
    await runAndOpenLog(page);
    for (const id of [SINGLE, delayId, FAST_DOWN]) {
      await expectNode(page, id, "passed");
      await expectStepState(page, id, "passed");
    }
    await expectRunSummary(page, { passed: 3 });
    const order = await page
      .locator("[data-step-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-step-id")));
    expect(order).toEqual([SINGLE, delayId, FAST_DOWN]);
    const duration = await stepRow(page, delayId).innerText();
    expect(parseDurationMs(duration)).toBeGreaterThanOrEqual(300);
    await snap("chn-m-09-delay-order");
  });

  test("[CHN-M-10] A Display alias drives a Condition", async ({
    seededPage: page,
    snap,
  }) => {
    const disp = blockId("display-condition", "disp");
    const cond = blockId("display-condition", "cond");
    await openChain(page, "qa-e2e-med-display-condition");
    await runAndOpenLog(page);
    await expectNode(page, disp, "passed");
    await expectBranchTaken(page, cond, "high");
    await expectBranchTargets(page, [SINGLE], [ECHO]);
    await openStepTab(page, disp, "Extracted");
    await expect(detailPanel(page)).toContainText("s");
    await expect(detailPanel(page)).toContainText("7");
    await snap("chn-m-10-display-drives-condition");
  });

  const THREE_BRANCH = [
    { id: "11a", score: "1", label: "first", target: SINGLE },
    { id: "11b", score: "5", label: "second", target: ECHO },
    { id: "11c", score: "9", label: "third", target: TOKEN },
    { id: "11d", score: "99", label: "else", target: USERS },
  ];
  const THREE_BRANCH_TARGETS = THREE_BRANCH.map((b) => b.target);

  for (const { id, score, label, target } of THREE_BRANCH) {
    test(`[CHN-M-${id}] The three-branch Condition takes "${label}" for score ${score}`, async ({
      seededPage: page,
      snap,
    }) => {
      const cond = blockId("three-branch", "cond");
      await openChain(page, "qa-e2e-med-three-branch");
      await runWithInput(page, score);
      await expectBranchTaken(page, cond, label);
      await expectBranchTargets(
        page,
        [target],
        THREE_BRANCH_TARGETS.filter((t) => t !== target),
      );
      await expectRunSummary(page, { passed: 3, skipped: 3 });
      await expect(runCards(page).first()).toContainText("Passed");
      await snap(`chn-m-${id.toLowerCase()}-three-branch`);
    });
  }

  test("[CHN-M-12] Two Conditions in parallel lanes decide independently", async ({
    seededPage: page,
    snap,
  }) => {
    const condA = blockId("two-conditions", "condA");
    const condB = blockId("two-conditions", "condB");
    await openChain(page, "qa-e2e-med-two-conditions");
    await runAndOpenLog(page);
    await expectBranchTaken(page, condA, "high");
    await expectBranchTaken(page, condB, "low");
    await expectBranchTargets(page, [MEDIUM, USERS], [ECHO, TOKEN]);
    await expectRunSummary(page, { passed: 5, skipped: 2 });
    await expect(page.getByTestId("step-lane-0").first()).toBeVisible();
    await expect(page.getByTestId("step-lane-1").first()).toBeVisible();
    await snap("chn-m-12-two-lanes");
  });

  test("[CHN-M-13] A Merge joins the taken Condition branch", async ({
    seededPage: page,
    snap,
  }) => {
    const cond = blockId("condition-merge", "cond");
    const merge = blockId("condition-merge", "merge");
    await openChain(page, "qa-e2e-med-condition-merge");
    await runAndOpenLog(page);
    await expectBranchTaken(page, cond, "high");
    await expectBranchTargets(page, [SINGLE, merge, ECHO], [TOKEN]);
    await expectRunSummary(page, { passed: 5, skipped: 1 });
    await openStepTab(page, TOKEN, "Error");
    await expect(detailPanel(page)).not.toContainText(/already resolved/i);
    await snap("chn-m-13-condition-merge");
  });

  test("[CHN-M-14] A Display alias is resolved in a downstream header", async ({
    seededPage: page,
    snap,
  }) => {
    const disp = blockId("display-header", "disp");
    const target = "qa-e2e-req-disp-hdr";
    await openChain(page, "qa-e2e-med-display-header");
    await runAndOpenLog(page);
    for (const id of [TOKEN, disp, target]) await expectNode(page, id, "passed");
    await expectRunSummary(page, { passed: 3 });
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await openStepTab(page, target, "Input");
    await expect(detailPanel(page)).not.toContainText(/\{\{[^}]+\}\}/);
    await expect(detailPanel(page)).toContainText("tok");
    await expectNoUnresolved(page);
    await snap("chn-m-14-display-header");
  });

  test("[CHN-M-15] Two Displays from one response feed two requests", async ({
    seededPage: page,
    snap,
  }) => {
    const [dispA, dispB] = ["dispA", "dispB"].map((k) => blockId("two-displays", k));
    const [na, nb] = ["qa-e2e-med-req-na", "qa-e2e-med-req-nb"];
    await openChain(page, "qa-e2e-med-two-displays");
    await runAndOpenLog(page);
    for (const id of [USERS, dispA, dispB, na, nb]) await expectNode(page, id, "passed");
    await expectRunSummary(page, { passed: 5 });
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await openStepTab(page, na, "Input");
    const inputA = (await detailPanel(page).innerText()).trim();
    await openStepTab(page, nb, "Input");
    const inputB = (await detailPanel(page).innerText()).trim();
    expect(inputA.length).toBeGreaterThan(0);
    expect(inputB.length).toBeGreaterThan(0);
    expect(inputA).not.toEqual(inputB);
    await snap("chn-m-15-two-displays");
  });

  test("[CHN-M-16] Evaluate maps a list for a downstream request", async ({
    seededPage: page,
    snap,
  }) => {
    const evalId = blockId("eval-map", "eval");
    const names = "qa-e2e-med-req-names";
    await openChain(page, "qa-e2e-med-eval-map");
    await runAndOpenLog(page);
    for (const id of [USERS, evalId, names]) await expectNode(page, id, "passed");
    await expectRunSummary(page, { passed: 3 });
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await openStepTab(page, evalId, "Extracted");
    await expect(detailPanel(page)).toContainText("Alice");
    await openStepTab(page, names, "Input");
    await expect(detailPanel(page)).toContainText("Alice");
    await snap("chn-m-16-eval-map");
  });

  test("[CHN-M-17] An Evaluate result drives a Condition", async ({
    seededPage: page,
    snap,
  }) => {
    const evalId = blockId("eval-condition", "eval");
    const cond = blockId("eval-condition", "cond");
    await openChain(page, "qa-e2e-med-eval-condition");
    await runAndOpenLog(page);
    await expectBranchTaken(page, cond, "fourteen");
    await expectBranchTargets(page, [SINGLE], [ECHO]);
    await openStepTab(page, evalId, "Output");
    await expect(detailPanel(page)).toContainText("14");
    await snap("chn-m-17-eval-condition");
  });

  test("[CHN-M-18a] A passing Validate lets the next request run", async ({
    seededPage: page,
    snap,
  }) => {
    const val = blockId("validate-pass", "val");
    await openChain(page, "qa-e2e-med-validate-pass");
    await runAndOpenLog(page);
    for (const id of [USERS, val, ECHO]) await expectNode(page, id, "passed");
    await expectRunSummary(page, { passed: 3 });
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await expect(runCards(page).first()).toContainText("Passed");
    await snap("chn-m-18a-validate-pass");
  });

  test("[CHN-M-18b] A failing Validate skips the next request", async ({
    seededPage: page,
    snap,
  }) => {
    const val = blockId("validate-fail", "val");
    await openChain(page, "qa-e2e-med-validate-fail");
    await runAndOpenLog(page);
    await expectNode(page, USERS, "passed");
    await expectNode(page, val, "failed");
    await expectNode(page, ECHO, "skipped");
    await expectRunSummary(page, { passed: 1, failed: 1, skipped: 1 });
    await expect(runCards(page).first()).toContainText("Failed");
    await openStepTab(page, val, "Error");
    await expect(detailPanel(page)).not.toContainText("No error");
    await expectSkipReason(page, ECHO);
    await snap("chn-m-18b-validate-fail");
  });

  test("[CHN-M-19] A Merge waits for the slower lane before continuing", async ({
    seededPage: page,
    snap,
  }) => {
    const merge = blockId("merge-all-echo", "merge");
    await openChain(page, "qa-e2e-med-merge-all-echo");
    await runAndOpenLog(page);
    for (const id of [SINGLE, MEDIUM, merge, ECHO]) await expectNode(page, id, "passed");
    await expectRunSummary(page, { passed: 4 });
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    const order = await page
      .locator("[data-step-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-step-id")));
    expect(order.indexOf(merge)).toBeGreaterThan(order.indexOf(MEDIUM));
    expect(order.indexOf(ECHO)).toBeGreaterThan(order.indexOf(merge));
    await snap("chn-m-19-merge-waits");
  });

  test("[CHN-M-20] Aliases propagate across several requests", async ({
    seededPage: page,
    snap,
  }) => {
    const ids = [
      TOKEN,
      blockId("alias-relay", "dispA"),
      "qa-e2e-med-req-relay-b",
      blockId("alias-relay", "dispB"),
      "qa-e2e-med-req-relay-c",
    ];
    await openChain(page, "qa-e2e-med-alias-relay");
    await runAndOpenLog(page);
    for (const id of ids) await expectNode(page, id, "passed");
    await expectRunSummary(page, { passed: 5 });
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await openStepTab(page, "qa-e2e-med-req-relay-c", "Input");
    await expect(detailPanel(page)).not.toContainText(/\{\{[^}]+\}\}/);
    await expectNoUnresolved(page);
    await snap("chn-m-20-alias-relay");
  });

  test("[CHN-M-21] Collected loop results feed a later request", async ({
    seededPage: page,
    snap,
  }) => {
    const [loop, collect] = ["loop", "collect"].map((k) => blockId("loop-collect-echo", k));
    await openChain(page, "qa-e2e-med-loop-collect-echo");
    await runAndOpenLog(page);
    for (const id of [LIST, loop, collect, LOOP_TAIL]) await expectNode(page, id, "passed");
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await openStepTab(page, collect, "Output");
    const collected = await detailPanel(page).innerText();
    expect(collected.match(new RegExp(`"${LOOP_INDEX}"`, "g"))).toHaveLength(3);
    await openStepTab(page, LOOP_TAIL, "Input");
    await expect(detailPanel(page)).toContainText("X-Collected");
    await snap("chn-m-21-loop-collect-echo");
  });

  test("[CHN-M-22] A Condition inside a Loop branches per iteration", async ({
    seededPage: page,
    snap,
  }) => {
    const loop = blockId("loop-condition", "loop");
    const cond = blockId("loop-condition", "cond");
    // The branch variable is a shared alias, so concurrent iterations would race on it.
    await setConcurrency(page, 1);
    await openChain(page, "qa-e2e-med-loop-condition");
    await runAndOpenLog(page);
    await expectNode(page, loop, "passed");
    await expectNode(page, blockId("loop-condition", "collect"), "passed");
    for (const index of [0, 1, 2]) {
      await expandIteration(page, loop, index, `${cond}::${loop}::${index}`);
    }
    const iterationStep = (index: number, id: string) => `${id}::${loop}::${index}`;
    const expected = [
      { index: 0, passed: ECHO, skipped: SINGLE },
      { index: 1, passed: SINGLE, skipped: ECHO },
      { index: 2, passed: ECHO, skipped: SINGLE },
    ];
    for (const { index, passed, skipped } of expected) {
      await expectStepState(page, iterationStep(index, passed), "passed");
      await expectStepState(page, iterationStep(index, skipped), "skipped");
    }
    await snap("chn-m-22-loop-condition");
  });

  test("[CHN-M-23] An Evaluate inside a Loop computes a value per iteration", async ({
    seededPage: page,
    snap,
  }) => {
    const loop = blockId("loop-evaluate", "loop");
    const evalId = blockId("loop-evaluate", "eval");
    const collect = blockId("loop-evaluate", "collect");
    await openChain(page, "qa-e2e-med-loop-evaluate");
    await runAndOpenLog(page);
    await expectNode(page, collect, "passed");
    for (const [index, value] of [0, 10, 20].entries()) {
      const evalStep = `${evalId}::${loop}::${index}`;
      await expandIteration(page, loop, index, evalStep);
      await openStepTab(page, evalStep, "Output");
      await expect(detailPanel(page)).toContainText(String(value));
    }
    await openStepTab(page, collect, "Output");
    const collected = await detailPanel(page).innerText();
    expect(collected.match(new RegExp(`"${evalId}"`, "g"))).toHaveLength(3);
    for (const value of [0, 10, 20]) {
      expect(collected).toMatch(new RegExp(`"body":\\s*"${value}"`));
    }
    await snap("chn-m-23-loop-evaluate");
  });

  test("[CHN-M-24] A Delay inside a Loop runs the iterations one after another", async ({
    seededPage: page,
    snap,
  }) => {
    const loop = blockId("loop-delay", "loop");
    await setConcurrency(page, 1);
    await openChain(page, "qa-e2e-med-loop-delay");
    await runAndOpenLog(page);
    await expectNode(page, blockId("loop-delay", "collect"), "passed");
    await expect(page.getByTestId("run-summary-header")).toBeVisible();
    const total = parseDurationMs(await page.getByTestId("run-summary-header").innerText());
    expect(total).toBeGreaterThanOrEqual(3 * LOOP_DELAY_MS);
    const toggles = page.locator(`[data-testid^="iteration-toggle-${loop}-"]`);
    await expect(toggles).toHaveCount(3);
    const ids = await toggles.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")),
    );
    expect(ids).toEqual([0, 1, 2].map((i) => `iteration-toggle-${loop}-${i}`));
    await snap("chn-m-24-loop-delay");
  });

  test("[CHN-M-25] A Subchain returns an alias to its parent", async ({
    seededPage: page,
    snap,
  }) => {
    const sub = blockId("sub-alias", "sub");
    await openChain(page, "qa-e2e-med-sub-alias");
    await runAndOpenLog(page);
    await expectNode(page, sub, "passed");
    await expectNode(page, ECHO, "passed");
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await openStepTab(page, ECHO, "Input");
    await expect(detailPanel(page)).toContainText("X-Token");
    await expect(detailPanel(page)).not.toContainText(/\{\{[^}]+\}\}/);
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    await expect(stepRow(page, `${TOKEN}::${sub}`)).toBeVisible();
    await snap("chn-m-25-sub-alias");
  });

  test("[CHN-M-26] A Subchain whose child contains a Loop nests two levels in the log", async ({
    seededPage: page,
    snap,
  }) => {
    const sub = blockId("sub-loop", "sub");
    await openChain(page, "qa-e2e-med-sub-loop");
    await runAndOpenLog(page);
    await expectNode(page, sub, "passed");
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    const childLoop = `qa-e2e-med-sub-loop-child-loop::${sub}`;
    const iterationStep = `${LOOP_INDEX}::qa-e2e-med-sub-loop-child-loop::0::${sub}`;
    await expect(stepRow(page, `${LIST}::${sub}`)).toBeVisible();
    await expandIteration(page, childLoop, 0, iterationStep);
    await expect(page.getByTestId(`iteration-toggle-${childLoop}-2`)).toBeVisible();
    await snap("chn-m-26-sub-loop");
  });

  test("[CHN-M-27] A failed Validate blocks only its own branch", async ({
    seededPage: page,
    snap,
  }) => {
    const val = blockId("validate-recovery", "val");
    await openChain(page, "qa-e2e-med-validate-recovery");
    await runAndOpenLog(page);
    await expectNode(page, val, "failed");
    await expectNode(page, SINGLE, "skipped");
    await expectNode(page, ECHO, "passed");
    await expectStepState(page, val, "failed");
    await expectStepState(page, SINGLE, "skipped");
    await expectStepState(page, ECHO, "passed");
    await expect(page.getByTestId("chain-failed-count")).toBeVisible();
    await snap("chn-m-27-validate-recovery");
  });

  test("[CHN-M-28] Running from a node skips earlier nodes", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, THREE_REQUESTS);
    await runSubset(page, "context-menu-run-from-here");
    await expect(runCards(page)).toHaveCount(1);
    await expect(runCards(page).first()).toContainText(/From/);
    await expect(page.locator("[data-step-id]")).toHaveCount(2);
    await expect(stepRow(page, TOKEN)).toBeVisible();
    await expect(stepRow(page, ECHO)).toBeVisible();
    await expect(stepRow(page, SINGLE)).toHaveCount(0);
    await expectNode(page, TOKEN, "passed");
    await expectNode(page, ECHO, "passed");
    await expectNode(page, SINGLE, "idle");
    await snap("chn-m-28-run-from-here");
  });

  test("[CHN-M-29] Running up to a node skips later nodes", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, THREE_REQUESTS);
    await runSubset(page, "context-menu-run-up-to");
    await expect(runCards(page)).toHaveCount(1);
    await expect(runCards(page).first()).toContainText(/Up to/);
    await expect(page.locator("[data-step-id]")).toHaveCount(2);
    await expect(stepRow(page, SINGLE)).toBeVisible();
    await expect(stepRow(page, TOKEN)).toBeVisible();
    await expect(stepRow(page, ECHO)).toHaveCount(0);
    await expectNode(page, SINGLE, "passed");
    await expectNode(page, TOKEN, "passed");
    await snap("chn-m-29-run-up-to");
  });

  test("[CHN-M-30] Running a single node ignores upstream injection", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-token-echo");
    await nodeBadge(page, ECHO_TOKEN).hover();
    await page
      .locator(
        `.react-flow__node:has([data-testid="chain-node-${ECHO_TOKEN}"]) [data-testid="node-toolbar-run"]`,
      )
      .click();
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(1);
    await expect(runCards(page).first()).toContainText(/Only/);
    await expect(page.locator("[data-step-id]")).toHaveCount(1);
    await expectNode(page, ECHO_TOKEN, "passed");
    await expectNode(page, TOKEN, "idle");
    await openStepTab(page, ECHO_TOKEN, "Input");
    // BUG-10: current behaviour is documented as-is; the injected value is simply absent.
    await expect(detailPanel(page)).toContainText(/unresolved/i);
    await expect(detailPanel(page)).not.toContainText("secret-token-abc");
    await snap("chn-m-30-single-node");
  });

  test("[CHN-M-31] Stopping during a Delay aborts it and skips the rest", async ({
    seededPage: page,
    snap,
  }) => {
    test.setTimeout(60_000);
    const delay = blockId("delay-long", "delay");
    await openChain(page, "qa-e2e-med-delay-long");
    await runChain(page);
    await expectNode(page, delay, "running");
    await stopChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expectNode(page, SINGLE, "passed");
    await expectNode(page, delay, "aborted");
    await expectStepState(page, SINGLE, "passed");
    await expectStepState(page, delay, "aborted");
    await expect(runCards(page).first()).toContainText("Stopped");
    await expectBar(page, /stopped/i, ["1 passed", "1 skipped"]);
    await snap("chn-m-31-stop-during-delay");
  });

  test("[CHN-M-32] Changing the Start value between runs changes the branch", async ({
    seededPage: page,
    snap,
  }) => {
    const cond = "qa-e2e-cond-eq-cond";
    const start = "qa-e2e-cond-eq-start";
    await openChain(page, "qa-e2e-cond-eq");
    await runAndOpenLog(page);
    await expectBranchTaken(page, cond, "equal");
    await expect(runCards(page)).toHaveCount(1);
    const firstRunId = await runCards(page).first().getAttribute("data-run-id");

    await openNodePanel(page, start);
    await page.getByTestId("start-config-default-value").first().fill("1");
    await page.getByTestId("start-config-save-btn").click();
    await runAndOpenLog(page);
    await expectBranchTaken(page, cond, "other");
    await expect(runCards(page)).toHaveCount(2);
    const first = page.locator(`[data-run-id="${firstRunId}"]`);
    await expect(first).toContainText("Passed");
    await expect(first).toContainText("Full run");
    await expect(first).toContainText("3 passed, 1 skipped");
    await expect(runCards(page).first()).not.toHaveAttribute("data-run-id", firstRunId ?? "");
    await snap("chn-m-32-start-change");
  });

  test("[CHN-M-33] A stopped run followed by a re-run passes cleanly", async ({
    seededPage: page,
    snap,
  }) => {
    test.setTimeout(60_000);
    const delay = blockId("delay-merge", "delay");
    const merge = blockId("delay-merge", "merge");
    await openChain(page, "qa-e2e-med-delay-merge");
    await runChain(page);
    await expectNode(page, delay, "running");
    await stopChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(1);
    await expect(runCards(page).first()).toContainText("Stopped");

    await runChain(page);
    await waitRunDone(page);
    await expect(runCards(page)).toHaveCount(2);
    await expect(runCards(page).first()).toContainText("Passed");
    await expect(runCards(page).last()).toContainText("Stopped");
    await expectNode(page, merge, "passed");
    await expect(page.locator(".react-flow__node [class*='animate-spin']")).toHaveCount(0);
    for (const id of [blockId("delay-merge", "start"), delay, blockId("delay-merge", "cond")]) {
      await expect.poll(() => nodeBadge(page, id).getAttribute("class")).not.toContain("blue-");
    }
    await snap("chn-m-33-stop-then-rerun");
  });

  test("[CHN-M-34] Run history and iteration groups survive a reload", async ({
    seededPage: page,
    snap,
  }) => {
    const loop = blockId("loop-collect-echo", "loop");
    await openChain(page, "qa-e2e-med-loop-collect-echo");
    await runAndOpenLog(page);
    await runChain(page);
    await waitRunDone(page);
    await expect(runCards(page)).toHaveCount(2);

    await page.reload();
    await waitCanvasReady(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(2);
    for (const index of [0, 1, 2]) {
      await expandIteration(page, loop, index, `${LOOP_INDEX}::${loop}::${index}`);
    }
    await expectNode(page, blockId("loop-collect-echo", "collect"), "passed");
    await snap("chn-m-34-reload-history");
  });

  test("[CHN-M-35] A renamed child chain is reflected on the parent Subchain", async ({
    seededPage: page,
    snap,
  }) => {
    const sub = blockId("request-sub-request", "sub");
    const childId = "qa-e2e-med-sub-rename-child";
    const renamed = "Renamed child chain";
    await openChain(page, "qa-e2e-med-request-sub-request");
    await runAndOpenLog(page);
    await expectNode(page, sub, "passed");
    await expect(nodeBadge(page, sub)).toContainText("Rename child");

    // Client-side navigation keeps the in-memory chain store; the chain list lives in the app sidebar.
    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL("/app", { waitUntil: "commit" });
    const item = page.getByTestId(`chain-list-item-${childId}`);
    await item.hover();
    await item.getByTestId(`chain-list-more-btn-${childId}`).click();
    await page.getByTestId("chain-rename-btn").click();
    await page.getByTestId("chain-rename-input").fill(renamed);
    await page.keyboard.press("Enter");
    await expect(item).toContainText(renamed);
    await page.getByTestId("chain-list-item-qa-e2e-med-request-sub-request").click();
    await waitCanvasReady(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(1);

    await runChain(page);
    await waitRunDone(page);
    await expect(runCards(page)).toHaveCount(2);
    await expect(nodeBadge(page, sub)).toContainText(renamed);
    await nodeBadge(page, sub).hover();
    await page
      .locator(
        `.react-flow__node:has([data-testid="subchain-node-${sub}"]) [data-testid="node-toolbar-change-reference"]`,
      )
      .click();
    await expect(page.getByTestId(`subchain-picker-item-${childId}`)).toContainText(renamed);
    await snap("chn-m-35-renamed-child");
  });
});
