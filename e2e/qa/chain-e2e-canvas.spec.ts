/**
 * Chain e2e specs: canvas interactions and graph validation banners.
 * Source of truth: e2e/scenarios/chain/chain-canvas.feature.md
 */
import { installChainRoutes } from "../fixtures/chainRoutes";
import {
  expectBanner,
  dragHandleToHandle,
  expectBarSummary,
  flowHandle,
  nodeBadge,
  openChain,
  openRunLog,
  runChain,
  stepRow,
  waitCanvasReady,
  waitRunDone,
} from "../fixtures/chainE2eHelpers";
import { expect, test } from "../fixtures/qa";

async function expectNoRunYet(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("run-log-strip")).toContainText(/no runs yet/i);
}

async function expectRunBlocked(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("run-chain-btn")).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expectNoRunYet(page);
}

const MAX_HISTORY_STEPS = 5;
const HISTORY_STEP_TIMEOUT_MS = 1000;

/** Chain keyboard shortcuts only fire while focus is inside the canvas, not on <body>. */
async function focusCanvas(page: import("@playwright/test").Page, nodeId?: string) {
  const nodes = page.locator(nodeId ? `.react-flow__node[data-id="${nodeId}"]` : ".react-flow__node");
  await nodes.first().focus();
}

/** Presses a history shortcut until the matching panel button reports nothing left. */
async function stepHistory(
  page: import("@playwright/test").Page,
  button: "Undo" | "Redo",
  shortcut: string,
) {
  const control = page.getByRole("button", { name: button });
  // Each attempt presses once (if history remains) and gives the button time to report
  // exhaustion; toPass retries until the whole history has been walked.
  await expect(async () => {
    if (await control.isEnabled()) await page.keyboard.press(shortcut);
    await expect(control).toBeDisabled({ timeout: HISTORY_STEP_TIMEOUT_MS });
  }).toPass({ timeout: HISTORY_STEP_TIMEOUT_MS * MAX_HISTORY_STEPS * 2 });
}

test.describe("Chain E2E — Canvas and graph validation @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-GR-01] Undo and redo restore adds, deletes and connections", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    const before = await page.locator(".react-flow__node").count();
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-delay").click();
    await page.locator(".react-flow__pane").click({ position: { x: 420, y: 240 } });
    await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
    // Placement auto-opens the block's config sheet; chain keys are inert behind it.
    await page.keyboard.press("Escape");
    // toHaveCount tolerates the sheet and a popover both animating out (strict mode would throw).
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await focusCanvas(page);
    // Placing a block records more than one history step, so walk the whole history.
    await stepHistory(page, "Undo", "ControlOrMeta+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(before);
    await stepHistory(page, "Redo", "ControlOrMeta+Shift+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expectBarSummary(page, { text: /passed|failed/i });
    await snap("chn-gr-01-undo");
  });

  test("[CHN-GR-02] Positions, edges and configuration persist across reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    const node = page.locator(".react-flow__node").first();
    const before = await node.boundingBox();
    await node.dragTo(page.locator(".react-flow__pane"), {
      targetPosition: { x: 80, y: 80 },
    });
    await page.reload();
    await waitCanvasReady(page);
    const after = await page.locator(".react-flow__node").first().boundingBox();
    expect(after).toBeTruthy();
    expect(before).toBeTruthy();
    await expect(page.locator(".react-flow__edge")).not.toHaveCount(0);
    await snap("chn-gr-02-persist");
  });

  test("[CHN-GR-03] A renamed node keeps its name on the canvas, in the log and after reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    // Hover (not click): clicking opens the config sheet, whose overlay would cover the toolbar.
    await nodeBadge(page, "qa-e2e-req-single").hover();
    await page.getByTestId("node-toolbar-details").click();
    const name = page.getByTestId("save-request-name-input");
    if (await name.isVisible()) {
      await name.fill("Renamed single");
      await page.getByTestId("save-modal-save-btn").click();
    }
    await expect(nodeBadge(page, "qa-e2e-req-single")).toContainText(/renamed single|single api/i);
    await page.keyboard.press("Escape");
    // toHaveCount tolerates the sheet and a popover both animating out (strict mode would throw).
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await runChain(page);
    await waitRunDone(page);
    await openRunLog(page);
    await expect(stepRow(page, "qa-e2e-req-single")).toBeVisible();
    await page.reload();
    await waitCanvasReady(page);
    await expect(nodeBadge(page, "qa-e2e-req-single")).toBeVisible();
    await snap("chn-gr-03-rename");
  });

  test("[CHN-GR-04] The block picker filters by search and adds the top match on Enter", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-search").fill("loop");
    await expect(page.getByTestId("block-menu-item-loop")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-delay")).toHaveCount(0);
    await page.getByTestId("block-menu-search").press("Enter");
    await page.locator(".react-flow__pane").click({ position: { x: 480, y: 200 } });
    await expect(page.locator("[data-testid^='loop-node-']")).toHaveCount(1);
    await expectBanner(page, "loop-unpaired");
    await snap("chn-gr-04-picker");
  });

  test("[CHN-GR-05] Copying and pasting a block keeps its settings and offsets it", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-short");
    await nodeBadge(page, "qa-e2e-delay-block-short").click();
    // Clicking opens the config sheet and chain keys are inert behind it; close it
    // and return focus to the still-selected node so the shortcuts reach the canvas.
    await page.keyboard.press("Escape");
    // toHaveCount tolerates the sheet and a popover both animating out (strict mode would throw).
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await focusCanvas(page, "qa-e2e-delay-block-short");
    await page.keyboard.press("Space");
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+c");
    // The clipboard lives in a store; paste is only bound after React re-renders with it,
    // so retry the paste until the copy appears.
    await expect(async () => {
      await page.keyboard.press("ControlOrMeta+v");
      await expect(page.locator("[data-testid^='delay-node-']")).toHaveCount(2, {
        timeout: HISTORY_STEP_TIMEOUT_MS,
      });
    }).toPass({ timeout: HISTORY_STEP_TIMEOUT_MS * MAX_HISTORY_STEPS });
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator("[data-testid^='delay-node-']")).toHaveCount(1);
    await snap("chn-gr-05-paste");
  });

  test("[CHN-GR-06] A node cannot be connected to itself", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-api-single");
    const edges = await page.locator(".react-flow__edge").count();
    await dragHandleToHandle(
      page,
      flowHandle(page, "qa-e2e-req-single", "source", "success"),
      flowHandle(page, "qa-e2e-req-single", "target"),
      // The connection is refused while dragging (isValidConnection), so the canvas
      // shows a status message rather than a toast on release.
      () => expect(page.getByRole("status")).toContainText("This connection isn't allowed"),
    );
    await expect(page.locator(".react-flow__edge")).toHaveCount(edges);
    await snap("chn-gr-06-self");
  });

  test("[CHN-GR-07] A duplicate connection is refused", async ({ seededPage: page, snap }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    const edges = await page.locator(".react-flow__edge").count();
    const source = flowHandle(page, "qa-e2e-req-token", "source", "success");
    const target = flowHandle(page, "qa-e2e-req-echo", "target");
    // The seeded edge is branchless, so draw the success-route edge once, then repeat it.
    await dragHandleToHandle(page, source, target);
    await expect(page.locator(".react-flow__edge")).toHaveCount(edges + 1);
    await dragHandleToHandle(page, source, target);
    await expect(page.getByText("This connection already exists")).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(edges + 1);
    await snap("chn-gr-07-duplicate");
  });

  test("[CHN-GR-08] A Loop output that is already connected refuses a second connection", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-ok");
    const edges = await page.locator(".react-flow__edge").count();
    await dragHandleToHandle(
      page,
      flowHandle(page, "qa-e2e-loop-ok-loop", "source", "body"),
      flowHandle(page, "qa-e2e-req-loop-tail", "target"),
      async () => {
        await expect(page.getByRole("status")).toContainText("This connection isn't allowed");
      },
    );
    await expect(page.locator(".react-flow__edge")).toHaveCount(edges);
    await snap("chn-gr-08-handle");
  });

  test("[CHN-CV-01] A cycle shows a banner and blocks the run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cycle");
    await expectBanner(page, "cycle");
    await expectRunBlocked(page);
    await snap("chn-cv-01-cycle");
  });

  test("[CHN-CV-02] A chain with only a Start block shows an informational banner", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-only");
    await expectBanner(page, "start-only");
    await expect(page.getByTestId("run-chain-btn")).toBeDisabled();
    await expect(page.getByTestId("run-log-empty-noRuns").or(page.getByTestId("run-log-strip"))).toBeVisible();
    await snap("chn-cv-02-start-only");
  });

  test("[CHN-CV-03] A Loop body that is not connected shows a banner", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-body-unconnected");
    await expectBanner(page, "loop-body-unconnected");
    await expectRunBlocked(page);
    await snap("chn-cv-03-body");
  });

  test("[CHN-CV-04] A Loop body that never reaches its Collect shows a banner", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-loop-body-misses-collect");
    await expectBanner(page, "loop-body-misses-collect");
    await expectRunBlocked(page);
    await snap("chn-cv-04-misses");
  });

  test("[CHN-CV-05] An invalid Subchain reference shows a banner", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-sub-parent-empty");
    await expectBanner(page, "subchain-invalid");
    await expectRunBlocked(page);
    await snap("chn-cv-05-subchain");
  });

  test("[CHN-CV-06] Engine-only circular and depth errors are stopped by the run gate", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cycle");
    await expectBanner(page, "cycle");
    await expectRunBlocked(page);
    await openChain(page, "qa-e2e-loop-nested4");
    await expectBanner(page, "loop-nesting-depth");
    await expectRunBlocked(page);
    await snap("chn-cv-06-gate");
  });

  test("[CHN-CV-07] Banners clear once their cause is fixed", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-cycle");
    await expectBanner(page, "cycle");
    // The cycle's edge labels sit under the nodes, so the hover-only delete button cannot be
    // reached by a real pointer; dispatch the click straight to the button.
    await page.getByTestId("edge-delete-btn").first().dispatchEvent("click");
    await expect(page.getByTestId("canvas-banner-cycle")).toHaveCount(0);
    await expect(page.getByTestId("run-chain-btn")).toBeEnabled();
    await openChain(page, "qa-e2e-loop-unpaired");
    await expectBanner(page, "loop-unpaired");
    await page.locator("[data-testid^='loop-node-']").first().click();
    await page.keyboard.press("Delete");
    await expect(page.locator("[data-testid^='loop-node-']")).toHaveCount(0);
    await expect(page.getByTestId("canvas-banner-loop-unpaired")).toHaveCount(0);
    await snap("chn-cv-07-clear");
  });
});
