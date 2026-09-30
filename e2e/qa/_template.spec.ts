import { expect, test } from "../fixtures/qa";
import { createChain, createCollection, openTab } from "../fixtures/qaHelpers";

// ---------------------------------------------------------------------------
// COPY ME — do not run this file directly (see playwright.config.ts
// testIgnore: it's excluded from the runner on purpose).
//
// To use: `cp e2e/qa/_template.spec.ts e2e/qa/<feature>.spec.ts`, then:
//   1. Rename the describe block to "<Feature> @qa".
//   2. Replace the example test with one test() per Verify/checklist item
//      from the phase's tasks file — do not bundle multiple checklist items
//      into one test. Independent tests isolate failures and can run in
//      parallel; a shared serial test hides which item actually regressed.
//   3. Add any fixture data the checklist needs to a new e2e/fixtures/seed/<feature>.json and run
//      `bun run qa:seed:build`, then read it via `seededPage` — never build
//      it by clicking through the UI, unless that UI is the feature under
//      test. Seeding is for setup; the test should exercise the feature.
//   4. Never call page.waitForTimeout() — it's the #1 source of flaky QA
//      specs. Wait on a real condition instead: expect(...).toBeVisible(),
//      page.waitForURL(), or a network route/response.
//   5. Never filter or bypass the `consoleGuard` auto fixture (e2e/fixtures/
//      qa.ts) — it fails the test on ANY console error/warning/page error,
//      unfiltered. If your feature legitimately logs a warning, fix the
//      feature, don't suppress the guard.
//   6. Use role/testid locators (getByTestId, getByRole) over CSS selectors
//      — they mirror how the app exposes state to assistive tech and survive
//      styling changes.
//   7. End each test with a snap() — it's the visual evidence a verifier
//      checks without re-running the suite.
// ---------------------------------------------------------------------------

test.describe("<Feature> @qa", () => {
  // One test per checklist item. Rename/duplicate this block per item —
  // don't chain multiple assertions for different checklist items together.
  test("<checklist item description>", async ({ seededPage: page, snap }) => {
    await page.goto("/app");

    // Prefer the seeded fixture's data when the checklist item needs
    // pre-existing state (a collection/chain/environment). Only fall back
    // to building it live through the UI when the UI itself is under test,
    // e.g.:
    await openTab(page);
    await createCollection(page, "QA Template Collection");
    await createChain(page, "QA Template Chain");

    // Real expects against the rendered UI — not just a screenshot.
    await expect(page.getByTestId("chain-request-count")).toBeVisible();

    await snap("01-example");
  });
});
