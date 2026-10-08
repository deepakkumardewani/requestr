/**
 * Chain e2e specs: run log and results bar.
 * Source of truth: e2e/scenarios/chain/chain-run-log.feature.md
 * Seed data: e2e/fixtures/seed/chain-e2e.json, e2e/fixtures/seed/chain-polish.json
 */
import type { Page } from "@playwright/test";
import { installChainRoutes } from "../fixtures/chainRoutes";
import {
  collapseRunLog,
  expectNode,
  expectStepState,
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

const AUTO_OPEN_STORAGE_KEY = "rq_chain_run_log_auto_open";

const dock = (page: Page) => page.getByTestId("run-log-dock");
const strip = (page: Page) => page.getByTestId("run-log-strip");
const runCard = (page: Page, runId: string) =>
  page.locator(`[data-run-id="${runId}"]`);
const searchBox = (page: Page) => page.getByPlaceholder("Filter by node label");
const POLISH_RUN_LOG = "qa-polish-run-log";
const FILTERS = ["all", "passed", "failed", "skipped"] as const;

/** Selects a recorded run from the run list. */
async function selectRun(page: Page, runId: string) {
  await runCard(page, runId).locator("> button").click();
  await expect(runCard(page, runId)).toHaveAttribute("aria-selected", "true");
}

/** Opens a seeded chain's run log and selects one of its recorded runs. */
async function openSeededRun(page: Page, chainId: string, runId: string) {
  await openChain(page, chainId);
  await openRunLog(page);
  await selectRun(page, runId);
}

/** Deletes a recorded run through its card's options menu. */
async function deleteRunViaMenu(page: Page, runId: string) {
  await runCard(page, runId).hover();
  await runCard(page, runId)
    .getByRole("button", { name: "Run options" })
    .click();
  await page.getByRole("menuitem", { name: "Delete run" }).click();
  await expect(runCard(page, runId)).toHaveCount(0);
}

/** Opens the dock's options menu and picks "Clear all runs". */
async function clearAllRunsMenu(page: Page) {
  await dock(page).getByRole("button", { name: "Run Log options" }).click();
  await page.getByRole("menuitem", { name: "Clear all runs" }).click();
}

const MED_THREE = "qa-e2e-med-three-requests";
const MED_FIRST = "qa-e2e-req-single";
const MED_MIDDLE = "qa-e2e-req-token";
const MED_LAST = "qa-e2e-req-echo";

type SubsetRerun = {
  id: string;
  title: string;
  /** Context-menu action (or toolbar run) that produces the original run. */
  action: "run-up-to" | "run-from-here" | "toolbar-run";
  trigger: RegExp;
  stepIds: string[];
};

const SUBSET_RERUNS: SubsetRerun[] = [
  {
    id: "29a",
    title: 'Re-running an "up to" run keeps the same subset',
    action: "run-up-to",
    trigger: /Up to/,
    stepIds: [MED_FIRST, MED_MIDDLE],
  },
  {
    id: "29b",
    title: 'Re-running a "from here" run keeps the same subset',
    action: "run-from-here",
    trigger: /From/,
    stepIds: [MED_MIDDLE, MED_LAST],
  },
  {
    id: "29c",
    title: 'Re-running a "single" run keeps the same node',
    action: "toolbar-run",
    trigger: /Only/,
    stepIds: [MED_MIDDLE],
  },
];

const NARROW_VIEWPORT_PX = 559;
const RUN_CAP = 50;
const LARGE_LOOP_ITEMS = 60;
const DURATION_PATTERN = /\d+(\.\d+)?\s?(ms|s)\b/;

const TRIGGER_CARDS: {
  id: string;
  action: SubsetRerun["action"];
  trigger: RegExp;
  label: string;
}[] = [
  { id: "35b", action: "toolbar-run", trigger: /Only/, label: "single-node" },
  { id: "35c", action: "run-from-here", trigger: /From/, label: '"from here"' },
  { id: "35d", action: "run-up-to", trigger: /Up to/, label: '"up to"' },
];

/** Starts a subset run anchored on the middle node of the three-request chain. */
async function runSubset(
  page: Page,
  { action }: Pick<SubsetRerun, "action">,
) {
  const node = nodeBadge(page, MED_MIDDLE);
  if (action === "toolbar-run") {
    await node.hover();
    await page
      .locator(
        `.react-flow__node:has([data-testid="chain-node-${MED_MIDDLE}"]) [data-testid="node-toolbar-run"]`,
      )
      .click();
  } else {
    await node.click({ button: "right" });
    await page.getByTestId(`context-menu-${action}`).click();
  }
  await waitRunDone(page);
}

/** Re-runs a recorded run through its card's options menu. */
async function rerunFromCardMenu(page: Page, runId: string) {
  const card = runCard(page, runId);
  await card.hover();
  await card.getByRole("button", { name: "Run options" }).click();
  await page.getByRole("menuitem", { name: "Re-run same subset" }).click();
}

/** Resolves once the slow mock's response (or its cancelled request) has finished. */
function slowRequestSettled(page: Page) {
  return Promise.race([
    page.waitForResponse((r) => r.url().includes("/api/proxy")),
    page.waitForEvent("requestfailed", (r) => r.url().includes("/api/proxy")),
  ]);
}

/** The count a filter tab advertises, read from its "Label N" text. */
async function tabCount(page: Page, filter: (typeof FILTERS)[number]) {
  const text = await page.getByTestId(`run-filter-tab-${filter}`).innerText();
  return Number(text.match(/(\d+)\s*$/)?.[1]);
}

/** Keeps the dock collapsed while a run is in flight, so the bottom bar stays on screen. */
async function disableRunLogAutoOpen(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "false");
  }, AUTO_OPEN_STORAGE_KEY);
}

test.describe("Chain E2E — Run log and results bar @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-LOG-01] A never-run chain shows the idle empty state", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-polish-never-run");
    await expect(strip(page)).toContainText(/no runs yet/i);
    await expect(page.getByTestId("chain-history-label")).toContainText(
      "Not yet run",
    );
    await strip(page).click();
    await expect(page.getByTestId("run-log-empty-noRuns")).toBeVisible();
    await expect(page.getByTestId("run-log-header")).toContainText("0 runs");
    await expect(runCards(page)).toHaveCount(0);
    await snap("chn-log-01-idle");
  });

  test("[CHN-LOG-02] A running chain shows live progress", async ({
    seededPage: page,
    snap,
  }) => {
    await disableRunLogAutoOpen(page);
    await openChain(page, "qa-e2e-api-slow");
    await runChain(page);
    // Canvas: the node is running; the Run action is replaced by Stop.
    await expectNode(page, "qa-e2e-req-slow", "running");
    await expect(page.getByTestId("stop-chain-btn")).toBeVisible();
    await expect(page.getByTestId("run-chain-btn")).toHaveCount(0);
    await expect(page.getByTestId("chain-running-indicator")).toBeVisible();
    // Bar: collapsed, so it summarises the live run.
    await expect(strip(page)).toContainText("Running");
    await expect(strip(page).locator("svg.animate-spin")).toBeVisible();
    // Run log: the live card and the running step.
    await strip(page).click();
    await expect(runCards(page).first()).toContainText("Running");
    await expectStepState(page, "qa-e2e-req-slow", "running");
    await snap("chn-log-02-running");
    await stopChain(page);
    await waitRunDone(page);
  });

  test("[CHN-LOG-03] A passing run shows Passed everywhere", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await runAndOpenLog(page);
    await expectNode(page, "qa-e2e-req-single", "passed");
    await expectStepState(page, "qa-e2e-req-single", "passed");
    await expect(runCards(page).first()).toContainText("Passed");
    await expect(page.getByTestId("chain-passed-count")).toContainText(
      "1 passed",
    );
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
    await collapseRunLog(page);
    await expect(strip(page)).toContainText("Last run passed");
    await expect(strip(page)).toContainText("1 passed");
    await snap("chn-log-03-passed");
  });

  test("[CHN-LOG-04] A failing run shows Failed with its failed count", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-fail500");
    await runAndOpenLog(page);
    await expectNode(page, "qa-e2e-req-fail500", "failed");
    await expectStepState(page, "qa-e2e-req-fail500", "failed");
    await expect(runCards(page).first()).toContainText("Failed");
    await expect(page.getByTestId("chain-failed-count")).toContainText(
      "1 failed",
    );
    await expect(page.getByTestId("step-error-line")).toBeVisible();
    await collapseRunLog(page);
    await expect(strip(page)).toContainText("Last run failed");
    await expect(strip(page)).toContainText("1 failed");
    await snap("chn-log-04-failed");
  });

  test("[CHN-LOG-05] Skipped steps are styled and counted", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-bug-cond-ge");
    await runAndOpenLog(page);
    await expectNode(page, "qa-e2e-req-echo", "skipped");
    await expectStepState(page, "qa-e2e-req-echo", "skipped");
    await expect(page.getByTestId("run-filter-tab-skipped")).toContainText(
      "Skipped 1",
    );
    await expect(page.getByTestId("chain-skipped-count")).toContainText(
      "1 skipped",
    );
    await setFilter(page, "skipped");
    await expect(stepRow(page, "qa-e2e-req-echo")).toBeVisible();
    await expect(stepRow(page, "qa-e2e-req-single")).toHaveCount(0);
    await snap("chn-log-05-skipped");
  });

  test("[CHN-LOG-06] A stopped run shows aborted steps", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-long");
    await runChain(page);
    await expectNode(page, "qa-e2e-delay-block-long", "running");
    await stopChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expectNode(page, "qa-e2e-delay-block-long", "aborted");
    await expectStepState(page, "qa-e2e-delay-block-long", "aborted");
    await expect(runCards(page).first()).toContainText("Stopped");
    await setFilter(page, "failed");
    await expect(stepRow(page, "qa-e2e-delay-block-long")).toBeVisible();
    await collapseRunLog(page);
    await expect(strip(page)).toContainText("Last run stopped");
    await snap("chn-log-06-aborted");
  });

  test("[CHN-LOG-07] Filter tab counts match the rows they show", async ({
    seededPage: page,
    snap,
  }) => {
    await openSeededRun(page, POLISH_RUN_LOG, "qa-polish-rl-failed");
    // Seeded failed run: 1 passed, 2 failed, 0 skipped.
    await expect(page.getByTestId("run-filter-tab-skipped")).toHaveCount(0);
    for (const filter of ["all", "passed", "failed"] as const) {
      await setFilter(page, filter);
      const expected = await tabCount(page, filter);
      expect(expected).toBeGreaterThan(0);
      await expect(page.locator("[data-step-id]")).toHaveCount(expected);
    }
    expect(await tabCount(page, "all")).toBe(3);
    await snap("chn-log-07-tab-counts");
  });

  test("[CHN-LOG-08] Tabs with no rows are hidden", async ({
    seededPage: page,
  }) => {
    await openSeededRun(page, POLISH_RUN_LOG, "qa-polish-rl-passed");
    await expect(page.getByTestId("run-filter-tab-all")).toBeVisible();
    await expect(page.getByTestId("run-filter-tab-passed")).toBeVisible();
    await expect(page.getByTestId("run-filter-tab-failed")).toHaveCount(0);
    await expect(page.getByTestId("run-filter-tab-skipped")).toHaveCount(0);
  });

  test("[CHN-LOG-09] The active filter falls back to All when it empties", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-fail500");
    await runAndOpenLog(page);
    await setFilter(page, "failed");
    await expect(page.getByTestId("run-filter-tab-failed")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
    await expectStepState(page, "qa-e2e-req-fail500", "passed");
    await expect(runCards(page)).toHaveCount(2);
    await snap("chn-log-09-fallback-all");
  });

  test("[CHN-LOG-10] The filter follows the selected run", async ({
    seededPage: page,
    snap,
  }) => {
    await openSeededRun(page, POLISH_RUN_LOG, "qa-polish-rl-failed");
    await setFilter(page, "failed");
    await expect(page.locator("[data-step-id]")).toHaveCount(2);

    // A fully passed run has no Failed tab, so the view falls back to All.
    await selectRun(page, "qa-polish-rl-passed");
    await expect(page.getByTestId("run-filter-tab-failed")).toHaveCount(0);
    await expect(page.getByTestId("run-filter-tab-all")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-step-id]")).toHaveCount(3);

    // A stopped run folds its aborted steps into Failed.
    await selectRun(page, "qa-polish-rl-stopped");
    await expect(page.getByTestId("run-filter-tab-failed")).toContainText(
      "Failed 2",
    );
    await setFilter(page, "failed");
    await expect(page.locator("[data-step-id]")).toHaveCount(2);
    await expectStepState(page, "qa-polish-rl-stopped-s2", "aborted");
    await snap("chn-log-10-follows-run");
  });

  test("[CHN-LOG-11] Search finds steps by label", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cx-auth-pipeline");
    await runAndOpenLog(page);
    await expect(page.locator("[data-step-id]")).toHaveCount(7);
    const allBefore = await page.getByTestId("run-filter-tab-all").innerText();
    await searchBox(page).fill("Echo");
    await expect(page.locator("[data-step-id]")).toHaveCount(1);
    await expect(stepRow(page, "qa-e2e-req-echo")).toBeVisible();
    await expect(page.getByTestId("run-filter-tab-all")).toHaveText(allBefore);
    await snap("chn-log-11-search-label");
  });

  test("[CHN-LOG-12a] Search finds steps by error code", async ({
    seededPage: page,
  }) => {
    await openChain(page, "qa-e2e-cx-gauntlet");
    await runAndOpenLog(page);
    await searchBox(page).fill("HTTP_STATUS");
    await expect(stepRow(page, "qa-e2e-req-fail500")).toBeVisible();
    await expect(page.locator("[data-step-id]")).toHaveCount(1);
    await expect(stepRow(page, "qa-e2e-req-single")).toHaveCount(0);
  });

  test("[CHN-LOG-12b] Search finds steps by HTTP status", async ({
    seededPage: page,
  }) => {
    await openChain(page, "qa-e2e-cx-gauntlet");
    await runAndOpenLog(page);
    await searchBox(page).fill("500");
    await expect(stepRow(page, "qa-e2e-req-fail500")).toBeVisible();
    await expect(page.locator("[data-step-id]")).toHaveCount(1);
    await expect(stepRow(page, "qa-e2e-req-single")).toHaveCount(0);
  });

  test("[CHN-LOG-13] A search with no results shows a message and Escape clears it", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cx-auth-pipeline");
    await runAndOpenLog(page);
    await searchBox(page).fill("zzz-matches-nothing");
    await expect(page.locator("[data-step-id]")).toHaveCount(0);
    await expect(dock(page)).toContainText("No steps match this filter.");
    await snap("chn-log-13-no-results");
    await searchBox(page).press("Escape");
    await expect(searchBox(page)).toHaveValue("");
    await expect(page.locator("[data-step-id]")).toHaveCount(7);
  });

  test("[CHN-LOG-14] A step's Input tab shows what was sent", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    await runAndOpenLog(page);
    await openStepDetail(page, "qa-e2e-req-echo");
    await openDetailTab(page, "Input");
    const panel = page.locator("[data-slot='tabs-content']:not([inert])");
    await expect(panel).toContainText("https://example.com/api/echo");
    await expect(panel).toContainText("X-Token");
    await expect(panel).toContainText("secret-token-abc");
    await snap("chn-log-14-input");
  });

  test("[CHN-LOG-15] A step's Output tab shows JSON or raw text", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-text");
    await runAndOpenLog(page);
    await openStepDetail(page, "qa-e2e-req-text");
    await openDetailTab(page, "Output");
    await expect(
      page.locator("[data-slot='tabs-content']:not([inert])"),
    ).toContainText("plain text response");
    await snap("chn-log-15-output-raw");
  });

  test("[CHN-LOG-16] A step's Assertions tab shows passed and failed labels", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-assert-fail");
    await runAndOpenLog(page);
    await expectStepState(page, "qa-e2e-req-assert", "failed");
    await expect(page.getByTestId("step-error-line")).toContainText(
      "assertions failed",
    );
    await openStepDetail(page, "qa-e2e-req-assert");
    await openDetailTab(page, "Assertions");
    const panel = page.locator("[data-slot='tabs-content']:not([inert])");
    await expect(panel).toContainText("Status Code");
    await expect(panel.getByLabel("Fail")).toBeVisible();
    await expect(panel).toContainText("Expected");
    await expect(panel).toContainText("500");
    await expect(panel).toContainText("Actual");
    await expect(panel).toContainText("200");
    await snap("chn-log-16-assertions");
  });

  test("[CHN-LOG-17] A step's Extracted tab lists injected values", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    await runAndOpenLog(page);
    await openStepDetail(page, "qa-e2e-req-echo");
    await openDetailTab(page, "Extracted");
    const panel = page.locator("[data-slot='tabs-content']:not([inert])");
    await expect(panel).toContainText("secret-token-abc");
    await expect(panel).toContainText("$.data.token");
    await snap("chn-log-17-extracted");
  });

  test("[CHN-LOG-18] Loop iterations can be expanded and collapsed", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    await runAndOpenLog(page);
    const toggle = page.getByTestId("iteration-toggle-qa-e2e-loop-ok-loop-0");
    const topLevelRows = await page.locator("[data-step-id]").count();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const nested = toggle.locator(
      "xpath=following-sibling::div[1]//*[@data-step-id]",
    );
    await expect(nested.first()).toBeVisible();
    await expect(page.locator("[data-step-id]")).not.toHaveCount(topLevelRows);
    await nested.first().click();
    await expect(nested.first()).toHaveAttribute("aria-selected", "true");
    await snap("chn-log-18-iteration-expanded");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-step-id]")).toHaveCount(topLevelRows);
  });

  test("[CHN-LOG-19] Subchain steps can be expanded and collapsed", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-sub-parent-ok");
    await runAndOpenLog(page);
    const toggle = page.getByTestId("subchain-toggle-qa-e2e-sub-parent-ok-sub");
    const topLevelRows = await page.locator("[data-step-id]").count();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      toggle.locator("xpath=following-sibling::div[1]//*[@data-step-id]").first(),
    ).toBeVisible();
    await expect(page.locator("[data-step-id]")).not.toHaveCount(topLevelRows);
    await snap("chn-log-19-subchain-expanded");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-step-id]")).toHaveCount(topLevelRows);
  });

  test("[CHN-LOG-20] Unresolved variables are listed on the step and the node footer", async ({
    seededPage: page,
    snap,
  }) => {
    const condId = "qa-e2e-cond-eq-cond";
    await openChain(page, "qa-e2e-cond-eq");
    // Make the Condition's input absent: it now references a variable nothing defines.
    await openNodePanel(page, condId);
    await page.getByTestId("condition-config-variable").fill("{{missing}}");
    await page.getByTestId("condition-config-save-btn").click();
    await runAndOpenLog(page);
    await openStepDetail(page, condId);
    await openDetailTab(page, "Input");
    await expect(page.getByTestId("unresolved-vars")).toContainText(
      "{{missing}}",
    );
    const footer = nodeBadge(page, condId);
    await expect(
      footer.getByTestId("node-variables-footer-unresolved"),
    ).toBeVisible();
    await expect(
      footer.getByTestId("node-variables-footer-list"),
    ).toContainText("{{missing}}");
    await snap("chn-log-20-unresolved");
  });

  test("[CHN-LOG-21] A deleted run can be restored within the undo window", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    const before = await runCards(page).count();
    await deleteRunViaMenu(page, "qa-polish-rl-passed");
    await expect(runCards(page)).toHaveCount(before - 1);
    await expect(page.getByText("Run deleted")).toBeVisible();
    await page.locator("[data-sonner-toast]").getByText("Undo").click();
    await expect(runCard(page, "qa-polish-rl-passed")).toHaveCount(1);
    await expect(runCards(page)).toHaveCount(before);
    await snap("chn-log-21-restored");
  });

  test("[CHN-LOG-22] A deleted run stays deleted after reload", async ({
    seededPage: page,
  }) => {
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    const before = await runCards(page).count();
    await deleteRunViaMenu(page, "qa-polish-rl-passed");
    await expect(runCards(page)).toHaveCount(before - 1);
    await page.reload();
    await openRunLog(page);
    await expect(runCard(page, "qa-polish-rl-passed")).toHaveCount(0);
    await expect(runCards(page)).toHaveCount(before - 1);
  });

  test("[CHN-LOG-23a] Cancelling the clear-all confirmation keeps the runs", async ({
    seededPage: page,
  }) => {
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    const before = await runCards(page).count();
    await clearAllRunsMenu(page);
    const dialog = page.getByRole("alertdialog", { name: "Clear all runs?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(runCards(page)).toHaveCount(before);
  });

  test("[CHN-LOG-23b] Confirming clear-all removes every run and keeps the graph", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, POLISH_RUN_LOG);
    const nodeCount = await page.locator(".react-flow__node").count();
    await openRunLog(page);
    await deleteRunViaMenu(page, "qa-polish-rl-passed");
    await clearAllRunsMenu(page);
    await page
      .getByRole("alertdialog", { name: "Clear all runs?" })
      .getByRole("button", { name: "Clear all runs" })
      .click();
    await expect(page.getByTestId("run-log-empty-noRuns")).toBeVisible();
    await expect(runCards(page)).toHaveCount(0);
    await expect(page.locator(".react-flow__node")).toHaveCount(nodeCount);
    // The earlier pending deletion must not resurrect anything after reload.
    await page.reload();
    await openRunLog(page).catch(() => undefined);
    await expect(runCards(page)).toHaveCount(0);
    await snap("chn-log-23b-cleared");
  });

  test("[CHN-LOG-24] Clearing run results resets canvas badges but keeps history", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await runAndOpenLog(page);
    await expectNode(page, "qa-e2e-req-single", "passed");
    const before = await runCards(page).count();
    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-run-results-btn").click();
    await expect
      .poll(() => nodeBadge(page, "qa-e2e-req-single").getAttribute("class"))
      .not.toContain("emerald");
    await expect(runCards(page)).toHaveCount(before);
    await snap("chn-log-24-cleared-results");
  });

  test("[CHN-LOG-25] The Stop button cancels a running chain", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-slow");
    const settled = slowRequestSettled(page);
    await runChain(page);
    await expectNode(page, "qa-e2e-req-slow", "running");
    await stopChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-slow", "aborted");
    await openRunLog(page);
    await expect(runCards(page).first()).toContainText("Stopped");
    await expectStepState(page, "qa-e2e-req-slow", "aborted");
    // Let the in-flight slow response land, then confirm it changed nothing.
    await settled;
    await expectNode(page, "qa-e2e-req-slow", "aborted");
    await expectStepState(page, "qa-e2e-req-slow", "aborted");
    await expect(runCards(page).first()).toContainText("Stopped");
    await snap("chn-log-25-stopped");
  });

  test("[CHN-LOG-26] The cancel shortcut stops a running chain", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-slow");
    await runChain(page);
    await expectNode(page, "qa-e2e-req-slow", "running");
    // The shortcut only fires with the canvas focused.
    await page.locator(".react-flow__node").first().focus();
    await page.keyboard.press("ControlOrMeta+.");
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-slow", "aborted");
    await openRunLog(page);
    await expect(runCards(page).first()).toContainText("Stopped");
    await snap("chn-log-26-shortcut-stop");
  });

  test("[CHN-LOG-27] Running again right after cancelling works", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-slow");
    await runChain(page);
    await expectNode(page, "qa-e2e-req-slow", "running");
    await stopChain(page);
    await waitRunDone(page);
    await runChain(page);
    await expect(page.getByTestId("stop-chain-btn")).toBeVisible();
    await expectNode(page, "qa-e2e-req-slow", "running");
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(2);
    await expect(runCards(page).first()).toContainText("Running");
    await expect(runCards(page).nth(1)).toContainText("Stopped");
    await snap("chn-log-27-rerun-after-stop");
    await stopChain(page);
    await waitRunDone(page);
  });

  test("[CHN-LOG-28] A full re-run from the run card menu creates a new run", async ({
    seededPage: page,
    snap,
  }) => {
    // The seeded polish requests have no mock target; answer every one with 200.
    await page.route("/api/proxy", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true }),
        }),
      }),
    );
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    const before = await runCards(page).count();
    await rerunFromCardMenu(page, "qa-polish-rl-passed");
    await waitRunDone(page);
    await expect(runCards(page)).toHaveCount(before + 1);
    await expect(runCards(page).first()).toContainText("Full run");
    await snap("chn-log-28-full-rerun");
  });

  for (const scenario of SUBSET_RERUNS) {
    test(`[CHN-LOG-${scenario.id}] ${scenario.title}`, async ({
      seededPage: page,
      snap,
    }) => {
      await openChain(page, MED_THREE);
      await runSubset(page, scenario);
      await openRunLog(page);
      await expect(runCards(page)).toHaveCount(1);
      await expect(runCards(page).first()).toContainText(scenario.trigger);
      await expect(page.locator("[data-step-id]")).toHaveCount(
        scenario.stepIds.length,
      );
      const runId = await runCards(page).first().getAttribute("data-run-id");
      await rerunFromCardMenu(page, runId ?? "");
      await waitRunDone(page);
      await expect(runCards(page)).toHaveCount(2);
      const newest = runCards(page).first();
      await expect(newest).not.toHaveAttribute("data-run-id", runId ?? "");
      await expect(newest).toContainText(scenario.trigger);
      for (const id of scenario.stepIds) {
        await expect(stepRow(page, id)).toBeVisible();
      }
      await expect(page.locator("[data-step-id]")).toHaveCount(
        scenario.stepIds.length,
      );
      await snap(`chn-log-${scenario.id}-subset-rerun`);
    });
  }

  test("[CHN-LOG-30] Re-run is disabled when its anchor node was deleted", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    const card = runCard(page, "qa-polish-rl-deleted-anchor");
    await card.hover();
    await card.getByRole("button", { name: "Run options" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Re-run same subset" }),
    ).toBeDisabled();
    await snap("chn-log-30-rerun-disabled");
  });

  test("[CHN-LOG-31] The page header status follows each run state", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await expect(page.getByTestId("chain-history-label")).toContainText(
      "Not yet run",
    );
    await runAndOpenLog(page);
    const label = page.getByTestId("chain-history-label");
    await expect(label.getByTestId("chain-passed-count")).toContainText(
      "1 passed",
    );
    await expect(label.getByTestId("chain-passed-count")).toHaveClass(
      /text-emerald/,
    );
    await expect(label.getByTestId("chain-failed-count")).toHaveCount(0);
    await snap("chn-log-31-passed");

    await openChain(page, "qa-e2e-api-fail500");
    await runAndOpenLog(page);
    await expect(label.getByTestId("chain-failed-count")).toContainText(
      "1 failed",
    );
    await expect(label.getByTestId("chain-failed-count")).toHaveClass(
      /text-red/,
    );
    await expect(label.getByTestId("chain-passed-count")).toHaveCount(0);
    await snap("chn-log-31-failed");
  });

  test("[CHN-LOG-32] The run log tolerates a node deleted after the run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await runAndOpenLog(page);
    await expect(stepRow(page, "qa-e2e-req-single")).toBeVisible();
    await nodeBadge(page, "qa-e2e-req-single").click({ button: "right" });
    await page.getByTestId("context-menu-delete").click();
    await expect(nodeBadge(page, "qa-e2e-req-single")).toHaveCount(0);
    await expect(stepRow(page, "qa-e2e-req-single")).toContainText(
      "Node removed",
    );
    await expect(page.getByTestId("run-summary-header")).toBeVisible();
    await snap("chn-log-32-node-removed");
  });

  test("[CHN-LOG-33a] The collapsed state of the dock persists across reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await runAndOpenLog(page);
    await collapseRunLog(page);
    await page.reload();
    await waitCanvasReady(page);
    await expect(strip(page)).toBeVisible();
    await expect(strip(page)).toContainText(/passed/i);
    await expect(page.getByTestId("run-summary-header")).toHaveCount(0);
    await snap("chn-log-33a-collapsed-reload");
  });

  test("[CHN-LOG-33b] The dock height persists across reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await runAndOpenLog(page);
    const handle = page.getByRole("separator", { name: "Resize run log" });
    const initial = Number(await handle.getAttribute("aria-valuenow"));
    await handle.focus();
    await page.keyboard.press("Home");
    await expect(handle).not.toHaveAttribute("aria-valuenow", String(initial));
    const resized = await handle.getAttribute("aria-valuenow");
    await page.reload();
    await waitCanvasReady(page);
    await expect(
      page.getByRole("separator", { name: "Resize run log" }),
    ).toHaveAttribute("aria-valuenow", resized ?? "");
    await snap("chn-log-33b-height-reload");
  });

  test("[CHN-LOG-34] Switching runs from the run selector replaces the details", async ({
    seededPage: page,
    snap,
  }) => {
    await page.setViewportSize({ width: NARROW_VIEWPORT_PX, height: 900 });
    await openChain(page, POLISH_RUN_LOG);
    await openRunLog(page);
    const firstRow = page.locator("[data-step-id]").first();
    const staleStepId = await firstRow.getAttribute("data-step-id");
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-selected", "true");
    await page.getByRole("combobox", { name: "Run selection" }).click();
    await page.getByRole("option", { name: /^Only "/ }).first().click();
    await expect(stepRow(page, "qa-polish-rl-single-s1")).toBeVisible();
    await expect(page.locator("[data-step-id]")).toHaveCount(1);
    await expect(stepRow(page, staleStepId ?? "")).toHaveCount(0);
    // The newly selected run auto-selects its own step, never the old one.
    await expect(
      page.locator("[data-step-id][aria-selected='true']"),
    ).toHaveAttribute("data-step-id", "qa-polish-rl-single-s1");
    await snap("chn-log-34-run-switched");
  });

  test("[CHN-LOG-35a] A full run card shows its trigger and duration", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, MED_THREE);
    await runAndOpenLog(page);
    await expect(runCards(page)).toHaveCount(1);
    await expect(runCards(page).first()).toContainText("Full run");
    await expect(runCards(page).first()).toContainText(DURATION_PATTERN);
    await snap("chn-log-35a-full");
  });

  for (const { id, action, trigger, label } of TRIGGER_CARDS) {
    test(`[CHN-LOG-${id}] A ${label} run card shows its trigger`, async ({
      seededPage: page,
      snap,
    }) => {
      await openChain(page, MED_THREE);
      await runSubset(page, { action });
      await openRunLog(page);
      await expect(runCards(page)).toHaveCount(1);
      await expect(runCards(page).first()).toContainText(trigger);
      await snap(`chn-log-${id}-trigger`);
    });
  }

  test("[CHN-LOG-36] A run with over fifty rows stays searchable and scrollable", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-large");
    await runAndOpenLog(page);
    const toggles = page.locator('[data-testid^="iteration-toggle-"]');
    await expect(toggles).toHaveCount(LARGE_LOOP_ITEMS);
    const last = page.getByTestId(
      `iteration-toggle-qa-e2e-loop-large-loop-${LARGE_LOOP_ITEMS - 1}`,
    );
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await searchBox(page).fill("loop");
    await expect(toggles.first()).toBeVisible();
    await snap("chn-log-36-large-loop");
  });

  test("[CHN-LOG-37] Only the newest fifty runs are kept per chain", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single-cap");
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(RUN_CAP);
    await expect(runCard(page, "qa-e2e-cap-00")).toHaveCount(1);
    await runChain(page);
    await waitRunDone(page);
    await expect(runCard(page, "qa-e2e-cap-00")).toHaveCount(0);
    await expect(runCards(page)).toHaveCount(RUN_CAP);
    await expect(runCards(page).first()).not.toHaveAttribute(
      "data-run-id",
      /^qa-e2e-cap-/,
    );
    await expect(runCard(page, "qa-e2e-cap-49")).toHaveCount(1);
    await snap("chn-log-37-cap");
  });

  test("[CHN-LOG-38] Step detail values can be copied and Escape closes the pane", async ({
    seededPage: page,
    context,
    snap,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openChain(page, "qa-e2e-api-inject-hdr");
    await runAndOpenLog(page);
    await openStepDetail(page, "qa-e2e-req-echo");
    await openDetailTab(page, "Output");
    await page.getByRole("button", { name: "Copy response" }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("secret-token-abc");
    await snap("chn-log-38-copied");

    // Escape only reaches the listbox when a step row has focus, not the pane's own buttons.
    await stepRow(page, "qa-e2e-req-echo").click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tab", { name: "Output" })).toBeHidden();
  });

  test("[CHN-LOG-39] The failed-run summary links to the first failing step", async ({
    seededPage: page,
  }) => {
    await openChain(page, "qa-e2e-api-fail500");
    await runAndOpenLog(page);
    await page.getByTestId("run-summary-jump-to-failure").click();
    await expect(stepRow(page, "qa-e2e-req-fail500")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(stepRow(page, "qa-e2e-req-fail500")).toBeInViewport();
  });
});
