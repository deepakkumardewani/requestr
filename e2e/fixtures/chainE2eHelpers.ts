/**
 * Thin helpers for the chain e2e specs (e2e/qa/chain-e2e-*.spec.ts).
 * All functions use getByTestId / web-first assertions. No fixed sleeps.
 */
import { expect, type Locator, type Page } from "@playwright/test";

export const ASSERTION_PANEL_TESTIDS = [
  "assertion-add-btn",
  "assertion-enable-toggle-<id>",
  "assertion-source-select-<id>",
  "assertion-source-path-<id>",
  "assertion-operator-select-<id>",
  "assertion-expected-value-<id>",
  "assertion-delete-btn-<id>",
  "assertion-schema-<id>",
] as const;

/** Navigate to a chain page by its chain ID. */
export async function openChain(page: Page, chainId: string): Promise<void> {
  await page.goto(`/chain/${chainId}`);
  await waitCanvasReady(page);
}

/** Wait for all React Flow nodes to be initialized and rendered. */
export async function waitCanvasReady(page: Page): Promise<void> {
  // Wait until at least one .react-flow__node[data-id] exists and the
  // ReactFlow canvas has fully initialized its internal node lookup
  // (signalled by data-rf-ready="true" on the canvas wrapper).
  // Without this guard, pressing Arrow keys immediately after navigation
  // can trigger React Flow warning #015 ("trying to drag a node that is
  // not initialized").
  await expect(page.locator(".react-flow__node[data-id]").first()).toBeAttached(
    { timeout: 15_000 },
  );

  await expect(
    page.locator(".chain-canvas-react-flow[data-rf-ready='true']"),
  ).toBeAttached({ timeout: 10_000 });
}

type RunVia = "button";

/** Trigger a chain run. */
export async function runChain(
  page: Page,
  { via = "button" }: { via?: RunVia } = {},
): Promise<void> {
  if (via === "button") {
    await page.getByTestId("run-chain-btn").click();
  }
}

/** Wait for the chain run to finish (run button re-appears, stop button gone). */
export async function waitRunDone(page: Page): Promise<void> {
  await expect(page.getByTestId("run-chain-btn")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("stop-chain-btn")).not.toBeVisible({
    timeout: 5_000,
  });
}

/** Stop a running chain. */
export async function stopChain(page: Page): Promise<void> {
  await page.getByTestId("stop-chain-btn").click();
}

const NODE_TEST_ID_PREFIXES = [
  "chain-node",
  "start-node",
  "delay-node",
  "condition-node",
  "display-node",
  "evaluate-node",
  "validate-node",
  "merge-node",
  "loop-node",
  "collect-node",
  "subchain-node",
] as const;

export type NodeRunState =
  | "passed"
  | "failed"
  | "running"
  | "skipped"
  | "aborted"
  | "idle";

/** Get the locator for a canvas node by its request/block ID. */
export function nodeBadge(page: Page, nodeId: string): Locator {
  const selector = NODE_TEST_ID_PREFIXES.map(
    (prefix) => `[data-testid="${prefix}-${nodeId}"]`,
  ).join(", ");
  return page.locator(selector).first();
}

/** Assert that a canvas node has the expected run state class/badge. */
export async function expectNode(
  page: Page,
  nodeId: string,
  state: NodeRunState,
): Promise<void> {
  const node = nodeBadge(page, nodeId);
  await expect(node).toBeVisible({ timeout: 10_000 });
  if (state === "idle") return;

  const colorMap: Record<string, string> = {
    passed: "emerald",
    failed: "red-",
    running: "blue-",
    skipped: "zinc",
    aborted: "orange",
  };
  const colorHint = colorMap[state];
  if (colorHint) {
    await expect.poll(() => node.getAttribute("class")).toContain(colorHint);
  }
}

/** Open the run log dock (toggle if closed). */
export async function openRunLog(page: Page): Promise<void> {
  const dock = page.getByTestId("run-log-dock");
  await expect(dock).toBeVisible({ timeout: 10_000 });
  const strip = page.getByTestId("run-log-strip");
  if (await strip.isVisible()) {
    await strip.click();
  }
  await expect(page.getByTestId("run-summary-header")).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Assert a run log step exists for a given node ID.
 * State verification is done via the chain-passed/failed count badges
 * (since StepRow does not expose a data-step-state attribute).
 */
export async function expectStep(
  page: Page,
  nodeId: string,
  _state?: "passed" | "failed" | "skipped" | "running",
): Promise<void> {
  const step = page.locator(`[data-step-id="${nodeId}"]`);
  await expect(step).toBeVisible({ timeout: 10_000 });
}

/** Assert the run summary header (counts or overall state). */
export async function expectRunSummary(
  page: Page,
  opts: { passed?: number; failed?: number; skipped?: number },
): Promise<void> {
  const header = page.getByTestId("run-summary-header");
  await expect(header).toBeVisible({ timeout: 10_000 });
  if (opts.passed !== undefined) {
    await expect(page.getByTestId("chain-passed-count")).toContainText(
      new RegExp(`\\b${opts.passed}\\b`),
    );
  }
  if (opts.failed !== undefined) {
    await expect(page.getByTestId("chain-failed-count")).toContainText(
      new RegExp(`\\b${opts.failed}\\b`),
    );
  }
  if (opts.skipped !== undefined) {
    await expect(page.getByTestId("chain-skipped-count")).toContainText(
      new RegExp(`\\b${opts.skipped}\\b`),
    );
  }
}

/** Assert the collapsed run bar strip (last-run summary line). */
export async function expectBarSummary(
  page: Page,
  opts: { passed?: number; failed?: number; text?: RegExp | string },
): Promise<void> {
  const strip = page.getByTestId("run-log-strip");
  const header = page.getByTestId("chain-history-label");
  const bar = strip.or(header);
  await expect(bar.first()).toBeVisible({ timeout: 10_000 });
  if (opts.text) {
    await expect(bar.filter({ hasText: opts.text }).first()).toBeVisible({
      timeout: 10_000,
    });
  }
}

/** Click a step row to open its detail panel. */
export async function openStepDetail(
  page: Page,
  nodeId: string,
): Promise<void> {
  const step = page.locator(`[data-step-id="${nodeId}"]`);
  await expect(step).toBeVisible({ timeout: 10_000 });
  await step.click();
  await expect(step).toHaveAttribute("aria-selected", "true");
}

/** Set the run filter tab. */
export async function setFilter(
  page: Page,
  filter: "all" | "passed" | "failed" | "skipped",
): Promise<void> {
  await page.getByTestId(`run-filter-tab-${filter}`).click();
}

/** Open a block's config sheet from its hover toolbar. */
export async function openNodePanel(page: Page, nodeId: string): Promise<void> {
  const node = nodeBadge(page, nodeId);
  await expect(node).toBeVisible({ timeout: 10_000 });
  const configBtn = page.locator(
    NODE_TEST_ID_PREFIXES.map(
      (prefix) =>
        `.react-flow__node:has([data-testid="${prefix}-${nodeId}"]) [data-testid="node-toolbar-configure"]`,
    ).join(", "),
  );
  // The toolbar is CSS :hover only. If React Flow's fit-view/layout moves the
  // node after the pointer lands, :hover goes stale until the mouse moves
  // again, so re-issue the hover until the toolbar actually shows.
  await expect(async () => {
    await node.hover();
    await expect(configBtn).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await configBtn.click();
}

/** Open the request details sheet (assertions live here) from the node toolbar. */
export async function openNodeDetails(
  page: Page,
  nodeId: string,
): Promise<void> {
  const node = nodeBadge(page, nodeId);
  await expect(node).toBeVisible({ timeout: 10_000 });
  const details = page.getByTestId("node-toolbar-details");
  // Re-hover until the hover-only toolbar shows (see openNodePanel).
  await expect(async () => {
    await node.hover();
    await expect(details).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await details.click();
}

/** Click a step-detail tab by its visible label. */
export async function openDetailTab(
  page: Page,
  tab: "Input" | "Output" | "Assertions" | "Extracted" | "Error",
): Promise<void> {
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

/** Step row in the open run log. */
export function stepRow(page: Page, nodeId: string): Locator {
  return page.locator(`[data-step-id="${nodeId}"]`);
}

/** Assert a canvas banner by its type (e.g. "start-only", "invalid-config"). */
export async function expectBanner(page: Page, type: string): Promise<void> {
  await expect(page.getByTestId(`canvas-banner-${type}`)).toBeVisible({
    timeout: 5_000,
  });
}

const HANDLE_DRAG_STEPS = 12;

/** Locator for a React Flow handle: `source` handles are filtered by handle id, `target` has none. */
export function flowHandle(
  page: Page,
  nodeId: string,
  type: "source" | "target",
  handleId?: string,
): Locator {
  const base = `.react-flow__node[data-id="${nodeId}"] .react-flow__handle.${type}`;
  return page
    .locator(handleId ? `${base}[data-handleid="${handleId}"]` : base)
    .first();
}

/** Real-mouse drag between two handles, with intermediate moves so React Flow tracks the connection. */
export async function dragHandleToHandle(
  page: Page,
  from: Locator,
  to: Locator,
  beforeRelease?: () => Promise<void>,
): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error("handle geometry unavailable");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {
    steps: HANDLE_DRAG_STEPS,
  });
  await beforeRelease?.();
  await page.mouse.up();
}

const STEP_STATE_ICON_CLASS: Record<Exclude<NodeRunState, "idle">, string> = {
  passed: "text-emerald",
  failed: "text-red",
  running: "animate-spin",
  skipped: "text-muted-foreground",
  aborted: "text-orange",
};

/** Assert a run log step row shows the expected state (its leading state icon's colour/animation). */
export async function expectStepState(
  page: Page,
  nodeId: string,
  state: Exclude<NodeRunState, "idle">,
): Promise<void> {
  const icon = stepRow(page, nodeId).locator("svg").first();
  await expect(icon).toHaveClass(new RegExp(STEP_STATE_ICON_CLASS[state]), {
    timeout: 10_000,
  });
}

/** Run cards (one per recorded or live run) in the open run log. */
export function runCards(page: Page): Locator {
  return page.locator("[data-run-id]");
}

/** Collapse the run log dock to its bottom bar. */
export async function collapseRunLog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Collapse run log" }).click();
  await expect(page.getByTestId("run-log-strip")).toBeVisible();
}

/** Run the chain, wait for it to finish, and leave the run log open on the latest run. */
export async function runAndOpenLog(page: Page): Promise<void> {
  await runChain(page);
  await waitRunDone(page);
  await openRunLog(page);
}
