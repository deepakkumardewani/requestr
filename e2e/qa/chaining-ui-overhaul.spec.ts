import { installChainRoutes } from "../fixtures/chainRoutes";
import { expect, test } from "../fixtures/qa";
import {
  addApiRequest,
  countIdbRecords,
  createChain,
  createCollection,
  openTab,
  saveRequestToCollection,
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
  test("Legacy chain migrates and renders", async ({ seededPage: page, snap }) => {
    await page.goto("/chain/qa-collection-1");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 10_000 },
    );
    await expect(page.locator('[data-testid^="chain-node-"]')).toContainText(
      "Get Users",
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
      "1 request",
      { timeout: 10_000 },
    );
    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node).toContainText("Get Users (legacy standalone)");
    // The seeded legacy position (100, 100) survives migration verbatim —
    // React Flow renders the node's transform wrapper on its parent.
    const nodeWrapper = page.locator(
      '.react-flow__node[data-id="qa-req-users-legacy-standalone"]',
    );
    await expect(nodeWrapper).toHaveCSS(
      "transform",
      /matrix\(1,\s*0,\s*0,\s*1,\s*100,\s*100\)/,
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
      "2 requests",
      { timeout: 10_000 },
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
      /HTTP 500/,
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
      .getByRole("button", { name: "Failed" })
      .click();
    await expect(steps).toHaveCount(1);
    await page
      .getByTestId("run-log-dock")
      .getByRole("button", { name: "All", exact: true })
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
        content,
      );
    }

    await snap("05-run-log-dock-tabs-filter");

    // Survives reload — wait until the run is actually persisted first.
    await expect
      .poll(() => countIdbRecords(page, "chainRuns"))
      .toBeGreaterThan(0);
    await page.reload({ waitUntil: "commit" });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 10_000 },
    );
    // The dock's open/collapsed state is persisted (the run auto-opened it),
    // so it comes back open after the reload without another toggle click.
    await expect(page.getByTestId("toggle-run-log-btn")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 5000 },
    );
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 5000,
    });
    // After a reload the dock reopens on the run list, not the previously
    // selected run's steps — select the (only) persisted run to expand it.
    // Row text comes from the "runLogCounts" message: "{passed} ✓ {failed} ✗ …".
    await page
      .getByTestId("run-log-dock")
      .getByText(/✓.*✗/)
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
      "2 requests",
      { timeout: 10_000 },
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
      "1 request",
      { timeout: 5000 },
    );

    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );

    await snap("07-undo-restore");
  });

  test("`?` overlay lists aliases; block-menu, `/` and select-all bindings fire; Cmd+K stays the palette", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/chain/qa-chain-shortcuts");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 10_000 },
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
    await expect(page.locator(".react-flow__node.selected")).not.toHaveCount(
      0,
    );

    await page.keyboard.press("ControlOrMeta+k");
    await expect(
      page.getByPlaceholder("Search requests, actions..."),
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
      "1 request",
      { timeout: 10_000 },
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
      "2 requests",
      { timeout: 10_000 },
    );

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("3");
    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.["x-qa-evaluated-token"]).toBe(
      "secret-token-abc",
    );

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
    const assertionsTab = page.getByRole("tab", { name: "Assertions" });
    await assertionsTab.click();
    await expect(page.getByText("missingA")).toBeVisible();
    await expect(page.getByText("missingB")).toBeVisible();
    await expect(page.getByText("missingC")).toBeVisible();

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
      `[data-testid^="iteration-toggle-${loopId}-"]`,
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
    await page.locator(".react-flow__pane").first().click({
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
      "2 requests",
      { timeout: 10_000 },
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
      await slowLane.getAttribute("data-testid"),
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
      "https://example.com/api/fast",
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
          els.map((el) => (el as HTMLElement).style.transform),
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
      "1 request",
      { timeout: 10_000 },
    );
    await page
      .locator(".react-flow__pane")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ControlOrMeta+a");
    await expect(page.locator(".react-flow__node.selected")).not.toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+d");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
  });
});
