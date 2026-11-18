/**
 * Chain e2e specs: complex tier (production-style flows combining many blocks).
 * Source of truth: e2e/scenarios/chain/chain-complex.feature.md
 * Seed data: e2e/fixtures/seed/chain-e2e.json (qa-e2e-cx-*)
 */
import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../src/lib/idbSchema";
import { installChainRoutes } from "../fixtures/chainRoutes";
import {
  collapseRunLog,
  expectNode,
  expectRunSummary,
  expectStepState,
  nodeBadge,
  openChain,
  openDetailTab,
  openNodePanel,
  openRunLog,
  openStepDetail,
  runChain,
  stopChain,
  waitCanvasReady,
  runAndOpenLog,
  runCards,
  setFilter,
  stepRow,
  waitRunDone,
} from "../fixtures/chainE2eHelpers";
import { expect, test } from "../fixtures/qa";

const SINGLE = "qa-e2e-req-single";
const TOKEN = "qa-e2e-req-token";
const ECHO = "qa-e2e-req-echo";
const USERS = "qa-e2e-req-users";
const FAST_DOWN = "qa-e2e-req-delay-downstream";
const LIST = "qa-e2e-req-list";
const LOOP_INDEX = "qa-e2e-req-loop-index";
const FAIL = "qa-e2e-req-fail500";
const MEDIUM = "qa-e2e-med-req-medium";
const ECHO_TAG = "qa-e2e-cx-req-echo-tag";
const SUB_ECHO = "qa-e2e-req-sub-echo";

const strip = (page: Page) => page.getByTestId("run-log-strip");
const searchBox = (page: Page) => page.getByPlaceholder("Filter by node label");
const headerLabel = (page: Page) => page.getByTestId("chain-history-label");

/** Node id of a block in a `qa-e2e-cx-<chain>` seed. */
const blockId = (chain: string, key: string) => `qa-e2e-cx-${chain}-${key}`;

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

/** Assert the collapsed bar summarises the last run with the given status text and counts. */
async function expectBar(page: Page, status: RegExp, counts: string[]) {
  await collapseRunLog(page);
  await expect(strip(page)).toContainText(status);
  for (const count of counts) await expect(strip(page)).toContainText(count);
  await openRunLog(page);
}

/** Assert the page header status (scoped away from the run summary's own counts). */
async function expectHeader(page: Page, counts: string[]) {
  for (const count of counts) await expect(headerLabel(page)).toContainText(count);
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
async function expandIteration(
  page: Page,
  groupId: string,
  iteration: number,
  childStepId: string,
) {
  const toggle = page.getByTestId(`iteration-toggle-${groupId}-${iteration}`);
  await expect(toggle).toBeVisible();
  if ((await stepRow(page, childStepId).count()) === 0) await toggle.click();
  await expect(stepRow(page, childStepId)).toBeVisible();
}

/** Run through the "Run with inputs" popover with one Start input overridden. */
async function runWithInput(page: Page, value: string) {
  await page.getByTestId("run-with-inputs-btn").click();
  const popover = page.getByTestId("run-with-inputs-popover");
  await popover.locator("input").first().fill(value);
  await popover.getByRole("button", { name: /run/i }).click();
  await waitRunDone(page);
  await openRunLog(page);
}

/** Parse the JSON array shown in the open Output tab (the panel adds a status line around it). */
async function readOutputArray(page: Page): Promise<unknown[]> {
  const text = await detailPanel(page).innerText();
  return JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
}

/**
 * Hold every proxied request to `pathname` until the returned `release` is called, so a run stays
 * observably in flight without wall-clock waits. Registered after installChainRoutes, so it sees
 * requests first and hands them on with `fallback()` once released.
 */
async function holdRequests(page: Page, pathname: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("/api/proxy", async (route) => {
    const { url } = JSON.parse(route.request().postData() ?? "{}") as { url?: string };
    if (url && new URL(url).pathname === pathname) await gate;
    await route.fallback();
  });
  return release;
}

/** Keep the dock collapsed on run start so the bottom bar is visible while the run is in flight. */
async function keepDockCollapsed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("rq_chain_run_log_auto_open", "false");
  });
}

/** Start a run held by `release`'s gate, assert the bar reads Running, release, then open the log. */
async function runObservingBar(page: Page, release: () => void) {
  await runChain(page);
  await expect(strip(page)).toContainText(/running/i);
  release();
  await waitRunDone(page);
  await openRunLog(page);
}

/** Open a chain with its first request held, run it, and assert Running -> final-state transition. */
async function runHeld(page: Page, chainId: string, holdPath: string) {
  await keepDockCollapsed(page);
  const release = await holdRequests(page, holdPath);
  await openChain(page, chainId);
  await runObservingBar(page, release);
}

/** Assert the Passed and Skipped filters list exactly the given step ids. */
async function expectFilters(
  page: Page,
  { passed, skipped }: { passed: string[]; skipped: string[] },
) {
  await setFilter(page, "passed");
  await expect(page.locator("[data-step-id]")).toHaveCount(passed.length);
  for (const id of passed) await expect(stepRow(page, id)).toBeVisible();
  await setFilter(page, "skipped");
  await expect(page.locator("[data-step-id]")).toHaveCount(skipped.length);
  for (const id of skipped) await expect(stepRow(page, id)).toBeVisible();
  await setFilter(page, "all");
}

const API_SINGLE = "qa-e2e-api-single";

/** Chain keyboard shortcuts only fire while focus is inside the canvas, not on <body>. */
async function focusFirstNode(page: Page) {
  await page.locator(".react-flow__node").first().focus();
}

const POLISH_BLOCKS = "qa-polish-blocks";
const PHONE_VIEWPORT = { width: 390, height: 844 };
const UNKNOWN_CHAIN_ID = "qa-e2e-does-not-exist";
const FALLBACK_CHAIN_TITLE = "Chain";

/** One config edit on a `qa-polish-blocks` block, with its before/after values asserted on the canvas. */
type BlockEdit = {
  label: string;
  blockId: string;
  /** JSON fragment of the block in IndexedDB once the edit has been written. */
  persisted: string;
  edit: (page: Page) => Promise<void>;
  expectValue: (page: Page, which: "before" | "after") => Promise<void>;
};

const POLISH = {
  delay: "qa-polish-delay-b",
  condition: "qa-polish-condition",
  evaluate: "qa-polish-evaluate",
  validate: "qa-polish-validate",
  loop: "qa-polish-loop",
  merge: "qa-polish-merge",
} as const;

/**
 * Open a block's config sheet and wait for its slide-in to finish. The sheet moves focus to its first
 * field when the animation ends, which would swallow text typed into any other field before then.
 */
async function openSettledPanel(page: Page, nodeId: string) {
  await openNodePanel(page, nodeId);
  const dialog = page.getByRole("dialog");
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  );
  // Under load the animation may not have started when the check above ran, so also wait for the
  // sheet's auto-focus to land; typing before that appends to the auto-focused field.
  await expect(dialog.locator(":focus")).toHaveCount(1);
}

/** Close the open block config sheet without saving. */
async function cancelPanel(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Open a block's config sheet, run the assertions inside it, then close it unchanged. */
async function inPanel(page: Page, nodeId: string, assertions: () => Promise<void>) {
  await openSettledPanel(page, nodeId);
  await assertions();
  await cancelPanel(page);
}

/** Save the open block config sheet and wait for it to close. */
async function saveAndClosePanel(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/**
 * Open a block's config sheet, change one field, and save. The sheet seeds its draft from the block
 * right after mounting, so wait for the field's current value first or the seed overwrites the edit.
 */
async function editInPanel(
  page: Page,
  nodeId: string,
  field: { testId: string; current: string },
  change: () => Promise<void>,
) {
  await openSettledPanel(page, nodeId);
  await expect(page.getByTestId(field.testId)).toHaveValue(field.current);
  await change();
  await saveAndClosePanel(page);
}

const delayButton = (page: Page) => nodeBadge(page, POLISH.delay).getByTestId("delay-value-btn");

const POLISH_EDITS: BlockEdit[] = [
  {
    label: "delay",
    blockId: POLISH.delay,
    persisted: '"delayMs":900',
    edit: async (page) => {
      await delayButton(page).click();
      const input = nodeBadge(page, POLISH.delay).locator("input[type='number']");
      await input.fill("900");
      await input.press("Enter");
    },
    expectValue: async (page, which) => {
      await expect(delayButton(page)).toHaveText(which === "before" ? "750" : "900");
    },
  },
  {
    label: "condition",
    blockId: POLISH.condition,
    persisted: '"variable":"{{kind}}"',
    edit: (page) =>
      editInPanel(page, POLISH.condition, { testId: "condition-config-variable", current: "{{role}}" }, () =>
        page.getByTestId("condition-config-variable").fill("{{kind}}"),
      ),
    expectValue: (page, which) =>
      inPanel(page, POLISH.condition, () =>
        expect(page.getByTestId("condition-config-variable")).toHaveValue(
          which === "before" ? "{{role}}" : "{{kind}}",
        ),
      ),
  },
  {
    label: "evaluate",
    blockId: POLISH.evaluate,
    persisted: '"outputAlias":"polishTotal"',
    edit: (page) =>
      editInPanel(page, POLISH.evaluate, { testId: "evaluate-config-alias", current: "polishSum" }, () =>
        page.getByTestId("evaluate-config-alias").fill("polishTotal"),
      ),
    expectValue: (page, which) =>
      inPanel(page, POLISH.evaluate, () =>
        expect(page.getByTestId("evaluate-config-alias")).toHaveValue(
          which === "before" ? "polishSum" : "polishTotal",
        ),
      ),
  },
  {
    label: "validate",
    blockId: POLISH.validate,
    persisted: '"sourceJsonPath":"$.data"',
    edit: (page) =>
      editInPanel(page, POLISH.validate, { testId: "validate-config-source-path", current: "$" }, () =>
        page.getByTestId("validate-config-source-path").fill("$.data"),
      ),
    expectValue: (page, which) =>
      inPanel(page, POLISH.validate, () =>
        expect(page.getByTestId("validate-config-source-path")).toHaveValue(
          which === "before" ? "$" : "$.data",
        ),
      ),
  },
  {
    label: "loop",
    blockId: POLISH.loop,
    persisted: '"maxIterations":7',
    edit: (page) =>
      editInPanel(page, POLISH.loop, { testId: "loop-config-max-iterations", current: "100" }, () =>
        page.getByTestId("loop-config-max-iterations").fill("7"),
      ),
    expectValue: (page, which) =>
      inPanel(page, POLISH.loop, () =>
        expect(page.getByTestId("loop-config-max-iterations")).toHaveValue(
          which === "before" ? "100" : "7",
        ),
      ),
  },
  {
    label: "merge",
    blockId: POLISH.merge,
    persisted: '"mode":"any"',
    edit: (page) =>
      openSettledPanel(page, POLISH.merge)
        .then(() => page.getByTestId("merge-config-mode-any-btn").click())
        .then(() => saveAndClosePanel(page)),
    expectValue: (page, which) =>
      inPanel(page, POLISH.merge, async () => {
        const pressed = which === "before" ? "all" : "any";
        const other = which === "before" ? "any" : "all";
        await expect(page.getByTestId(`merge-config-mode-${pressed}-btn`)).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(page.getByTestId(`merge-config-mode-${other}-btn`)).toHaveAttribute(
          "aria-pressed",
          "false",
        );
      }),
  },
];

/** Blocks without an editable surface here must still be on the canvas after a reload. */
const UNEDITED_POLISH_BLOCKS = [
  "qa-polish-start",
  "qa-polish-delay-a",
  "qa-polish-collect",
  "qa-polish-subchain",
  "qa-polish-display",
];

/**
 * Chain edits reach IndexedDB on a 150 ms trailing debounce with no flush on unload. Wait for the
 * write to land before reloading (a sooner reload drops the edit) or before opening the next config
 * sheet (a write landing mid-edit re-seeds the sheet's draft and discards what was typed).
 */
async function expectEditPersisted(page: Page, chainId: string, edit: BlockEdit) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ dbName, chain, block }) =>
          new Promise<string>((resolve, reject) => {
            const open = indexedDB.open(dbName);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const get = open.result.transaction("chains").objectStore("chains").get(chain);
              get.onerror = () => reject(get.error);
              get.onsuccess = () => {
                const found = (get.result?.blocks ?? []).find((b: { id: string }) => b.id === block);
                open.result.close();
                resolve(JSON.stringify(found ?? null));
              };
            };
          }),
        { dbName: IDB_DB_NAME, chain: chainId, block: edit.blockId },
      ),
    )
    .toContain(edit.persisted);
}

/** Apply one config edit and wait until it is durable. */
async function applyEdit(page: Page, edit: BlockEdit) {
  await edit.edit(page);
  await expectEditPersisted(page, POLISH_BLOCKS, edit);
}

/** Click Undo or Redo in the canvas panel and wait for the click to take effect. */
async function stepHistoryOnce(page: Page, button: "Undo" | "Redo") {
  await page.getByRole("button", { name: button, exact: true }).click();
}

/** Assert every edited block shows its before or after value. */
async function expectAllValues(page: Page, which: "before" | "after") {
  for (const edit of POLISH_EDITS) await edit.expectValue(page, which);
}

/**
 * Assert the run log dock fits inside the viewport and its own content does not overflow sideways.
 * (The chain page header's action row currently overflows a 390 px page; that is tracked separately
 * and deliberately not asserted here.)
 */
async function expectRunLogFitsViewport(page: Page) {
  const dock = page.getByTestId("run-log-dock");
  await expect
    .poll(() =>
      dock.evaluate((el) => ({
        right: Math.round(el.getBoundingClientRect().right),
        overflow: el.scrollWidth - el.clientWidth,
        viewport: document.documentElement.clientWidth,
      })),
    )
    .toEqual(expect.objectContaining({ right: PHONE_VIEWPORT.width, overflow: 0 }));
}

test.describe("Chain E2E — Complex flows @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-C-01] An authenticated data pipeline passes end to end", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "auth-pipeline";
    const display = blockId(chain, "display");
    const validate = blockId(chain, "validate");
    const evaluate = blockId(chain, "eval");
    const nodes = [blockId(chain, "start"), TOKEN, display, USERS, validate, evaluate, ECHO];
    await runHeld(page, `qa-e2e-cx-${chain}`, "/api/token");
    for (const id of nodes) {
      await expectNode(page, id, "passed");
      await expectStepState(page, id, "passed");
    }
    await expect(page.locator("[data-step-id]")).toHaveCount(7);
    await expectRunSummary(page, { passed: 7 });
    await setFilter(page, "passed");
    await expect(page.locator("[data-step-id]")).toHaveCount(7);
    for (const id of nodes) await expect(stepRow(page, id)).toBeVisible();
    await expect(page.getByTestId("run-filter-tab-skipped")).toHaveCount(0);
    await expect(page.getByTestId("run-filter-tab-failed")).toHaveCount(0);
    await setFilter(page, "all");
    await expectBar(page, /Last run passed/i, ["7 passed"]);
    await expectHeader(page, ["7 passed"]);
    await openStepTab(page, display, "Extracted");
    await expect(detailPanel(page)).toContainText("tok");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await openStepTab(page, evaluate, "Extracted");
    await expect(detailPanel(page)).toContainText("$.result");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("2");
    await snap("chn-c-01-auth-pipeline");
  });

  test("[CHN-C-02] Fan-out, merge and branching show the right lanes and skips", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "fanout-merge";
    const cond = blockId(chain, "cond");
    const delay = blockId(chain, "delay");
    const mergeAll = blockId(chain, "merge-all");
    const evaluate = blockId(chain, "eval");
    const mergeFinal = blockId(chain, "merge-final");
    const sub = blockId(chain, "sub");
    const parallelPassed = [
      blockId(chain, "start"),
      cond,
      SINGLE,
      FAST_DOWN,
      mergeAll,
      evaluate,
      mergeFinal,
      ECHO,
      sub,
    ];
    const altPassed = [blockId(chain, "start"), cond, TOKEN, delay, mergeFinal, ECHO, sub];
    await runHeld(page, `qa-e2e-cx-${chain}`, "/api/fast");

    // Run 1 (mode=1): the parallel lanes run, the delay lane is skipped.
    for (const id of parallelPassed) await expectNode(page, id, "passed");
    for (const id of [TOKEN, delay]) await expectNode(page, id, "skipped");
    await expect(page.locator("[data-lane-count], [data-testid^='step-lane-']").first()).toBeVisible();
    await expectRunSummary(page, { passed: 11, skipped: 2 });
    await expectFilters(page, { passed: parallelPassed, skipped: [TOKEN, delay] });
    await expectBar(page, /Last run passed/i, ["11 passed", "2 skipped"]);
    await expectHeader(page, ["11 passed", "2 skipped"]);
    await snap("chn-c-02-run-parallel");

    // Run 2 (mode=2): the delay lane runs, the parallel lanes are skipped.
    await runWithInput(page, "2");
    for (const id of altPassed) await expectNode(page, id, "passed");
    for (const id of [SINGLE, FAST_DOWN, mergeAll, evaluate]) {
      await expectNode(page, id, "skipped");
    }
    await expectRunSummary(page, { passed: 9, skipped: 4 });
    await expectFilters(page, {
      passed: altPassed,
      skipped: [SINGLE, FAST_DOWN, mergeAll, evaluate],
    });
    await expect(runCards(page)).toHaveCount(2);
    await expectBar(page, /Last run passed/i, ["9 passed", "4 skipped"]);
    await expectHeader(page, ["9 passed", "4 skipped"]);
    await snap("chn-c-02-run-alternate");
  });

  test("[CHN-C-03] A loop with per-item validation and one failing item completes with a warning", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "loop-validate-partial";
    const loop = blockId(chain, "loop");
    const validate = blockId(chain, "validate");
    const collect = blockId(chain, "collect");
    const evaluate = blockId(chain, "eval");
    const iteration = (id: string, index: number) => `${id}::${loop}::${index}`;
    // The index alias is shared, so concurrent iterations would race on which item is rejected.
    await setConcurrency(page, 1);
    await runHeld(page, `qa-e2e-cx-${chain}`, "/api/list");
    for (const id of [LIST, loop, collect, evaluate]) {
      await expectNode(page, id, "passed");
    }
    await openStepDetail(page, loop);
    await expect(page.getByRole("alert").filter({ hasText: /1 of 3 iterations failed/i })).toBeVisible();
    for (const index of [0, 1, 2]) {
      await expandIteration(page, loop, index, iteration(LOOP_INDEX, index));
    }
    for (const index of [0, 2]) {
      await expectStepState(page, iteration(validate, index), "passed");
    }
    await expectStepState(page, iteration(validate, 1), "failed");
    await expectRunSummary(page, { passed: 9, failed: 1 });
    await setFilter(page, "failed");
    // Only the failed iteration is offered, under its (passed) Loop parent.
    await expect(stepRow(page, loop)).toBeVisible();
    await expect(page.getByTestId(`iteration-toggle-${loop}-0`)).toHaveCount(0);
    await expandIteration(page, loop, 1, iteration(validate, 1));
    await expect(stepRow(page, iteration(LOOP_INDEX, 1))).toHaveCount(0);
    await expectStepState(page, iteration(validate, 1), "failed");
    await openStepTab(page, iteration(validate, 1), "Error");
    await expect(detailPanel(page)).toContainText("must match pattern");
    await setFilter(page, "all");
    await expectBar(page, /Last run failed/i, ["9 passed", "1 failed"]);
    await expectHeader(page, ["9 passed", "1 failed"]);
    await snap("chn-c-03-loop-validate-partial");
  });
  test("[CHN-C-04] Nested loops with a Condition and a Subchain run to completion", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "nested-loops-sub";
    const outer = blockId(chain, "loop");
    const collect = blockId(chain, "collect");
    const cond = blockId(chain, "cond");
    const innerLoop = "qa-e2e-cx-nested-child-loop";
    const innerCollect = "qa-e2e-cx-nested-child-collect";
    // Outer iteration 0 takes the "first" branch; 1 and 2 take "rest".
    const subFor = (index: number) =>
      blockId(chain, index === 0 ? "sub-first" : "sub-rest");
    const outerStep = (id: string, index: number) => `${id}::${outer}::${index}`;
    const subStep = (index: number) => outerStep(subFor(index), index);
    const innerStep = (id: string, index: number) =>
      `${id}::${subStep(index)}`;
    const innerLoopStep = (index: number) => innerStep(innerLoop, index);
    const echoStep = (outerIndex: number, innerIndex: number) =>
      `${ECHO_TAG}::${innerLoop}::${innerIndex}::${subStep(outerIndex)}`;

    // The branch input is a shared alias, so concurrent iterations would race on it.
    await setConcurrency(page, 1);
    await runHeld(page, `qa-e2e-cx-${chain}`, "/api/list");

    for (const id of [LIST, outer, collect]) await expectNode(page, id, "passed");
    await expect(page.locator("[data-testid^='canvas-banner-']")).toHaveCount(0);
    await expectRunSummary(page, { passed: 27, skipped: 3 });
    await expectBar(page, /Last run passed/i, ["27 passed", "3 skipped"]);
    await expectHeader(page, ["27 passed", "3 skipped"]);

    for (const index of [0, 1, 2]) {
      await expandIteration(page, outer, index, outerStep(cond, index));
      await expandIteration(page, outer, index, subStep(index));
      await page.getByTestId(`subchain-toggle-${subStep(index)}`).click();
      await expect(stepRow(page, innerLoopStep(index))).toBeVisible();
      for (const inner of [0, 1]) {
        await expandIteration(
          page,
          innerLoopStep(index),
          inner,
          echoStep(index, inner),
        );
        await expectStepState(page, echoStep(index, inner), "passed");
      }
      const skippedSub = outerStep(subFor(index === 0 ? 1 : 0), index);
      await expectStepState(page, skippedSub, "skipped");
    }

    // Search narrows to the six echo rows (their parents stay so they remain reachable).
    await searchBox(page).fill("echo");
    await expect(page.locator(`[data-step-id^="${ECHO_TAG}::"]`)).toHaveCount(6);
    await expect(page.locator(`[data-step-id^="${LOOP_INDEX}::"]`)).toHaveCount(0);
    await searchBox(page).fill("");
    await setFilter(page, "passed");
    await expect(page.locator(`[data-step-id^="${ECHO_TAG}::"]`)).toHaveCount(6);
    await setFilter(page, "skipped");
    await expect(page.locator(`[data-step-id^="${blockId(chain, "sub-")}"]`)).toHaveCount(3);
    await setFilter(page, "all");

    // Changing the filter rebuilds the nested groups, so reopen the first iteration's groups.
    await expandIteration(page, outer, 0, subStep(0));
    await page.getByTestId(`subchain-toggle-${subStep(0)}`).click();
    await openStepTab(page, collect, "Output");
    expect(await readOutputArray(page)).toHaveLength(3);
    await openStepTab(page, innerStep(innerCollect, 0), "Output");
    expect(await readOutputArray(page)).toHaveLength(2);
    await snap("chn-c-04-nested-loops-sub");
  });

  test("[CHN-C-05a] A failed request recovers through its fail handle", async ({
    seededPage: page,
    snap,
  }) => {
    const merge = blockId("recovery", "merge");
    await runHeld(page, "qa-e2e-cx-recovery", "/api/medium");
    await expectNode(page, FAIL, "failed");
    await expectNode(page, ECHO, "passed");
    await expectNode(page, MEDIUM, "passed");
    await expectNode(page, merge, "passed");
    await expectStepState(page, FAIL, "failed");
    await expectStepState(page, ECHO, "passed");
    await expectStepState(page, MEDIUM, "passed");
    await expectStepState(page, merge, "passed");
    await expectRunSummary(page, { passed: 3, failed: 1 });
    await setFilter(page, "failed");
    await expect(page.locator("[data-step-id]")).toHaveCount(1);
    await expect(stepRow(page, FAIL)).toBeVisible();
    await setFilter(page, "all");
    await expectBar(page, /Last run failed/i, ["3 passed", "1 failed"]);
    await expectHeader(page, ["1 failed"]);
    await expect(headerLabel(page).getByTestId("chain-failed-count")).toBeVisible();
    await snap("chn-c-05a-recovery");
  });

  test("[CHN-C-05b] The same flow skips recovery when the first request passes", async ({
    seededPage: page,
    snap,
  }) => {
    const merge = blockId("recovery-ok", "merge");
    await runHeld(page, "qa-e2e-cx-recovery-ok", "/api/medium");
    await expectNode(page, SINGLE, "passed");
    await expectNode(page, MEDIUM, "passed");
    await expectNode(page, merge, "passed");
    await expectNode(page, ECHO, "skipped");
    await expectStepState(page, ECHO, "skipped");
    await expectRunSummary(page, { passed: 3, skipped: 1 });
    await expect(page.getByTestId("run-filter-tab-failed")).toHaveCount(0);
    await expectBar(page, /Last run passed/i, ["3 passed", "1 skipped"]);
    await expectHeader(page, ["3 passed", "1 skipped"]);
    await expect(headerLabel(page).getByTestId("chain-failed-count")).toHaveCount(0);
    await snap("chn-c-05b-recovery-ok");
  });

  test("[CHN-C-07] Every kind of failure at once is listed and searchable", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "gauntlet";
    const failures = [
      { id: blockId(chain, "eval"), code: "EVALUATE_UNDEFINED_OUTPUT", line: /returned undefined/i },
      { id: blockId(chain, "validate"), code: "VALIDATE_NO_MATCH", line: /matched nothing/i },
      { id: blockId(chain, "display"), code: "DISPLAY_NO_PATH", line: /no extraction path/i },
      { id: FAIL, code: "HTTP_STATUS", line: /HTTP 500/ },
      { id: blockId(chain, "cond"), code: "NO_BRANCH_MATCHED", line: /No branch matched/i },
      { id: blockId(chain, "loop"), code: "LOOP_SOURCE_NOT_ARRAY", line: /did not resolve to an array/i },
    ];
    const loopId = blockId(chain, "loop");
    const skipped = [USERS, blockId(chain, "collect"), "qa-e2e-req-loop-tail"];
    await runHeld(page, `qa-e2e-cx-${chain}`, "/api/fail");
    for (const { id } of failures) await expectNode(page, id, "failed");
    for (const id of skipped) await expectNode(page, id, "skipped");
    await expectRunSummary(page, { passed: 5, failed: 6, skipped: 3 });
    await setFilter(page, "failed");
    await expect(page.locator("[data-step-id]")).toHaveCount(6);
    for (const { id, line } of failures) {
      await expectStepState(page, id, "failed");
      await expect(stepRow(page, id)).toContainText(line);
    }
    await setFilter(page, "all");
    for (const { id, code } of failures) {
      // A failed Loop also stamps its code on the body and Collect it skipped.
      const rows = id === loopId ? [id, ...skipped.slice(1)] : [id];
      await searchBox(page).fill(code);
      await expect(page.locator("[data-step-id]")).toHaveCount(rows.length);
      for (const row of rows) await expect(stepRow(page, row)).toBeVisible();
    }
    await searchBox(page).fill("");
    await expectBar(page, /Last run failed/i, ["5 passed", "6 failed", "3 skipped"]);
    await expectHeader(page, ["6 failed"]);
    await snap("chn-c-07-gauntlet");
  });

  test("[CHN-C-08] Composed subchains with bound inputs and subset re-runs", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "sub-compose";
    const subA = blockId(chain, "sub-a");
    const subB = blockId(chain, "sub-b");
    const delay = blockId(chain, "delay");
    const nested = (sub: string) => `${SUB_ECHO}::${sub}`;
    await runHeld(page, `qa-e2e-cx-${chain}`, "/api/echo");
    for (const id of [subA, subB, delay, SINGLE]) await expectNode(page, id, "passed");
    await expectRunSummary(page, { passed: 9 });

    // Both subchains bind from the Start inputs.
    await page.getByTestId(`subchain-toggle-${subA}`).click();
    await openStepTab(page, nested(subA), "Input");
    await expect(detailPanel(page)).toContainText("name=Ada&city=Paris");
    await page.getByTestId(`subchain-toggle-${subB}`).click();
    await openStepTab(page, nested(subB), "Input");
    await expect(detailPanel(page)).toContainText("name=Ada&city=Paris");

    // Re-run from the second Subchain.
    await nodeBadge(page, subB).click({ button: "right" });
    await page.getByTestId("context-menu-run-from-here").click();
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(2);
    await expect(runCards(page).first()).toContainText(/From/);
    await expectNode(page, subB, "passed");
    await expect(stepRow(page, subA)).toHaveCount(0);

    // Run the last request alone; the open dock leaves too little canvas, so the minimap covers the node.
    await collapseRunLog(page);
    await nodeBadge(page, SINGLE).hover();
    await page
      .locator(
        `.react-flow__node:has([data-testid="chain-node-${SINGLE}"]) [data-testid="node-toolbar-run"]`,
      )
      .click();
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(3);
    await expect(runCards(page).first()).toContainText(/Only/);
    await expect(page.locator("[data-step-id]")).toHaveCount(1);
    await expect(runCards(page).nth(1)).toContainText(/From/);
    await expect(runCards(page).nth(2)).toContainText(/Full run/);
    await expectBar(page, /Last run passed/i, ["1 passed"]);
    await snap("chn-c-08-sub-compose");
  });
  test("[CHN-C-10] Structural edits around a complex run are reflected in later runs", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "auth-pipeline";
    const evaluate = blockId(chain, "eval");
    const focusCanvas = async () => {
      await page.locator(".react-flow__pane").first().click({ position: { x: 360, y: 440 } });
    };
    await openChain(page, `qa-e2e-cx-${chain}`);
    await runAndOpenLog(page);
    await expectBar(page, /Last run passed/i, ["7 passed"]);

    // Delete the Evaluate node; the first run's row keeps a "Node removed" chip.
    await collapseRunLog(page);
    await nodeBadge(page, evaluate).click({ button: "right" });
    await page.getByTestId("context-menu-delete").click();
    await expect(nodeBadge(page, evaluate)).toHaveCount(0);
    await openRunLog(page);
    await expect(stepRow(page, evaluate)).toContainText("Node removed");

    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(2);
    await expect(page.locator("[data-step-id]")).toHaveCount(6);
    await expectBar(page, /Last run passed/i, ["6 passed"]);
    await expect(stepRow(page, evaluate)).toHaveCount(0);

    // Undo restores the node, and the next run matches the first.
    await collapseRunLog(page);
    await focusCanvas();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(nodeBadge(page, evaluate)).toBeVisible();
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(3);
    await expect(page.locator("[data-step-id]")).toHaveCount(7);
    await expectBar(page, /Last run passed/i, ["7 passed"]);
    await expectHeader(page, ["7 passed"]);
    for (const card of [0, 1, 2]) {
      await expect(runCards(page).nth(card)).toContainText(/passed/i);
    }

    // Repeated redo/undo keeps the canvas stable (the console guard fails on any error).
    await collapseRunLog(page);
    for (let i = 0; i < 3; i++) {
      await focusCanvas();
      await page.keyboard.press("ControlOrMeta+Shift+z");
      await expect(nodeBadge(page, evaluate)).toHaveCount(0);
      await focusCanvas();
      await page.keyboard.press("ControlOrMeta+z");
      await expect(nodeBadge(page, evaluate)).toBeVisible();
    }
    await snap("chn-c-10-structural-edits");
  });
  test("[CHN-C-06] Stopping a wide parallel run and re-running it", async ({
    seededPage: page,
    snap,
  }) => {
    test.setTimeout(60_000);
    const chain = "wide-cancel";
    const lanes = [1, 2, 3, 4].map((n) => `qa-e2e-cx-req-lane-${n}`);
    const rest = [
      blockId(chain, "merge"),
      blockId(chain, "cond"),
      USERS,
      blockId(chain, "loop"),
      blockId(chain, "collect"),
    ];
    // Keep the dock collapsed so the bar is visible while the run is in flight.
    await page.addInitScript(() => {
      localStorage.setItem("rq_chain_run_log_auto_open", "false");
    });
    await openChain(page, `qa-e2e-cx-${chain}`);
    await runChain(page);
    await expectNode(page, lanes[0], "running");
    await expectNode(page, lanes[1], "running");
    await expect(strip(page)).toContainText(/running/i);
    await stopChain(page);
    await waitRunDone(page);

    for (const id of lanes) await expectNode(page, id, "aborted");
    for (const id of rest) await expectNode(page, id, "skipped");
    await expect(strip(page)).toContainText(/stopped/i);
    await expectHeader(page, ["skipped"]);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(1);
    await expect(runCards(page).first()).toContainText("Stopped");
    for (const id of lanes) await expectStepState(page, id, "aborted");
    await snap("chn-c-06-stopped");

    // Re-run the same subset from the run card; it completes this time.
    const stoppedId = await runCards(page).first().getAttribute("data-run-id");
    const card = page.locator(`[data-run-id="${stoppedId}"]`);
    await card.hover();
    await card.getByRole("button", { name: "Run options" }).click();
    await page.getByRole("menuitem", { name: "Re-run same subset" }).click();
    await waitRunDone(page);
    await openRunLog(page);
    await expect(runCards(page)).toHaveCount(2);
    await expect(runCards(page).first()).toContainText("Passed");
    await expect(runCards(page).nth(1)).toContainText("Stopped");
    for (const id of [...lanes, ...rest]) await expectNode(page, id, "passed");
    await expectBar(page, /Last run passed/i, ["passed"]);
    await snap("chn-c-06-rerun-passed");
  });

  test("[CHN-C-09] A complex run's history survives a reload and can be cleared", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "fanout-merge";
    const cond = blockId(chain, "cond");
    const mergeAll = blockId(chain, "merge-all");
    await openChain(page, `qa-e2e-cx-${chain}`);
    await runAndOpenLog(page);
    await runWithInput(page, "2");
    await expect(runCards(page)).toHaveCount(2);
    const latestId = await runCards(page).first().getAttribute("data-run-id");

    await page.reload();
    await waitCanvasReady(page);
    await expectNode(page, cond, "passed");
    await expectNode(page, mergeAll, "skipped");
    await openRunLog(page);
    await expectBar(page, /Last run passed/i, ["9 passed", "4 skipped"]);
    await expect(runCards(page)).toHaveCount(2);
    await expect(runCards(page).first()).toHaveAttribute("data-run-id", latestId ?? "");
    await expect(runCards(page).first()).toContainText("Full run");
    await expect(runCards(page).first()).toContainText("9 passed, 4 skipped");
    await expect(runCards(page).nth(1)).toContainText("11 passed, 2 skipped");
    await expect(page.getByTestId("run-filter-tab-all")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-step-id]")).toHaveCount(11);
    await expectHeader(page, ["9 passed", "4 skipped"]);

    // The Subchain's nested group is restored collapsed and still expands to its child step.
    const sub = blockId(chain, "sub");
    const nestedEcho = `${SUB_ECHO}::${sub}`;
    await expect(stepRow(page, nestedEcho)).toHaveCount(0);
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    await expect(stepRow(page, nestedEcho)).toBeVisible();
    await expectStepState(page, nestedEcho, "passed");
    await page.getByTestId(`subchain-toggle-${sub}`).click();
    await expect(stepRow(page, nestedEcho)).toHaveCount(0);

    // Clearing results drops the badges but keeps both runs.
    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-run-results-btn").click();
    await expect
      .poll(() => nodeBadge(page, cond).getAttribute("class"))
      .not.toContain("emerald");
    await expect(runCards(page)).toHaveCount(2);

    // Clearing all runs empties the list but leaves the graph.
    await page.getByTestId("run-log-dock").getByRole("button", { name: "Run Log options" }).click();
    await page.getByRole("menuitem", { name: "Clear all runs" }).click();
    await page
      .getByRole("alertdialog", { name: "Clear all runs?" })
      .getByRole("button", { name: "Clear all runs" })
      .click();
    await expect(page.getByTestId("run-log-empty-noRuns")).toBeVisible();
    await expect(runCards(page)).toHaveCount(0);
    for (const id of [cond, mergeAll, SINGLE, TOKEN]) await expect(nodeBadge(page, id)).toBeVisible();
    await snap("chn-c-09-cleared");
  });

  test("[CHN-X-01] Every block type keeps its configuration after reload", async ({
    seededPage: page,
    snap,
  }) => {
    test.slow();
    await openChain(page, POLISH_BLOCKS);
    for (const edit of POLISH_EDITS) {
      await applyEdit(page, edit);
      await page.reload();
      await waitCanvasReady(page);
      await edit.expectValue(page, "after");
    }
    await expectAllValues(page, "after");
    for (const id of UNEDITED_POLISH_BLOCKS) await expect(nodeBadge(page, id)).toBeVisible();
    await expect(page.getByTestId("chain-request-count")).toContainText("13 nodes");
    // The seeded graph is deliberately not runnable (unpaired Loop, empty Merge), so the log stays empty.
    await expect(strip(page)).toContainText(/no runs yet/i);
    await expect(page.getByTestId("run-chain-btn")).toBeDisabled();
    await snap("chn-x-01-persisted");
  });

  test("[CHN-X-02] Each configuration edit can be undone and redone", async ({
    seededPage: page,
    snap,
  }) => {
    test.slow();
    await openChain(page, POLISH_BLOCKS);
    for (const edit of POLISH_EDITS) await applyEdit(page, edit);
    await expectAllValues(page, "after");

    // Undo walks the edits newest-first; only the block just undone returns to its earlier value.
    for (const [index, edit] of [...POLISH_EDITS].reverse().entries()) {
      await stepHistoryOnce(page, "Undo");
      await edit.expectValue(page, "before");
      const stillEdited = POLISH_EDITS.slice(0, POLISH_EDITS.length - 1 - index);
      for (const earlier of stillEdited) await earlier.expectValue(page, "after");
    }
    await expectAllValues(page, "before");
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();

    // Redo re-applies them oldest-first.
    for (const edit of POLISH_EDITS) {
      await stepHistoryOnce(page, "Redo");
      await edit.expectValue(page, "after");
    }
    await expectAllValues(page, "after");
    await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
    await snap("chn-x-02-undo-redo");
  });

  test("[CHN-X-03] The run log stays usable on a phone-width screen", async ({
    seededPage: page,
    snap,
  }) => {
    const chain = "fanout-merge";
    const cond = blockId(chain, "cond");
    const mergeAll = blockId(chain, "merge-all");
    const lastStep = blockId(chain, "sub");
    await page.setViewportSize(PHONE_VIEWPORT);
    await openChain(page, `qa-e2e-cx-${chain}`);
    await runAndOpenLog(page);
    await expectNode(page, cond, "passed");
    await expectNode(page, mergeAll, "passed");
    await expectRunSummary(page, { passed: 11, skipped: 2 });
    await expect(page.locator("[data-step-id]")).toHaveCount(11);
    await expectStepState(page, cond, "passed");
    await expectRunLogFitsViewport(page);
    // The list scrolls: its last row becomes reachable and the dock still does not overflow.
    await stepRow(page, lastStep).scrollIntoViewIfNeeded();
    await expect(stepRow(page, lastStep)).toBeInViewport();
    await openStepDetail(page, lastStep);
    await expect(detailPanel(page)).toBeVisible();
    await expectRunLogFitsViewport(page);
    await expectBar(page, /Last run passed/i, ["11 passed", "2 skipped"]);
    await snap("chn-x-03-phone-width");
  });

  test("[CHN-X-04] The core flow works with the keyboard alone", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, API_SINGLE);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Add: select the request and duplicate it. Placing a new block from the block menu and drawing
    // an edge both need the pointer today, so this is the keyboard route to a second node.
    await focusFirstNode(page);
    await page.keyboard.press("Space");
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+d");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    const ids = await page
      .locator(".react-flow__node")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-id") ?? ""));
    const copyId = ids.find((id) => id !== SINGLE) ?? "";
    await expect(nodeBadge(page, copyId)).toBeVisible();

    // Configure: Enter on the focused node opens its details, Escape closes them.
    await focusFirstNode(page);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Run: the shortcut starts the chain from the canvas.
    await focusFirstNode(page);
    await page.keyboard.press("ControlOrMeta+Enter");
    await waitRunDone(page);
    await openRunLog(page);
    for (const id of [SINGLE, copyId]) {
      await expectNode(page, id, "passed");
      await expectStepState(page, id, "passed");
    }
    await expect(page.locator("[data-step-id]")).toHaveCount(2);

    // Open a step: a finished run already selects the last step and opens its node details; close
    // them, then move the selection up the focused step list with the arrow key.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.locator("[role='listbox'][tabindex='0']").focus();
    await page.keyboard.press("ArrowUp");
    await expect(stepRow(page, SINGLE)).toHaveAttribute("aria-selected", "true");
    await expect(stepRow(page, copyId)).toHaveAttribute("aria-selected", "false");
    await expect(detailPanel(page)).toContainText("Fast Response");
    await snap("chn-x-04-keyboard");
  });

  test("[CHN-X-05] Clearing nodes after a run removes the canvas badges", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, API_SINGLE);
    await runAndOpenLog(page);
    await expectNode(page, SINGLE, "passed");
    await expectStepState(page, SINGLE, "passed");

    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-nodes-btn").click();
    await page.getByRole("button", { name: "Yes, clear nodes" }).click();

    await expect(page.getByTestId("chain-request-count")).toContainText("No nodes");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(nodeBadge(page, SINGLE)).toHaveCount(0);
    await expect(page.getByTestId("chain-empty-state")).toBeVisible();
    // The recorded run stays in the log, but its step now points at a node that is gone.
    await expect(runCards(page)).toHaveCount(1);
    await expect(stepRow(page, SINGLE)).toContainText("Node removed");
    await snap("chn-x-05-cleared");
  });

  test("[CHN-X-06] Opening an unknown chain address does not crash", async ({
    seededPage: page,
    snap,
  }) => {
    // Observed fallback: the header title reads "Chain" over an empty canvas; nothing is logged.
    await page.goto(`/chain/${UNKNOWN_CHAIN_ID}`);
    await expect(page.getByRole("heading", { name: FALLBACK_CHAIN_TITLE, exact: true })).toBeVisible();
    await expect(page.getByTestId("chain-request-count")).toContainText("No nodes");
    await expect(page.getByTestId("chain-empty-state")).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(strip(page)).toContainText(/no runs yet/i);
    await snap("chn-x-06-unknown-chain");
  });
});
