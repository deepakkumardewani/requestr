/**
 * Chain e2e specs: Condition, Display, Evaluate, and Validate nodes.
 * Source of truth: e2e/scenarios/chain/chain-nodes-logic.feature.md
 * Seed data: e2e/fixtures/seed/chain-e2e-logic.json
 */
import { installChainRoutes } from "../fixtures/chainRoutes";
import {
  expectBarSummary,
  expectBanner,
  expectNode,
  expectRunSummary,
  nodeBadge,
  openChain,
  openDetailTab,
  openNodePanel,
  openRunLog,
  openStepDetail,
  runChain,
  setFilter,
  stepRow,
  waitRunDone,
} from "../fixtures/chainE2eHelpers";
import { expect, test } from "../fixtures/qa";

const FAST = "qa-e2e-req-single";
const ECHO = "qa-e2e-req-echo";

/**
 * Opens a Condition's config sheet and waits for its focus scope to land on the
 * variable input. Playwright's fill() types into the focused element, so a fill
 * that races the sheet's mount-time autofocus lands in the variable field.
 */
async function openConditionPanel(
  page: import("@playwright/test").Page,
  condId: string,
) {
  await openNodePanel(page, condId);
  await expect(page.getByTestId("condition-config-variable")).toBeFocused();
}

function detailPanel(page: import("@playwright/test").Page) {
  return page.locator("[data-slot='tabs-content']:not([inert])");
}

async function expectNoRunYet(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("run-log-strip")).toContainText(/no runs yet/i);
}

async function expectTakenBranch(
  page: import("@playwright/test").Page,
  condId: string,
  label: string,
  takenId: string,
  skippedId: string,
) {
  await expectNode(page, condId, "passed");
  await expect(nodeBadge(page, condId).locator(".text-emerald-400")).toHaveText(label);
  await expectNode(page, takenId, "passed");
  await expectNode(page, skippedId, "skipped");
  await expectBarSummary(page, { text: /passed/i });
  await openRunLog(page);
  await expectRunSummary(page, { passed: 3, skipped: 1 });
  await expect(stepRow(page, condId)).toBeVisible();
  await setFilter(page, "skipped");
  await expect(stepRow(page, skippedId)).toBeVisible();
  await openStepDetail(page, skippedId);
  await openDetailTab(page, "Error");
  await expect(detailPanel(page)).toContainText(/upstream|skipped/i);
}

test.describe("Chain E2E — Simple logic nodes @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-S-CND-01] An equality branch is taken when its expression matches", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-eq");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-eq-cond", "equal", FAST, ECHO);
    await snap("chn-s-cnd-01-equality");
  });

  test("[CHN-S-CND-02] A not-equal branch is taken for a different value", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-neq");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-neq-cond", "different", FAST, ECHO);
    await snap("chn-s-cnd-02-not-equal");
  });

  test("[CHN-S-CND-03] A greater-than branch compares numbers", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-gt");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-gt-cond", "greater", FAST, ECHO);
    await snap("chn-s-cnd-03-greater");
  });

  test("[CHN-S-CND-04] A less-than branch compares numbers", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-lt");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-lt-cond", "less", FAST, ECHO);
    await snap("chn-s-cnd-04-less");
  });

  test("[CHN-S-CND-05] A contains branch matches on substrings", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-contains");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-contains-cond", "contains", FAST, ECHO);
    await snap("chn-s-cnd-05-contains");
  });

  test("[CHN-S-CND-06] Adding and removing branches updates the node handles", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-cond-multi-cond";
    await openChain(page, "qa-e2e-cond-multi");
    const sources = nodeBadge(page, condId).locator(".react-flow__handle.source");
    await expect(sources).toHaveCount(3);
    await openConditionPanel(page, condId);
    await page.getByTestId("condition-config-add-branch-btn").click();
    await page.getByTestId("condition-config-save-btn").click();
    await expect(sources).toHaveCount(4);
    await openConditionPanel(page, condId);
    await page
      .locator(
        "[data-testid^='condition-config-remove-branch-']:not([data-testid='condition-config-remove-branch-first-btn']):not([data-testid='condition-config-remove-branch-second-btn']):not([data-testid='condition-config-remove-branch-else-btn'])",
      )
      .click();
    await page.getByTestId("condition-config-save-btn").click();
    await expect(sources).toHaveCount(3);
    await expect(nodeBadge(page, condId)).toContainText("else");
    await expectNoRunYet(page);
    await snap("chn-s-cnd-06-handles");
  });

  test("[CHN-S-CND-07] The else path is taken when no branch matches", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-else");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-else-cond", "else", FAST, ECHO);
    await snap("chn-s-cnd-07-else");
  });

  test("[CHN-S-CND-08] A numeric value and its string form give the same outcome", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-eq");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, FAST, "passed");
    await page.getByTestId("run-with-inputs-btn").click();
    const popover = page.getByTestId("run-with-inputs-popover");
    await popover.locator("input").first().fill("7");
    await popover.getByRole("button", { name: /run/i }).click();
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-eq-cond", "equal", FAST, ECHO);
    await snap("chn-s-cnd-08-numeric-string");
  });

  test("[CHN-S-CND-09] An unresolved variable is flagged on the Condition", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-cond-eq-cond";
    await openChain(page, "qa-e2e-cond-eq");
    await openConditionPanel(page, condId);
    await page.getByTestId("condition-config-variable").fill("{{missing}}");
    await page.getByTestId("condition-config-save-btn").click();
    await expect(
      nodeBadge(page, condId).getByTestId("node-variables-footer-unresolved"),
    ).toBeVisible();
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await openStepDetail(page, condId);
    await openDetailTab(page, "Input");
    await expect(page.getByTestId("unresolved-vars")).toContainText("{{missing}}");
    await snap("chn-s-cnd-09-unresolved");
  });

  test("[CHN-S-CND-10] No matching branch and no else fails the Condition", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-cond-nomatch-cond";
    await openChain(page, "qa-e2e-cond-nomatch");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, condId, "failed");
    await expectNode(page, FAST, "skipped");
    await expectBarSummary(page, { text: /failed/i });
    await openRunLog(page);
    await expectRunSummary(page, { failed: 1, skipped: 1 });
    await expect(stepRow(page, condId).getByTestId("step-error-line")).toContainText(
      /no branch matched/i,
    );
    await snap("chn-s-cnd-10-no-match");
  });

  test("[CHN-S-CND-11a] A greater-than-or-equal comparison takes its branch on equality", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cond-ge");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-ge-cond", "at-least", FAST, ECHO);
    await snap("chn-s-cnd-11a-ge");
  });

  test("[CHN-S-CND-11b] A less-than-or-equal comparison takes its branch on equality", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-cond-ge-cond";
    await openChain(page, "qa-e2e-cond-ge");
    await openConditionPanel(page, condId);
    await page.getByTestId("condition-config-branch-ge-expression").fill("<= 5");
    await page.getByTestId("condition-config-branch-ge-label").fill("at-most");
    await page.getByTestId("condition-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, condId, "at-most", FAST, ECHO);
    await snap("chn-s-cnd-11b-le");
  });

  test("[CHN-S-CND-12] A non-numeric operand never causes an uncaught error", async ({
    seededPage: page,
    snap,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await openChain(page, "qa-e2e-cond-badnum");
    await runChain(page);
    await waitRunDone(page);
    await expectTakenBranch(page, "qa-e2e-cond-badnum-cond", "else", FAST, ECHO);
    expect(errors).toEqual([]);
    await snap("chn-s-cnd-12-badnum");
  });

  test("[CHN-S-CND-13] The first listed matching branch wins and labels can be edited", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-cond-multi-cond";
    await openChain(page, "qa-e2e-cond-multi");
    await openConditionPanel(page, condId);
    await page.getByTestId("condition-config-branch-first-label").fill("first-edited");
    await page.getByTestId("condition-config-branch-second-label").fill("second-edited");
    await page.getByTestId("condition-config-save-btn").click();
    await expect(nodeBadge(page, condId)).toContainText("first-edited");
    await expect(nodeBadge(page, condId)).toContainText("second-edited");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, condId, "passed");
    await expect(nodeBadge(page, condId).locator(".text-emerald-400")).toHaveText("first-edited");
    await expectNode(page, FAST, "passed");
    await expectNode(page, ECHO, "skipped");
    await expectNode(page, "qa-e2e-req-fail500", "skipped");
    await expectBarSummary(page, { text: /passed/i });
    await openRunLog(page);
    await expectRunSummary(page, { passed: 3, skipped: 2 });
    await snap("chn-s-cnd-13-first-wins");
  });
});

async function replaceEditor(
  page: import("@playwright/test").Page,
  testId: string,
  text: string,
) {
  const editor = page.getByTestId(testId).locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Meta+A");
  await page.keyboard.insertText(text);
}

async function expectErrorLine(
  page: import("@playwright/test").Page,
  nodeId: string,
  message: RegExp,
) {
  await openRunLog(page);
  await expect(stepRow(page, nodeId).getByTestId("step-error-line")).toContainText(message);
}

test.describe("Chain E2E — Display, Evaluate, Validate @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-S-DSP-01] Display extracts a token into a header alias", async ({
    seededPage: page,
    snap,
  }) => {
    const disp = "qa-e2e-disp-header-disp";
    await openChain(page, "qa-e2e-disp-header");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-token", "passed");
    await expectNode(page, disp, "passed");
    await expectNode(page, "qa-e2e-req-disp-hdr", "passed");
    await expectBarSummary(page, { text: /passed/i });
    await openRunLog(page);
    await openStepDetail(page, disp);
    await openDetailTab(page, "Extracted");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await snap("chn-s-dsp-01-header");
  });

  test("[CHN-S-DSP-02] Display can target the URL", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-disp-url");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-disp-url-disp", "passed");
    await expectNode(page, "qa-e2e-req-disp-url", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-disp-url");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await snap("chn-s-dsp-02-url");
  });

  test("[CHN-S-DSP-03] Display can target the path", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-disp-path");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-disp-path-disp", "passed");
    await expectNode(page, "qa-e2e-req-disp-path", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-disp-path");
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("/api/item/1");
    await snap("chn-s-dsp-03-path");
  });

  test("[CHN-S-DSP-04] Display can target a header", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-disp-header");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-disp-hdr", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-disp-hdr");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await snap("chn-s-dsp-04-header-sent");
  });

  test("[CHN-S-DSP-05] Display can target the body", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-disp-body");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-disp-body-disp", "passed");
    await expectNode(page, "qa-e2e-req-disp-body", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-disp-body");
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await snap("chn-s-dsp-05-body");
  });

  test("[CHN-S-DSP-06] A Display alias resolves downstream without warnings", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-disp-header");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-disp-hdr", "passed");
    await expect(nodeBadge(page, "qa-e2e-req-disp-hdr").getByTestId("node-variables-footer-unresolved")).toHaveCount(0);
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-disp-hdr");
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).not.toContainText("{{tok}}");
    await snap("chn-s-dsp-06-alias");
  });

  test("[CHN-S-DSP-07] A Display with several inputs blocks the run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-disp-multi-in");
    await expectBanner(page, "display-multiple-inputs");
    await expect(page.getByTestId("run-chain-btn")).toBeDisabled();
    await snap("chn-s-dsp-07-multiple-inputs");
  });

  test("[CHN-S-DSP-08] A Display without a source fails", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-disp-nosrc");
    await expect(page.getByTestId("run-chain-btn")).toBeDisabled();
    await expect(page.getByTestId("run-log-strip")).toContainText(/no runs yet/i);
    await snap("chn-s-dsp-08-no-source");
  });

  test("[CHN-S-DSP-09] A Display with an empty path fails", async ({ seededPage: page, snap }) => {
    const disp = "qa-e2e-disp-nopath-disp";
    await openChain(page, "qa-e2e-disp-nopath");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, disp, "failed");
    await expectErrorLine(page, disp, /no extraction path/i);
    await snap("chn-s-dsp-09-no-path");
  });

  test("[CHN-S-DSP-10] A Display whose path misses fails and skips downstream", async ({
    seededPage: page,
    snap,
  }) => {
    const disp = "qa-e2e-disp-miss-disp";
    await openChain(page, "qa-e2e-disp-miss");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, disp, "failed");
    await expectNode(page, "qa-e2e-req-echo", "skipped");
    await expectErrorLine(page, disp, /could not extract/i);
    await snap("chn-s-dsp-10-miss");
  });

  test("[CHN-S-DSP-11] The extractor picker builds a path from the upstream response", async ({
    seededPage: page,
    snap,
  }) => {
    const disp = "qa-e2e-disp-header-disp";
    await openChain(page, "qa-e2e-disp-header");
    await runChain(page);
    await waitRunDone(page);
    await page.getByTestId(`display-node-${disp}`).click({ button: "right" });
    await page.getByTestId("context-menu-configure").click();
    await page.getByTestId("extractor-picker").getByRole("button", { name: /use/i }).first().click();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(nodeBadge(page, disp)).toContainText(/\$/);
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await openStepDetail(page, disp);
    await openDetailTab(page, "Extracted");
    await expect(detailPanel(page)).not.toBeEmpty();
    await snap("chn-s-dsp-11-picker");
  });

  test("[CHN-S-DSP-12] A Display after a failed request is skipped, not failed", async ({
    seededPage: page,
    snap,
  }) => {
    const disp = "qa-e2e-disp-after-fail-disp";
    await openChain(page, "qa-e2e-disp-after-fail");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-fail500", "failed");
    await expectNode(page, disp, "skipped");
    await expectBarSummary(page, { text: /failed/i });
    await openRunLog(page);
    await expectRunSummary(page, { failed: 1, skipped: 1 });
    await snap("chn-s-dsp-12-after-fail");
  });

  test("[CHN-S-EVL-01] The default code passes upstream data through", async ({
    seededPage: page,
    snap,
  }) => {
    const ev = "qa-e2e-eval-data-eval";
    await openChain(page, "qa-e2e-eval-data");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ev, "passed");
    await openRunLog(page);
    await openStepDetail(page, ev);
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await snap("chn-s-evl-01-passthrough");
  });

  test("[CHN-S-EVL-02] Custom code transforms upstream data", async ({ seededPage: page, snap }) => {
    const ev = "qa-e2e-eval-ok-eval";
    await openChain(page, "qa-e2e-eval-ok");
    await openNodePanel(page, ev);
    await replaceEditor(page, "evaluate-config-code", 'return { transformed: true };');
    await page.getByTestId("evaluate-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ev, "passed");
    await openRunLog(page);
    await openStepDetail(page, ev);
    await openDetailTab(page, "Extracted");
    await expect(detailPanel(page)).toContainText("transformed");
    await snap("chn-s-evl-02-transform");
  });

  test("[CHN-S-EVL-03] A custom output alias is usable downstream", async ({
    seededPage: page,
    snap,
  }) => {
    const ev = "qa-e2e-eval-ok-eval";
    await openChain(page, "qa-e2e-eval-ok");
    await openNodePanel(page, ev);
    await page.getByTestId("evaluate-config-alias").fill("result");
    await page.getByTestId("evaluate-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-eval-down", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-eval-down");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("seed-value");
    await snap("chn-s-evl-03-alias");
  });

  test("[CHN-S-EVL-04a] The panel Test shows a successful result", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-eval-ok");
    await openNodePanel(page, "qa-e2e-eval-ok-eval");
    await page.getByTestId("evaluate-config-test-btn").click();
    await expect(page.getByTestId("evaluate-test-output")).toContainText("seed-value");
    await expectNoRunYet(page);
    await snap("chn-s-evl-04a-test-ok");
  });

  test("[CHN-S-EVL-04b] The panel Test shows an error for failing code", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-eval-throw");
    await openNodePanel(page, "qa-e2e-eval-throw-eval");
    await page.getByTestId("evaluate-config-test-btn").click();
    await expect(page.getByTestId("evaluate-test-error")).toContainText(/window/i);
    await expectNoRunYet(page);
    await snap("chn-s-evl-04b-test-error");
  });

  test("[CHN-S-EVL-05] An Evaluate alias is usable in a downstream URL query", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-eval-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-eval-down", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-eval-down");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("k=seed-value");
    await snap("chn-s-evl-05-query");
  });

  test("[CHN-S-EVL-06] Code returning undefined fails", async ({ seededPage: page, snap }) => {
    const ev = "qa-e2e-eval-undef-eval";
    await openChain(page, "qa-e2e-eval-undef");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ev, "failed");
    await expectErrorLine(page, ev, /undefined/i);
    await snap("chn-s-evl-06-undefined");
  });

  test("[CHN-S-EVL-07] Code that throws fails and skips downstream", async ({
    seededPage: page,
    snap,
  }) => {
    const ev = "qa-e2e-eval-throw-eval";
    await openChain(page, "qa-e2e-eval-throw");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ev, "failed");
    await expectNode(page, "qa-e2e-req-echo", "skipped");
    await expectErrorLine(page, ev, /window/i);
    await snap("chn-s-evl-07-throw");
  });

  test("[CHN-S-EVL-08] Code that never finishes times out", async ({ seededPage: page, snap }) => {
    const ev = "qa-e2e-eval-timeout-eval";
    await openChain(page, "qa-e2e-eval-timeout");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ev, "failed");
    await expectErrorLine(page, ev, /timed out|terminated/i);
    await snap("chn-s-evl-08-timeout");
  });

  test("[CHN-S-EVL-09] An output alias that collides with an existing alias is rejected", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-eval-alias-clash");
    await openNodePanel(page, "qa-e2e-eval-alias-clash-eval");
    await page.getByTestId("evaluate-config-alias").fill("tok");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("evaluate-config-save-btn")).toBeDisabled();
    await expectNoRunYet(page);
    await snap("chn-s-evl-09-alias-clash");
  });

  test("[CHN-S-EVL-10] A syntax error is reported in the panel and at run time", async ({
    seededPage: page,
    snap,
  }) => {
    const ev = "qa-e2e-eval-syntax-eval";
    await openChain(page, "qa-e2e-eval-syntax");
    await openNodePanel(page, ev);
    await page.getByTestId("evaluate-config-test-btn").click();
    await expect(page.getByTestId("evaluate-test-error")).toBeVisible();
    const message = await page.getByTestId("evaluate-test-error").innerText();
    await page.keyboard.press("Escape");
    // A Run click while the sheet is still closing hits its overlay and never starts the run.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ev, "failed");
    await expectErrorLine(page, ev, new RegExp(message.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    await snap("chn-s-evl-10-syntax");
  });

  test("[CHN-S-EVL-11] Evaluate code cannot reach browser or network globals", async ({
    seededPage: page,
    snap,
  }) => {
    let echoHits = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/echo")) echoHits += 1;
    });
    const ev = "qa-e2e-eval-throw-eval";
    await openChain(page, "qa-e2e-eval-throw");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ev, "failed");
    await expectErrorLine(page, ev, /window/i);
    expect(echoHits).toBe(0);
    await snap("chn-s-evl-11-sandbox");
  });

  test("[CHN-S-VAL-01] A body matching the default schema passes", async ({
    seededPage: page,
    snap,
  }) => {
    const node = "qa-e2e-val-pass-val";
    await openChain(page, "qa-e2e-val-pass");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "passed");
    await expectBarSummary(page, { text: /passed/i });
    await openRunLog(page);
    await expect(stepRow(page, node)).toBeVisible();
    await snap("chn-s-val-01-pass");
  });

  test("[CHN-S-VAL-02] A body matching a typed schema with required fields passes", async ({
    seededPage: page,
    snap,
  }) => {
    const node = "qa-e2e-val-pass-val";
    await openChain(page, "qa-e2e-val-pass");
    await openNodePanel(page, node);
    await replaceEditor(
      page,
      "validate-config-schema",
      '{"type":"object","required":["id"],"properties":{"id":{"type":"number"}}}',
    );
    await page.getByTestId("validate-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "passed");
    await openRunLog(page);
    await expectRunSummary(page, { passed: 2 });
    await snap("chn-s-val-02-typed");
  });

  test("[CHN-S-VAL-03] A source path scopes what is validated", async ({ seededPage: page, snap }) => {
    const node = "qa-e2e-val-path-ok-val";
    await openChain(page, "qa-e2e-val-path-ok");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "passed");
    await openRunLog(page);
    await openStepDetail(page, node);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("1");
    await snap("chn-s-val-03-path");
  });

  test("[CHN-S-VAL-04] A Validate without upstream fails", async ({ seededPage: page, snap }) => {
    const node = "qa-e2e-val-noup-val";
    await openChain(page, "qa-e2e-val-noup");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "failed");
    await expectErrorLine(page, node, /no upstream/i);
    await snap("chn-s-val-04-no-upstream");
  });

  test("[CHN-S-VAL-05] A source path that matches nothing fails", async ({ seededPage: page, snap }) => {
    const node = "qa-e2e-val-nomatch-val";
    await openChain(page, "qa-e2e-val-nomatch");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "failed");
    await expectErrorLine(page, node, /matched nothing/i);
    await snap("chn-s-val-05-no-match");
  });

  test("[CHN-S-VAL-06] A non-JSON upstream body fails validation", async ({ seededPage: page, snap }) => {
    const node = "qa-e2e-val-badjson-val";
    await openChain(page, "qa-e2e-val-badjson");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "failed");
    await expectErrorLine(page, node, /not valid json/i);
    await snap("chn-s-val-06-bad-json");
  });

  test("[CHN-S-VAL-07] An invalid JSONPath fails validation", async ({ seededPage: page, snap }) => {
    const node = "qa-e2e-val-badpath-val";
    await openChain(page, "qa-e2e-val-badpath");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "failed");
    await expectErrorLine(page, node, /invalid jsonpath/i);
    await snap("chn-s-val-07-bad-path");
  });

  test("[CHN-S-VAL-08a] Schema text that is not JSON is flagged", async ({ seededPage: page, snap }) => {
    const node = "qa-e2e-val-badschema-val";
    await openChain(page, "qa-e2e-val-badschema");
    await openNodePanel(page, node);
    // Scope to the sheet: a page-level alert (toast region) can match before the sheet has opened.
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await page.keyboard.press("Escape");
    // A Run click while the sheet is still closing hits its overlay and never starts the run.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "failed");
    await expectErrorLine(page, node, /not valid json/i);
    await snap("chn-s-val-08a-schema-json");
  });

  test("[CHN-S-VAL-08b] A JSON document that is not a valid schema is flagged", async ({
    seededPage: page,
    snap,
  }) => {
    const node = "qa-e2e-val-badschema-val";
    await openChain(page, "qa-e2e-val-badschema");
    await openNodePanel(page, node);
    await replaceEditor(page, "validate-config-schema", '{"type":"not-a-type"}');
    await page.getByTestId("validate-config-save-btn").click();
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "failed");
    await expectErrorLine(page, node, /schema is invalid/i);
    await snap("chn-s-val-08b-schema");
  });

  test("[CHN-S-VAL-09] A failed validation lists at most three errors and counts the rest", async ({
    seededPage: page,
    snap,
  }) => {
    const node = "qa-e2e-val-fail-val";
    await openChain(page, "qa-e2e-val-fail");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, node, "failed");
    await openRunLog(page);
    await openStepDetail(page, node);
    await openDetailTab(page, "Error");
    await expect(detailPanel(page)).toContainText(/\(\+\d+ more\)/);
    await snap("chn-s-val-09-three-errors");
  });
});
