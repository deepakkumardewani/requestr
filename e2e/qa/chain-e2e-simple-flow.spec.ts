/**
 * Chain e2e specs: Merge, Loop, Collect, and Subchain nodes.
 * Source of truth: e2e/scenarios/chain/chain-nodes-flow.feature.md
 * Seed data: e2e/fixtures/seed/chain-e2e-flow.json
 */
import { installChainRoutes } from "../fixtures/chainRoutes";
import {
  expectBanner,
  expectBarSummary,
  expectNode,
  expectRunSummary,
  nodeBadge,
  openChain,
  openDetailTab,
  openNodePanel,
  openRunLog,
  openStepDetail,
  runChain,
  stepRow,
  waitRunDone,
} from "../fixtures/chainE2eHelpers";
import { expect, test } from "../fixtures/qa";

function detailPanel(page: import("@playwright/test").Page) {
  return page.locator("[data-slot='tabs-content']:not([inert])");
}

async function expectNoRunYet(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("run-log-strip")).toContainText(/no runs yet/i);
}

async function expectRunBlocked(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("run-chain-btn")).toBeDisabled();
  await page.keyboard.press("Meta+Enter");
  await expectNoRunYet(page);
}

async function expectErrorLine(
  page: import("@playwright/test").Page,
  nodeId: string,
  message: RegExp,
) {
  await openRunLog(page);
  await expect(stepRow(page, nodeId).getByTestId("step-error-line")).toContainText(
    message,
  );
}

/** Loop body steps are keyed `nodeId::loopId::iteration`, not the bare request id. */
async function openSubChainPicker(
  page: import("@playwright/test").Page,
  nodeId: string,
) {
  await nodeBadge(page, nodeId).hover();
  await page
    .locator(
      `.react-flow__node:has([data-testid="subchain-node-${nodeId}"]) [data-testid="node-toolbar-change-reference"]`,
    )
    .click();
}

async function openIterationInput(
  page: import("@playwright/test").Page,
  loopId: string,
  nodeId: string,
  iteration: number,
) {
  const toggle = page.getByTestId(`iteration-toggle-${loopId}-${iteration}`);
  await expect(toggle).toBeVisible();
  const stepId = `${nodeId}::${loopId}::${iteration}`;
  const step = page.locator(`[data-step-id="${stepId}"]`);
  if ((await step.count()) === 0) await toggle.click();
  await openStepDetail(page, stepId);
  await openDetailTab(page, "Input");
}

test.describe("Chain E2E — Simple flow nodes @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-S-MRG-01] Merge in \"all\" mode passes after both lanes pass", async ({
    seededPage: page,
    snap,
  }) => {
    const merge = "qa-e2e-merge-all-ok-merge";
    await openChain(page, "qa-e2e-merge-all-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-single", "passed");
    await expectNode(page, "qa-e2e-req-delay-downstream", "passed");
    await expectNode(page, merge, "passed");
    await expectBarSummary(page, { text: /passed/i });
    await openRunLog(page);
    await expect(stepRow(page, merge)).toBeVisible();
    await snap("chn-s-mrg-01-all");
  });

  test("[CHN-S-MRG-02] Merge in \"any\" mode resolves on the first lane and skips the other", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-merge-any-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-merge-any-ok-merge", "passed");
    await expectNode(page, "qa-e2e-req-slow", "skipped");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-slow");
    await expect(page.getByTestId("run-log-dock")).toContainText(/already resolved/i);
    await snap("chn-s-mrg-02-any");
  });

  test("[CHN-S-MRG-03] The Merge mode can be toggled and persists", async ({
    seededPage: page,
    snap,
  }) => {
    const merge = "qa-e2e-merge-all-ok-merge";
    await openChain(page, "qa-e2e-merge-all-ok");
    await openNodePanel(page, merge);
    await page.getByTestId("merge-config-mode-any-btn").click();
    await page.getByRole("button", { name: /^save$/i }).click();
    await page.reload();
    await expect(nodeBadge(page, merge)).toContainText(/first to pass/i);
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, merge, "passed");
    await openRunLog(page);
    await expect(stepRow(page, merge)).toBeVisible();
    await snap("chn-s-mrg-03-toggle");
  });

  test("[CHN-S-MRG-04] \"Any\" mode still passes when the first lane fails", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-merge-any-first-fail");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-merge-any-first-fail-merge", "passed");
    await expectNode(page, "qa-e2e-req-fail500", "failed");
    await expectNode(page, "qa-e2e-req-single", "passed");
    await openRunLog(page);
    await expectRunSummary(page, { failed: 1, passed: 2 });
    await snap("chn-s-mrg-04-any-fail");
  });

  test("[CHN-S-MRG-05] A Merge with one inbound edge blocks the run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-merge-single-in");
    await expectBanner(page, "merge");
    await expectRunBlocked(page);
    await snap("chn-s-mrg-05-single");
  });

  test("[CHN-S-MRG-06] \"All\" mode fails when a lane fails", async ({
    seededPage: page,
    snap,
  }) => {
    const merge = "qa-e2e-merge-all-fail-merge";
    await openChain(page, "qa-e2e-merge-all-fail");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-fail500", "failed");
    await expectNode(page, merge, "failed");
    await expectNode(page, "qa-e2e-req-echo", "skipped");
    await expectErrorLine(page, merge, /upstream lane failed/i);
    await snap("chn-s-mrg-06-all-fail");
  });

  test("[CHN-S-MRG-07] A lane cut off by \"any\" mode is not counted as a result", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-merge-any-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-slow", "skipped");
    await expectNode(page, "qa-e2e-merge-any-ok-merge", "passed");
    await openRunLog(page);
    await expect(stepRow(page, "qa-e2e-req-slow")).toBeVisible();
    await snap("chn-s-mrg-07-cut");
  });

  test("[CHN-S-MRG-08] A Merge exposes combined lane results downstream", async ({
    seededPage: page,
    snap,
  }) => {
    const merge = "qa-e2e-merge-all-ok-merge";
    await openChain(page, "qa-e2e-merge-all-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-echo", "passed");
    await openRunLog(page);
    await openStepDetail(page, merge);
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toBeVisible();
    await openStepDetail(page, "qa-e2e-req-echo");
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toBeVisible();
    await snap("chn-s-mrg-08-output");
  });

  test("[CHN-S-LOP-01] A three-item array iterates three times", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-loop-body", "passed");
    await expectNode(page, "qa-e2e-loop-ok-collect", "passed");
    await openRunLog(page);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-ok-loop-0")).toBeVisible();
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-ok-loop-2")).toBeVisible();
    await snap("chn-s-lop-01-three");
  });

  test("[CHN-S-LOP-02] A custom item alias is usable in the loop body", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await openNodePanel(page, "qa-e2e-loop-ok-loop");
    await page.getByTestId("loop-config-item-alias").fill("user");
    await page.getByTestId("loop-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    for (const iteration of [0, 1, 2]) {
      await openIterationInput(
        page,
        "qa-e2e-loop-ok-loop",
        "qa-e2e-req-loop-body",
        iteration,
      );
      await expect(detailPanel(page)).toContainText(
        new RegExp(`Item(?:%20| )${iteration + 1}`),
      );
    }
    await snap("chn-s-lop-02-alias");
  });

  test("[CHN-S-LOP-03] A maximum lower than the array length truncates iterations", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await openNodePanel(page, "qa-e2e-loop-ok-loop");
    await page.getByTestId("loop-config-max-iterations").fill("2");
    await page.getByTestId("loop-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-ok-loop-1")).toBeVisible();
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-ok-loop-2")).toHaveCount(0);
    await snap("chn-s-lop-03-truncate");
  });

  test("[CHN-S-LOP-04] A source path selects a nested array", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-nested");
    await openNodePanel(page, "qa-e2e-loop-nested-loop");
    await page.getByTestId("loop-config-source-path").fill("$.items");
    await page.getByTestId("loop-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-nested-loop-0")).toBeVisible();
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-nested-loop-1")).toBeVisible();
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-nested-loop-2")).toHaveCount(0);
    await snap("chn-s-lop-04-nested");
  });

  test("[CHN-S-LOP-05] The iteration index is available in the body", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-alias-index");
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    for (const iteration of [0, 1, 2]) {
      await openIterationInput(
        page,
        "qa-e2e-loop-alias-index-loop",
        "qa-e2e-req-loop-index",
        iteration,
      );
      await expect(detailPanel(page)).toContainText(`i=${iteration}`);
    }
    await snap("chn-s-lop-05-index");
  });

  test("[CHN-S-LOP-06] An empty array runs zero iterations", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-empty");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-loop-empty-loop", "passed");
    await expectNode(page, "qa-e2e-loop-empty-collect", "passed");
    await openRunLog(page);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-empty-loop-0")).toHaveCount(0);
    await snap("chn-s-lop-06-empty");
  });

  test("[CHN-S-LOP-07a] A maximum above the cap is clamped or rejected", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-max-cap");
    await openNodePanel(page, "qa-e2e-loop-max-cap-loop");
    await page.getByTestId("loop-config-max-iterations").fill("5000");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("loop-config-save-btn")).toBeDisabled();
    await snap("chn-s-lop-07a-cap");
  });

  test("[CHN-S-LOP-07b] A maximum of zero is clamped or rejected", async ({
    seededPage: page,
    snap,
  }) => {
    const loop = "qa-e2e-loop-max-cap-loop";
    await openChain(page, "qa-e2e-loop-max-cap");
    await openNodePanel(page, loop);
    await page.getByTestId("loop-config-max-iterations").fill("0");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("loop-config-save-btn")).toBeDisabled();
    await page.keyboard.press("Escape");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, loop, "failed");
    await expectErrorLine(page, loop, /at least 1/i);
    await snap("chn-s-lop-07b-zero");
  });

  test("[CHN-S-LOP-08] A source that is not an array fails the Loop", async ({
    seededPage: page,
    snap,
  }) => {
    const loop = "qa-e2e-loop-notarray-loop";
    await openChain(page, "qa-e2e-loop-notarray");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, loop, "failed");
    await expectErrorLine(page, loop, /did not resolve to an array/i);
    await snap("chn-s-lop-08-not-array");
  });

  test("[CHN-S-LOP-09a] The panel rejects a reserved item alias", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-alias-bad");
    await openNodePanel(page, "qa-e2e-loop-alias-bad-loop");
    await page.getByTestId("loop-config-item-alias").fill("index");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("loop-config-save-btn")).toBeDisabled();
    await snap("chn-s-lop-09a-alias");
  });

  test("[CHN-S-LOP-09b] A seeded invalid alias fails at run time", async ({
    seededPage: page,
    snap,
  }) => {
    const loop = "qa-e2e-loop-alias-bad-loop";
    await openChain(page, "qa-e2e-loop-alias-bad");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, loop, "failed");
    await expectNode(page, "qa-e2e-req-loop-body", "skipped");
    await expectErrorLine(page, loop, /index/i);
    await snap("chn-s-lop-09b-alias-run");
  });

  test("[CHN-S-LOP-10] A failing iteration leaves the Loop passed with a warning", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-iter-fail");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-loop-iter-fail-loop", "passed");
    await openRunLog(page);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-iter-fail-loop-0")).toBeVisible();
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-iter-fail-loop-2")).toBeVisible();
    await snap("chn-s-lop-10-iter-fail");
  });

  test("[CHN-S-LOP-11] A Loop without upstream fails", async ({ seededPage: page, snap }) => {
    const loop = "qa-e2e-loop-noup-loop";
    await openChain(page, "qa-e2e-loop-noup");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, loop, "failed");
    await expectErrorLine(page, loop, /no upstream/i);
    await snap("chn-s-lop-11-no-upstream");
  });

  test("[CHN-S-LOP-12] A Loop without a paired Collect blocks the run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-unpaired");
    await expectBanner(page, "loop-unpaired");
    await expectRunBlocked(page);
    await snap("chn-s-lop-12-unpaired");
  });

  test("[CHN-S-LOP-13] Loops nested three deep run normally", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-nested3");
    await expect(page.getByTestId("canvas-banner-loop-nesting-depth")).toHaveCount(0);
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-loop-nested3-l1", "passed");
    await expectNode(page, "qa-e2e-loop-nested3-l3", "passed");
    await openRunLog(page);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-nested3-l1-0")).toBeVisible();
    await snap("chn-s-lop-13-nested3");
  });

  test("[CHN-S-LOP-14] Loops nested four deep show a banner and block the run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-nested4");
    await expectBanner(page, "loop-nesting-depth");
    await expectRunBlocked(page);
    await snap("chn-s-lop-14-nested4");
  });

  test("[CHN-S-LOP-15] The default maximum is shown for an untouched Loop", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await openNodePanel(page, "qa-e2e-loop-ok-loop");
    await expect(page.getByTestId("loop-config-max-iterations")).toHaveValue("100");
    await snap("chn-s-lop-15-default");
  });

  test("[CHN-S-LOP-16] The done output continues after the Collect", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-loop-ok-collect", "passed");
    await expectNode(page, "qa-e2e-req-loop-tail", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-loop-tail");
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("[");
    await snap("chn-s-lop-16-tail");
  });

  test("[CHN-S-LOP-17] Re-running a Loop shows only the new run's iterations", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await runChain(page);
    await waitRunDone(page);
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-ok-loop-0")).toHaveCount(1);
    await expect(page.getByTestId("iteration-toggle-qa-e2e-loop-ok-loop-2")).toHaveCount(1);
    await snap("chn-s-lop-17-rerun");
  });

  test("[CHN-S-COL-01] Collect gathers every iteration output", async ({
    seededPage: page,
    snap,
  }) => {
    const collect = "qa-e2e-loop-ok-collect";
    await openChain(page, "qa-e2e-loop-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, collect, "passed");
    await openRunLog(page);
    await openStepDetail(page, collect);
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("[");
    await snap("chn-s-col-01-gather");
  });

  test("[CHN-S-COL-02] Duplicating a Loop duplicates and pairs its Collect", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await nodeBadge(page, "qa-e2e-loop-ok-loop").click();
    await page.keyboard.press("Meta+D");
    await expect(page.locator("[data-testid^='loop-node-']")).toHaveCount(2);
    await expect(page.locator("[data-testid^='collect-node-']")).toHaveCount(2);
    await snap("chn-s-col-02-duplicate");
  });

  test("[CHN-S-COL-03] Collect of an empty loop returns an empty list", async ({
    seededPage: page,
    snap,
  }) => {
    const collect = "qa-e2e-loop-empty-collect";
    await openChain(page, "qa-e2e-loop-empty");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, collect, "passed");
    await openRunLog(page);
    await openStepDetail(page, collect);
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("[]");
    await snap("chn-s-col-03-empty");
  });

  test("[CHN-S-COL-04] A Collect with no loop result is skipped", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-nolink");
    await expectBanner(page, "loop-body-misses-collect");
    await expectRunBlocked(page);
    await snap("chn-s-col-04-no-result");
  });

  test("[CHN-S-COL-05] An unresolved Collect blocks the run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-stray");
    await expectBanner(page, "collect-unresolved");
    await expectRunBlocked(page);
    await snap("chn-s-col-05-unresolved");
  });

  test("[CHN-S-COL-06a] The Collect panel shows its paired Loop", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await openNodePanel(page, "qa-e2e-loop-ok-collect");
    await expect(page.getByTestId("collect-config-loop")).toContainText(/loop/i);
    await snap("chn-s-col-06a-panel");
  });

  test("[CHN-S-COL-06b] Deleting the Loop also removes its paired Collect", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await nodeBadge(page, "qa-e2e-loop-ok-loop").click();
    await page.keyboard.press("Delete");
    // Store cascade: a Loop takes its paired Collect with it, so nothing is left unresolved.
    await expect(nodeBadge(page, "qa-e2e-loop-ok-loop")).toHaveCount(0);
    await expect(nodeBadge(page, "qa-e2e-loop-ok-collect")).toHaveCount(0);
    await expect(page.getByTestId("canvas-banner-collect-unresolved")).toHaveCount(0);
    await snap("chn-s-col-06b-delete");
  });

  test("[CHN-S-SUB-01] A parent runs its child chain inline", async ({
    seededPage: page,
    snap,
  }) => {
    const sub = "qa-e2e-sub-parent-ok-sub";
    await openChain(page, "qa-e2e-sub-parent-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, sub, "passed");
    await openRunLog(page);
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    await expect(stepRow(page, `qa-e2e-req-sub-echo::${sub}`)).toBeVisible();
    await snap("chn-s-sub-01-inline");
  });

  test("[CHN-S-SUB-02] An input binding can be a literal", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-sub-parent-bind");
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await page.getByTestId("subchain-toggle-qa-e2e-sub-parent-bind-sub").click();
    await openStepDetail(page, "qa-e2e-req-sub-echo::qa-e2e-sub-parent-bind-sub");
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("literal-ada");
    await snap("chn-s-sub-02-literal");
  });

  test("[CHN-S-SUB-03] An input binding can come from an upstream alias", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-sub-parent-bind");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-sub-parent-bind-sub", "passed");
    await openRunLog(page);
    await page.getByTestId("subchain-toggle-qa-e2e-sub-parent-bind-sub").click();
    await openStepDetail(page, "qa-e2e-req-sub-echo::qa-e2e-sub-parent-bind-sub");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await snap("chn-s-sub-03-alias");
  });

  test("[CHN-S-SUB-04] The referenced chain can be changed from the picker", async ({
    seededPage: page,
    snap,
  }) => {
    const sub = "qa-e2e-sub-parent-ok-sub";
    await openChain(page, "qa-e2e-sub-parent-ok");
    await openSubChainPicker(page, sub);
    await page.getByTestId("subchain-picker-search").fill("child alt");
    await page.getByTestId("subchain-picker-item-qa-e2e-sub-child-alt").click();
    await expect(nodeBadge(page, sub)).toContainText(/child alt/i);
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, sub, "passed");
    await openRunLog(page);
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    await expect(stepRow(page, `qa-e2e-req-single::${sub}`)).toBeVisible();
    await snap("chn-s-sub-04-picker");
  });

  test("[CHN-S-SUB-05] A child chain with nothing to run is flagged", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-sub-parent-empty");
    await expectBanner(page, "subchain-invalid");
    await expectRunBlocked(page);
    await snap("chn-s-sub-05-empty");
  });

  test("[CHN-S-SUB-06] A deleted child chain is reported as unresolved", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-sub-parent-missing");
    await expectBanner(page, "subchain-invalid");
    await expectRunBlocked(page);
    await snap("chn-s-sub-06-missing");
  });

  test("[CHN-S-SUB-07] Subchains nested beyond five levels fail", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-sub-parent-deep6");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-sub-parent-deep6-sub", "failed");
    await openRunLog(page);
    await expect(page.getByTestId("run-log-dock")).toContainText(/maximum depth/i);
    await snap("chn-s-sub-07-depth");
  });

  test("[CHN-S-SUB-08] A failing child step fails the parent", async ({
    seededPage: page,
    snap,
  }) => {
    const sub = "qa-e2e-sub-parent-fail-sub";
    await openChain(page, "qa-e2e-sub-parent-fail");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, sub, "failed");
    await openRunLog(page);
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    await expect(stepRow(page, `qa-e2e-req-fail500::${sub}`)).toBeVisible();
    await snap("chn-s-sub-08-child-fail");
  });

  test("[CHN-S-SUB-09] A chain cannot reference itself", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-sub-parent-self");
    await expectBanner(page, "subchain-invalid");
    await expectRunBlocked(page);
    await snap("chn-s-sub-09-self");
  });

  test("[CHN-S-SUB-10] The picker excludes the current chain and filters by name", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-sub-parent-ok");
    await openSubChainPicker(page, "qa-e2e-sub-parent-ok-sub");
    await expect(page.getByTestId("subchain-picker-dialog")).toBeVisible();
    await expect(page.getByTestId("subchain-picker-item-qa-e2e-sub-parent-ok")).toHaveCount(0);
    await page.getByTestId("subchain-picker-search").fill("child alt");
    await expect(page.getByTestId("subchain-picker-item-qa-e2e-sub-child-alt")).toBeVisible();
    await expect(page.getByTestId("subchain-picker-item-qa-e2e-sub-child")).toHaveCount(0);
    await snap("chn-s-sub-10-picker-filter");
  });

  test("[CHN-S-SUB-11] A failing child surfaces as a subchain failure on the parent step", async ({
    seededPage: page,
    snap,
  }) => {
    const sub = "qa-e2e-sub-parent-fail-sub";
    await openChain(page, "qa-e2e-sub-parent-fail");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, sub, "failed");
    await expectErrorLine(page, sub, /sub-chain run failed|internal server/i);
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    await expect(stepRow(page, `qa-e2e-req-fail500::${sub}`)).toBeVisible();
    await snap("chn-s-sub-11-subchain-failed");
  });
});
