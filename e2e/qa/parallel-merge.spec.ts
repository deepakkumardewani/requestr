import { installChainRoutes } from "../fixtures/chainRoutes";
import { expect, test } from "../fixtures/qa";

// ---------------------------------------------------------------------------
// P7.10 — Phase 7 gate: Parallel execution + Merge.
//
// One independent test() per Verify checklist item: lanes at concurrency 4,
// Merge `all` outcome, Merge `any` outcome, sequential order at
// concurrency 1. Each opens a seeded chain (e2e/fixtures/seed/chaining.json)
// against the hermetic /slow (5000ms) + /fast (0ms) fixture routes — never
// live endpoints. The `consoleGuard` auto fixture (e2e/fixtures/qa.ts)
// enforces zero console errors/warnings on every test.
// ---------------------------------------------------------------------------

test.describe("Parallel execution + Merge @qa", () => {
  test("Two independent branches run concurrently, showing distinct lanes at concurrency 4", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-parallel-lanes");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 10_000 },
    );
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(0);

    const startedAt = Date.now();
    await page.getByTestId("run-chain-btn").click();

    // The fast branch completes almost immediately — well before the slow
    // branch's 5000ms delay elapses — proving the two lanes ran
    // concurrently rather than sequentially.
    const fastRow = page
      .getByRole("option")
      .filter({ hasText: "QA Parallel Fast" });
    await expect(fastRow).toBeVisible({ timeout: 5000 });
    expect(Date.now() - startedAt).toBeLessThan(4000);

    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");

    const slowRow = page
      .getByRole("option")
      .filter({ hasText: "QA Parallel Slow" });
    await expect(slowRow).toBeVisible({ timeout: 5000 });
    const fastLane = fastRow.locator('[data-testid^="step-lane-"]');
    const slowLane = slowRow.locator('[data-testid^="step-lane-"]');
    await expect(fastLane).toBeVisible();
    await expect(slowLane).toBeVisible();
    expect(await fastLane.getAttribute("data-testid")).not.toBe(
      await slowLane.getAttribute("data-testid"),
    );

    await snap("01-lanes-at-concurrency-4");
  });

  test("Merge in `all` mode waits for both branches and passes", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-merge-all");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 10_000 },
    );
    await expect(page.locator('[data-testid^="merge-node-"]')).toBeVisible();

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 8000,
    });
    // Two API steps plus the merge step all pass.
    await expect(page.getByTestId("chain-passed-count")).toContainText("3");
    await expect(page.getByTestId("chain-failed-count")).not.toBeVisible();
    await expect(
      page.getByTestId("chain-skipped-count"),
    ).not.toBeVisible();

    await snap("02-merge-all-outcome");
  });

  test("Merge in `any` mode fires on the first branch and skips the remaining lane", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    // Concurrency 1 so the slow branch has not started yet when the fast
    // branch resolves the "any" Merge early — demonstrating the skip
    // ("a lane that hasn't started is short-circuited to skipped") rather
    // than the in-flight-lane-finishes-naturally case, which concurrency 4
    // (the default) would hit instead since both lanes launch at once.
    await page.addInitScript(() => {
      localStorage.setItem("rq_chain_concurrency", "1");
    });
    await page.goto("/chain/qa-chain-merge-any");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 10_000 },
    );
    await expect(page.locator('[data-testid^="merge-node-"]')).toBeVisible();

    await page.getByTestId("run-chain-btn").click();

    // The fast branch (dispatched first at concurrency 1) resolves the
    // Merge immediately; the not-yet-started slow branch is short-circuited
    // to skipped rather than being dispatched at all.
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");
    await expect(page.getByTestId("chain-skipped-count")).toBeVisible({
      timeout: 2000,
    });
    await expect(page.getByTestId("chain-skipped-count")).toContainText("1");

    await snap("03-merge-any-outcome");
  });

  test("Setting concurrency to 1 runs a two-branch chain sequentially", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);

    // The concurrency setting (P7.3) is a plain persisted localStorage value
    // (useUIStore, key "rq_chain_concurrency") consumed directly by the
    // runner — set it the same way the Settings UI does, without navigating
    // through /settings, since that page isn't part of this feature.
    await page.addInitScript(() => {
      localStorage.setItem("rq_chain_concurrency", "1");
    });

    await page.goto("/chain/qa-chain-parallel-lanes");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 10_000 },
    );

    const startedAt = Date.now();
    await page.getByTestId("run-chain-btn").click();

    // At concurrency 1 the slow branch (5000ms) runs before the fast branch
    // can complete — the fast row does not appear until the slow one's
    // delay has elapsed, proving sequential (not concurrent) execution.
    const fastRow = page
      .getByRole("option")
      .filter({ hasText: "QA Parallel Fast" });
    await expect(fastRow).toBeVisible({ timeout: 8000 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(4000);

    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");

    await snap("04-sequential-at-concurrency-1");
  });
});
