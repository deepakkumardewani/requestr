import type { Locator, Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../src/lib/idbSchema";
import { installChainRoutes } from "../fixtures/chainRoutes";
import { waitCanvasReady } from "../fixtures/chainE2eHelpers";
import { expect, test } from "../fixtures/qa";
import {
  addApiRequest,
  countIdbRecords,
  createChain,
  createCollection,
  openTab,
  saveRequestToCollection,
  seedSyntheticRequests,
} from "../fixtures/qaHelpers";

// ---------------------------------------------------------------------------
// P10.4 — Final browser walkthrough of every feature.
//
// One INDEPENDENT test() per P10.4 checklist item (agent_docs/chaining-ui-
// overhaul-tasks.md), tagged @qa. Each test gets its own isolated browser
// context/storage from Playwright, so no manual IndexedDB-clearing is needed
// between tests (unlike the old single serial spec this replaces).
//
// Every scenario below now opens a fully-wired, executable chain seeded in
// e2e/fixtures/seed/chaining.json via `seededPage` — see e2e/fixtures/README.md
// for the full seeded-chain list. Only the UI interaction the test is actually
// about (deleting/undoing a node, overriding a Start input, opening the
// shortcuts overlay) is still driven through the UI; building the chain
// itself is no longer part of any test but the two that need it (Sub-chain
// steps nest — the picker flow itself is under test — and the legacy-
// migration/edge-mapping tests already covered by `seededPage`).
//
// Console/warning/page-error assertions are no longer a single end-of-run
// step — the `consoleGuard` auto fixture (e2e/fixtures/qa.ts) enforces zero
// of each on every test individually, which also pinpoints which test
// regressed instead of failing one giant shared run.
// ---------------------------------------------------------------------------

test.describe("Chaining UI overhaul — QA walkthrough @qa", () => {
  test("Legacy chain migrates and renders", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/chain/qa-collection-1");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 10_000 }
    );
    await expect(page.locator('[data-testid^="chain-node-"]')).toContainText(
      "Get Users"
    );
    await snap("01-legacy-chain-migrates");
  });

  // Distinct from the test above: this seeds the "chains" store's own
  // pre-v5 shape (`LegacyStandaloneChain`), not the `chainConfigs` store —
  // proving migration handles both legacy stores, with positions intact.
  test("Legacy standalone chain migrates and renders with nodes and positions intact", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/chain/qa-legacy-standalone-chain");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 10_000 }
    );
    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node).toContainText("Get Users (legacy standalone)");
    // The seeded legacy position (100, 100) survives migration verbatim —
    // React Flow renders the node's transform wrapper on its parent.
    const nodeWrapper = page.locator(
      '.react-flow__node[data-id="qa-req-users-legacy-standalone"]'
    );
    await expect(nodeWrapper).toHaveCSS(
      "transform",
      /matrix\(1,\s*0,\s*0,\s*1,\s*100,\s*100\)/
    );
    await snap("01b-legacy-standalone-chain-migrates");
  });

  test("Edge click maps data, the value is injected, and {{baseUrl}} resolves", async ({
    seededPage: page,
    snap,
  }) => {
    await page.addInitScript(() => {
      // useEnvironmentsStore only restores an active environment from this
      // key (see src/stores/useEnvironmentsStore.ts hydrate()) — it is never
      // auto-activated just because it's the only one seeded.
      localStorage.setItem("requestly_active_env_id", "qa-env-1");
    });

    let capturedDetailUrl: string | null = null;
    await page.route("/api/proxy", async (route) => {
      const bodyText = route.request().postData();
      if (!bodyText) return route.fallback();
      const parsed = JSON.parse(bodyText) as { url?: string };
      const url = parsed.url ?? "";
      if (url.endsWith("/users")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "application/json" },
            body: JSON.stringify([{ id: 42, name: "Leia" }]),
          }),
        });
        return;
      }
      if (/\/users\/\d+$/.test(url)) {
        capturedDetailUrl = url;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: 42, name: "Leia" }),
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/chain/qa-chain-mapping");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 10_000 }
    );

    // No unresolved-variable pill — {{baseUrl}} resolves from the seeded QA
    // Environment, activated via localStorage above.
    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node.getByText(/unresolved/).first()).not.toBeVisible();

    await page.getByLabel("Auto-arrange nodes on the canvas").click();
    const edgeMidpoint = page.locator('[class~="group/edgelabel"]').first();
    await edgeMidpoint.click();
    await expect(page.getByText("Configure Dependency")).toBeVisible({
      timeout: 5000,
    });
    // The saved mapping (source $[0].id -> target path "id") is visible.
    await expect(page.getByText("$[0].id")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Configure Dependency")).not.toBeVisible();

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");

    // {{baseUrl}} resolved to the seeded environment's value, and the
    // injected id (42) reached the target request's path.
    expect(capturedDetailUrl).toBe("https://api.qa-seed.test/users/42");

    await snap("02-edge-mapping-baseurl");
  });

  test("Error strip and Error tab show a failure", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-failing");

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15_000,
    });

    const node = page.locator('[data-testid^="chain-node-"]').first();
    const errorStrip = node.locator("span[title]");
    await expect(errorStrip).toBeVisible({ timeout: 5000 });
    await expect(errorStrip).toHaveAttribute("title", /HTTP 500/);

    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10_000,
    });
    const dock = page.getByTestId("run-log-dock");
    const step = dock.locator("[data-step-id]").first();
    await expect(step).toBeVisible();
    await step.click();
    // Selection must land before the detail pane (and its Error tab) exists.
    await expect(step).toHaveAttribute("aria-selected", "true");
    const errorTab = dock.getByRole("tab", { name: "Error" });
    await errorTab.click();
    await expect(errorTab).toHaveAttribute("aria-selected", "true");
    // Panel content, not just the tab state: the failure reason is rendered.
    await expect(dock.getByRole("tabpanel", { name: "Error" })).toContainText(
      /HTTP 500/
    );

    await snap("03-error-strip-and-error-tab");
  });

  test("Stop cancels a slow run", async ({ seededPage: page, snap }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-slow");

    // The proxy route holds /slow for 5s; a client-side abort surfaces as a
    // failed request well before that, proving the in-flight fetch was cancelled.
    const abortedRequest = page.waitForEvent("requestfailed", {
      predicate: (req) => req.url().includes("/api/proxy"),
      timeout: 4000,
    });
    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("stop-chain-btn")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("stop-chain-btn").click();
    await abortedRequest;

    await expect(page.getByTestId("run-chain-btn")).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByTestId("chain-passed-count")).not.toBeVisible();

    await snap("04-stop-slow-run");
  });

  test("Run log opens, filters, all five tabs show their content, selection syncs both ways, survives reload", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-run-log");

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10_000,
    });

    const steps = page.locator("[data-step-id]");
    await expect(steps).toHaveCount(2);

    // Filter — only the failed step remains.
    await page
      .getByTestId("run-log-dock")
      .getByRole("button", { name: /^Failed \d+$/ })
      .click();
    await expect(steps).toHaveCount(1);
    await page
      .getByTestId("run-log-dock")
      .getByRole("button", { name: /^All \d+$/ })
      .click();
    await expect(steps).toHaveCount(2);

    // Selection syncs timeline -> canvas.
    const highlightClasses =
      /ring-2 ring-ring ring-offset-2 ring-offset-background/;
    const firstNode = page.locator('[data-testid^="chain-node-"]').first();
    await expect(firstNode).not.toHaveClass(highlightClasses);
    await steps.first().click();
    await expect(firstNode).toHaveClass(highlightClasses);

    // Selection syncs canvas -> timeline: clicking another node selects its step.
    const secondNode = page.locator('[data-testid^="chain-node-"]').nth(1);
    await secondNode.click();
    await expect(steps.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(steps.first()).toHaveAttribute("aria-selected", "false");
    // Clicking a canvas node also opens its config sheet; close it so its
    // overlay does not intercept the timeline clicks below.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // All five tabs render on the failed step.
    await steps.nth(1).click();
    const tabContent: Record<string, RegExp> = {
      Input: /example\.com\/api\/fail/,
      Output: /Internal server error/,
      Assertions: /No assertions/,
      Extracted: /No extracted values/,
      Error: /HTTP 500/,
    };
    for (const [tabName, content] of Object.entries(tabContent)) {
      const tab = page.getByRole("tab", { name: tabName });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel", { name: tabName })).toContainText(
        content
      );
    }

    await snap("05-run-log-dock-tabs-filter");

    // Survives reload — wait until the run is actually persisted first.
    await expect
      .poll(() => countIdbRecords(page, "chainRuns"))
      .toBeGreaterThan(0);
    await page.reload({ waitUntil: "commit" });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 10_000 }
    );
    // The dock's open/collapsed state is persisted (the run auto-opened it),
    // so it comes back open after the reload without another toggle click.
    await expect(page.getByTestId("toggle-run-log-btn")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 5000 }
    );
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 5000,
    });
    // After a reload the dock reopens on the run list, not the previously
    // selected run's steps — select the (only) persisted run to expand it.
    await page
      .getByTestId("run-log-dock")
      .getByRole("button", { name: /Full run/ })
      .first()
      .click();
    await expect(page.locator("[data-step-id]")).toHaveCount(2, {
      timeout: 5000,
    });

    await snap("06-run-log-survives-reload");
  });

  test("Cmd+Z restores a deleted node", async ({ seededPage: page, snap }) => {
    await page.goto("/chain/qa-chain-undo");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 10_000 }
    );

    const node = page.locator('[data-testid^="chain-node-"]').first();
    await node.click();
    // Clicking a node opens its config sheet, and chain keys are deliberately
    // inert behind a modal; close it so Delete reaches the canvas.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // Closing the sheet drops focus to <body>; chain keys need focus back
    // inside the canvas (keyboard users Tab back to the still-selected node).
    await page.locator(".react-flow__node").first().focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    await expect(page.locator(".react-flow__node").first()).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
    );

    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
    );

    await snap("07-undo-restore");
  });

  test("`?` overlay lists aliases; block-menu, `/` and select-all bindings fire; Cmd+K stays the palette", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/chain/qa-chain-shortcuts");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 10_000 }
    );

    // `?` is a canvas binding: it only fires while focus is inside the canvas.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Shift+Slash");
    const dialog = page.getByRole("dialog", { name: "Keyboard Shortcuts" });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText("Chain canvas")).toBeVisible();
    // Aliases documented in the registry are listed next to their primary key.
    await expect(dialog.locator("kbd", { hasText: "Backspace" })).toBeVisible();
    await snap("08-shortcuts-overlay");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    // Canvas bindings need canvas focus-within; click empty pane to restore it.
    const pane = page.locator(".react-flow__pane");
    await pane.click({ position: { x: 5, y: 5 } });

    const blockMenuItem = page.getByTestId("block-menu-item-delay");
    await page.keyboard.press("ControlOrMeta+Shift+k");
    await expect(blockMenuItem).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(blockMenuItem).not.toBeVisible();

    await pane.click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(blockMenuItem).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(blockMenuItem).not.toBeVisible();

    await pane.click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ControlOrMeta+a");
    await expect(page.locator(".react-flow__node.selected")).not.toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+k");
    await expect(
      page.getByPlaceholder("Search requests, actions...")
    ).toBeVisible({ timeout: 5000 });
    await expect(blockMenuItem).not.toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Start input override reaches a downstream request header", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    let capturedHeaders: Record<string, string> | null = null;
    await page.route("/api/proxy", async (route) => {
      const bodyText = route.request().postData();
      if (bodyText) {
        const parsed = JSON.parse(bodyText) as {
          url?: string;
          headers?: Record<string, string>;
        };
        if (parsed.url?.includes("/echo")) {
          capturedHeaders = parsed.headers ?? {};
        }
      }
      await route.fallback();
    });

    await page.goto("/chain/qa-chain-start-inputs");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 10_000 }
    );

    await page.getByTestId("run-with-inputs-btn").click();
    await expect(page.getByTestId("run-with-inputs-popover")).toBeVisible({
      timeout: 5000,
    });
    await page.getByLabel("qaToken").fill("qa-override-token");
    await page
      .getByTestId("run-with-inputs-popover")
      .getByRole("button", { name: "Run" })
      .click();

    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15_000,
    });
    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.["x-qa-token"]).toBe("qa-override-token");

    await snap("09-start-input-override");
  });

  test("Evaluate result flows into a header", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    let capturedHeaders: Record<string, string> | null = null;
    await page.route("/api/proxy", async (route) => {
      const bodyText = route.request().postData();
      if (bodyText) {
        const parsed = JSON.parse(bodyText) as {
          url?: string;
          headers?: Record<string, string>;
        };
        if (parsed.url?.includes("/echo")) {
          capturedHeaders = parsed.headers ?? {};
        }
      }
      await route.fallback();
    });

    await page.goto("/chain/qa-chain-evaluate");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "3 nodes",
      { timeout: 10_000 }
    );

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("3");
    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.["x-qa-evaluated-token"]).toBe("secret-token-abc");

    await snap("10-evaluate-to-header");
  });

  test("Validate lists three errors", async ({ seededPage: page, snap }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-validate");

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10_000,
    });
    const validateStep = page
      .locator("[data-step-id]")
      .filter({ hasText: "Validate" })
      .first();
    await validateStep.click();
    // Schema-validation failures surface in the Error tab, not Assertions.
    await page.getByRole("tab", { name: "Error" }).click();
    const assertionsPanel = page.getByRole("tabpanel");
    await expect(assertionsPanel.getByText("missingA")).toBeVisible();
    await expect(assertionsPanel.getByText("missingB")).toBeVisible();
    await expect(assertionsPanel.getByText("missingC")).toBeVisible();

    await snap("11-validate-three-errors");
  });

  test("A 3-item loop shows 3 iterations", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-loop");

    const loopNode = page.locator('[data-testid^="loop-node-"]');
    const loopTestId = (await loopNode.getAttribute("data-testid")) ?? "";
    const loopId = loopTestId.replace("loop-node-", "");

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10_000,
    });

    const iterationToggles = page.locator(
      `[data-testid^="iteration-toggle-${loopId}-"]`
    );
    await expect(iterationToggles).toHaveCount(3, { timeout: 15_000 });

    await snap("12-loop-three-iterations");
  });

  test("Enter on a keyboard-focused Loop block opens its config panel", async ({
    seededPage: page,
  }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-loop");
    await expect(page.locator('[data-testid^="loop-node-"]')).toBeVisible({
      timeout: 10_000,
    });

    // Reading order is request -> loop -> collect -> body request, so one
    // ArrowRight from an unfocused canvas lands the focus ring on the Loop.
    await page
      .locator(".react-flow__pane")
      .first()
      .click({
        position: { x: 360, y: 440 },
      });
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Configure Loop")).toBeVisible({
      timeout: 5000,
    });
  });

  test("Two parallel branches render in two distinct lanes", async ({
    seededPage: page,
    snap,
  }) => {
    await installChainRoutes(page);
    await page.goto("/chain/qa-chain-parallel-lanes");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 10_000 }
    );
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(0);

    await page.getByTestId("run-chain-btn").click();
    const fastRow = page
      .getByRole("option")
      .filter({ hasText: "QA Parallel Fast" });
    await expect(fastRow).toBeVisible({ timeout: 5000 });
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
      await slowLane.getAttribute("data-testid")
    );

    // Not asserted: overlapping start times. The run log DOM exposes only
    // durations (no start timestamps), and the fast branch resolves instantly,
    // so request ordering cannot tell parallel from sequential execution.
    await snap("13-parallel-two-lanes");
  });

  test("Sub-chain steps nest", async ({ seededPage: page, snap }) => {
    // The subchain picker flow (creating a host chain, referencing the
    // seeded target chain by id) is the feature under test, so it stays
    // UI-driven — only the target chain being run is seeded.
    await installChainRoutes(page);
    await openTab(page);
    await createCollection(page, "QA Sub-chain Collection");
    await saveRequestToCollection(
      page,
      "QA Host Request",
      "https://example.com/api/fast"
    );

    await createChain(page, "QA Host Chain");
    await addApiRequest(page, "QA Host Request");

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-subchain").click();
    const pane = page.locator(".react-flow__pane").first();
    await pane.hover({ position: { x: 700, y: 550 } });
    await pane.click({ position: { x: 700, y: 550 } });
    await expect(page.getByTestId("subchain-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page
      .getByTestId("subchain-picker-item-qa-chain-subchain-target")
      .click();
    await expect(page.getByTestId("subchain-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10_000,
    });

    const subChainToggle = page.locator('[data-testid^="subchain-toggle-"]');
    await expect(subChainToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("QA Sub Body Request")).not.toBeVisible();
    await subChainToggle.click();
    await expect(subChainToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("QA Sub Body Request")).toBeVisible();

    await snap("14-subchain-nested-steps");
  });

  for (const chainId of ["qa-chain-loop", "qa-chain-mapping"]) {
    test(`L auto-layouts ${chainId} and the page stays responsive`, async ({
      seededPage: page,
    }) => {
      await page.goto(`/chain/${chainId}`);
      const nodes = page.locator(".react-flow__node");
      await expect(nodes.first()).toBeVisible({ timeout: 10_000 });
      const transforms = () =>
        nodes.evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).style.transform)
        );

      // Scramble one node so a layout pass has something to change.
      const box = await nodes.first().boundingBox();
      if (!box) throw new Error("first node has no bounding box");
      await page.mouse.move(box.x + 10, box.y + 10);
      await page.mouse.down();
      await page.mouse.move(box.x + 160, box.y + 190, { steps: 5 });
      await page.mouse.up();
      const before = await transforms();

      for (let press = 0; press < 3; press++) {
        await page
          .locator(".react-flow__pane")
          .first()
          .click({ position: { x: 5, y: 5 } });
        await page.keyboard.press("l");
        await expect(page.getByText("Layout applied").first()).toBeVisible({
          timeout: 5000,
        });
        // A hung tab would time this round trip out.
        expect(await page.evaluate(() => 1 + 1)).toBe(2);
      }
      // Held key: auto-repeat must not wedge the renderer either.
      await page.keyboard.down("l");
      for (let i = 0; i < 80; i++) await page.keyboard.press("l");
      await page.keyboard.up("l");
      expect(await page.evaluate(() => 1 + 1)).toBe(2);

      expect(await transforms()).not.toEqual(before);
    });
  }

  test("Cmd+D on a selected API request node duplicates it", async ({
    seededPage: page,
  }) => {
    await page.goto("/chain/qa-chain-shortcuts");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 10_000 }
    );
    await page
      .locator(".react-flow__pane")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ControlOrMeta+a");
    await expect(page.locator(".react-flow__node.selected")).not.toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+d");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
    );
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Chain UI polish — Phase 1. One test per requirement (title starts with the
// requirement id so `-g "CANVAS-1"` selects it). Chains come from
// e2e/fixtures/seed/chain-polish.json.
// ---------------------------------------------------------------------------

const POLISH_BLOCKS = "qa-polish-blocks";
const POLISH_LAST_RUN = "qa-polish-last-run";
const POLISH_NEVER_RUN = "qa-polish-never-run";
const POLISH_ZERO_STEP = "qa-polish-zero-step-run";
const POLISH_START_ONLY = "qa-polish-start-only";
const LOAD_TIMEOUT_MS = 10_000;
/** The seeded "last run" finished here (see seed chainRuns `qa-polish-run-last`). */
const LAST_RUN_FINISHED_AT = 1_700_000_100_500;
const BLOCK_TYPES = [
  "start",
  "delay",
  "condition",
  "evaluate",
  "validate",
  "merge",
  "loop",
  "collect",
  "subchain",
  "display",
] as const;

async function openPolishChain(page: Page, chainId: string) {
  await page.goto(`/chain/${chainId}`);
  await expect(page.getByTestId("chain-request-count")).toBeVisible({
    timeout: LOAD_TIMEOUT_MS,
  });
}

/** Seeded requests use `{{baseUrl}}`; a run needs the seeded environment active (see seed README). */
async function activateQaEnvironment(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("requestly_active_env_id", "qa-env-1");
  });
}

/** Answers every proxied request with a 200 so a seeded chain runs to a passed state offline. */
async function mockProxyOk(page: Page) {
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
    })
  );
}

async function openHeaderMenuItem(page: Page, testId: string) {
  await page.getByTestId("chain-more-actions-btn").click();
  const item = page.getByTestId(testId);
  await expect(item).toBeVisible();
  return item;
}

/** Moves the real pointer from a card up into its toolbar (continuous path, not a teleport). */
async function reachToolbar(page: Page, card: Locator) {
  await card.hover();
  const box = await card.boundingBox();
  const toolbarButton = card
    .locator("xpath=ancestor::div[contains(@class,'group/node')][1]")
    .locator("button")
    .first();
  await expect(toolbarButton).toBeVisible({ timeout: 5000 });
  const target = await toolbarButton.boundingBox();
  if (!box || !target) throw new Error("toolbar geometry unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + 2);
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 }
  );
  await expect(toolbarButton).toBeVisible();
  return toolbarButton;
}

test.describe("Chain UI polish — P1 @qa", () => {
  test("CANVAS-1: the hover toolbar stays reachable on every block type", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_BLOCKS);
    for (const type of BLOCK_TYPES) {
      const card = page.locator(`[data-testid^="${type}-node-"]`).first();
      await expect(card).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
      await card.scrollIntoViewIfNeeded();
      const button = await reachToolbar(page, card);
      await expect(button).toBeEnabled();
    }
    await snap("p1-canvas-1-toolbar");
  });

  test("CANVAS-1: a node 20px above another keeps its body clickable", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_BLOCKS);
    const upper = page.locator(
      '.react-flow__node[data-id="qa-polish-delay-a"]'
    );
    const lower = page.locator(
      '.react-flow__node[data-id="qa-polish-delay-b"]'
    );
    await expect(upper).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    const upperBox = await upper.boundingBox();
    const lowerBox = await lower.boundingBox();
    if (!upperBox || !lowerBox) throw new Error("delay geometry unavailable");
    expect(lowerBox.y).toBeGreaterThan(upperBox.y);

    // The lower node's 36px hover strip reaches over the upper node's top edge.
    await page.mouse.click(upperBox.x + upperBox.width / 2, upperBox.y + 4);
    await expect(upper).toHaveClass(/selected/);
  });

  test("CANVAS-2: Start exposes one default output handle that can be wired", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_BLOCKS);
    const start = page.locator('[data-testid^="start-node-"]');
    await expect(start).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(start.locator(".react-flow__handle.source")).toHaveCount(1);
    await expect(start.getByLabel("Default output")).toHaveCount(1);
    await expect(start).toContainText("No inputs defined");
    // Seeded edge from the default handle (no branch id) renders.
    await expect(
      page.getByTestId("rf__edge-qa-polish-edge-start-delay")
    ).toHaveCount(1);
    await snap("p1-canvas-2-start-handle");
  });

  test("CANVAS-3: Clear all nodes confirms, cancels cleanly, and empties the chain", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_BLOCKS);
    const count = page.getByTestId("chain-request-count");
    await expect(count).toContainText("13 nodes");
    await expect(page.getByTestId("chain-history-label")).toBeVisible();

    await (await openHeaderMenuItem(page, "clear-nodes-btn")).click();
    const dialog = page.getByTestId("clear-nodes-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Cmd+Z");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(count).toContainText("13 nodes");

    await (await openHeaderMenuItem(page, "clear-nodes-btn")).click();
    await page.getByRole("button", { name: "Yes, clear nodes" }).click();
    await expect(count).toContainText("No nodes", { timeout: 5000 });
    await expect(page.getByTestId("chain-history-label")).toHaveCount(0);
    await snap("p1-canvas-3-cleared");

    await page.getByTestId("chain-more-actions-btn").click();
    await expect(page.getByTestId("clear-nodes-btn")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  test("CANVAS-4: Clear edges says it is undoable and Cmd+Z brings the edges back", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_BLOCKS);
    const edges = page.locator('[data-testid^="rf__edge-"]');
    await expect(edges).toHaveCount(2, { timeout: LOAD_TIMEOUT_MS });

    await (await openHeaderMenuItem(page, "clear-edges-btn")).click();
    const dialog = page.getByRole("alertdialog", { name: "Clear all edges?" });
    await expect(dialog).toContainText("Cmd+Z");
    await expect(dialog).not.toContainText("can't be undone");
    await page.getByRole("button", { name: "Yes, clear edges" }).click();
    await expect(edges).toHaveCount(0);

    await page
      .locator(".react-flow__pane")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ControlOrMeta+z");
    await expect(edges).toHaveCount(2, { timeout: 5000 });
  });

  test("CANVAS-5: run badges are pruned with their node and not resurrected by undo", async ({
    seededPage: page,
  }) => {
    await mockProxyOk(page);
    await activateQaEnvironment(page);
    await openPolishChain(page, POLISH_NEVER_RUN);
    await page.getByTestId("run-chain-btn").click();
    const fastNode = page.locator('[data-testid="chain-node-qa-req-fast"]');
    const badge = fastNode.locator("svg[class*='emerald'], svg[class*='red-']");
    await expect(badge).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("stop-chain-btn")).not.toBeVisible({
      timeout: 15_000,
    });

    await page.locator('.react-flow__node[data-id="qa-req-fast"]').focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
    );

    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
    );
    await expect(
      page
        .locator('[data-testid="chain-node-qa-req-fast"]')
        .locator("svg[class*='emerald'], svg[class*='red-']")
    ).toHaveCount(0);
  });

  test("CANVAS-6: the header shows the persisted last run and opens it", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_LAST_RUN);
    const label = page.getByTestId("chain-history-label");
    await expect(label).toContainText("Last run", { timeout: LOAD_TIMEOUT_MS });
    await expect(label.locator("time")).toHaveAttribute("datetime", /2023/);
    await snap("p1-canvas-6-last-run");

    await label.click();
    await expect(page.getByTestId("run-log-dock")).toBeVisible();
    await expect(
      page.locator('[data-step-id="qa-polish-lr-s2"]')
    ).toHaveAttribute("aria-selected", "true");

    await openPolishChain(page, POLISH_NEVER_RUN);
    await expect(page.getByTestId("chain-history-label")).toHaveText(
      "Not yet run"
    );
    await expect(page.getByTestId("chain-passed-count")).toHaveCount(0);

    await openPolishChain(page, POLISH_ZERO_STEP);
    await expect(page.getByTestId("chain-history-label")).toContainText(
      "No steps recorded"
    );
    await expect(page.getByTestId("chain-passed-count")).toHaveCount(0);
    await expect(page.getByTestId("chain-failed-count")).toHaveCount(0);
  });

  test("CANVAS-7: the header counts nodes, not requests", async ({
    seededPage: page,
  }) => {
    const count = page.getByTestId("chain-request-count");
    await openPolishChain(page, POLISH_START_ONLY);
    await expect(count).toHaveText("1 node");
    await openPolishChain(page, POLISH_NEVER_RUN);
    await expect(count).toHaveText("2 nodes");
    await expect(count).not.toContainText("request");
  });

  test("CANVAS-8: Clear run results resets badges and keeps history", async ({
    seededPage: page,
  }) => {
    await mockProxyOk(page);
    await activateQaEnvironment(page);
    await openPolishChain(page, POLISH_NEVER_RUN);
    await page.getByTestId("chain-more-actions-btn").click();
    await expect(page.getByTestId("clear-run-results-btn")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await page.keyboard.press("Escape");

    await page.getByTestId("run-chain-btn").click();
    const badge = page
      .locator('[data-testid="chain-node-qa-req-fast"]')
      .locator("svg[class*='emerald'], svg[class*='red-']");
    await expect(badge).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("stop-chain-btn")).not.toBeVisible({
      timeout: 15_000,
    });
    const runsBefore = await countIdbRecords(page, "chainRuns");

    await (await openHeaderMenuItem(page, "clear-run-results-btn")).click();
    await expect(badge).toHaveCount(0);
    expect(await countIdbRecords(page, "chainRuns")).toBe(runsBefore);
  });

  test("CANVAS-9: toolbar tooltips show the registry shortcut", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_NEVER_RUN);
    const card = page.locator('[data-testid="chain-node-qa-req-users"]');
    const frame = page.getByTestId("rf__node-qa-req-users");
    await card.hover();
    await frame.getByLabel("Duplicate").hover();
    await expect(
      page.locator('[data-slot="tooltip-content"][data-open]')
    ).toContainText(/Duplicate \((⌘|Ctrl\+)D\)/);
    await card.hover();
    await frame.getByLabel("Remove from chain").hover();
    await expect(
      page.locator('[data-slot="tooltip-content"][data-open]')
    ).toContainText(/Remove from chain \(.+\)/);
  });

  test("RUNLOG-7: the header's relative time ticks and its tooltip shows the absolute time", async ({
    seededPage: page,
  }) => {
    await page.clock.install({ time: LAST_RUN_FINISHED_AT + 5_000 });
    await openPolishChain(page, POLISH_LAST_RUN);
    const time = page.getByTestId("chain-history-label").locator("time");
    await expect(time).toHaveText(/\d+ seconds? ago/, {
      timeout: LOAD_TIMEOUT_MS,
    });

    await page.clock.fastForward(125_000);
    await expect(time).toHaveText(/2 minutes ago/);

    await time.hover();
    // Tooltip open delay runs on the faked clock.
    await page.clock.fastForward(1_000);
    await expect(
      page.locator('[data-slot="tooltip-content"][data-open]')
    ).toContainText(/Nov 1[45], 2023.*\d{1,2}:\d{2}:\d{2}/);
  });

  test("RUNLOG-8: counts read as words, not glyphs", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_LAST_RUN);
    await expect(page.getByTestId("chain-passed-count")).toHaveText(
      "2 passed",
      {
        timeout: LOAD_TIMEOUT_MS,
      }
    );
    await expect(page.getByTestId("chain-failed-count")).toHaveText("1 failed");
    await expect(page.getByTestId("chain-skipped-count")).toHaveText(
      "1 skipped"
    );
    const text =
      (await page.getByTestId("chain-history-label").innerText()) ?? "";
    expect(text).not.toMatch(/[✓✗]/);
    await snap("p1-runlog-8-counts");
  });
});

// ---------------------------------------------------------------------------
// Chain UI polish — Phase 2 (empty canvas, pane menu, connect-drop, run gate).
// Chains come from e2e/fixtures/seed/chain-polish.json.
// ---------------------------------------------------------------------------

const POLISH_EMPTY = "qa-polish-empty";
const POLISH_DELAY_ONLY = "qa-polish-delay-only";
const POLISH_SOURCE_HANDLES = "qa-polish-source-handles";
/** Pane-relative point well clear of the centered overlay card and every seeded node. */
const EMPTY_PANE_POINT = { x: 120, y: 140 };
/** Allowed distance between a viewport center and the first block placed there (node is ~350px wide). */
const CENTER_TOLERANCE_PX = 260;
const LOOP_FREE_ID = "qa-polish-sh-loop-free";
const LOOP_USED_ID = "qa-polish-sh-loop-used";
const SOURCE_HANDLES_NODE_COUNT = 5;
const SOURCE_HANDLES_EDGE_COUNT = 2;

const emptyOverlay = (page: Page) => page.getByTestId("chain-empty-state");
const runButton = (page: Page) => page.getByTestId("run-chain-btn");
const nodeCount = (page: Page) => page.locator(".react-flow__node");
const edgeCount = (page: Page) => page.locator(".react-flow__edge");

/** Pane geometry plus a pane-relative -> viewport point helper. */
async function paneOrigin(page: Page) {
  const box = await page.locator(".react-flow__pane").first().boundingBox();
  if (!box) throw new Error("pane geometry unavailable");
  return box;
}

/** Real-mouse drag from a source handle to a pane-relative point (no valid target there). */
async function dragHandleToPane(
  page: Page,
  handle: Locator,
  to: { x: number; y: number }
) {
  const pane = await paneOrigin(page);
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(pane.x + to.x, pane.y + to.y, { steps: 8 });
  await page.mouse.up();
}

const loopBodyHandle = (page: Page, loopId: string) =>
  page.locator(
    `.react-flow__node[data-id="${loopId}"] .react-flow__handle[data-handleid="body"]`
  );

test.describe("Chain UI polish — P2 @qa", () => {
  test("EMPTY-1: a Delay-only chain shows the canvas; an empty chain keeps the canvas under the overlay", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_DELAY_ONLY);
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(emptyOverlay(page)).toHaveCount(0);

    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(page.locator(".react-flow")).toBeVisible();
    await expect(page.getByTestId("block-menu-trigger")).toBeEnabled();
    await snap("p2-empty-1-overlay");
  });

  test("EMPTY-2: the overlay is a compact card with two buttons and no quick-add grid", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    const overlay = emptyOverlay(page);
    await expect(overlay).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(overlay.getByRole("button")).toHaveCount(2);
    await expect(page.getByTestId("empty-add-api-btn")).toHaveText("Add API");
    await expect(page.getByTestId("empty-add-start-btn")).toHaveText(
      "Add Start block"
    );
    await expect(overlay.locator("kbd")).toHaveText("/");

    const pointerEvents = await overlay.evaluate((root) => ({
      root: getComputedStyle(root).pointerEvents,
      card: getComputedStyle(root.firstElementChild as Element).pointerEvents,
    }));
    expect(pointerEvents).toEqual({ root: "none", card: "auto" });

    const card = await overlay.locator("> div").first().boundingBox();
    const pane = await paneOrigin(page);
    if (!card) throw new Error("card geometry unavailable");
    expect(card.height).toBeLessThan(pane.height);
    expect(card.y).toBeGreaterThanOrEqual(pane.y);
    expect(card.y + card.height).toBeLessThanOrEqual(pane.y + pane.height);
  });

  test("EMPTY-3: Add Start lands at the viewport center, the overlay and minimap react", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(page.locator(".react-flow__minimap")).toHaveCount(0);

    await page.getByTestId("empty-add-start-btn").click();
    const start = page.locator('[data-testid^="start-node-"]');
    await expect(start).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(emptyOverlay(page)).toHaveCount(0);
    await expect(page.locator(".react-flow__minimap")).toBeVisible();

    const pane = await paneOrigin(page);
    const box = await start.boundingBox();
    if (!box) throw new Error("start geometry unavailable");
    expect(
      Math.abs(box.x + box.width / 2 - (pane.x + pane.width / 2))
    ).toBeLessThan(CENTER_TOLERANCE_PX);
    expect(
      Math.abs(box.y + box.height / 2 - (pane.y + pane.height / 2))
    ).toBeLessThan(CENTER_TOLERANCE_PX);
  });

  test("EMPTY-4: Tab reaches Add API then Add Start block, and / opens the block menu at 0 nodes", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    const buttons = emptyOverlay(page).getByRole("button");
    await expect(buttons.first()).toHaveAttribute(
      "data-testid",
      "empty-add-api-btn"
    );

    await page.getByTestId("empty-add-api-btn").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("empty-add-start-btn")).toBeFocused();

    await page
      .locator(".react-flow__pane")
      .first()
      .click({ position: EMPTY_PANE_POINT });
    await page.keyboard.press("/");
    await expect(page.getByTestId("block-menu-search")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
  });

  test("EMPTY-5: zero nodes disable Run, show No nodes, hide drag hints and the minimap", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "No nodes"
    );
    await expect(runButton(page)).toBeDisabled();
    await expect(page.getByTestId("chain-history-label")).toHaveCount(0);
    await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
    const footer = page.locator("footer");
    await expect(footer).not.toContainText("Drag nodes");
    await expect(footer).not.toContainText("Right-click");
  });

  test("EMPTY-6: overlay copy matches the spec", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    const overlay = emptyOverlay(page);
    await expect(overlay).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(overlay).toContainText("Start building your chain");
    await expect(overlay).toContainText(
      "Add blocks, then connect them to set the run order."
    );
    await expect(overlay).toContainText("right-click");
    await expect(page.getByText("No APIs in this chain")).toHaveCount(0);
  });

  test("EMPTY-7: a Start-only chain shows the banner, and adding a Delay removes it", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_START_ONLY);
    const banner = page.getByTestId("canvas-banner-start-only");
    await expect(banner).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(banner).toContainText("Only a Start block so far");
    await expect(emptyOverlay(page)).toHaveCount(0);

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-delay").click();
    const pane = page.locator(".react-flow__pane").first();
    await pane.hover({ position: EMPTY_PANE_POINT });
    await pane.click({ position: EMPTY_PANE_POINT });
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(banner).toHaveCount(0);
  });

  test("EMPTY-8: the overlay never flashes while a populated chain loads", async ({
    seededPage: page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __overlaySeen: boolean };
      w.__overlaySeen = false;
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="chain-empty-state"]')) {
          w.__overlaySeen = true;
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await openPolishChain(page, POLISH_DELAY_ONLY);
    await expect(page.locator('[data-testid^="delay-node-"]')).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(
      await page.evaluate(
        () => (window as unknown as { __overlaySeen: boolean }).__overlaySeen
      )
    ).toBe(false);
  });

  test("EMPTY-9: the overlay keeps its legacy test ids and Add API text", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(page.getByTestId("empty-add-api-btn")).toContainText(
      "Add API"
    );
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
  });

  test("EMPTY-10: reduced motion removes the entrance animation", async ({
    seededPage: page,
  }) => {
    const animationName = async () =>
      emptyOverlay(page).evaluate(
        (root) =>
          getComputedStyle(root.firstElementChild as Element).animationName
      );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    expect(await animationName()).toBe("none");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    expect(await animationName()).not.toBe("none");
  });

  test("CANVAS-10: right-click opens the block menu at the cursor; Esc closes it and refocuses the canvas; node menu is unaffected", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_DELAY_ONLY);
    const pane = page.locator(".react-flow__pane").first();
    await expect(page.locator('[data-testid^="delay-node-"]')).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });

    await pane.click({ button: "right", position: EMPTY_PANE_POINT });
    const menu = page.getByTestId("pane-block-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId("block-menu-search")).toBeVisible();
    const paneBox = await paneOrigin(page);
    const menuBox = await menu.boundingBox();
    if (!menuBox) throw new Error("menu geometry unavailable");
    expect(Math.abs(menuBox.x - (paneBox.x + EMPTY_PANE_POINT.x))).toBeLessThan(
      CENTER_TOLERANCE_PX
    );
    await snap("p2-canvas-10-pane-menu");

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(
      page.locator('[aria-label^="Request chain canvas"]')
    ).toBeFocused();

    await page
      .locator('[data-testid^="delay-node-"]')
      .click({ button: "right" });
    await expect(page.getByTestId("pane-block-menu")).toHaveCount(0);
  });

  test("CANVAS-11: dropping a handle on empty pane opens the menu; Esc is a no-op; a pick connects with one undo", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, POLISH_SOURCE_HANDLES);
    await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT, {
      timeout: LOAD_TIMEOUT_MS,
    });
    const freeBody = loopBodyHandle(page, LOOP_FREE_ID);
    const menu = page.getByTestId("pane-block-menu");

    await dragHandleToPane(page, freeBody, EMPTY_PANE_POINT);
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId("block-menu-item-start")).toHaveCount(0);
    await snap("p2-canvas-11-connect-drop-menu");

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT);
    await expect(edgeCount(page)).toHaveCount(SOURCE_HANDLES_EDGE_COUNT);

    await dragHandleToPane(page, freeBody, EMPTY_PANE_POINT);
    await expect(menu).toBeVisible();
    await menu.getByTestId("block-menu-item-delay").click();
    await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT + 1);
    await expect(edgeCount(page)).toHaveCount(SOURCE_HANDLES_EDGE_COUNT + 1);

    await page.locator('[aria-label^="Request chain canvas"]').focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT);
    await expect(edgeCount(page)).toHaveCount(SOURCE_HANDLES_EDGE_COUNT);
  });

  test("CANVAS-11: a Loop body handle that already has an edge opens no menu", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_SOURCE_HANDLES);
    await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT, {
      timeout: LOAD_TIMEOUT_MS,
    });
    await dragHandleToPane(
      page,
      loopBodyHandle(page, LOOP_USED_ID),
      EMPTY_PANE_POINT
    );
    await expect(page.getByTestId("pane-block-menu")).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT);
  });

  test("CANVAS-12: the overlay button, toolbar menu and pane menu share one add-block behavior", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await page.getByTestId("empty-add-start-btn").click();
    await expect(page.locator('[data-testid^="start-node-"]')).toHaveCount(1, {
      timeout: LOAD_TIMEOUT_MS,
    });

    // Both menus keep offering Start (CHN-S-STR-09): choosing it while one
    // exists is refused with a toast instead of being hidden.
    await page.getByTestId("block-menu-trigger").click();
    await expect(page.getByTestId("block-menu-item-delay")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-start")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("block-menu-search")).toHaveCount(0);

    await page
      .locator(".react-flow__pane")
      .first()
      .click({ button: "right", position: EMPTY_PANE_POINT });
    const paneMenu = page.getByTestId("pane-block-menu");
    await expect(paneMenu).toBeVisible();
    await expect(paneMenu.getByTestId("block-menu-item-delay")).toBeVisible();
    await expect(paneMenu.getByTestId("block-menu-item-start")).toBeVisible();
    await paneMenu.getByTestId("block-menu-item-start").click();
    await expect(
      page.getByText("Only one Start block is allowed per chain"),
    ).toBeVisible();
    await expect(page.locator('[data-testid^="start-node-"]')).toHaveCount(1);
  });

  test("CANVAS-13: Run needs a runnable node and Cmd+Enter obeys the same gate", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    await expect(runButton(page)).toBeDisabled({ timeout: LOAD_TIMEOUT_MS });

    await openPolishChain(page, POLISH_START_ONLY);
    await expect(runButton(page)).toBeDisabled({ timeout: LOAD_TIMEOUT_MS });
    await page
      .locator(".react-flow__pane")
      .first()
      .click({ position: EMPTY_PANE_POINT });
    await page.keyboard.press("ControlOrMeta+Enter");
    // A blocked run must not start: the header still reads "Not yet run".
    await expect(page.getByTestId("chain-history-label")).toContainText(
      "Not yet run"
    );
    await expect(page.getByTestId("chain-passed-count")).toHaveCount(0);

    await openPolishChain(page, POLISH_DELAY_ONLY);
    await expect(runButton(page)).toBeEnabled({ timeout: LOAD_TIMEOUT_MS });
  });

  test("CANVAS-22: the footer never hints at dragging nodes or edges on an empty canvas", async ({
    seededPage: page,
  }) => {
    const footer = page.locator("footer");
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await expect(footer).not.toContainText("Drag nodes");
    await expect(footer).not.toContainText("Draw from handle");
    await expect(footer).not.toContainText("Delete/Backspace");

    await openPolishChain(page, POLISH_SOURCE_HANDLES);
    await expect(footer).toContainText("Drag nodes", {
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(footer).toContainText("Delete/Backspace");
  });
});

// ---------------------------------------------------------------------------
// Chain UI polish — Phase 3 (run log). Chains and runs come from
// e2e/fixtures/seed/chain-polish.json: "QA Polish - Run Log" holds nine runs
// (latest first: failed, passed, from-node, up-to-node, stopped, deleted
// anchor, zero steps, one skipped, single node); "Run Cap" holds 50 runs and
// "Many Steps" a single 120-step run.
// ---------------------------------------------------------------------------

const RUN_LOG = "qa-polish-run-log";
const RUN_CAP = "qa-polish-run-cap";
const MANY_STEPS = "qa-polish-many-steps";
const RUN_LOG_RUN_COUNT = 9;
const RUN_CAP_COUNT = 50;
const MANY_STEPS_COUNT = 120;
/** Rows above this count are virtualized (StepsTimeline.VIRTUALIZE_THRESHOLD). */
const VIRTUALIZED_DOM_ROW_BOUND = 50;
const DEFAULT_LIST_WIDTH_PX = 288;
const MIN_LIST_WIDTH_PX = 200;
const LIST_WIDTH_KEY_STEP_PX = 16;
const MIN_DOCK_HEIGHT_PX = 160;
const COLLAPSED_DOCK_HEIGHT_PX = 32;
const NARROW_BREAKPOINT_PX = 560;
const WIDE_VIEWPORT = { width: 1440, height: 900 };
const LIST_WIDTH_STORAGE_KEY = "rq_chain_run_log_list_width";
const DETAIL_RATIO_STORAGE_KEY = "rq_chain_run_log_detail_ratio";
const COLLAPSED_STORAGE_KEY = "rq_chain_run_log_collapsed";
/** The latest seeded run on "Run Log" (`qa-polish-rl-failed`) started here. */
const RUN_LOG_LATEST_STARTED_AT = 1_700_001_900_000;
const MIN_TEXT_CONTRAST = 4.5;
const MIN_TEXT_PX = 12;

const runDock = (page: Page) => page.getByTestId("run-log-dock");
const runCard = (page: Page, runId: string) =>
  page.locator(`[data-run-id="${runId}"]`);
const runCards = (page: Page) => page.locator("[data-run-id]");
const stepRows = (page: Page) => page.locator("[data-step-id]");
const stepRow = (page: Page, stepId: string) =>
  page.locator(`[data-step-id="${stepId}"]`);
const collapsedBar = (page: Page) => page.getByTestId("run-log-strip");
const expandedHeader = (page: Page) => page.getByTestId("run-log-header");
const collapseButton = (page: Page) =>
  page.getByRole("button", { name: "Collapse run log" });
const filterTab = (page: Page, name: RegExp | string) =>
  runDock(page).getByRole("button", { name });
const canvasNode = (page: Page, nodeId: string) =>
  page.locator(`.react-flow__node[data-id="${nodeId}"]`);

/** Opens a seeded chain with its dock expanded and the run list rendered. */
async function openRunLog(page: Page, chainId: string) {
  await openPolishChain(page, chainId);
  // The dock's collapsed state persists, so an earlier open in the same test leaves it expanded.
  await expect(collapsedBar(page).or(expandedHeader(page))).toBeVisible({
    timeout: LOAD_TIMEOUT_MS,
  });
  // The strip can vanish mid-click when the persisted open state hydrates, so
  // a click timeout is only an error if the dock still did not expand.
  if (await collapsedBar(page).isVisible()) {
    await collapsedBar(page)
      .click({ timeout: 3000 })
      .catch(() => undefined);
  }
  await expect(expandedHeader(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
}

async function openRunLogWithRuns(page: Page, chainId = RUN_LOG) {
  await openRunLog(page, chainId);
  await expect(runCards(page).first()).toBeVisible({
    timeout: LOAD_TIMEOUT_MS,
  });
}

/**
 * Writes localStorage before the app boots, so persisted prefs are in place on
 * first render. Runs once per tab: a later reload keeps whatever the test wrote.
 */
async function presetLocalStorage(page: Page, entries: Record<string, string>) {
  await page.addInitScript((values) => {
    if (sessionStorage.getItem("qa-preset-applied")) return;
    sessionStorage.setItem("qa-preset-applied", "1");
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, value);
    }
  }, entries);
}

const listSeparator = (page: Page) =>
  page.getByRole("separator", { name: "Resize runs list" });
const detailSeparator = (page: Page) =>
  page.getByRole("separator", { name: "Resize step detail" });
const dockHeightSeparator = (page: Page) =>
  page.getByRole("separator", { name: "Resize run log" });

async function separatorValue(separator: Locator): Promise<number> {
  return Number(await separator.getAttribute("aria-valuenow"));
}

/** Real-pointer drag of a separator by a pixel delta. */
async function dragSeparator(
  page: Page,
  separator: Locator,
  delta: { dx?: number; dy?: number }
) {
  const box = await separator.boundingBox();
  if (!box) throw new Error("separator geometry unavailable");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + (delta.dx ?? 0), startY + (delta.dy ?? 0), {
    steps: 6,
  });
  await page.mouse.up();
}

/** Deletes a run through its row menu and returns once the card is gone. */
async function deleteRunViaMenu(page: Page, runId: string) {
  await runCard(page, runId).hover();
  await runCard(page, runId)
    .getByRole("button", { name: "Run options" })
    .click();
  await page.getByRole("menuitem", { name: "Delete run" }).click();
  await expect(runCard(page, runId)).toHaveCount(0);
}

test.describe("Chain UI polish — P3 @qa", () => {
  test.use({ viewport: WIDE_VIEWPORT });

  test("RUNLOG-1: the collapsed bar summarizes the last run, its variants, and truncates time before status", async ({
    seededPage: page,
    snap,
  }) => {
    await openPolishChain(page, RUN_LOG);
    const bar = collapsedBar(page);
    await expect(bar).toContainText("Run Log", { timeout: LOAD_TIMEOUT_MS });
    await expect(bar).toContainText("Last run failed");
    await expect(bar).toContainText("1 passed, 2 failed");
    await expect(bar).toContainText("150 ms");
    await expect(bar.locator("time")).toBeVisible();
    // Zero-count buckets are hidden: no "0 skipped".
    await expect(bar).not.toContainText("skipped");
    await expect(bar).not.toContainText(/[✓✗]/);
    await snap("p3-runlog-1-bar-failed");

    // Never run, and a zero-step run.
    await openPolishChain(page, POLISH_NEVER_RUN);
    await expect(collapsedBar(page)).toContainText("No runs yet", {
      timeout: LOAD_TIMEOUT_MS,
    });
    await openPolishChain(page, POLISH_ZERO_STEP);
    await expect(collapsedBar(page)).toContainText("Last run passed", {
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(collapsedBar(page)).toContainText("No steps recorded");

    // Truncation order: the relative time shrinks first; title and status never do.
    await openPolishChain(page, RUN_LOG);
    await expect(collapsedBar(page).locator("time")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await page.setViewportSize({ width: 380, height: 800 });
    const fits = await collapsedBar(page).evaluate((button) => {
      const clipped = (el: Element | null) =>
        el ? el.scrollWidth > el.clientWidth + 1 : false;
      const spans = Array.from(button.querySelectorAll(":scope > span"));
      const byText = (needle: string) =>
        spans.find((span) => span.textContent?.includes(needle)) ?? null;
      return {
        time: clipped(button.querySelector("time")),
        title: clipped(byText("Run Log")),
        status: clipped(byText("Last run failed")),
      };
    });
    expect(fits.title).toBe(false);
    expect(fits.status).toBe(false);
    expect(fits.time).toBe(true);
  });

  test("RUNLOG-1: a live run reads Running with step progress", async ({
    seededPage: page,
  }) => {
    await activateQaEnvironment(page);
    await page.route("/api/proxy", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      });
    });
    await openPolishChain(page, POLISH_NEVER_RUN);
    await runButton(page).click();
    await collapseButtonIfExpanded(page);
    await expect(collapsedBar(page)).toContainText(/Running/, {
      timeout: LOAD_TIMEOUT_MS,
    });
  });

  test("RUNLOG-2: the whole collapsed bar is one button that click, Enter and Space expand", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, RUN_LOG);
    const bar = collapsedBar(page);
    await expect(bar).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    expect(await bar.evaluate((el) => el.tagName)).toBe("BUTTON");
    await expect(bar).toHaveAttribute("aria-expanded", "false");
    await expect(bar).toHaveAttribute("aria-controls", /.+/);
    // No interactive element is nested inside the collapsed button.
    await expect(
      bar.locator("button, a, input, [role='button'], [tabindex]")
    ).toHaveCount(0);

    await bar.click();
    await expect(expandedHeader(page)).toBeVisible();

    await collapseButton(page).click();
    await collapsedBar(page).focus();
    await page.keyboard.press("Enter");
    await expect(expandedHeader(page)).toBeVisible();

    await collapseButton(page).click();
    await collapsedBar(page).focus();
    await page.keyboard.press("Space");
    await expect(expandedHeader(page)).toBeVisible();
  });

  test("RUNLOG-3: the expanded header shows the run count and its title area collapses the dock", async ({
    seededPage: page,
    snap,
  }) => {
    await openRunLogWithRuns(page);
    const header = expandedHeader(page);
    await expect(header).toContainText("Run Log");
    await expect(header).toContainText(`(${RUN_LOG_RUN_COUNT} runs)`);
    // Clear all runs / Auto-open moved into the options menu.
    await expect(
      header.getByRole("button", { name: "Clear all runs" })
    ).toHaveCount(0);
    await expect(
      header.getByRole("button", { name: "Run Log options" })
    ).toBeVisible();
    await snap("p3-runlog-3-header");

    await header.getByText("Run Log", { exact: true }).click();
    await expect(collapsedBar(page)).toBeVisible();
  });

  test("RUNLOG-4: run cards are two lines with trigger, counts and a deleted-anchor fallback", async ({
    seededPage: page,
    snap,
  }) => {
    await openRunLogWithRuns(page);
    await expect(runCards(page)).toHaveCount(RUN_LOG_RUN_COUNT);

    const failed = runCard(page, "qa-polish-rl-failed");
    await expect(failed).toContainText("Full run");
    await expect(failed).toContainText("1 passed, 2 failed");
    await expect(failed).toContainText("150 ms");
    await expect(failed).toHaveAttribute("aria-selected", "true");
    await expect(failed.getByTestId("run-card-indicator")).toBeVisible();
    // Two lines, line 1 never wraps.
    const title = failed.locator("span[title]").first();
    expect(await title.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe(
      "nowrap"
    );

    await expect(runCard(page, "qa-polish-rl-from")).toContainText(
      'From "QA Failing Request"'
    );
    await expect(runCard(page, "qa-polish-rl-upto")).toContainText(
      'Up to "QA Failing Request"'
    );
    await expect(runCard(page, "qa-polish-rl-single")).toContainText(
      'Only "QA Fast Request"'
    );
    await expect(runCard(page, "qa-polish-rl-deleted-anchor")).toContainText(
      "a deleted node"
    );
    await expect(runCard(page, "qa-polish-rl-zero")).toContainText(
      "No steps recorded"
    );
    await snap("p3-runlog-4-cards");

    // The run cap: 50 runs scroll in the list without growing the dock.
    await openRunLogWithRuns(page, RUN_CAP);
    await expect(runCards(page)).toHaveCount(RUN_CAP_COUNT);
  });

  test("RUNLOG-5: the row menu re-runs, copies and deletes with an undo toast", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const card = runCard(page, "qa-polish-rl-passed");
    await card.hover();
    await card.getByRole("button", { name: "Run options" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Re-run same subset" })
    ).toBeEnabled();
    await expect(
      page.getByRole("menuitem", { name: "Copy run summary" })
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Delete run" }).click();

    await expect(card).toHaveCount(0);
    await expect(runCards(page)).toHaveCount(RUN_LOG_RUN_COUNT - 1);
    const toast = page.getByText("Run deleted");
    await expect(toast).toBeVisible();
    await page.locator("[data-action='true']", { hasText: "Undo" }).click();
    await expect(runCard(page, "qa-polish-rl-passed")).toBeVisible();
    await expect(runCards(page)).toHaveCount(RUN_LOG_RUN_COUNT);

    // Re-run is disabled, with a reason, when the anchor node is gone.
    const orphan = runCard(page, "qa-polish-rl-deleted-anchor");
    await orphan.hover();
    await orphan.getByRole("button", { name: "Run options" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Re-run same subset" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("RUNLOG-6: the run list is a listbox with arrow, Home, End, Enter and Delete keys", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    await expect(
      page.getByRole("listbox", { name: "Run Log" }).first()
    ).toBeVisible();
    const buttonOf = (runId: string) =>
      runCard(page, runId).locator("> button");
    await buttonOf("qa-polish-rl-failed").focus();

    await page.keyboard.press("ArrowDown");
    await expect(buttonOf("qa-polish-rl-passed")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(buttonOf("qa-polish-rl-failed")).toBeFocused();
    await page.keyboard.press("End");
    await expect(buttonOf("qa-polish-rl-single")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(buttonOf("qa-polish-rl-failed")).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(runCard(page, "qa-polish-rl-passed")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // Selecting a run selects its first failed step; a passed run has none, so its first step.
    await expect(stepRow(page, "qa-polish-rl-passed-s1")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.keyboard.press("Delete");
    await expect(runCard(page, "qa-polish-rl-passed")).toHaveCount(0);
    // Focus lands on a neighbouring run rather than vanishing.
    await expect(buttonOf("qa-polish-rl-from")).toBeFocused();
    // Visible focus ring.
    const ring = await buttonOf("qa-polish-rl-from").evaluate((el) => {
      const style = getComputedStyle(el);
      return style.boxShadow !== "none" || style.outlineStyle !== "none";
    });
    expect(ring).toBe(true);
  });

  test("RUNLOG-7: every relative time (cards, summary header, bar) ticks and carries an absolute tooltip", async ({
    seededPage: page,
  }) => {
    await page.clock.install({ time: RUN_LOG_LATEST_STARTED_AT + 5_000 });
    await openRunLogWithRuns(page);
    const cardTime = runCard(page, "qa-polish-rl-failed").locator("time");
    const headerTime = page.getByTestId("run-summary-header").locator("time");
    await expect(cardTime).toHaveText(/\d+ seconds? ago/);
    await expect(headerTime).toHaveText(/\d+ seconds? ago/);
    await expect(cardTime).toHaveAttribute("datetime", /2023-11-1\dT/);

    await page.clock.fastForward(125_000);
    await expect(cardTime).toHaveText(/2 minutes ago/);
    await expect(headerTime).toHaveText(/2 minutes ago/);

    await cardTime.hover();
    await page.clock.fastForward(1_000);
    await expect(
      page.locator('[data-slot="tooltip-content"][data-open]')
    ).toContainText(/Nov 1[45], 2023.*\d{1,2}:\d{2}:\d{2}/);

    await collapseButton(page).click();
    await expect(collapsedBar(page).locator("time")).toHaveText(
      /2 minutes ago/
    );
  });

  test("RUNLOG-8: counts read as words in the card, tabs, header and bar (stopped included)", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    await expect(runCard(page, "qa-polish-rl-skipped")).toContainText(
      "2 passed, 1 skipped"
    );
    await expect(runCard(page, "qa-polish-rl-failed")).toContainText(
      "1 passed, 2 failed"
    );
    const dockText = (await runDock(page).innerText()) ?? "";
    expect(dockText).not.toMatch(/[✓✗]/);

    await runCard(page, "qa-polish-rl-stopped").locator("> button").click();
    await expect(runCard(page, "qa-polish-rl-stopped")).toContainText(
      "1 passed"
    );
    await expect(filterTab(page, /^Failed \d+/)).toBeVisible();
  });

  test("RUNLOG-9: the latest run and its first failed step are auto-selected, and a user choice sticks", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    await expect(runCard(page, "qa-polish-rl-failed")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // First failed step (the 404), not the first step.
    await expect(stepRow(page, "qa-polish-rl-failed-s2")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(stepRow(page, "qa-polish-rl-failed-s1")).toHaveAttribute(
      "aria-selected",
      "false"
    );
    await expect(page.getByRole("tab", { name: "Error" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // An explicit selection survives collapsing and re-expanding the dock.
    await runCard(page, "qa-polish-rl-from").locator("> button").click();
    await collapseButton(page).click();
    await collapsedBar(page).click();
    await expect(runCard(page, "qa-polish-rl-from")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("RUNLOG-10: the summary header names the trigger, start time, duration and step count with a gated Re-run", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const header = page.getByTestId("run-summary-header");
    await expect(header).toContainText("Full run");
    await expect(header).toContainText("Started");
    await expect(header).toContainText("150 ms");
    await expect(header).toContainText("3 steps");
    await expect(
      header.getByRole("button", { name: "Re-run same subset" })
    ).toBeEnabled();

    await runCard(page, "qa-polish-rl-from").locator("> button").click();
    await expect(header).toContainText('From "QA Failing Request"');
    await expect(header).toContainText("2 steps");

    await runCard(page, "qa-polish-rl-deleted-anchor")
      .locator("> button")
      .click();
    await expect(header).toContainText("a deleted node");
    await expect(
      header.getByRole("button", { name: "Re-run same subset" })
    ).toBeDisabled();
    await header.locator("span[tabindex='0']").hover();
    await expect(
      page.locator('[data-slot="tooltip-content"][data-open]')
    ).toContainText("Can't re-run");
  });

  test("RUNLOG-11: count tabs filter the steps, hide empty buckets, and reset when their tab vanishes", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    await expect(filterTab(page, "All 3")).toBeVisible();
    await expect(filterTab(page, "Passed 1")).toBeVisible();
    await expect(filterTab(page, "Failed 2")).toBeVisible();
    // Skipped appears only when n > 0.
    await expect(filterTab(page, /^Skipped \d+$/)).toHaveCount(0);

    await filterTab(page, "Failed 2").click();
    await expect(filterTab(page, "Failed 2")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(stepRows(page)).toHaveCount(2);

    // The passed run has no failures: the Failed tab vanishes and the filter resets.
    await runCard(page, "qa-polish-rl-passed").locator("> button").click();
    await expect(filterTab(page, /^Failed \d+$/)).toHaveCount(0);
    await expect(filterTab(page, "All 3")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(stepRows(page)).toHaveCount(3);

    await runCard(page, "qa-polish-rl-skipped").locator("> button").click();
    await expect(filterTab(page, "Skipped 1")).toBeVisible();
  });

  test("RUNLOG-12: the filter input narrows steps, announces the count, and Esc clears before collapsing", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const input = page.getByPlaceholder("Filter by node label");
    await input.fill("missing");
    await expect(stepRows(page)).toHaveCount(1);
    await expect(
      runDock(page).locator('[role="status"][aria-live="polite"]').first()
    ).toContainText("1 step");

    await input.press("Escape");
    await expect(input).toHaveValue("");
    await expect(stepRows(page)).toHaveCount(3);
    await expect(expandedHeader(page)).toBeVisible();

    await input.press("Escape");
    await expect(collapsedBar(page)).toBeVisible();
  });

  test("RUNLOG-13: step rows align index, method, label, HTTP status and duration, without a Globe or lane dot", async ({
    seededPage: page,
    snap,
  }) => {
    await openRunLogWithRuns(page);
    const row = stepRow(page, "qa-polish-rl-failed-s2");
    await expect(row).toContainText("GET");
    await expect(row).toContainText("GET /missing");
    await expect(row.getByTestId("step-http-status")).toHaveText("404");
    await expect(row).toContainText("40 ms");
    await expect(
      stepRow(page, "qa-polish-rl-failed-s1").getByTestId("step-http-status")
    ).toHaveText("200");
    // API rows carry no node-type icon and a sequential run no lane dots.
    await expect(page.getByTestId("step-type-icon")).toHaveCount(0);
    await expect(page.locator('[data-testid^="step-lane-"]')).toHaveCount(0);
    // Colour by class: 4xx amber vs 2xx green.
    const classOf = (id: string) =>
      stepRow(page, id).getByTestId("step-http-status").getAttribute("class");
    expect(await classOf("qa-polish-rl-failed-s2")).toContain("amber");
    expect(await classOf("qa-polish-rl-failed-s1")).toContain("emerald");
    await snap("p3-runlog-13-step-rows");
  });

  test("RUNLOG-14: failed steps show an inline error line and open the Error tab on click", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const withError = stepRow(page, "qa-polish-rl-failed-s2");
    await expect(withError.getByTestId("step-error-line")).toHaveText(
      "HTTP 404 Not Found: resource does not exist"
    );
    // An assertion-only failure summarizes the failed assertions instead.
    await expect(
      stepRow(page, "qa-polish-rl-failed-s3").getByTestId("step-error-line")
    ).toHaveText("1 assertion failed");
    await expect(
      stepRow(page, "qa-polish-rl-failed-s1").getByTestId("step-error-line")
    ).toHaveCount(0);

    await stepRow(page, "qa-polish-rl-failed-s1").click();
    await expect(page.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await withError.click();
    await expect(page.getByRole("tab", { name: "Error" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("RUNLOG-15: each empty situation shows its own message", async ({
    seededPage: page,
    snap,
  }) => {
    // No runs at all: message plus a Run flow button.
    await openRunLog(page, POLISH_NEVER_RUN);
    const noRuns = page.getByTestId("run-log-empty-noRuns");
    await expect(noRuns).toContainText("No runs yet", {
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(
      noRuns.getByRole("button", { name: "Run flow" })
    ).toBeVisible();
    await snap("p3-runlog-15-no-runs");

    // A zero-step run: steps empty plus the detail placeholder.
    await openRunLogWithRuns(page);
    await runCard(page, "qa-polish-rl-zero").locator("> button").click();
    await expect(runDock(page)).toContainText("This run recorded no steps.");
    await expect(runDock(page)).toContainText(
      "Select a step to see its request and response"
    );

    // Steps exist but the filter matches none.
    await runCard(page, "qa-polish-rl-failed").locator("> button").click();
    await page.getByPlaceholder("Filter by node label").fill("zzz-nothing");
    await expect(runDock(page)).toContainText("No steps match this filter.");
    await expect(runDock(page)).not.toContainText(
      "This run recorded no steps."
    );
    await runDock(page).getByRole("button", { name: "Clear filter" }).click();
    await expect(stepRows(page)).toHaveCount(3);
  });

  test("RUNLOG-16: the columns resize by drag and keys, persist across reload, and reset on double-click", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const list = listSeparator(page);
    await expect(list).toHaveAttribute("aria-orientation", "vertical");
    expect(await separatorValue(list)).toBe(DEFAULT_LIST_WIDTH_PX);

    await dragSeparator(page, list, { dx: 60 });
    const dragged = await separatorValue(list);
    expect(dragged).toBeGreaterThan(DEFAULT_LIST_WIDTH_PX);
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        LIST_WIDTH_STORAGE_KEY
      )
    ).toBe(String(dragged));

    await list.focus();
    await page.keyboard.press("ArrowLeft");
    expect(await separatorValue(list)).toBe(dragged - LIST_WIDTH_KEY_STEP_PX);
    await page.keyboard.press("Home");
    expect(await separatorValue(list)).toBe(MIN_LIST_WIDTH_PX);
    await page.keyboard.press("ArrowRight");
    expect(await separatorValue(list)).toBe(
      MIN_LIST_WIDTH_PX + LIST_WIDTH_KEY_STEP_PX
    );

    const keyed = await separatorValue(list);
    await page.reload({ waitUntil: "commit" });
    await expect(runCards(page).first()).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(await separatorValue(list)).toBe(keyed);

    await list.dblclick();
    expect(await separatorValue(list)).toBe(DEFAULT_LIST_WIDTH_PX);

    // The row divider between steps and detail resizes too, within 25-75%.
    const detail = detailSeparator(page);
    await expect(detail).toHaveAttribute("aria-orientation", "horizontal");
    const before = await separatorValue(detail);
    await detail.focus();
    await page.keyboard.press("End");
    expect(await separatorValue(detail)).toBe(75);
    await page.keyboard.press("Home");
    expect(await separatorValue(detail)).toBe(25);
    await detail.dblclick();
    expect(await separatorValue(detail)).toBe(before);
  });

  test("PERSIST-1: the stored list width clamps to 200-420 and a corrupt value falls back to 288", async ({
    seededPage: page,
  }) => {
    await presetLocalStorage(page, {
      [LIST_WIDTH_STORAGE_KEY]: "50",
      [COLLAPSED_STORAGE_KEY]: "false",
    });
    await openPolishChain(page, RUN_LOG);
    await expect(runCards(page).first()).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(await separatorValue(listSeparator(page))).toBe(MIN_LIST_WIDTH_PX);

    await page.evaluate(
      (key) => localStorage.setItem(key, "banana"),
      LIST_WIDTH_STORAGE_KEY
    );
    await page.reload({ waitUntil: "commit" });
    await expect(runCards(page).first()).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(await separatorValue(listSeparator(page))).toBe(
      DEFAULT_LIST_WIDTH_PX
    );
  });

  test("PERSIST-2: the stored detail ratio clamps to 0.25-0.75 and a corrupt value falls back to 0.5", async ({
    seededPage: page,
  }) => {
    await presetLocalStorage(page, {
      [DETAIL_RATIO_STORAGE_KEY]: "9",
      [COLLAPSED_STORAGE_KEY]: "false",
    });
    await openPolishChain(page, RUN_LOG);
    await expect(runCards(page).first()).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(await separatorValue(detailSeparator(page))).toBe(75);

    await page.evaluate(
      (key) => localStorage.setItem(key, "banana"),
      DETAIL_RATIO_STORAGE_KEY
    );
    await page.reload({ waitUntil: "commit" });
    await expect(runCards(page).first()).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(await separatorValue(detailSeparator(page))).toBe(50);
  });

  test("RUNLOG-17: a dock narrower than 560px swaps the run list for a Select", async ({
    seededPage: page,
    snap,
  }) => {
    await openRunLogWithRuns(page);
    await page.setViewportSize({ width: NARROW_BREAKPOINT_PX, height: 900 });
    await expect(runCards(page).first()).toBeVisible();
    await expect(listSeparator(page)).toBeVisible();

    await page.setViewportSize({
      width: NARROW_BREAKPOINT_PX - 1,
      height: 900,
    });
    const select = page.getByRole("combobox", { name: "Run selection" });
    await expect(select).toBeVisible();
    await expect(listSeparator(page)).toHaveCount(0);
    await expect(runCards(page)).toHaveCount(0);
    await snap("p3-runlog-17-narrow");

    // Picking a run in the select selects it (and its steps).
    await select.click();
    await page.getByRole("option", { name: /Only "QA Fast Request"/ }).click();
    await expect(stepRows(page)).toHaveCount(1);
    await expect(stepRow(page, "qa-polish-rl-single-s1")).toBeVisible();
  });

  test("RUNLOG-18: Copy error and Copy response put the raw text on the clipboard and announce Copied", async ({
    seededPage: page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openRunLogWithRuns(page);
    await expect(page.getByRole("tab", { name: "Error" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.getByRole("button", { name: "Copy error" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "HTTP 404 Not Found: resource does not exist"
    );
    await expect(
      runDock(page).locator('[role="status"]', { hasText: "Copied" })
    ).toBeAttached();

    await stepRow(page, "qa-polish-rl-failed-s1").click();
    await expect(page.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.getByRole("button", { name: "Copy response" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "{}"
    );
  });

  test("RUNLOG-19: selecting a step selects its canvas node; a removed node shows a chip and selects nothing", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    await stepRow(page, "qa-polish-rl-failed-s1").click();
    await expect(canvasNode(page, "qa-req-users")).toHaveClass(/selected/);
    await stepRow(page, "qa-polish-rl-failed-s3").click();
    await expect(canvasNode(page, "qa-req-fast")).toHaveClass(/selected/);
    await expect(canvasNode(page, "qa-req-users")).not.toHaveClass(/selected/);

    await runCard(page, "qa-polish-rl-deleted-anchor")
      .locator("> button")
      .click();
    const orphan = stepRow(page, "qa-polish-rl-deleted-anchor-s1");
    await expect(orphan).toContainText("Node removed");
    await orphan.click();
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(0);
  });

  test("RUNLOG-20: the dock height resizes within 160px to 60% of the viewport and collapses to 32px", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const dock = runDock(page);
    const height = async () => (await dock.boundingBox())?.height ?? 0;
    const handle = dockHeightSeparator(page);

    await handle.focus();
    await page.keyboard.press("Home");
    await expect.poll(height).toBe(MIN_DOCK_HEIGHT_PX);
    await page.keyboard.press("End");
    await expect
      .poll(height)
      .toBeLessThanOrEqual(WIDE_VIEWPORT.height * 0.6 + 1);
    expect(await height()).toBeGreaterThan(MIN_DOCK_HEIGHT_PX);

    await collapseButton(page).click();
    await expect.poll(height).toBe(COLLAPSED_DOCK_HEIGHT_PX);
  });

  test("RUNLOG-21: the footer hides its hints while expanded but keeps the unresolved-variables warning", async ({
    seededPage: page,
  }) => {
    // "Never Run" has a node whose {{baseUrl}} is unresolved without an active env.
    await openPolishChain(page, POLISH_NEVER_RUN);
    const footer = page.locator("footer");
    await expect(footer).toContainText("Drag nodes", {
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(footer).toContainText(/unresolved variable/);

    await collapsedBar(page).click();
    await expect(expandedHeader(page)).toBeVisible();
    await expect(footer).not.toContainText("Drag nodes");
    await expect(footer).toContainText(/unresolved variable/);

    await collapseButton(page).click();
    await expect(footer).toContainText("Drag nodes");
  });

  test("RUNLOG-22: the panel menu toggles auto-open and clears all runs behind a confirmation", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    await runDock(page)
      .getByRole("button", { name: "Run Log options" })
      .click();
    const autoOpen = page.getByRole("menuitemcheckbox", {
      name: "Auto-open on run",
    });
    await expect(autoOpen).toHaveAttribute("aria-checked", "true");
    // A checkbox item keeps the menu open, so the toggle result is visible in place.
    await autoOpen.click();
    await expect(autoOpen).toHaveAttribute("aria-checked", "false");

    await page.getByRole("menuitem", { name: "Clear all runs" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Clear all runs?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(runCards(page)).toHaveCount(RUN_LOG_RUN_COUNT);

    await runDock(page)
      .getByRole("button", { name: "Run Log options" })
      .click();
    await page.getByRole("menuitem", { name: "Clear all runs" }).click();
    await page
      .getByRole("alertdialog", { name: "Clear all runs?" })
      .getByRole("button", { name: "Clear all runs" })
      .click();
    await expect(page.getByTestId("run-log-empty-noRuns")).toBeVisible();
  });

  test("RUNLOG-23: dock text is at least 12px and status and muted text keep 4.5:1 contrast", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const smallest = await runDock(page).evaluate((dock, minPx) => {
      const offenders: string[] = [];
      for (const el of Array.from(dock.querySelectorAll("*"))) {
        const hasOwnText = Array.from(el.childNodes).some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim()
        );
        if (!hasOwnText) continue;
        const size = Number.parseFloat(getComputedStyle(el).fontSize);
        if (size < minPx)
          offenders.push(`${el.textContent?.trim()} (${size}px)`);
      }
      return offenders;
    }, MIN_TEXT_PX);
    expect(smallest).toEqual([]);

    // Contrast of the failed bar's status word and muted summary on the tinted bar.
    await collapseButton(page).click();
    const ratios = await collapsedBar(page).evaluate((bar) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no canvas context");
      const toRgba = (css: string): [number, number, number, number] => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const over = (
        top: [number, number, number, number],
        base: [number, number, number, number]
      ): [number, number, number, number] => {
        const a = top[3] + base[3] * (1 - top[3]);
        const mix = (i: number) =>
          (top[i] * top[3] + base[i] * base[3] * (1 - top[3])) / (a || 1);
        return [mix(0), mix(1), mix(2), a];
      };
      const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (c: number[]) =>
        0.2126 * channel(c[0]) +
        0.7152 * channel(c[1]) +
        0.0722 * channel(c[2]);
      const ratio = (fg: number[], bg: number[]) => {
        const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      // Background: the bar tint over the dock surface over the page background.
      const surface = over(
        toRgba(getComputedStyle(bar.parentElement as Element).backgroundColor),
        toRgba(getComputedStyle(document.body).backgroundColor)
      );
      const background = over(
        toRgba(getComputedStyle(bar).backgroundColor),
        surface
      );
      const spans = Array.from(bar.querySelectorAll(":scope > span"));
      const contrastOf = (needle: string) => {
        const el = spans.find((s) => s.textContent?.includes(needle));
        if (!el) throw new Error(`no bar segment contains ${needle}`);
        const fg = over(toRgba(getComputedStyle(el).color), background);
        return ratio(fg, background);
      };
      return {
        status: contrastOf("Last run failed"),
        counts: contrastOf("passed"),
      };
    });
    expect(ratios.status).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(ratios.counts).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    // Colour is never the only signal: the bar has an icon and the status word.
    await expect(collapsedBar(page).locator("svg").first()).toBeVisible();
  });

  test("RUNLOG-24: a 120-step run mounts a bounded number of rows and still reaches the last one", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page, MANY_STEPS);
    await expect(filterTab(page, `All ${MANY_STEPS_COUNT}`)).toBeVisible();
    const mounted = await stepRows(page).count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(VIRTUALIZED_DOM_ROW_BOUND);

    const listbox = page.getByRole("listbox", { name: "Run Log" }).last();
    await listbox.focus();
    await page.keyboard.press("End").catch(() => undefined);
    await listbox.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(
      stepRow(page, `qa-polish-many-run-s${MANY_STEPS_COUNT}`)
    ).toBeVisible();
    expect(await stepRows(page).count()).toBeLessThan(
      VIRTUALIZED_DOM_ROW_BOUND
    );
  });

  test("RUNLOG-25: Re-run replays the same subset, selects the new live run and returns focus to the top row", async ({
    seededPage: page,
  }) => {
    await activateQaEnvironment(page);
    await mockProxyOk(page);
    await openRunLogWithRuns(page);
    const card = runCard(page, "qa-polish-rl-from");
    await card.hover();
    await card.getByRole("button", { name: "Run options" }).click();
    await page.getByRole("menuitem", { name: "Re-run same subset" }).click();

    await expect(runCards(page)).toHaveCount(RUN_LOG_RUN_COUNT + 1, {
      timeout: LOAD_TIMEOUT_MS,
    });
    const top = runCards(page).first();
    await expect(top).toContainText('From "QA Failing Request"');
    await expect(top).toHaveAttribute("aria-selected", "true");
    await expect(top.locator("> button")).toBeFocused();
  });

  test("RUNLOG-26: a stopped run reads Stopped with its own icon and tone, in the card, header and bar", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const stopped = runCard(page, "qa-polish-rl-stopped");
    await expect(stopped.locator(".sr-only")).toHaveText("Stopped");
    const failedIcon = await runCard(page, "qa-polish-rl-failed")
      .locator("svg")
      .first()
      .getAttribute("class");
    const stoppedIcon = await stopped
      .locator("svg")
      .first()
      .getAttribute("class");
    expect(stoppedIcon).not.toBe(failedIcon);
    expect(stoppedIcon).toContain("amber");
    expect(failedIcon).not.toContain("amber");

    await stopped.locator("> button").click();
    await expect(page.getByTestId("run-summary-header")).toBeVisible();

    // Once it is the latest run, the bar says so too.
    for (const id of [
      "qa-polish-rl-failed",
      "qa-polish-rl-passed",
      "qa-polish-rl-from",
      "qa-polish-rl-upto",
    ]) {
      await deleteRunViaMenu(page, id);
    }
    await collapseButton(page).click();
    await expect(collapsedBar(page)).toContainText("Last run stopped");
  });

  test("RUNLOG-27: the collapsed or expanded state persists across reload, and a run auto-opens a collapsed dock", async ({
    seededPage: page,
  }) => {
    await activateQaEnvironment(page);
    await mockProxyOk(page);
    await openPolishChain(page, RUN_LOG);
    await expect(collapsedBar(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });

    await collapsedBar(page).click();
    await expect(expandedHeader(page)).toBeVisible();
    await page.reload({ waitUntil: "commit" });
    await expect(expandedHeader(page)).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });

    await collapseButton(page).click();
    await page.reload({ waitUntil: "commit" });
    await expect(collapsedBar(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });

    await runButton(page).click();
    await expect(expandedHeader(page)).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
  });

  test("RUNLOG-28: the dock is a named region and its parts follow header, list, filters, steps, detail order", async ({
    seededPage: page,
  }) => {
    await openRunLogWithRuns(page);
    const region = page.getByRole("region", { name: "Run Log" });
    await expect(region).toBeVisible();
    await expect(listSeparator(page)).toHaveAccessibleName("Resize runs list");
    await expect(detailSeparator(page)).toHaveAccessibleName(
      "Resize step detail"
    );

    const order = await region.evaluate((dock) => {
      const find = (selector: string) => dock.querySelector(selector);
      const parts = {
        header: find('[data-testid="run-log-header"]'),
        runs: find('[role="listbox"]'),
        filters: find("button[aria-pressed]"),
        steps: find("[data-step-id]")?.closest('[role="listbox"]') ?? null,
        detail: find('[role="tablist"]'),
      };
      const names = Object.keys(parts) as (keyof typeof parts)[];
      const missing = names.filter((name) => !parts[name]);
      const sorted = [...names].sort((a, b) => {
        const left = parts[a];
        const right = parts[b];
        if (!left || !right) return 0;
        return left.compareDocumentPosition(right) &
          Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      });
      const positiveTabIndex = Array.from(
        dock.querySelectorAll("[tabindex]")
      ).filter((el) => Number(el.getAttribute("tabindex")) > 0).length;
      return { missing, sorted, positiveTabIndex };
    });
    expect(order.missing).toEqual([]);
    expect(order.sorted).toEqual([
      "header",
      "runs",
      "filters",
      "steps",
      "detail",
    ]);
    expect(order.positiveTabIndex).toBe(0);
  });
});

/** Collapses the dock when a run's auto-open expanded it, so the bar can be asserted. */
async function collapseButtonIfExpanded(page: Page) {
  const button = collapseButton(page);
  if (await button.isVisible()) await button.click();
}

// ---------------------------------------------------------------------------
// Phase 4 — Add API dialog, browse half (seed: e2e/fixtures/seed/chain-polish-picker.json).
// ---------------------------------------------------------------------------

const PK_CHAIN = "qa-pk-chain";
const PK_NESTED = "qa-pk-nested";
const PK_EMPTY = "qa-pk-empty";
const PK_BULK = "qa-pk-bulk";
const PK_SYNTHETIC = "qa-pk-synthetic";
const PK_LONG_URL_REQUEST = "qa-pk-long-url";
const PK_LONG_URL = `https://api.example.com/${"very-long-segment-".repeat(
  22
)}end`;
const PK_PICKER_TAB_KEY = "rq_chain_picker_tab";
const PK_MAX_DOM_ROWS = 80;
const PK_MOBILE_VIEWPORT = { width: 360, height: 800 };
const PK_DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const PK_SYNTHETIC_SMALL = 600;
const PK_SYNTHETIC_LARGE = 1500;
const PK_EXPAND_BUDGET_MS = 3_000;
const PK_OPEN_BUDGET_MS = 3_000;
const PK_HYDRATION_DELAY_MS = 1_500;

const pkDialog = (page: Page) => page.getByTestId("api-picker-dialog");
const pkTree = (page: Page) => page.getByTestId("picker-tree");
const pkRows = (page: Page) => page.locator('[data-testid^="picker-row-"]');
const pkRow = (page: Page, id: string) => page.getByTestId(`picker-row-${id}`);
const pkHeader = (page: Page, id: string) =>
  page.getByTestId(`picker-header-${id}`);
const pkExpandToggle = (page: Page) => page.getByTestId("picker-expand-toggle");

/** Opens the seeded picker chain and its Add API dialog (Collections tab by default). */
async function openPicker(page: Page) {
  await openPolishChain(page, PK_CHAIN);
  await openPickerDialog(page);
  await expect(page.getByTestId("picker-search")).toBeVisible();
}

async function expandAll(page: Page) {
  const toggle = pkExpandToggle(page);
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toContainText("Collapse all");
}

/** Writes one extra record into an app IndexedDB store; the next load hydrates it. */
async function putIdbRecord(page: Page, store: string, record: object) {
  await page.evaluate(
    ({ dbName, storeName, value }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(value);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, storeName: store, value: record }
  );
}

async function clearIdbStore(page: Page, store: string) {
  await page.evaluate(
    ({ dbName, storeName }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, storeName: store }
  );
}

/** Loads the chain once so the seed lands, then writes data and reloads so the stores hydrate it. */
async function seedThenReload(page: Page, write: () => Promise<void>) {
  await openPolishChain(page, PK_CHAIN);
  await write();
  await page.reload({ waitUntil: "commit" });
  await expect(page.getByTestId("chain-request-count")).toBeVisible({
    timeout: LOAD_TIMEOUT_MS,
  });
}

async function openPickerDialog(page: Page) {
  const item = page.getByTestId("block-menu-item-api");
  // The canvas can still be hydrating right after a reload and swallow the first trigger click.
  await expect(async () => {
    if (!(await item.isVisible())) {
      await page.getByTestId("block-menu-trigger").click();
    }
    await expect(item).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: LOAD_TIMEOUT_MS });
  await item.click();
  await expect(pkDialog(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
}

test.describe("Chain UI polish — P4 browse @qa", () => {
  for (const viewport of [PK_MOBILE_VIEWPORT, PK_DESKTOP_VIEWPORT]) {
    test(`PICKER-1: a 400-char URL truncates with a tooltip and never scrolls horizontally at ${viewport.width}px`, async ({
      seededPage: page,
      snap,
    }) => {
      await page.setViewportSize(viewport);
      await seedThenReload(page, () =>
        putIdbRecord(page, "requests", {
          id: PK_LONG_URL_REQUEST,
          collectionId: PK_NESTED,
          folderId: null,
          name: "Long URL Request",
          method: "GET",
          url: PK_LONG_URL,
          params: [],
          headers: [],
          auth: { type: "none" },
          body: { type: "none", content: "" },
          preScript: "",
          postScript: "",
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        })
      );
      expect(PK_LONG_URL.length).toBeGreaterThanOrEqual(400);
      await openPickerDialog(page);
      await page.getByTestId("picker-search").fill("Long URL Request");
      const row = pkRow(page, PK_LONG_URL_REQUEST);
      await expect(row).toBeVisible({ timeout: LOAD_TIMEOUT_MS });

      const urlText = row.locator(`span[title="${PK_LONG_URL}"]`);
      await expect(urlText).toBeVisible();
      const truncated = await urlText.evaluate(
        (el) => el.scrollWidth > el.clientWidth
      );
      expect(truncated).toBe(true);

      const overflow = await pkDialog(page).evaluate((dialog) => {
        const tree = dialog.querySelector('[data-testid="picker-tree"]');
        return {
          dialog: dialog.scrollWidth - dialog.clientWidth,
          tree: tree ? tree.scrollWidth - tree.clientWidth : -1,
        };
      });
      expect(overflow.dialog).toBeLessThanOrEqual(0);
      expect(overflow.tree).toBeLessThanOrEqual(0);
      const box = await pkDialog(page).boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width
      );
      await snap(`p4-picker-1-overflow-${viewport.width}`);
    });
  }

  test("PICKER-2: the three tabs are labelled and arrow keys switch them", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await expect(page.getByTestId("picker-tab-collections")).toHaveText(
      "Collections"
    );
    await expect(page.getByTestId("picker-tab-history")).toHaveText("History");
    await expect(page.getByTestId("picker-tab-new")).toHaveText("New request");
    await expect(page.getByTestId("picker-tab-collections")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByTestId("picker-tab-collections").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("picker-tab-history")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.getByTestId("picker-tab-history").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("picker-tab-new")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("PICKER-2: the last selected tab is persisted across a reload", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await page.getByTestId("picker-tab-history").click();
    await expect(page.getByTestId("picker-tab-history")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      await page.evaluate((key) => localStorage.getItem(key), PK_PICKER_TAB_KEY)
    ).toContain("history");

    await page.reload({ waitUntil: "commit" });
    await expect(page.getByTestId("chain-request-count")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await openPickerDialog(page);
    await expect(page.getByTestId("picker-tab-history")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("picker-tab-collections")).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  test("PICKER-3: search ANDs tokens, highlights matches and offers a clear action on no results", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    const search = page.getByTestId("picker-search");
    await expect(search).toBeFocused();

    await search.fill("a1x");
    await expect(pkRow(page, "qa-pk-n-a1x")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(pkRow(page, "qa-pk-n-root")).toHaveCount(0);
    await expect(
      pkRow(page, "qa-pk-n-a1x").locator("mark").first()
    ).toBeVisible();

    await search.fill("nested root");
    await expect(pkRow(page, "qa-pk-n-root")).toBeVisible();
    await expect(pkRow(page, "qa-pk-n-a")).toHaveCount(0);

    await search.fill("nested zzzqqq");
    await expect(page.getByTestId("picker-no-results")).toContainText(
      "nested zzzqqq"
    );
    await page.getByTestId("picker-clear-search").click();
    await expect(search).toHaveValue("");
    await expect(page.getByTestId("picker-no-results")).toHaveCount(0);
  });

  test("PICKER-3: a cURL query shows a suggestion that opens New request prefilled", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    const curl = "curl -X POST https://api.example.com/orders";
    await page.getByTestId("picker-search").fill(curl);
    const suggestion = page.getByTestId("picker-suggestion");
    await expect(suggestion).toContainText("cURL");
    await suggestion.click();
    await expect(page.getByTestId("picker-tab-new")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("picker-new-curl")).toHaveValue(curl);
  });

  test("PICKER-3: a URL query shows a URL suggestion", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await page.getByTestId("picker-search").fill("https://api.example.com/x");
    await expect(page.getByTestId("picker-suggestion")).toContainText(
      "https://api.example.com/x"
    );
  });

  test("PICKER-4: method chips show counts, combine with search and disable at zero matches", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      await expect(page.getByTestId(`picker-method-${method}`)).toBeVisible();
    }
    // 150 bulk requests are 30 per method; other seeded collections (incl. chain-e2e) add a few more.
    await expect(page.getByTestId("picker-method-POST")).toContainText(/POST\s*3\d/);
    await expect(page.getByTestId("picker-method-PATCH")).toContainText(/30/);

    await page.getByTestId("picker-method-PATCH").click();
    await expect(page.getByTestId("picker-method-PATCH")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("picker-filter-clear")).toBeVisible();
    await expandAll(page);
    await expect(pkRows(page).first()).toBeVisible();
    const methods = await pkRows(page).evaluateAll((rows) =>
      rows.map((row) => row.textContent ?? "")
    );
    expect(methods.length).toBeGreaterThan(0);
    for (const text of methods) expect(text).toMatch(/PATCH/i);

    await page.getByTestId("picker-filter-clear").click();
    await expect(page.getByTestId("picker-method-PATCH")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    // Search ANDs with the chips: a lone GET match leaves every other chip empty and disabled.
    await page.getByTestId("picker-search").fill("Nested Root");
    await expect(page.getByTestId("picker-method-POST")).toBeDisabled();
    await expect(page.getByTestId("picker-method-POST")).toBeVisible();
    await expect(page.getByTestId("picker-method-GET")).toBeEnabled();
  });

  test("PICKER-5: nested folders keep their hierarchy, corrupt parents become roots, empty collections cannot expand", async ({
    seededPage: page,
    snap,
  }) => {
    await openPicker(page);
    const level = async (id: string) =>
      Number(await pkHeader(page, id).getAttribute("aria-level"));

    // Expand one level at a time: Expand all would push this collection out of the virtual window.
    await pkHeader(page, `collection:${PK_NESTED}`).click();
    for (const folderId of ["qa-pk-f-a", "qa-pk-f-b", "qa-pk-f-orphan"]) {
      await pkHeader(page, `folder:${folderId}`).click();
    }
    await pkHeader(page, "folder:qa-pk-f-a1").click();
    await pkHeader(page, "folder:qa-pk-f-a1x").click();
    await expect(pkRow(page, "qa-pk-n-a1x")).toBeVisible();
    const collectionLevel = await level(`collection:${PK_NESTED}`);
    expect(await level("folder:qa-pk-f-a")).toBe(collectionLevel + 1);
    expect(await level("folder:qa-pk-f-a1")).toBe(collectionLevel + 2);
    expect(await level("folder:qa-pk-f-a1x")).toBe(collectionLevel + 3);
    expect(await level("folder:qa-pk-f-b")).toBe(collectionLevel + 1);
    // `parentFolderId` points at a missing id: the folder renders as a root-level folder.
    await expect(pkHeader(page, "folder:qa-pk-f-orphan")).toBeVisible();
    expect(await level("folder:qa-pk-f-orphan")).toBe(collectionLevel + 1);

    // Requests sit under their own folder, never mixed into a sibling.
    const order = await pkTree(page).evaluate((tree) =>
      Array.from(
        tree.querySelectorAll(
          '[data-testid^="picker-header-"], [data-testid^="picker-row-"]'
        )
      ).map((el) => el.getAttribute("data-testid") ?? "")
    );
    const indexOf = (testId: string) => order.indexOf(testId);
    expect(indexOf("picker-header-folder:qa-pk-f-a1")).toBeGreaterThan(
      indexOf("picker-header-folder:qa-pk-f-a")
    );
    expect(indexOf("picker-header-folder:qa-pk-f-a1x")).toBeGreaterThan(
      indexOf("picker-header-folder:qa-pk-f-a1")
    );
    expect(indexOf("picker-row-qa-pk-n-a1x")).toBeGreaterThan(
      indexOf("picker-header-folder:qa-pk-f-a1x")
    );
    expect(indexOf("picker-row-qa-pk-n-a1x")).toBeLessThan(
      indexOf("picker-header-folder:qa-pk-f-b")
    );
    expect(indexOf("picker-row-qa-pk-n-b")).toBeGreaterThan(
      indexOf("picker-header-folder:qa-pk-f-b")
    );

    // An empty collection is muted, non-expandable and says so.
    const empty = pkHeader(page, `collection:${PK_EMPTY}`);
    await expect(empty).toBeVisible();
    await expect(empty).not.toHaveAttribute("aria-expanded", /.*/);
    await snap("p4-picker-5-tree");

    await page.getByTestId("picker-search").fill("Nested");
    await expect(pkHeader(page, `collection:${PK_NESTED}`)).toBeVisible();
    await expect(pkHeader(page, `collection:${PK_EMPTY}`)).toHaveCount(0);
  });

  test("PICKER-6: everything starts collapsed, Collapse all collapses, and clearing search restores expansion", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await expect(pkHeader(page, `collection:${PK_NESTED}`)).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(pkHeader(page, `collection:${PK_NESTED}`)).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(pkRows(page)).toHaveCount(0);
    await expect(pkExpandToggle(page)).toContainText("Expand all");

    await expandAll(page);
    await expect(pkRows(page).first()).toBeVisible();
    // Nested sits below the expanded 150-request collection, outside the virtual window.
    expect(
      Number(await pkTree(page).getAttribute("data-expanded-count"))
    ).toBeGreaterThan(1);
    await pkExpandToggle(page).click();
    await expect(pkExpandToggle(page)).toContainText("Expand all");
    await expect(pkRows(page)).toHaveCount(0);
    await expect(pkTree(page)).toHaveAttribute("data-expanded-count", "0");
    await expect(pkHeader(page, `collection:${PK_NESTED}`)).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    // A search auto-expands matching branches and shows `visible/total` counts...
    await page.getByTestId("picker-search").fill("a1x");
    await expect(pkRow(page, "qa-pk-n-a1x")).toBeVisible();
    await expect(pkHeader(page, `collection:${PK_NESTED}`)).toContainText(
      /1\/6/
    );
    // ...and clearing it restores the prior (collapsed) state.
    await page.getByTestId("picker-search").fill("");
    await expect(pkRows(page)).toHaveCount(0);
    await expect(pkHeader(page, `collection:${PK_NESTED}`)).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  test("PICKER-6: expanding a single collection by click shows its rows and keeps others collapsed", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await pkHeader(page, `collection:${PK_NESTED}`).click();
    await expect(pkHeader(page, "folder:qa-pk-f-a")).toBeVisible();
    await expect(pkRow(page, "qa-pk-n-root")).toBeVisible();
    await expect(pkRow(page, "qa-pk-bulk-001")).toHaveCount(0);
  });

  test("PICKER-7: the 150-request collection renders fewer than 80 DOM rows and scrolls", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await pkHeader(page, `collection:${PK_BULK}`).click();
    await expect(pkRow(page, "qa-pk-bulk-001")).toBeVisible();
    expect(await pkRows(page).count()).toBeLessThan(PK_MAX_DOM_ROWS);

    await pkTree(page).evaluate((tree) => {
      tree.scrollTop = tree.scrollHeight;
    });
    await expect(pkRow(page, "qa-pk-bulk-150")).toBeVisible();
    await expect(pkRow(page, "qa-pk-bulk-001")).toHaveCount(0);
    expect(await pkRows(page).count()).toBeLessThan(PK_MAX_DOM_ROWS);
  });

  for (const count of [PK_SYNTHETIC_SMALL, PK_SYNTHETIC_LARGE]) {
    test(`PICKER-7: Expand all on ${count} synthetic requests stays virtualized and non-blocking`, async ({
      seededPage: page,
    }) => {
      await seedThenReload(page, async () => {
        await putIdbRecord(page, "collections", {
          id: PK_SYNTHETIC,
          name: "QA Picker - Synthetic",
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        });
        await seedSyntheticRequests(page, count);
      });
      await openPickerDialog(page);
      await expect(pkHeader(page, `collection:${PK_SYNTHETIC}`)).toBeVisible({
        timeout: LOAD_TIMEOUT_MS,
      });

      const started = Date.now();
      await expandAll(page);
      await expect(pkRows(page).first()).toBeVisible();
      expect(Date.now() - started).toBeLessThan(PK_EXPAND_BUDGET_MS);
      expect(await pkRows(page).count()).toBeLessThan(PK_MAX_DOM_ROWS);

      await pkTree(page).evaluate((tree) => {
        tree.scrollTop = tree.scrollHeight;
      });
      await expect(pkRows(page).first()).toBeVisible();
      expect(
        await pkTree(page).evaluate((tree) => tree.scrollTop)
      ).toBeGreaterThan(0);
      expect(await pkRows(page).count()).toBeLessThan(PK_MAX_DOM_ROWS);
    });
  }

  test("PICKER-9: a request row shows checkbox, method, name, URL path and toggles selection on click", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await pkHeader(page, `collection:${PK_NESTED}`).click();
    const row = pkRow(page, "qa-pk-n-root");
    await expect(row).toBeVisible();
    await expect(row.locator('[data-slot="checkbox"]')).toBeVisible();
    await expect(row).toContainText("GET");
    await expect(row).toContainText("Nested Root Request");
    await expect(row).toContainText("https://api.example.com/root");
    await expect(
      row.locator('span[title="https://api.example.com/root"]')
    ).toBeVisible();
    expect(await row.evaluate((el) => el.getBoundingClientRect().height)).toBe(
      36
    );

    await row.click();
    await expect(row).toHaveAttribute("aria-selected", "true");
    await expect(row).toHaveAttribute("data-selected", "true");
    await row.click();
    await expect(row).toHaveAttribute("aria-selected", "false");
  });

  test("PICKER-9: the keyboard-active row is distinct and exposed through aria-activedescendant", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await pkHeader(page, `collection:${PK_NESTED}`).click();
    await expect(pkRow(page, "qa-pk-n-root")).toBeVisible();
    await pkTree(page).focus();
    await page.keyboard.press("ArrowDown");
    const activeId = await pkTree(page).getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    const active = page.locator(`[id="${activeId}"]`);
    await expect(active).toBeVisible();
    await expect(active).toHaveClass(/ring-2/);
  });

  test("PICKER-13: History groups entries under day headers and dedupes identical method+URL", async ({
    seededPage: page,
    snap,
  }) => {
    await openPicker(page);
    await page.getByTestId("picker-tab-history").click();
    const headers = page.locator('[data-testid^="picker-header-day:"]');
    await expect(headers).toHaveCount(3, { timeout: LOAD_TIMEOUT_MS });

    // Seed has 7 entries; GET /users x3 and POST /orders x2 collapse to their latest entry each.
    await expect(pkRows(page)).toHaveCount(4);
    await expect(
      pkRow(page, "qa-pk-h1").or(pkRow(page, "qa-pk-h2"))
    ).toHaveCount(1);
    await expect(pkRow(page, "qa-pk-h4")).toHaveCount(0);
    await expect(pkRow(page, "qa-pk-h5")).toContainText("DELETE");
    await expect(pkRow(page, "qa-pk-h7")).toContainText("health");

    await page.getByTestId("picker-search").fill("health");
    await expect(pkRows(page)).toHaveCount(1);
    await snap("p4-picker-13-history");
  });

  test("PICKER-13: an empty history shows the empty state without crashing", async ({
    seededPage: page,
  }) => {
    await seedThenReload(page, () => clearIdbStore(page, "history"));
    await openPickerDialog(page);
    await page.getByTestId("picker-tab-history").click();
    await expect(page.getByTestId("picker-history-empty")).toContainText(
      "No history yet"
    );
    await expect(pkRows(page)).toHaveCount(0);
  });

  test("PICKER-18: collections hydrate behind a skeleton and settle without an error row", async ({
    seededPage: page,
  }) => {
    // Hold back the collections read so the pre-hydration skeleton is observable.
    await page.addInitScript((delayMs) => {
      const original = IDBObjectStore.prototype.getAll;
      IDBObjectStore.prototype.getAll = function (...args) {
        const request = original.apply(this, args);
        if (this.name !== "collections") return request;
        const add = request.addEventListener.bind(request);
        request.addEventListener = ((
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions
        ) =>
          add(
            type,
            (event: Event) =>
              setTimeout(
                () =>
                  typeof listener === "function"
                    ? listener(event)
                    : listener.handleEvent(event),
                delayMs
              ),
            options
          )) as typeof request.addEventListener;
        return request;
      };
    }, PK_HYDRATION_DELAY_MS);
    await page.goto(`/chain/${PK_CHAIN}`);
    await expect(page.getByTestId("block-menu-trigger")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await openPickerDialog(page);
    await expect(page.getByTestId("picker-skeleton")).toBeVisible();
    await expect(pkHeader(page, `collection:${PK_NESTED}`)).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(page.getByTestId("picker-skeleton")).toHaveCount(0);
    await expect(page.getByTestId("picker-error")).toHaveCount(0);
  });

  test("PICKER-21: opening with 1,500 requests is quick and typing searches without blocking", async ({
    seededPage: page,
  }) => {
    await seedThenReload(page, async () => {
      await putIdbRecord(page, "collections", {
        id: PK_SYNTHETIC,
        name: "QA Picker - Synthetic",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      });
      await seedSyntheticRequests(page, PK_SYNTHETIC_LARGE);
    });
    await openPickerDialog(page);
    // Time only the tree's first render: menu navigation and dialog mount are not the flatten cost.
    const started = Date.now();
    await expect(pkHeader(page, `collection:${PK_SYNTHETIC}`)).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(Date.now() - started).toBeLessThan(PK_OPEN_BUDGET_MS);

    const search = page.getByTestId("picker-search");
    await search.pressSequentially("Synthetic Request 1499", { delay: 10 });
    await expect(pkRow(page, `qa-synth-${PK_SYNTHETIC}-1499`)).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    expect(await pkRows(page).count()).toBeLessThan(PK_MAX_DOM_ROWS);
    await expect(page.getByTestId("picker-result-announcement")).toContainText(
      /1 result/
    );
  });

  test("PICKER-22: the dialog is named and described and announces result and selection counts", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    const dialog = pkDialog(page);
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAccessibleName("Add API Request");
    const describedBy = await dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).not.toBeEmpty();

    const announcement = page.getByTestId("picker-result-announcement");
    await expect(announcement).toHaveAttribute("aria-live", "polite");
    await page.getByTestId("picker-search").fill("Nested");
    await expect(announcement).toHaveText(/\d+ results?/);

    const selected = page.getByTestId("picker-selected-count");
    await expect(selected).toHaveAttribute("aria-live", "polite");
    await expect(selected).toContainText("0 selected");
    await pkRow(page, "qa-pk-n-root").click();
    await expect(selected).toContainText("1 selected");
  });

  test("PICKER-23: every documented test id is present", async ({
    seededPage: page,
  }) => {
    await openPicker(page);
    await expect(pkDialog(page)).toBeVisible();
    for (const testId of [
      "picker-search",
      "picker-tab-collections",
      "picker-tab-history",
      "picker-tab-new",
      "picker-expand-toggle",
      "picker-add-selected",
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      await expect(page.getByTestId(`picker-method-${method}`)).toBeVisible();
    }
    await pkHeader(page, `collection:${PK_NESTED}`).click();
    await expect(pkRow(page, "qa-pk-n-root")).toBeVisible();

    await page.getByTestId("picker-tab-new").click();
    await page.getByTestId("picker-new-mode-curl").click();
    await page.getByTestId("picker-new-curl").fill("curl -X");
    await expect(page.getByTestId("picker-curl-error")).toBeVisible();
    await expect(page.getByTestId("picker-new-request-submit")).toBeVisible();
    await expect(page.getByTestId("picker-new-request-submit")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Phase 4 (part 2) — Add API dialog: adding, placement and creating requests.
// Seeded by e2e/fixtures/seed/chain-polish-picker.json (see PICKER-* in
// agent_docs/chain-ui-polish-spec.md). Helpers are prefixed `pk` to stay
// independent from the browse describe's helpers.
// ---------------------------------------------------------------------------

const PA_CHAIN = "qa-pk-chain";
const PA_IN_CHAIN_ONE = "qa-pk-c-1";
const PA_IN_CHAIN_TWO = "qa-pk-c-2";
const PA_NOT_IN_CHAIN = "qa-pk-c-3";
const PA_CHAIN_COLLECTION = "qa-pk-chain-col";
const PA_NESTED = "qa-pk-nested";
const PA_BULK = "qa-pk-bulk";
const PA_NESTED_NAME = "QA Picker - Nested";
const PA_BULK_NAME = "QA Picker - 150 Requests";
const PA_SELECTION_CAP = 100;
const PA_STACK_GAP_Y = 140;
const PA_AFTER_NODE_OFFSET_X = 320;
const PA_RIGHT_OF_BOUNDS_GAP = 80;
/** Seeded flow positions of the chain's two existing nodes (seed `qa-pk-chain`). */
const PA_NODE_ONE_POSITION = { x: 100, y: 100 };
const PA_NODE_TWO_POSITION = { x: 400, y: 100 };
const PA_POSITION_TOLERANCE = 2;
const PA_CLEAR_PANE_X = 120;
const PA_CLEAR_PANE_BOTTOM_GAP = 60;
const PA_DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const PA_NODE_WIDTH_ESTIMATE = 560; // mirrors NODE_WIDTH_ESTIMATE in src/lib/nodePlacement.ts
// The collection name contains "150", so match the request through its URL instead.
const PA_LAST_BULK_URL_QUERY = "bulk/150";
const PA_VIEWPORT_SETTLE_MS = 300;
const PA_PERSIST_TIMEOUT_MS = 5_000;
const PA_EXTRA_FOLDER_COUNT = 9;
const PA_RECENT_MAX = 5;
const PA_ORDERS_CURL =
  'curl -X POST https://api.example.com/orders \\\n  -H "Content-Type: application/json" \\\n  -d \'{"sku":1}\'';

type PaPoint = { x: number; y: number };

const paDialog = (page: Page) => page.getByTestId("api-picker-dialog");
const paSearchInput = (page: Page) => page.getByTestId("picker-search");
const paTree = (page: Page) => page.getByTestId("picker-tree");
const paSelectedCount = (page: Page) =>
  page.getByTestId("picker-selected-count");
const paAddSelected = (page: Page) => page.getByTestId("picker-add-selected");
const paRow = (page: Page, requestId: string) =>
  page.getByTestId(`picker-row-${requestId}`);
const paCollectionHeader = (page: Page, collectionId: string) =>
  page.getByTestId(`picker-header-collection:${collectionId}`);
const paFlowNode = (page: Page, nodeId: string) =>
  page.locator(`.react-flow__node[data-id="${nodeId}"]`);
const paCanvas = (page: Page) =>
  page.locator('[aria-label^="Request chain canvas"]');

async function paOpenViaToolbar(page: Page) {
  await page.getByTestId("block-menu-trigger").click();
  await page.getByTestId("block-menu-item-api").click();
  await expect(paDialog(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
}

async function paOpenPickerChain(page: Page, chainId = PA_CHAIN) {
  await openPolishChain(page, chainId);
  await expect(nodeCount(page).first()).toBeVisible({
    timeout: LOAD_TIMEOUT_MS,
  });
}

async function paExpandCollection(page: Page, collectionId: string) {
  const header = paCollectionHeader(page, collectionId);
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") {
    await header.click();
  }
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

/** Tab from the search box to the tree, the way a keyboard-only user would. */
async function paTabToTree(page: Page) {
  const maxTabs = 12;
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? null
    );
    if (focused === "picker-tree") return;
  }
  throw new Error("picker tree never received keyboard focus");
}

async function paActiveRowDomId(page: Page) {
  return paTree(page).getAttribute("aria-activedescendant");
}

/** Arrow-Down until the active descendant is the given row, so the test never hard-codes tree order. */
async function paArrowDownTo(page: Page, rowId: string) {
  const maxSteps = 40;
  for (let i = 0; i < maxSteps; i++) {
    if ((await paActiveRowDomId(page)) === `picker-row-dom-${rowId}`) return;
    await page.keyboard.press("ArrowDown");
  }
  throw new Error(`active row never reached ${rowId}`);
}

async function paSelectRows(page: Page, requestIds: string[]) {
  for (const id of requestIds) await paRow(page, id).click();
  await expect(paSelectedCount(page)).toHaveText(
    `${requestIds.length} selected`
  );
}

/** Bulk rows beyond the first screen are virtualized, so find each by name; the selection survives searching. */
async function paSelectBulk(page: Page, numbers: number[]) {
  for (const n of numbers) {
    const label = String(n).padStart(3, "0");
    await paSearchInput(page).fill(label);
    await paRow(page, `qa-pk-bulk-${label}`).click();
  }
  await paSearchInput(page).fill("");
  await expect(paSelectedCount(page)).toHaveText(`${numbers.length} selected`);
}

/** A pane point near the bottom-left, clear of nodes after the canvas refits. */
async function paClearPanePoint(page: Page): Promise<PaPoint> {
  const pane = await paneOrigin(page);
  return { x: PA_CLEAR_PANE_X, y: pane.height - PA_CLEAR_PANE_BOTTOM_GAP };
}

/** The canvas refits (animated) after an add; wait for the transform to settle before measuring. */
async function paWaitViewportStable(page: Page) {
  const read = () =>
    page
      .locator(".react-flow__viewport")
      .evaluate((el) => getComputedStyle(el).transform);
  let previous = await read();
  await expect
    .poll(async () => {
      await page.waitForTimeout(PA_VIEWPORT_SETTLE_MS);
      const current = await read();
      const settled = current === previous;
      previous = current;
      return settled;
    })
    .toBe(true);
}

async function paNodeBox(page: Page, nodeId: string) {
  const box = await paFlowNode(page, nodeId).boundingBox();
  if (!box) throw new Error(`node ${nodeId} has no geometry`);
  return box;
}

/** Reads the chain record straight from IndexedDB so placement is asserted in flow coordinates. */
async function paChainRecord(page: Page, chainId: string) {
  return page.evaluate(
    (id) =>
      new Promise<{
        nodeIds: string[];
        edges: {
          sourceRequestId: string;
          targetRequestId: string;
          branchId?: string;
        }[];
        nodePositions: Record<string, { x: number; y: number }>;
      } | null>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction("chains").objectStore("chains").get(id);
          get.onsuccess = () => {
            db.close();
            resolve(get.result ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    chainId
  );
}

async function paNodePositions(page: Page, chainId: string) {
  const positions: Record<string, PaPoint> = {};
  await expect
    .poll(
      async () => {
        const record = await paChainRecord(page, chainId);
        Object.assign(positions, record?.nodePositions ?? {});
        return record?.nodeIds.length ?? 0;
      },
      { timeout: PA_PERSIST_TIMEOUT_MS }
    )
    .toBeGreaterThan(0);
  return positions;
}

/** Waits for the persisted chain to hold exactly `count` request ids, then returns it. */
async function paChainAfterPersist(
  page: Page,
  chainId: string,
  nodeIdCount: number
) {
  await expect
    .poll(async () => (await paChainRecord(page, chainId))?.nodeIds.length, {
      timeout: PA_PERSIST_TIMEOUT_MS,
    })
    .toBe(nodeIdCount);
  const record = await paChainRecord(page, chainId);
  if (!record) throw new Error(`chain ${chainId} missing from IndexedDB`);
  return record;
}

async function paIdbAll<T>(page: Page, storeName: string) {
  return page.evaluate(
    (store) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction(store).objectStore(store).getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result);
          };
          all.onerror = () => reject(all.error);
        };
      }),
    storeName
  ) as Promise<T[]>;
}

async function paIdbPut(page: Page, storeName: string, records: unknown[]) {
  await page.evaluate(
    ({ store, items }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(store, "readwrite");
          for (const item of items) tx.objectStore(store).put(item);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { store: storeName, items: records }
  );
}

async function paIdbClear(page: Page, storeNames: string[]) {
  await page.evaluate(
    (stores) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(stores, "readwrite");
          for (const store of stores) tx.objectStore(store).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    storeNames
  );
}

type PaRequestRecord = {
  id: string;
  name: string;
  method: string;
  url: string;
  collectionId: string;
  folderId: string | null;
};

async function paRequestsByName(page: Page, name: string) {
  const all = await paIdbAll<PaRequestRecord>(page, "requests");
  return all.filter((request) => request.name === name);
}

/** Screen point -> React Flow coordinates, from the live viewport transform. */
async function paScreenToFlow(page: Page, screen: PaPoint): Promise<PaPoint> {
  const pane = await paneOrigin(page);
  const matrix = await page.locator(".react-flow__viewport").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { a: m.a, d: m.d, e: m.e, f: m.f };
  });
  return {
    x: (screen.x - pane.x - matrix.e) / matrix.a,
    y: (screen.y - pane.y - matrix.f) / matrix.d,
  };
}

function paExpectNear(actual: PaPoint, expected: PaPoint) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(
    PA_POSITION_TOLERANCE
  );
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(
    PA_POSITION_TOLERANCE
  );
}

/** Seeds history entries that link back to saved requests, so the Recent group has content. */
function paHistoryFor(requestId: string, index: number) {
  const url = `https://api.example.com/recent/${requestId}`;
  return {
    id: `qa-pk-recent-${index}`,
    method: "GET",
    url,
    status: 200,
    duration: 10,
    size: 10,
    timestamp: Date.now() - index * 1_000,
    request: {
      tabId: `qa-pk-recent-tab-${index}`,
      requestId,
      name: requestId,
      isDirty: false,
      type: "http",
      method: "GET",
      url,
      params: [],
      headers: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
    },
  };
}

test.describe("Chain UI polish — P4 add @qa", () => {
  test.use({ viewport: WIDE_VIEWPORT });

  test("PICKER-8: a keyboard-only user can search, move, select a range, add, and Esc clears search before closing", async ({
    seededPage: page,
    snap,
  }) => {
    await paOpenPickerChain(page);
    await paOpenViaToolbar(page);

    // Focus starts in search; typing filters and auto-expands the matching branch.
    await page.keyboard.type("nested");
    await expect(paSearchInput(page)).toHaveValue("nested");
    await paTabToTree(page);
    await expect(paTree(page)).toBeFocused();
    await expect(paTree(page)).toHaveAttribute("role", "tree");
    expect(await paActiveRowDomId(page)).toBe(
      `picker-row-dom-collection:${PA_NESTED}`
    );

    // End jumps to the last row; Space selects; Up/Shift+Up extend a range over visible requests only.
    await page.keyboard.press("End");
    expect(await paActiveRowDomId(page)).toBe("picker-row-dom-qa-pk-n-root");
    await page.keyboard.press("Space");
    await expect(paSelectedCount(page)).toHaveText("1 selected");
    await page.keyboard.press("ArrowUp");
    expect(await paActiveRowDomId(page)).toBe("picker-row-dom-qa-pk-n-b");
    await page.keyboard.press("Shift+ArrowUp");
    await page.keyboard.press("Shift+ArrowUp");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(paSelectedCount(page)).toHaveText("4 selected");
    await expect(paRow(page, "qa-pk-n-a1")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Cmd/Ctrl+A selects every visible request (5 in this collection).
    await page.keyboard.press("ControlOrMeta+a");
    await expect(paSelectedCount(page)).toHaveText("5 selected");
    await snap("p4-picker-8-keyboard-range");

    // Home returns to the collection header.
    await page.keyboard.press("Home");
    expect(await paActiveRowDomId(page)).toBe(
      `picker-row-dom-collection:${PA_NESTED}`
    );

    // Esc order: first clears the search (selection and dialog survive), second closes.
    await page.keyboard.press("Escape");
    await expect(paSearchInput(page)).toHaveValue("");
    await expect(paDialog(page)).toBeVisible();
    await expect(paSelectedCount(page)).toHaveText("5 selected");
    await page.keyboard.press("Escape");
    await expect(paDialog(page)).toHaveCount(0);
    expect(await nodeCount(page).count()).toBeGreaterThan(0);

    // With a selection of zero, Enter on a lone active request adds it immediately.
    await paOpenViaToolbar(page);
    const before = await nodeCount(page).count();
    await page.keyboard.type("nested a1x");
    await paTabToTree(page);
    await paArrowDownTo(page, "qa-pk-n-a1x");
    await page.keyboard.press("Enter");
    await expect(paDialog(page)).toHaveCount(0);
    await expect(paFlowNode(page, "qa-pk-n-a1x")).toHaveCount(1);
    await expect(nodeCount(page)).toHaveCount(before + 1);
  });

  test("PICKER-10: requests already in the chain show In chain, cannot be selected or added twice, and Show on canvas centers the node", async ({
    seededPage: page,
    snap,
  }) => {
    await paOpenPickerChain(page);
    const before = await nodeCount(page).count();
    await paOpenViaToolbar(page);
    await paExpandCollection(page, PA_CHAIN_COLLECTION);

    const inChain = paRow(page, PA_IN_CHAIN_ONE);
    await expect(inChain).toContainText("In chain");
    await expect(inChain).toHaveAttribute("aria-disabled", "true");
    await expect(paRow(page, PA_NOT_IN_CHAIN)).not.toContainText("In chain");

    // Click and Enter on an in-chain row add nothing and announce why.
    await inChain.click({ force: true });
    await expect(paSelectedCount(page)).toHaveText("0 selected");
    await expect(paAddSelected(page)).toBeDisabled();
    await expect(inChain.getByRole("status")).toHaveText(
      "Already in this chain"
    );
    await snap("p4-picker-10-in-chain-row");

    // A mixed selection counts only the addable request, and adding leaves one node per request.
    await paSelectRows(page, [PA_NOT_IN_CHAIN]);
    await expect(paAddSelected(page)).toHaveText("Add 1 request");
    await paAddSelected(page).click();
    await expect(paDialog(page)).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(before + 1);
    await expect(paFlowNode(page, PA_IN_CHAIN_ONE)).toHaveCount(1);

    // The just-added request is now "In chain" too; Show on canvas closes the dialog and selects its node.
    await paOpenViaToolbar(page);
    await paExpandCollection(page, PA_CHAIN_COLLECTION);
    await expect(paRow(page, PA_NOT_IN_CHAIN)).toContainText("In chain");
    await page
      .getByTestId(`picker-show-on-canvas-${PA_IN_CHAIN_TWO}`)
      .click({ force: true });
    await expect(paDialog(page)).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(before + 1);
    await expect(paFlowNode(page, PA_IN_CHAIN_TWO)).toHaveClass(/selected/, {
      timeout: LOAD_TIMEOUT_MS,
    });
    await paWaitViewportStable(page);
    const paneBox = await paneOrigin(page);
    const nodeBox = await paNodeBox(page, PA_IN_CHAIN_TWO);
    expect(
      Math.abs(nodeBox.x + nodeBox.width / 2 - (paneBox.x + paneBox.width / 2))
    ).toBeLessThan(CENTER_TOLERANCE_PX);
  });

  test("PICKER-11: multi-select shows a live footer count, survives tab switch and search, and caps at 100 with disabled rows", async ({
    seededPage: page,
    snap,
  }) => {
    await paOpenPickerChain(page);
    await paOpenViaToolbar(page);
    await expect(paAddSelected(page)).toBeDisabled();
    await paExpandCollection(page, PA_BULK);

    await paSelectRows(page, ["qa-pk-bulk-001", "qa-pk-bulk-002"]);
    await expect(paAddSelected(page)).toHaveText("Add 2 requests");
    await expect(paSelectedCount(page)).toHaveAttribute("aria-live", "polite");

    // Selection survives a tab switch, and a search that hides the selected rows.
    await page.getByTestId("picker-tab-history").click();
    await expect(page.getByTestId("picker-tab-history")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(paSelectedCount(page)).toHaveText("2 selected");
    await page.getByTestId("picker-tab-collections").click();
    await paSearchInput(page).fill(PA_LAST_BULK_URL_QUERY);
    await expect(paRow(page, "qa-pk-bulk-150")).toBeVisible();
    await expect(paRow(page, "qa-pk-bulk-001")).toHaveCount(0);
    await expect(paSelectedCount(page)).toHaveText("2 selected");

    // Cap: Cmd/Ctrl+A over 150 visible requests stops at 100, then the rest are disabled with a reason.
    await paSearchInput(page).fill("");
    await paTree(page).focus();
    await page.keyboard.press("ControlOrMeta+a");
    await expect(paSelectedCount(page)).toHaveText(
      `${PA_SELECTION_CAP} selected`
    );
    await expect(page.getByTestId("picker-cap-note")).toContainText(
      `up to ${PA_SELECTION_CAP}`
    );
    await paSearchInput(page).fill(PA_LAST_BULK_URL_QUERY);
    const capped = paRow(page, "qa-pk-bulk-150");
    await expect(capped).toHaveAttribute("aria-disabled", "true");
    await expect(capped).toHaveAttribute("title", /up to 100/);
    await capped.click({ force: true });
    await expect(paSelectedCount(page)).toHaveText(
      `${PA_SELECTION_CAP} selected`
    );
    await expect(paAddSelected(page)).toHaveText(
      `Add ${PA_SELECTION_CAP} requests`
    );
    await snap("p4-picker-11-cap");

    // Clear resets the selection and re-enables the rows.
    await page.getByTestId("picker-clear-selection").click();
    await expect(paSelectedCount(page)).toHaveText("0 selected");
    await expect(capped).not.toHaveAttribute("aria-disabled", "true");
    await expect(paAddSelected(page)).toBeDisabled();
  });

  test("PICKER-12: a multi-add stacks nodes right of the canvas in selection order as ONE undo; closing without confirming adds nothing", async ({
    seededPage: page,
  }) => {
    await paOpenPickerChain(page);
    const before = await nodeCount(page).count();
    const originalPositions = await paNodePositions(page, PA_CHAIN);

    // Closing (Cancel, then Esc) with a selection adds nothing.
    await paOpenViaToolbar(page);
    await paExpandCollection(page, PA_BULK);
    await paSelectRows(page, ["qa-pk-bulk-001", "qa-pk-bulk-002"]);
    await page.getByTestId("picker-cancel").click();
    await expect(paDialog(page)).toHaveCount(0);
    await paOpenViaToolbar(page);
    await expect(paSelectedCount(page)).toHaveText("0 selected");
    await page.keyboard.press("Escape");
    await expect(paDialog(page)).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(before);
    expect(await paChainRecord(page, PA_CHAIN)).toMatchObject({
      nodeIds: [PA_IN_CHAIN_ONE, PA_IN_CHAIN_TWO],
    });

    // Default origin: right of the existing bounds, top-aligned; selection order is top-to-bottom.
    const ids = ["qa-pk-bulk-003", "qa-pk-bulk-001", "qa-pk-bulk-002"];
    await paOpenViaToolbar(page);
    await paExpandCollection(page, PA_BULK);
    await paSelectRows(page, ids);
    await paAddSelected(page).click();
    await expect(paDialog(page)).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(before + ids.length);

    const record = await paChainAfterPersist(page, PA_CHAIN, 2 + ids.length);
    const originX =
      Math.max(...Object.values(originalPositions).map((p) => p.x)) +
      PA_NODE_WIDTH_ESTIMATE +
      PA_RIGHT_OF_BOUNDS_GAP;
    const originY = Math.min(
      ...Object.values(originalPositions).map((p) => p.y)
    );
    ids.forEach((id, index) => {
      paExpectNear(record.nodePositions[id], {
        x: originX,
        y: originY + index * PA_STACK_GAP_Y,
      });
    });
    // No edges are invented between the new nodes.
    expect(record.edges).toHaveLength(0);

    // The canvas fits the added nodes: all three are inside the pane.
    const pane = await paneOrigin(page);
    // Poll: fitView animates, so the final box is only stable after it settles.
    for (const id of ids) {
      await expect
        .poll(async () => {
          const box = await paNodeBox(page, id);
          return (
            box.x >= pane.x && box.x + box.width <= pane.x + pane.width + 1
          );
        })
        .toBe(true);
    }

    // ONE undo removes all added nodes.
    await paCanvas(page).focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(nodeCount(page)).toHaveCount(before);
    for (const id of ids) await expect(paFlowNode(page, id)).toHaveCount(0);
  });

  test("PICKER-12: Add API after this, the pane menu and the default entry each place nodes at their own origin", async ({
    seededPage: page,
  }) => {
    await paOpenPickerChain(page);

    // "Add API after this": x = anchor.x + 320, y = anchor.y.
    await paFlowNode(page, PA_IN_CHAIN_ONE).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add API after this" }).click();
    await expect(paDialog(page)).toBeVisible();
    await paExpandCollection(page, PA_BULK);
    await paSelectRows(page, ["qa-pk-bulk-004", "qa-pk-bulk-005"]);
    await paAddSelected(page).click();
    await expect(paDialog(page)).toHaveCount(0);
    let record = await paChainAfterPersist(page, PA_CHAIN, 4);
    for (const [index, id] of ["qa-pk-bulk-004", "qa-pk-bulk-005"].entries()) {
      paExpectNear(record.nodePositions[id], {
        x: PA_NODE_ONE_POSITION.x + PA_AFTER_NODE_OFFSET_X,
        y: PA_NODE_ONE_POSITION.y + index * PA_STACK_GAP_Y,
      });
    }

    // Pane menu: origin is the right-click point in flow coordinates.
    const clearPoint = await paClearPanePoint(page);
    await paWaitViewportStable(page);
    const pane = await paneOrigin(page);
    const flowPoint = await paScreenToFlow(page, {
      x: pane.x + clearPoint.x,
      y: pane.y + clearPoint.y,
    });
    await page
      .locator(".react-flow__pane")
      .first()
      .click({ button: "right", position: clearPoint });
    await page.getByTestId("block-menu-item-api").click();
    await expect(paDialog(page)).toBeVisible();
    await paExpandCollection(page, PA_BULK);
    await paSelectRows(page, ["qa-pk-bulk-006"]);
    await paAddSelected(page).click();
    await expect(paDialog(page)).toHaveCount(0);
    record = await paChainAfterPersist(page, PA_CHAIN, 5);
    paExpectNear(record.nodePositions["qa-pk-bulk-006"], flowPoint);
  });

  test("PICKER-14: New request creates a real request from valid multi-line cURL with Ctrl/Cmd+Enter, and invalid cURL blocks creation", async ({
    seededPage: page,
    snap,
  }) => {
    await paOpenPickerChain(page);
    const before = await nodeCount(page).count();
    const requestsBefore = (await paIdbAll<PaRequestRecord>(page, "requests"))
      .length;
    await paOpenViaToolbar(page);
    await page.getByTestId("picker-tab-new").click();
    await expect(page.getByTestId("picker-new-request")).toBeVisible();
    // The New request tab has its own action: the selection footer is gone.
    await expect(page.getByTestId("picker-footer")).toHaveCount(0);

    await page.getByTestId("picker-new-mode-curl").click();
    const curlBox = page.getByTestId("picker-new-curl");
    const submit = page.getByTestId("picker-new-request-submit");
    await expect(submit).toBeDisabled();

    // Invalid cURL: translated alert with the reason; nothing can be created.
    await curlBox.fill("curl -X POST");
    const alert = page.getByTestId("picker-curl-error");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText("Couldn't parse cURL");
    await expect(alert).toContainText("No URL found");
    await expect(submit).toBeDisabled();
    await snap("p4-picker-14-invalid-curl");
    await curlBox.press("ControlOrMeta+Enter");
    await expect(paDialog(page)).toBeVisible();
    expect((await paIdbAll<PaRequestRecord>(page, "requests")).length).toBe(
      requestsBefore
    );

    // Valid multi-line cURL with backslashes: one command, name derived from it.
    await curlBox.fill(PA_ORDERS_CURL);
    await expect(alert).toHaveCount(0);
    await expect(page.getByTestId("picker-new-name")).toHaveValue(
      "POST /orders"
    );
    await expect(submit).toBeEnabled();
    await curlBox.press("ControlOrMeta+Enter");
    await expect(paDialog(page)).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(before + 1);

    await expect
      .poll(async () => (await paRequestsByName(page, "POST /orders")).length, {
        timeout: PA_PERSIST_TIMEOUT_MS,
      })
      .toBe(1);
    const [created] = await paRequestsByName(page, "POST /orders");
    expect(created.method).toBe("POST");
    expect(created.url).toBe("https://api.example.com/orders");
    await expect(paFlowNode(page, created.id)).toHaveCount(1);
  });

  test("PICKER-14: Blank mode requires a URL, creates the typed request, and the same URL twice makes two requests", async ({
    seededPage: page,
  }) => {
    await paOpenPickerChain(page);
    await paOpenViaToolbar(page);
    await page.getByTestId("picker-tab-new").click();
    const url = page.getByTestId("picker-new-url");
    const submit = page.getByTestId("picker-new-request-submit");

    await expect(page.getByTestId("picker-new-name")).toHaveValue(
      "New request"
    );
    await expect(submit).toBeDisabled();
    await url.focus();
    await url.blur();
    await expect(page.getByTestId("picker-new-url-error")).toHaveText(
      "URL is required"
    );

    await page.getByTestId("picker-new-name").fill("Twin Request");
    await url.fill("https://api.example.com/twin");
    await expect(page.getByTestId("picker-new-url-error")).toHaveCount(0);
    await submit.click();
    await expect(paDialog(page)).toHaveCount(0);

    await paOpenViaToolbar(page);
    await page.getByTestId("picker-tab-new").click();
    await page.getByTestId("picker-new-name").fill("Twin Request");
    await page
      .getByTestId("picker-new-url")
      .fill("https://api.example.com/twin");
    await page.getByTestId("picker-new-request-submit").click();
    await expect(paDialog(page)).toHaveCount(0);

    await expect
      .poll(async () => (await paRequestsByName(page, "Twin Request")).length, {
        timeout: PA_PERSIST_TIMEOUT_MS,
      })
      .toBe(2);
    const twins = await paRequestsByName(page, "Twin Request");
    expect(new Set(twins.map((request) => request.id)).size).toBe(2);
    for (const twin of twins) {
      await expect(paFlowNode(page, twin.id)).toHaveCount(1);
    }
  });

  test("PICKER-14: with zero collections the picker offers Add without saving and creates an unsaved node", async ({
    seededPage: page,
    snap,
  }) => {
    await paOpenPickerChain(page);
    await paIdbClear(page, ["collections", "folders", "requests"]);
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });

    await page.getByTestId("empty-add-api-btn").click();
    await expect(paDialog(page)).toBeVisible();
    await expect(paDialog(page)).toContainText("No collections yet");
    await page.getByTestId("picker-tab-new").click();
    await expect(page.getByTestId("picker-target-empty")).toHaveText(
      "No collections yet"
    );
    const submit = page.getByTestId("picker-new-request-submit");
    await expect(submit).toHaveText("Add without saving");
    await page
      .getByTestId("picker-new-url")
      .fill("https://api.example.com/adhoc");
    await snap("p4-picker-14-zero-collections");
    await submit.click();

    await expect(paDialog(page)).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(1, { timeout: LOAD_TIMEOUT_MS });
    await expect(emptyOverlay(page)).toHaveCount(0);
    expect(await paIdbAll<PaRequestRecord>(page, "requests")).toHaveLength(0);
  });

  test("PICKER-15: the target picker shows the full path, resets the folder when the collection changes, and saves into the chosen folder", async ({
    seededPage: page,
    snap,
  }) => {
    await paOpenPickerChain(page);
    await paOpenViaToolbar(page);
    await page.getByTestId("picker-tab-new").click();
    await page.getByTestId("picker-new-name").fill("Deep Request");
    await page
      .getByTestId("picker-new-url")
      .fill("https://api.example.com/deep");

    // Pick the nested collection, then a folder three levels deep.
    await page.getByTestId("picker-target-collection").click();
    await page.getByRole("option", { name: PA_NESTED_NAME }).click();
    const path = page.getByTestId("picker-target-path");
    await expect(path).toHaveText(PA_NESTED_NAME);
    await path.click();
    // Five folders: no folder search yet (it appears only above 8).
    await expect(page.getByTestId("picker-target-folder-search")).toHaveCount(
      0
    );
    await page.getByRole("button", { name: "Level 1 A", exact: true }).click();
    await page.getByRole("button", { name: "Level 2 A1", exact: true }).click();
    await page.getByTestId("picker-target-folder-qa-pk-f-a1x").click();
    await expect(path).toHaveText(
      `${PA_NESTED_NAME} / Level 1 A / Level 2 A1 / Level 3 A1x`
    );
    await snap("p4-picker-15-full-path");

    // Changing the collection resets the folder.
    await page.getByTestId("picker-target-collection").click();
    await page.getByRole("option", { name: PA_BULK_NAME }).click();
    await page.getByTestId("picker-target-collection").click();
    await page.getByRole("option", { name: PA_NESTED_NAME }).click();
    await expect(page.getByTestId("picker-target-path")).toHaveText(
      PA_NESTED_NAME
    );

    await page.getByTestId("picker-target-path").click();
    await page.getByRole("button", { name: "Level 1 A", exact: true }).click();
    await page.getByRole("button", { name: "Level 2 A1", exact: true }).click();
    await page.getByTestId("picker-target-folder-qa-pk-f-a1x").click();
    await page.getByTestId("picker-new-request-submit").click();
    await expect(paDialog(page)).toHaveCount(0);

    await expect
      .poll(async () => (await paRequestsByName(page, "Deep Request")).length, {
        timeout: PA_PERSIST_TIMEOUT_MS,
      })
      .toBe(1);
    const [created] = await paRequestsByName(page, "Deep Request");
    expect(created.collectionId).toBe(PA_NESTED);
    expect(created.folderId).toBe("qa-pk-f-a1x");
  });

  test("PICKER-15: the folder tree gets a search box only above 8 folders", async ({
    seededPage: page,
  }) => {
    await paOpenPickerChain(page);
    const extraFolders = Array.from(
      { length: PA_EXTRA_FOLDER_COUNT },
      (_, i) => ({
        id: `qa-pk-extra-folder-${i + 1}`,
        collectionId: PA_BULK,
        name: `Extra Folder ${String(i + 1).padStart(2, "0")}`,
        parentFolderId: null,
        order: i,
      })
    );
    await paIdbPut(page, "folders", extraFolders);
    await openPolishChain(page, PA_CHAIN);

    await paOpenViaToolbar(page);
    await page.getByTestId("picker-tab-new").click();
    await page.getByTestId("picker-target-collection").click();
    await page.getByRole("option", { name: PA_NESTED_NAME }).click();
    await page.getByTestId("picker-target-path").click();
    await expect(page.getByTestId("picker-target-folder-search")).toHaveCount(
      0
    );

    await page.getByTestId("picker-target-collection").click();
    await page.getByRole("option", { name: PA_BULK_NAME }).click();
    await page.getByTestId("picker-target-path").click();
    const search = page.getByTestId("picker-target-folder-search");
    await expect(search).toBeVisible();
    await search.fill("Extra Folder 07");
    await expect(
      page.getByTestId("picker-target-folder-qa-pk-extra-folder-7")
    ).toBeVisible();
    await expect(
      page.getByTestId("picker-target-folder-qa-pk-extra-folder-3")
    ).toHaveCount(0);
  });

  // The handle drag needs the standard viewport so the loop handle stays on screen.
  test.describe("default viewport", () => {
    test.use({ viewport: PA_DEFAULT_VIEWPORT });

    test("PICKER-16: every entry point opens the same dialog, and closing resets search and selection but keeps the last tab", async ({
      seededPage: page,
    }) => {
      // 1. Toolbar "Add API".
      await paOpenPickerChain(page);
      await paOpenViaToolbar(page);
      await expect(paDialog(page).getByRole("heading")).toHaveText(
        "Add API Request"
      );

      // Close resets search + selection; the last tab persists.
      await paExpandCollection(page, PA_BULK);
      await paSelectRows(page, ["qa-pk-bulk-001"]);
      await paSearchInput(page).fill("bulk");
      await page.getByTestId("picker-tab-history").click();
      // First Esc clears the search, second closes the dialog.
      await page.keyboard.press("Escape");
      await expect(paSearchInput(page)).toHaveValue("");
      await page.keyboard.press("Escape");
      await expect(paDialog(page)).toHaveCount(0);
      await paOpenViaToolbar(page);
      await expect(page.getByTestId("picker-tab-history")).toHaveAttribute(
        "aria-selected",
        "true"
      );
      await expect(paSearchInput(page)).toHaveValue("");
      await expect(paSelectedCount(page)).toHaveText("0 selected");
      await page.getByTestId("picker-tab-collections").click();
      await expect(paCollectionHeader(page, PA_BULK)).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      await page.keyboard.press("Escape");
      await expect(paDialog(page)).toHaveCount(0);

      // 2. Node context menu "Add API after this".
      await paFlowNode(page, PA_IN_CHAIN_TWO).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Add API after this" }).click();
      await expect(paDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(paDialog(page)).toHaveCount(0);

      // 3. Pane context menu.
      await page
        .locator(".react-flow__pane")
        .first()
        .click({ button: "right", position: EMPTY_PANE_POINT });
      await page.getByTestId("block-menu-item-api").click();
      await expect(paDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(paDialog(page)).toHaveCount(0);

      // 4. Empty-canvas overlay.
      await openPolishChain(page, POLISH_EMPTY);
      await expect(emptyOverlay(page)).toBeVisible({
        timeout: LOAD_TIMEOUT_MS,
      });
      await page.getByTestId("empty-add-api-btn").click();
      await expect(paDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(paDialog(page)).toHaveCount(0);

      // 5. Dropping a connection on the empty pane.
      await openPolishChain(page, POLISH_SOURCE_HANDLES);
      await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT, {
        timeout: LOAD_TIMEOUT_MS,
      });
      await dragHandleToPane(
        page,
        loopBodyHandle(page, LOOP_FREE_ID),
        EMPTY_PANE_POINT
      );
      await page.getByTestId("block-menu-item-api").click();
      await expect(paDialog(page)).toBeVisible();
    });

    test("PICKER-17: a connect-drop add joins only the first new node and lands at the drop point; cancelling discards the pending connection", async ({
      seededPage: page,
    }) => {
      await openPolishChain(page, POLISH_SOURCE_HANDLES);
      await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT, {
        timeout: LOAD_TIMEOUT_MS,
      });
      const freeBody = loopBodyHandle(page, LOOP_FREE_ID);
      const initialRequestCount =
        (await paChainRecord(page, POLISH_SOURCE_HANDLES))?.nodeIds.length ?? 0;

      // Cancel: no node, no edge.
      await dragHandleToPane(page, freeBody, EMPTY_PANE_POINT);
      await page.getByTestId("block-menu-item-api").click();
      await expect(paDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(paDialog(page)).toHaveCount(0);
      await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT);
      await expect(edgeCount(page)).toHaveCount(SOURCE_HANDLES_EDGE_COUNT);

      // A plain add afterwards must not resurrect the discarded connection.
      await paOpenViaToolbar(page);
      await paSelectBulk(page, [10]);
      await paAddSelected(page).click();
      await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT + 1);
      await expect(edgeCount(page)).toHaveCount(SOURCE_HANDLES_EDGE_COUNT);
      await paCanvas(page).focus();
      await page.keyboard.press("ControlOrMeta+z");
      await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT);

      // Reload so the viewport is back at its initial fit, keeping the loop handle on screen.
      await openPolishChain(page, POLISH_SOURCE_HANDLES);
      await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT, {
        timeout: LOAD_TIMEOUT_MS,
      });

      // Confirm with two requests: the edge joins the first one only, both stack from the drop point.
      const pane = await paneOrigin(page);
      const dropFlow = await paScreenToFlow(page, {
        x: pane.x + EMPTY_PANE_POINT.x,
        y: pane.y + EMPTY_PANE_POINT.y,
      });
      await dragHandleToPane(page, freeBody, EMPTY_PANE_POINT);
      await page.getByTestId("block-menu-item-api").click();
      await expect(paDialog(page)).toBeVisible();
      await paSelectBulk(page, [11, 12]);
      await paAddSelected(page).click();
      await expect(paDialog(page)).toHaveCount(0);
      await expect(nodeCount(page)).toHaveCount(SOURCE_HANDLES_NODE_COUNT + 2);
      await expect(edgeCount(page)).toHaveCount(SOURCE_HANDLES_EDGE_COUNT + 1);

      // nodeIds lists request nodes only (loops and delays are not requests).
      const record = await paChainAfterPersist(
        page,
        POLISH_SOURCE_HANDLES,
        initialRequestCount + 2
      );
      const joined = record.edges.filter(
        (edge) =>
          edge.sourceRequestId === LOOP_FREE_ID &&
          edge.targetRequestId.startsWith("qa-pk-bulk")
      );
      expect(joined.map((edge) => edge.targetRequestId)).toEqual([
        "qa-pk-bulk-011",
      ]);
      paExpectNear(record.nodePositions["qa-pk-bulk-011"], dropFlow);
      paExpectNear(record.nodePositions["qa-pk-bulk-012"], {
        x: dropFlow.x,
        y: dropFlow.y + PA_STACK_GAP_Y,
      });
    });
  });

  test("PICKER-17: the empty-canvas overlay adds to an empty chain at the viewport origin and removes the overlay", async ({
    seededPage: page,
  }) => {
    await openPolishChain(page, POLISH_EMPTY);
    await expect(emptyOverlay(page)).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
    await page.getByTestId("empty-add-api-btn").click();
    await expect(paDialog(page)).toBeVisible();
    await paSelectBulk(page, [20, 21]);
    await paAddSelected(page).click();
    await expect(paDialog(page)).toHaveCount(0);
    await expect(nodeCount(page)).toHaveCount(2, { timeout: LOAD_TIMEOUT_MS });
    await expect(emptyOverlay(page)).toHaveCount(0);

    const record = await paChainAfterPersist(page, POLISH_EMPTY, 2);
    paExpectNear(record.nodePositions["qa-pk-bulk-020"], { x: 0, y: 0 });
    paExpectNear(record.nodePositions["qa-pk-bulk-021"], {
      x: 0,
      y: PA_STACK_GAP_Y,
    });
  });

  test("PICKER-19: Recent lists up to 5 recently run saved requests, hides while filtering and when empty", async ({
    seededPage: page,
    snap,
  }) => {
    await paOpenPickerChain(page);

    // The seeded history has no link to saved requests, so nothing is recent.
    await paOpenViaToolbar(page);
    await expect(paTree(page)).toBeVisible();
    await expect(page.getByTestId("picker-recent")).toHaveCount(0);
    await page.keyboard.press("Escape");

    const recentIds = [
      PA_IN_CHAIN_ONE,
      "qa-pk-n-root",
      "qa-pk-n-a",
      "qa-pk-n-b",
      "qa-pk-n-a1",
      "qa-pk-n-a1x",
      "qa-pk-n-orphan",
    ];
    await paIdbPut(
      page,
      "history",
      recentIds.map((id, index) => paHistoryFor(id, index))
    );
    await openPolishChain(page, PA_CHAIN);
    await paOpenViaToolbar(page);

    const recent = page.getByTestId("picker-recent");
    await expect(recent).toBeVisible();
    await expect(recent).toContainText("Recent");
    const shown = recent.locator('[data-testid^="picker-recent-"]');
    await expect(shown).toHaveCount(PA_RECENT_MAX);
    // Newest first; the in-chain request is disabled and badged.
    await expect(shown.nth(0)).toHaveAttribute(
      "data-testid",
      `picker-recent-${PA_IN_CHAIN_ONE}`
    );
    await expect(shown.nth(0)).toBeDisabled();
    await expect(shown.nth(0)).toContainText("In chain");
    await expect(page.getByTestId("picker-recent-qa-pk-n-orphan")).toHaveCount(
      0
    );
    await snap("p4-picker-19-recent");

    // Picking a recent request feeds the same selection and footer.
    await page.getByTestId("picker-recent-qa-pk-n-root").click();
    await expect(paSelectedCount(page)).toHaveText("1 selected");
    await page.getByTestId("picker-clear-selection").click();

    // Hidden while searching or filtering, back once both are cleared.
    await paSearchInput(page).fill("nested");
    await expect(recent).toHaveCount(0);
    await paSearchInput(page).fill("");
    await expect(recent).toBeVisible();
    await page.getByTestId("picker-method-GET").click();
    await expect(recent).toHaveCount(0);
    await page.getByTestId("picker-filter-clear").click();
    await expect(recent).toBeVisible();
  });

  test("PICKER-20: the footer hints keyboard use on first open, tints selected rows, and the hint stays dismissed for the session", async ({
    seededPage: page,
  }) => {
    await paOpenPickerChain(page);
    await paOpenViaToolbar(page);
    await paExpandCollection(page, PA_BULK);

    const hint = page.getByTestId("picker-hint");
    await expect(hint).toContainText("Press Space to select, Enter to add");
    await expect(paSelectedCount(page)).toHaveText("0 selected");

    // Selected rows keep a persistent tint distinct from an untouched row, even without hover or focus.
    const picked = paRow(page, "qa-pk-bulk-001");
    const untouched = paRow(page, "qa-pk-bulk-003");
    await picked.click();
    await page.mouse.move(0, 0);
    await expect(paSelectedCount(page)).toHaveText("1 selected");
    await expect(picked).toHaveAttribute("data-selected", "true");
    await expect(hint).toHaveCount(0);
    const background = (row: Locator) =>
      row.evaluate((el) => getComputedStyle(el).backgroundColor);
    const tint = await background(picked);
    expect(tint).not.toBe("rgba(0, 0, 0, 0)");
    expect(tint).not.toBe(await background(untouched));
    await expect(page.getByTestId("picker-clear-selection")).toBeVisible();

    // Clearing brings the hint back until it is dismissed; dismissal holds across reopen.
    await page.getByTestId("picker-clear-selection").click();
    await expect(hint).toBeVisible();
    await page.getByTestId("picker-hint-dismiss").click();
    await expect(hint).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(paDialog(page)).toHaveCount(0);
    await paOpenViaToolbar(page);
    await expect(page.getByTestId("picker-hint")).toHaveCount(0);
  });

  test("PICKER-24: a half-typed New request draft survives switching tabs and back, and resets when the dialog closes", async ({
    seededPage: page,
  }) => {
    await paOpenPickerChain(page);
    await paOpenViaToolbar(page);
    await page.getByTestId("picker-tab-new").click();

    // Blank-mode draft.
    await page.getByTestId("picker-new-name").fill("Draft name");
    await page
      .getByTestId("picker-new-url")
      .fill("https://api.example.com/draft");
    await page.getByTestId("picker-target-collection").click();
    await page.getByRole("option", { name: PA_NESTED_NAME }).click();

    await page.getByTestId("picker-tab-collections").click();
    await expect(paTree(page)).toBeVisible();
    await page.getByTestId("picker-tab-history").click();
    await page.getByTestId("picker-tab-new").click();
    await expect(page.getByTestId("picker-new-name")).toHaveValue("Draft name");
    await expect(page.getByTestId("picker-new-url")).toHaveValue(
      "https://api.example.com/draft"
    );
    await expect(page.getByTestId("picker-target-collection")).toContainText(
      PA_NESTED_NAME
    );

    // cURL-mode draft, including the typed text.
    await page.getByTestId("picker-new-mode-curl").click();
    await page.getByTestId("picker-new-curl").fill(PA_ORDERS_CURL);
    await page.getByTestId("picker-tab-collections").click();
    await page.getByTestId("picker-tab-new").click();
    await expect(page.getByTestId("picker-new-mode-curl")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await expect(page.getByTestId("picker-new-curl")).toHaveValue(
      PA_ORDERS_CURL
    );

    // The suggestion row also prefills the draft from the search box.
    await page.getByTestId("picker-tab-collections").click();
    await paSearchInput(page).fill("https://api.example.com/from-search");
    await page.getByTestId("picker-suggestion").click();
    await expect(page.getByTestId("picker-tab-new")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("picker-new-url")).toHaveValue(
      "https://api.example.com/from-search"
    );

    // Closing the dialog discards the draft (the persisted tab is still New request).
    await page.keyboard.press("Escape");
    await expect(paDialog(page)).toHaveCount(0);
    await paOpenViaToolbar(page);
    await expect(page.getByTestId("picker-new-url")).toHaveValue("");
    await expect(page.getByTestId("picker-new-name")).toHaveValue(
      "New request"
    );
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — canvas quality of life (CANVAS-14 .. CANVAS-21). Seeds:
// qa-p5-canvas (API + 3 delays, Success/Fail edges), qa-p5-many (60 delays),
// qa-polish-delay-only, qa-polish-empty.
// ---------------------------------------------------------------------------

const P5_CANVAS = "qa-p5-canvas";
const P5_MANY = "qa-p5-many";
const P5_GRID_STEP = 16;
const P5_SHIFT_NUDGE_STEPS = 10;
const P5_NUDGE_GAP_MS = 500;
const P5_VIRTUALIZE_ABOVE = 50;
const P5_LABEL_MIN_ZOOM = 0.6;
const P5_DRAG_STEPS = 10;
const P5_DRAG_DELTA_PX = 37;
const P5_NODE_CLICK_OFFSET = { x: 14, y: 8 };

const p5Node = (page: Page, id: string) =>
  page.locator(`.react-flow__node[data-id="${id}"]`);
const p5Selected = (page: Page) => page.locator(".react-flow__node.selected");

async function p5Open(page: Page, chainId: string) {
  await page.goto(`/chain/${chainId}`);
  await expect(page.getByTestId("chain-request-count")).toBeVisible({
    timeout: LOAD_TIMEOUT_MS,
  });
  await expect(page.locator(".react-flow__node").first()).toBeVisible({
    timeout: LOAD_TIMEOUT_MS,
  });
}

/** Flow-space position from the node's inline transform (unaffected by viewport zoom/pan). */
async function p5Position(page: Page, id: string) {
  const transform = await p5Node(page, id).evaluate(
    (el) => (el as HTMLElement).style.transform
  );
  const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(transform);
  if (!match) throw new Error(`no translate on node ${id}: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

async function p5Zoom(page: Page) {
  const transform = await page
    .locator(".react-flow__viewport")
    .evaluate((el) => (el as HTMLElement).style.transform);
  const match = /scale\(([\d.]+)\)/.exec(transform);
  if (!match) throw new Error(`no scale on viewport: ${transform}`);
  return Number(match[1]);
}

async function p5Box(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("geometry unavailable");
  return box;
}

/** Selects a node by clicking its left padding (the centre holds an editable input). */
async function p5Select(page: Page, id: string, modifiers: "Shift"[] = []) {
  await p5Node(page, id)
    .locator('[data-testid^="delay-node-"]')
    .click({ position: P5_NODE_CLICK_OFFSET, modifiers });
}

/** First point on a coarse grid whose top element is the bare pane, so drags start on empty canvas. */
async function p5EmptyPoint(page: Page) {
  const point = await page.evaluate(() => {
    const pane = document.querySelector(".react-flow__pane");
    if (!pane) return null;
    const rect = pane.getBoundingClientRect();
    for (let y = rect.bottom - 120; y > rect.top + 120; y -= 20) {
      for (let x = rect.right - 260; x > rect.left + 60; x -= 20) {
        if (document.elementFromPoint(x, y) === pane) return { x, y };
      }
    }
    return null;
  });
  if (!point) throw new Error("no empty pane point");
  return point;
}

async function p5Drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  button: "left" | "middle" | "right" = "left"
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: P5_DRAG_STEPS });
  await page.mouse.up({ button });
}

/** Marquee that crosses every seeded node (partial selection mode only needs a touch). */
async function p5MarqueeAll(page: Page) {
  const start = await p5EmptyPoint(page);
  const pane = await p5Box(page.locator(".react-flow__pane"));
  await p5Drag(page, start, { x: pane.x + 40, y: pane.y + 110 });
}

async function p5RightClickCentre(page: Page, id: string) {
  const box = await p5Box(p5Node(page, id));
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
    button: "right",
  });
}

async function p5Footer(page: Page) {
  return page.locator("footer");
}

test.describe("Chain UI polish — P5 @qa", () => {
  test("CANVAS-14: left-drag marquee selects, middle-drag pans, right-drag opens no menu", async ({
    seededPage: page,
    snap,
  }) => {
    await p5Open(page, P5_CANVAS);
    await expect(p5Selected(page)).toHaveCount(0);

    await p5MarqueeAll(page);
    expect(await p5Selected(page).count()).toBeGreaterThanOrEqual(2);
    await snap("p5-canvas-14-marquee");

    // Middle-drag on empty pane pans the viewport (nodes move, selection unaffected by flow position).
    await page.mouse.click(5, 300);
    await expect(p5Selected(page)).toHaveCount(0);
    const before = await p5Box(p5Node(page, "qa-p5-d3"));
    const start = await p5EmptyPoint(page);
    await p5Drag(page, start, { x: start.x - 90, y: start.y - 40 }, "middle");
    const after = await p5Box(p5Node(page, "qa-p5-d3"));
    expect(Math.round(before.x - after.x)).toBe(90);
    expect(Math.round(before.y - after.y)).toBe(40);
    await expect(p5Selected(page)).toHaveCount(0);

    // Right-drag pans too and must not pop the pane context menu.
    const rightStart = await p5EmptyPoint(page);
    await p5Drag(
      page,
      rightStart,
      { x: rightStart.x + 60, y: rightStart.y + 20 },
      "right"
    );
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("menuitem")).toHaveCount(0);
  });

  test("CANVAS-15: snap toggle persists across reload and snaps drops to multiples of 16", async ({
    seededPage: page,
    snap,
  }) => {
    await p5Open(page, P5_CANVAS);
    const toggle = page.getByRole("button", { name: "Snap to grid" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // Off: the free drop keeps the continuous (non-grid) coordinate.
    const free = await p5Box(p5Node(page, "qa-p5-d3"));
    const grab = { x: free.x + 14, y: free.y + 8 };
    await p5Drag(page, grab, {
      x: grab.x + P5_DRAG_DELTA_PX,
      y: grab.y + P5_DRAG_DELTA_PX,
    });
    const unsnapped = await p5Position(page, "qa-p5-d3");
    expect(unsnapped.x % P5_GRID_STEP).not.toBe(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    const reloaded = page.getByRole("button", { name: "Snap to grid" });
    await expect(reloaded).toHaveAttribute("aria-pressed", "true");

    const moved = await p5Box(p5Node(page, "qa-p5-d3"));
    const from = { x: moved.x + 14, y: moved.y + 8 };
    await p5Drag(page, from, {
      x: from.x + P5_DRAG_DELTA_PX,
      y: from.y + P5_DRAG_DELTA_PX,
    });
    const snapped = await p5Position(page, "qa-p5-d3");
    expect(snapped.x % P5_GRID_STEP).toBe(0);
    expect(snapped.y % P5_GRID_STEP).toBe(0);
    await snap("p5-canvas-15-snap");
  });

  test("CANVAS-16: Cmd/Ctrl+F opens Find node only with canvas focus; empty state; 60 nodes virtualize", async ({
    seededPage: page,
    snap,
  }) => {
    await p5Open(page, P5_MANY);
    const input = page.getByTestId("find-node-input");

    // Focus outside the canvas leaves the browser's find alone.
    await page.getByTestId("chain-request-count").click();
    await page.keyboard.press("ControlOrMeta+f");
    await expect(input).toHaveCount(0);

    await page.mouse.click(5, 300);
    await page.keyboard.press("ControlOrMeta+f");
    await expect(input).toBeVisible();
    const rows = page.locator('[data-testid^="find-node-row-"]');
    await expect(rows.first()).toBeVisible();
    const rendered = await rows.count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(P5_VIRTUALIZE_ABOVE + 10);
    await snap("p5-canvas-16-find-60");

    await page.keyboard.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(p5Selected(page)).toHaveCount(1);

    // Esc closes and returns focus to the canvas, so the shortcut works again.
    await page.keyboard.press("ControlOrMeta+f");
    await expect(input).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+f");
    await expect(input).toBeVisible();
  });

  test("CANVAS-16: Find node stays inert on an empty chain (the canvas is unmounted)", async ({
    seededPage: page,
  }) => {
    await page.goto("/chain/qa-polish-empty");
    await expect(page.getByTestId("chain-request-count")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await page.keyboard.press("ControlOrMeta+f");
    // The empty chain unmounts the canvas, so focus is on the page; the shortcut stays inert.
    await expect(page.getByTestId("find-node-input")).toHaveCount(0);
  });

  test("CANVAS-17: F fits the selection when nodes are selected, otherwise fits everything", async ({
    seededPage: page,
  }) => {
    await p5Open(page, P5_CANVAS);
    await page.mouse.click(5, 300);
    await page.keyboard.press("f");
    await expect.poll(() => p5Zoom(page)).toBeGreaterThan(0);
    const fitAll = await p5Zoom(page);

    await p5Select(page, "qa-p5-d3");
    await page.keyboard.press("f");
    await expect.poll(() => p5Zoom(page)).toBeGreaterThan(fitAll);

    const pane = await p5EmptyPoint(page);
    await page.mouse.click(pane.x, pane.y);
    await expect(p5Selected(page)).toHaveCount(0);
    await page.keyboard.press("f");
    await expect
      .poll(async () => Math.abs((await p5Zoom(page)) - fitAll))
      .toBeLessThan(0.02);
  });

  test("[CHN-BUG-19] CANVAS-18: arrows nudge 16px, Shift+arrow 160px, and a burst is one undo entry", async ({
    seededPage: page,
  }) => {
    await p5Open(page, P5_CANVAS);
    await waitCanvasReady(page);
    const start = await p5Position(page, "qa-p5-d1");
    await p5Select(page, "qa-p5-d1");

    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await p5Position(page, "qa-p5-d1")).x - start.x)
      .toBe(P5_GRID_STEP);
    await page.waitForTimeout(P5_NUDGE_GAP_MS);
    await page.keyboard.press("Shift+ArrowDown");
    await expect
      .poll(async () => (await p5Position(page, "qa-p5-d1")).y - start.y)
      .toBe(P5_GRID_STEP * P5_SHIFT_NUDGE_STEPS);

    // Gap > 400ms made two entries: one undo reverts only the Shift nudge.
    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(async () => (await p5Position(page, "qa-p5-d1")).y - start.y)
      .toBe(0);
    expect((await p5Position(page, "qa-p5-d1")).x - start.x).toBe(P5_GRID_STEP);

    // A fast burst coalesces: three presses, one undo back to the pre-burst spot.
    await page.waitForTimeout(P5_NUDGE_GAP_MS);
    const preBurst = await p5Position(page, "qa-p5-d1");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => preBurst.x - (await p5Position(page, "qa-p5-d1")).x)
      .toBe(P5_GRID_STEP * 3);
    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(async () => (await p5Position(page, "qa-p5-d1")).x)
      .toBe(preBurst.x);
  });

  test("CANVAS-18: arrows do nothing without a selection or while typing in an input", async ({
    seededPage: page,
  }) => {
    await p5Open(page, P5_CANVAS);
    const start = await p5Position(page, "qa-p5-d1");
    await page.mouse.click(5, 300);
    await page.keyboard.press("ArrowRight");
    expect(await p5Position(page, "qa-p5-d1")).toEqual(start);

    await p5Select(page, "qa-p5-d1");
    await p5Node(page, "qa-p5-d1").getByTestId("delay-value-btn").click();
    await expect(p5Node(page, "qa-p5-d1").locator("input")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    expect(await p5Position(page, "qa-p5-d1")).toEqual(start);
  });

  test("CANVAS-19: align and distribute from the selection menu, distribute disabled for 2, one undo", async ({
    seededPage: page,
    snap,
  }) => {
    await p5Open(page, P5_CANVAS);
    const ids = ["qa-p5-d1", "qa-p5-d2", "qa-p5-d3"];
    const original = await Promise.all(ids.map((id) => p5Position(page, id)));

    await p5Select(page, ids[0]);
    await p5Select(page, ids[1], ["Shift"]);
    await expect(p5Selected(page)).toHaveCount(2);
    await p5RightClickCentre(page, ids[0]);
    await expect(
      page.getByRole("menuitem", { name: "Align left" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Distribute horizontally" })
    ).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");

    await p5Select(page, ids[2], ["Shift"]);
    await expect(p5Selected(page)).toHaveCount(3);
    await p5RightClickCentre(page, ids[0]);
    await expect(
      page.getByRole("menuitem", { name: "Distribute horizontally" })
    ).not.toHaveAttribute("aria-disabled", "true");
    await snap("p5-canvas-19-menu");
    await page.getByRole("menuitem", { name: "Align left" }).click();

    const aligned = await Promise.all(ids.map((id) => p5Position(page, id)));
    expect(new Set(aligned.map((p) => p.x)).size).toBe(1);
    expect(aligned.map((p) => p.y)).toEqual(original.map((p) => p.y));

    // One undo restores all three x positions (shortcuts need canvas focus; the menu click left it).
    const empty = await p5EmptyPoint(page);
    await page.mouse.click(empty.x, empty.y);
    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(async () =>
        (
          await Promise.all(ids.map((id) => p5Position(page, id)))
        ).map((p) => p.x)
      )
      .toEqual(original.map((p) => p.x));

    // Distribute horizontally evens out the gaps between the three nodes.
    await p5Select(page, ids[0]);
    await p5Select(page, ids[1], ["Shift"]);
    await p5Select(page, ids[2], ["Shift"]);
    await expect(p5Selected(page)).toHaveCount(3);
    await p5RightClickCentre(page, ids[0]);
    await page
      .getByRole("menuitem", { name: "Distribute horizontally" })
      .click();
    const spread = (
      await Promise.all(ids.map((id) => p5Position(page, id)))
    ).sort((a, b) => a.x - b.x);
    expect(
      Math.abs(spread[1].x - spread[0].x - (spread[2].x - spread[1].x))
    ).toBeLessThan(P5_GRID_STEP);
  });

  test("CANVAS-20: a self-connection is muted and refused, and Success/Fail labels hide below 0.6 zoom", async ({
    seededPage: page,
    snap,
  }) => {
    await p5Open(page, P5_CANVAS);
    const edgeCount = page.locator('[data-testid^="rf__edge-"]');
    const before = await edgeCount.count();

    const delay = p5Node(page, "qa-p5-d3");
    const source = await p5Box(delay.locator(".react-flow__handle-right"));
    const target = await p5Box(delay.locator(".react-flow__handle-left"));
    await page.mouse.move(
      source.x + source.width / 2,
      source.y + source.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      {
        steps: P5_DRAG_STEPS,
      }
    );
    await expect(page.getByRole("status")).toContainText(
      "This connection isn't allowed"
    );
    await snap("p5-canvas-20-not-allowed");
    await page.mouse.up();
    await expect(edgeCount).toHaveCount(before);

    // Edge status is text, not colour alone, and only shows while zoomed in enough.
    const labels = page.getByTestId("edge-status-label");
    await expect(labels).toHaveText(["Success", "Fail"]);
    const zoomOut = page.locator(".react-flow__controls-zoomout");
    for (let i = 0; i < 6 && (await p5Zoom(page)) >= P5_LABEL_MIN_ZOOM; i++) {
      await zoomOut.click();
      await page.waitForTimeout(250);
    }
    expect(await p5Zoom(page)).toBeLessThan(P5_LABEL_MIN_ZOOM);
    await expect(labels).toHaveCount(0);
  });

  test("CANVAS-21: tips are contextual, dismiss persists across reload, warnings stay, Show tips lives in the ? overlay", async ({
    seededPage: page,
    snap,
  }) => {
    // Empty chain: no drag hints (the empty overlay explains how to start).
    await page.goto("/chain/qa-polish-empty");
    await expect(page.getByTestId("chain-request-count")).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(page.locator("footer")).not.toContainText("Drag nodes");

    // Non-empty chain with an unresolved {{baseUrl}}: tips plus the warning count.
    await p5Open(page, P5_CANVAS);
    const footer = await p5Footer(page);
    await expect(footer).toContainText("Drag nodes to reposition");
    await expect(footer).toContainText("unresolved variable");
    await snap("p5-canvas-21-tips");

    // Expanded Run Log hides hint text but keeps the warning.
    await page.getByTestId("toggle-run-log-btn").click();
    await expect(page.getByTestId("run-log-dock")).toBeVisible();
    await expect(footer).not.toContainText("Drag nodes");
    await expect(footer).toContainText("unresolved variable");
    await page.getByTestId("toggle-run-log-btn").click();
    await expect(footer).toContainText("Drag nodes to reposition");

    // Hide tips keeps only the warning, and survives a reload.
    await footer.getByRole("button", { name: "Hide tips" }).click();
    await expect(footer).not.toContainText("Drag nodes");
    await expect(footer).toContainText("unresolved variable");
    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible({
      timeout: LOAD_TIMEOUT_MS,
    });
    await expect(page.locator("footer")).not.toContainText("Drag nodes");
    await expect(page.locator("footer")).toContainText("unresolved variable");

    // Show tips in the ? overlay restores them.
    await page.mouse.click(5, 300);
    await page.keyboard.press("Shift+Slash");
    await page.getByRole("button", { name: "Show tips" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("footer")).toContainText(
      "Drag nodes to reposition"
    );
  });

  test("CANVAS-21: dismissed tips with nothing to warn about render no footer", async ({
    seededPage: page,
  }) => {
    await p5Open(page, "qa-polish-delay-only");
    const footer = page.locator("footer");
    await expect(footer).toContainText("Drag nodes to reposition");
    await footer.getByRole("button", { name: "Hide tips" }).click();
    await expect(page.locator("footer")).toHaveCount(0);
  });
});
