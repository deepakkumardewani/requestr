/**
 * Chain e2e specs: defect verification (CHN-BUG).
 * Source of truth: e2e/scenarios/chain/chain-bugs.feature.md
 * Seed data: e2e/fixtures/seed/chain-e2e.json (qa-e2e-bug-*), plus existing qa-e2e-* / qa-polish-* chains.
 */
import type { Page } from "@playwright/test";
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
  runAndOpenLog,
  runCards,
  runChain,
  setFilter,
  stepRow,
  stopChain,
  waitCanvasReady,
  waitRunDone,
} from "../fixtures/chainE2eHelpers";
import { expect, test } from "../fixtures/qa";

const POLISH_RUN_LOG = "qa-polish-run-log";
const POLISH_RUN_ID = "qa-polish-rl-passed";
/** Matches RUN_DELETE_UNDO_MS in src/stores/useChainRunStore.ts, plus slack. */
const RUN_DELETE_UNDO_WINDOW_MS = 6000;
const UNDO_WINDOW_SLACK_MS = 3000;
const PASTE_OFFSET = 40;
const SELECTION_RETRY_MS = 1500;
const TOAST_EXPIRY_MS = 8000;
const LOOP_ITERATIONS_FAILED = /\d+ of \d+ iterations? failed/;
const LOOP_DEPTH_ERROR = /Loop nesting exceeded the maximum depth/;
const FAILED_ITERATION_STEPS = 3;
const SINGLE_RUN_INJECTIONS_IGNORED = "Injections from upstream nodes are ignored";

const nodes = (page: Page) => page.locator(".react-flow__node");
const runButton = (page: Page) => page.getByTestId("run-chain-btn");

/** Flow-space position of a node, read from the translate() React Flow writes on it. */
async function nodePosition(page: Page, nodeId: string) {
  const transform = await page
    .locator(`.react-flow__node[data-id="${nodeId}"]`)
    .evaluate((el) => (el as HTMLElement).style.transform);
  const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
  if (!match) throw new Error(`no translate() on node ${nodeId}: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

/** Selects exactly one node by keyboard so chain shortcuts reach the canvas without opening its config sheet. */
async function selectOnly(page: Page, nodeId: string) {
  await page.locator(".react-flow__pane").click({ position: { x: 4, y: 4 } });
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
  await expect(
    page.locator(`.react-flow__node.selected[data-id="${nodeId}"]`),
  ).toHaveCount(1);
}

/** Opens a recorded run's card menu and deletes it. */
async function deleteRunViaMenu(page: Page, runId: string) {
  const card = page.locator(`[data-run-id="${runId}"]`);
  await card.hover();
  await card.getByRole("button", { name: "Run options" }).click();
  await page.getByRole("menuitem", { name: "Delete run" }).click();
  await expect(card).toHaveCount(0);
}

/** Step rows recorded inside loop iterations / Sub-chains, whose ids read `<node>::<parent>::<iteration>`. */
const nestedStepRows = (page: Page, nodeId: string) =>
  page.locator(`[data-step-id^="${nodeId}::"]`);

/** Expands every collapsed iteration / Sub-chain group in the run log, however deeply nested. */
async function expandAllGroups(page: Page) {
  const collapsed = page.locator(
    "[data-testid^='iteration-toggle-'][aria-expanded='false'], [data-testid^='subchain-toggle-'][aria-expanded='false']",
  );
  await expect(async () => {
    while ((await collapsed.count()) > 0) await collapsed.first().click();
  }).toPass({ timeout: SELECTION_RETRY_MS * 4 });
}

/**
 * Duplicate must be offered by the context menu exactly when Mod+D duplicates:
 * each path adds one copy that keeps its config and carries no edges.
 */
async function expectDuplicateParity(
  page: Page,
  nodeId: string,
  kind: "condition" | "delay",
) {
  const chainId = nodeId.replace(/-(cond|delay)$/, "");
  await openChain(page, chainId);
  const copies = page.locator(`[data-testid^='${kind}-node-']`);
  const edges = page.locator(".react-flow__edge");
  const copiesBefore = await copies.count();
  const edgesBefore = await edges.count();

  await nodeBadge(page, nodeId).click({ button: "right" });
  await page.getByTestId("context-menu-duplicate").click();
  await expect(copies).toHaveCount(copiesBefore + 1);
  await expect(edges).toHaveCount(edgesBefore);

  await selectOnly(page, nodeId);
  await page.keyboard.press("ControlOrMeta+d");
  await expect(copies).toHaveCount(copiesBefore + 2);
  await expect(edges).toHaveCount(edgesBefore);
}

test.describe("Chain E2E — Bug verification @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-BUG-01a] A greater-than-or-equal condition takes its branch on equality", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-bug-cond-ge-cond";
    await openChain(page, "qa-e2e-bug-cond-ge");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, condId, "passed");
    await expect(nodeBadge(page, condId).locator(".text-emerald-400")).toHaveText(
      "at-least",
    );
    await expectNode(page, "qa-e2e-req-single", "passed");
    await expectNode(page, "qa-e2e-req-echo", "skipped");
    await openRunLog(page);
    await expect(page.getByText("NO_BRANCH_MATCHED")).toHaveCount(0);
    await snap("chn-bug-01a-ge");
  });

  test("[CHN-BUG-01b] A less-than-or-equal condition takes its branch on equality", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-bug-cond-le-cond";
    await openChain(page, "qa-e2e-bug-cond-le");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, condId, "passed");
    await expect(nodeBadge(page, condId).locator(".text-emerald-400")).toHaveText(
      "at-most",
    );
    await expectNode(page, "qa-e2e-req-single", "passed");
    await expectNode(page, "qa-e2e-req-echo", "skipped");
    await openRunLog(page);
    await expect(page.getByText("NO_BRANCH_MATCHED")).toHaveCount(0);
    await snap("chn-bug-01b-le");
  });

  test("[CHN-BUG-03] Duplicating a lone Collect does not leave an orphan", async ({
    seededPage: page,
    snap,
  }) => {
    const collectId = "qa-e2e-bug-collect-dup-collect";
    await openChain(page, "qa-e2e-bug-collect-dup");
    await expect(runButton(page)).toBeEnabled();
    await selectOnly(page, collectId);
    await page.keyboard.press("ControlOrMeta+d");
    // The duplicate cannot pair with a Loop that already has a Collect, so it is
    // flagged by the unresolved-Collect banner and Run is blocked to match.
    await expect(page.locator("[data-testid^='collect-node-']")).toHaveCount(2);
    await expectBanner(page, "collect-unresolved");
    await expect(runButton(page)).toBeDisabled();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator("[data-testid^='collect-node-']")).toHaveCount(1);
    await expect(page.getByTestId("canvas-banner-collect-unresolved")).toHaveCount(0);
    await expect(runButton(page)).toBeEnabled();
    await snap("chn-bug-03-collect-dup");
  });

  test("[CHN-BUG-04] Deleting only the Collect unpairs the Loop and can be undone", async ({
    seededPage: page,
    snap,
  }) => {
    const collectId = "qa-e2e-bug-collect-delete-collect";
    await openChain(page, "qa-e2e-bug-collect-delete");
    await expect(runButton(page)).toBeEnabled();
    await selectOnly(page, collectId);
    await page.keyboard.press("Delete");
    await expect(page.locator("[data-testid^='collect-node-']")).toHaveCount(0);
    await expectBanner(page, "loop-unpaired");
    await expect(runButton(page)).toBeDisabled();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator("[data-testid^='collect-node-']")).toHaveCount(1);
    await expect(page.getByTestId("canvas-banner-loop-unpaired")).toHaveCount(0);
    await expect(runButton(page)).toBeEnabled();
    await snap("chn-bug-04-collect-delete");
  });

  test("[CHN-BUG-05a] Blocks that cannot be copied are refused with a toast", async ({
    seededPage: page,
    snap,
  }) => {
    const prefix = "qa-e2e-bug-clipboard";
    await openChain(page, prefix);
    const before = await nodes(page).count();
    const unsupported = [
      `${prefix}-loop`,
      `${prefix}-merge`,
      `${prefix}-sub`,
      `${prefix}-collect`,
      "qa-e2e-req-single",
    ];
    const toast = page.locator("[data-sonner-toast]", {
      hasText: "can't be copied and was skipped",
    });
    for (const id of unsupported) {
      await selectOnly(page, id);
      await page.keyboard.press("ControlOrMeta+c");
      await expect(toast).toBeVisible();
      await page.keyboard.press("ControlOrMeta+v");
      await expect(nodes(page)).toHaveCount(before);
      // Let the toast expire so the next block's toast is the only match.
      await expect(toast).toHaveCount(0, { timeout: TOAST_EXPIRY_MS });
    }
    await snap("chn-bug-05a-unsupported");
  });

  test("[CHN-BUG-05b] Supported blocks paste slightly offset", async ({
    seededPage: page,
    snap,
  }) => {
    const prefix = "qa-e2e-bug-clipboard";
    await openChain(page, prefix);
    for (const suffix of ["delay", "cond", "disp", "eval", "val"]) {
      const id = `${prefix}-${suffix}`;
      const origin = await nodePosition(page, id);
      const before = await nodes(page).count();
      const knownIds = await nodes(page).evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-id")),
      );
      await selectOnly(page, id);
      await page.keyboard.press("ControlOrMeta+c");
      // The clipboard lives in a store; paste is only bound after React re-renders with it.
      await expect(async () => {
        await page.keyboard.press("ControlOrMeta+v");
        await expect(nodes(page)).toHaveCount(before + 1, {
          timeout: SELECTION_RETRY_MS,
        });
      }).toPass({ timeout: SELECTION_RETRY_MS * 4 });
      const pastedId = (
        await nodes(page).evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-id")),
        )
      ).find((nodeId) => !knownIds.includes(nodeId));
      expect(pastedId).toBeTruthy();
      const pasted = await nodePosition(page, pastedId as string);
      expect(pasted).toEqual({
        x: origin.x + PASTE_OFFSET,
        y: origin.y + PASTE_OFFSET,
      });
    }
    await snap("chn-bug-05b-pasted");
  });

  test("[CHN-BUG-11a] Pressing Escape cancels block placement", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    const before = await nodes(page).count();
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-delay").click();
    await page.keyboard.press("Escape");
    await page.locator(".react-flow__pane").click({ position: { x: 420, y: 240 } });
    await expect(nodes(page)).toHaveCount(before);
    await expect(page.locator("[data-testid^='delay-node-']")).toHaveCount(0);
    await snap("chn-bug-11a-escape");
  });

  test("[CHN-BUG-11b] Clicking toolbar UI does not place a pending block", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    const before = await nodes(page).count();
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-delay").click();
    await page.getByRole("button", { name: "Snap to grid" }).click();
    await expect(nodes(page)).toHaveCount(before);
    await expect(page.locator("[data-testid^='delay-node-']")).toHaveCount(0);
    await snap("chn-bug-11b-toolbar-click");
  });

  test("[CHN-BUG-13] A dismissed banner reappears after the graph changes", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-bug-banner-dismiss");
    await expectBanner(page, "loop-unpaired");
    await page.getByRole("button", { name: "Dismiss banner" }).click();
    await expect(page.getByTestId("canvas-banner-loop-unpaired")).toHaveCount(0);
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-loop").click();
    await page.locator(".react-flow__pane").click({ position: { x: 480, y: 360 } });
    await expect(page.locator("[data-testid^='loop-node-']")).toHaveCount(2);
    await expectBanner(page, "loop-unpaired");
    await snap("chn-bug-13-banner-returns");
  });

  test("[CHN-BUG-14a] A run deleted without undo stays deleted after reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    const before = await runCards(page).count();
    await deleteRunViaMenu(page, POLISH_RUN_ID);
    const toast = page.locator("[data-sonner-toast]", { hasText: "Run deleted" });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCount(0, {
      timeout: RUN_DELETE_UNDO_WINDOW_MS + UNDO_WINDOW_SLACK_MS,
    });
    await page.reload();
    await waitCanvasReady(page);
    await openRunLog(page);
    await expect(page.locator(`[data-run-id="${POLISH_RUN_ID}"]`)).toHaveCount(0);
    await expect(runCards(page)).toHaveCount(before - 1);
    await expect(page.getByText("Run deleted")).toHaveCount(0);
    await snap("chn-bug-14a-stays-deleted");
  });

  test("[CHN-BUG-14b] Clearing runs finalises pending deletions", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    await deleteRunViaMenu(page, POLISH_RUN_ID);
    await page.getByTestId("run-log-dock").getByRole("button", { name: "Run Log options" }).click();
    await page.getByRole("menuitem", { name: "Clear all runs" }).click();
    await page
      .getByRole("alertdialog", { name: "Clear all runs?" })
      .getByRole("button", { name: "Clear all runs" })
      .click();
    await expect(page.getByTestId("run-log-empty-noRuns")).toBeVisible();
    await page.reload();
    await waitCanvasReady(page);
    await expect(runCards(page)).toHaveCount(0);
    await expect(page.locator(`[data-run-id="${POLISH_RUN_ID}"]`)).toHaveCount(0);
    await snap("chn-bug-14b-cleared");
  });

  test("[CHN-BUG-15] A second Start block is refused with a toast and nothing changes after reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-literal");
    await page.locator(".react-flow__pane").click({ button: "right" });
    await page.getByTestId("block-menu-item-start").click();
    await expect(page.getByText("Only one Start block is allowed per chain")).toBeVisible();
    await expect(page.locator("[data-testid^='start-node-']")).toHaveCount(1);
    await page.reload();
    await waitCanvasReady(page);
    await expect(page.locator("[data-testid^='start-node-']")).toHaveCount(1);
    await snap("chn-bug-15-second-start");
  });

  for (const [id, alias] of [
    ["CHN-BUG-16a", "index"],
    ["CHN-BUG-16b", "1abc"],
  ] as const) {
    test(`[${id}] The Loop panel rejects the alias "${alias}"`, async ({
      seededPage: page,
      snap,
    }) => {
      await openChain(page, "qa-e2e-loop-alias-bad");
      await openNodePanel(page, "qa-e2e-loop-alias-bad-loop");
      await page.getByTestId("loop-config-item-alias").fill(alias);
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.getByTestId("loop-config-save-btn")).toBeDisabled();
      await snap(`chn-bug-${id.slice(-3)}-alias`);
    });
  }

  test("[CHN-BUG-17] The Failed filter falls back to All after a passing re-run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-fail500");
    await runAndOpenLog(page);
    await setFilter(page, "failed");
    await expect(stepRow(page, "qa-e2e-req-fail500")).toBeVisible();
    // A later route wins over installChainRoutes; the failing target now answers 200.
    await page.route("/api/proxy", async (route) => {
      const body = route.request().postDataJSON() as { url?: string };
      if (!body.url?.endsWith("/api/fail")) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true }),
        }),
      });
    });
    await page.getByRole("button", { name: "Re-run same subset" }).click();
    await waitRunDone(page);
    await expect(page.getByTestId("run-filter-tab-failed")).toHaveCount(0);
    await expect(page.getByTestId("run-filter-tab-all")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(stepRow(page, "qa-e2e-req-fail500")).toBeVisible();
    await expect(page.getByTestId("run-log-empty-filter")).toHaveCount(0);
    await snap("chn-bug-17-fallback");
  });

  test("[CHN-BUG-18a] Nudging and auto-layout are ignored during a run", async ({
    seededPage: page,
    snap,
  }) => {
    const slowId = "qa-e2e-req-slow";
    await openChain(page, "qa-e2e-api-slow");
    await selectOnly(page, slowId);
    const start = await nodePosition(page, slowId);
    await runChain(page);
    await expectNode(page, slowId, "running");
    await page.locator(`.react-flow__node[data-id="${slowId}"]`).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("l");
    expect(await nodePosition(page, slowId)).toEqual(start);
    await stopChain(page);
    await waitRunDone(page);
    await snap("chn-bug-18a-no-move");
  });

  test("[CHN-BUG-18b] Canvas shortcuts are ignored while typing in an input", async ({
    seededPage: page,
    snap,
  }) => {
    const nodeId = "qa-e2e-req-single";
    await openChain(page, "qa-e2e-api-single");
    await selectOnly(page, nodeId);
    const start = await nodePosition(page, nodeId);
    const before = await nodes(page).count();
    await page.getByTestId("block-menu-trigger").click();
    const search = page.getByTestId("block-menu-search");
    await expect(search).toBeFocused();
    const typed = "lfd";
    await page.keyboard.type(typed);
    await page.keyboard.press("ArrowRight");
    await expect(search).toHaveValue(typed);
    await page.keyboard.press("Escape");
    expect(await nodePosition(page, nodeId)).toEqual(start);
    await expect(nodes(page)).toHaveCount(before);
    await snap("chn-bug-18b-typing");
  });

  test("[CHN-BUG-02a] Duplicate is offered on a Condition and the menu and Mod+D agree", async ({
    seededPage: page,
    snap,
  }) => {
    await expectDuplicateParity(page, "qa-e2e-bug-dup-menu-cond", "condition");
    await snap("chn-bug-02a-condition");
  });

  test("[CHN-BUG-02b] Duplicate is offered on a Delay and the menu and Mod+D agree", async ({
    seededPage: page,
    snap,
  }) => {
    await expectDuplicateParity(page, "qa-e2e-bug-dup-menu-delay", "delay");
    await snap("chn-bug-02b-delay");
  });

  test("[CHN-BUG-06] A Loop with failing iterations passes with a warning and keeps the failed rows", async ({
    seededPage: page,
    snap,
  }) => {
    const loopId = "qa-e2e-bug-loop-partial-loop";
    await openChain(page, "qa-e2e-bug-loop-partial");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, loopId, "passed");
    await openRunLog(page);
    await openStepDetail(page, loopId);
    await expect(
      page.getByRole("alert").filter({ hasText: LOOP_ITERATIONS_FAILED }),
    ).toBeVisible();
    // Documented outcome: the Loop node passes, but the failed iteration steps
    // still count toward the run, so the run itself is recorded as Failed.
    await expect(runCards(page).first()).toContainText(/failed/i);
    await expectRunSummary(page, { passed: 3, failed: 3 });
    await expect(page.locator("[data-testid^='iteration-toggle-']")).toHaveCount(
      FAILED_ITERATION_STEPS,
    );
    await expandAllGroups(page);
    await expect(page.getByTestId("run-filter-tab-failed")).toContainText(
      String(FAILED_ITERATION_STEPS),
    );
    const failedIterations = nestedStepRows(page, "qa-e2e-req-loop-item");
    await expect(failedIterations).toHaveCount(FAILED_ITERATION_STEPS);
    await expect(failedIterations.first()).toContainText(/HTTP 599/);
    await snap("chn-bug-06-loop-partial");
  });

  test("[CHN-BUG-07] Loop nesting across a Sub-chain is bounded by a failed step", async ({
    seededPage: page,
    snap,
  }) => {
    const subId = "qa-e2e-bug-loop-depth-sub";
    await openChain(page, "qa-e2e-bug-loop-depth");
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page).first()).toContainText(/failed/i);
    await expandAllGroups(page);
    // Nested rows carry their ancestry in the id, so match the Sub-chain by prefix.
    const failedSub = nestedStepRows(page, subId);
    await expect(failedSub).toHaveCount(1);
    await expect(failedSub.getByTestId("step-error-line")).toContainText(LOOP_DEPTH_ERROR);
    await expect(
      nestedStepRows(page, "qa-e2e-med-sub-loop-child-loop").getByTestId("step-error-line"),
    ).toContainText(LOOP_DEPTH_ERROR);
    await snap("chn-bug-07-loop-depth");
  });

  test("[CHN-BUG-08] A bad JSONPath edge fails the target with an explanation", async ({
    seededPage: page,
    snap,
  }) => {
    const target = "qa-e2e-req-echo";
    await openChain(page, "qa-e2e-bug-bad-path");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, target, "failed");
    await expect(nodeBadge(page, target)).toContainText(/extract failed/i);
    await openRunLog(page);
    await expectRunSummary(page, { passed: 1, failed: 1 });
    await expect(stepRow(page, target).getByTestId("step-error-line")).toContainText(
      /could not extract/i,
    );
    await openStepDetail(page, target);
    await openDetailTab(page, "Error");
    await expect(page.getByRole("tabpanel")).toContainText(/could not extract/i);
    await snap("chn-bug-08-bad-path");
  });

  test("[CHN-BUG-09] A Display with two inbound edges blocks the run until one is removed", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-bug-disp-2in");
    await expectBanner(page, "display-multiple-inputs");
    await expect(runButton(page)).toBeDisabled();
    await expect(runButton(page)).toHaveAttribute("title", /one input|single/i);
    await page.getByTestId("edge-delete-btn").first().dispatchEvent("click");
    await expect(page.getByTestId("canvas-banner-display-multiple-inputs")).toHaveCount(0);
    await expect(runButton(page)).toBeEnabled();
    await snap("chn-bug-09-display-two-inputs");
  });

  test("[CHN-BUG-10] A single-node run warns that upstream injections are ignored", async ({
    seededPage: page,
    snap,
  }) => {
    const target = "qa-e2e-req-disp-url";
    await openChain(page, "qa-e2e-bug-single-inject");
    const node = nodeBadge(page, target);
    await node.hover();
    await page
      .locator(
        `.react-flow__node:has([data-testid="chain-node-${target}"]) [data-testid="node-toolbar-run"]`,
      )
      .click();
    await expect(
      page.locator("[data-sonner-toast]", { hasText: SINGLE_RUN_INJECTIONS_IGNORED }),
    ).toBeVisible();
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-token", "idle");
    await openRunLog(page);
    await openStepDetail(page, target);
    await openDetailTab(page, "Input");
    await expect(page.getByTestId("unresolved-vars")).toContainText("tok");
    await snap("chn-bug-10-single-run");
  });

  test("[CHN-BUG-12] A Merge in any mode ends its in-flight lane skipped everywhere", async ({
    seededPage: page,
    snap,
  }) => {
    const slow = "qa-e2e-req-slow";
    await openChain(page, "qa-e2e-bug-merge-any-slow");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, slow, "skipped");
    await expectBarSummary(page, { text: /passed/i });
    await openRunLog(page);
    await expect(stepRow(page, slow)).toBeVisible();
    await expectRunSummary(page, { skipped: 1 });
    await expect(page.getByTestId("chain-aborted-count")).toHaveCount(0);
    await snap("chn-bug-12-merge-any");
  });
});
