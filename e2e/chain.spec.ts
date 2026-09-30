import { expect, type Locator, type Page, test } from "@playwright/test";
import { installChainRoutes } from "./fixtures/chainRoutes";

// ---------------------------------------------------------------------------
// DB helpers — all called via addInitScript so they run before page load.
// `addInitScript` re-runs on every navigation in the same tab, including
// `page.reload()` — each clear guards on a sessionStorage flag (cleared only
// when a brand-new tab/context starts) so a mid-test reload doesn't wipe the
// data the test just created.
// ---------------------------------------------------------------------------

async function clearChainsDB(page: Page) {
  await page.addInitScript(async () => {
    if (sessionStorage.getItem("e2e-cleared-chains")) return;
    sessionStorage.setItem("e2e-cleared-chains", "1");
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("chains")) {
        const tx = db.transaction("chains", "readwrite");
        tx.objectStore("chains").clear();
      }
      if (db.objectStoreNames.contains("chainConfigs")) {
        const tx = db.transaction("chainConfigs", "readwrite");
        tx.objectStore("chainConfigs").clear();
      }
      if (db.objectStoreNames.contains("chainRuns")) {
        const tx = db.transaction("chainRuns", "readwrite");
        tx.objectStore("chainRuns").clear();
      }
      // Close this ad-hoc connection immediately — `close()` waits for the
      // transactions above to finish before actually detaching. Leaving it
      // open would block the app's own versioned `openDB()` call (it opens
      // at a fixed version, so any leaked connection here can make that
      // upgrade transaction wait forever, hanging store hydration).
      db.close();
    };
  });
}

async function clearCollectionsDB(page: Page) {
  await page.addInitScript(async () => {
    if (sessionStorage.getItem("e2e-cleared-collections")) return;
    sessionStorage.setItem("e2e-cleared-collections", "1");
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("collections")) {
        const tx = db.transaction("collections", "readwrite");
        tx.objectStore("collections").clear();
      }
      if (db.objectStoreNames.contains("requests")) {
        const tx = db.transaction("requests", "readwrite");
        tx.objectStore("requests").clear();
      }
      db.close();
    };
  });
}

async function clearHistoryDB(page: Page) {
  await page.addInitScript(async () => {
    if (sessionStorage.getItem("e2e-cleared-history")) return;
    sessionStorage.setItem("e2e-cleared-history", "1");
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("history")) {
        const tx = db.transaction("history", "readwrite");
        tx.objectStore("history").clear();
      }
      db.close();
    };
  });
}

async function clearTabsDB(page: Page) {
  await page.addInitScript(async () => {
    if (sessionStorage.getItem("e2e-cleared-tabs")) return;
    sessionStorage.setItem("e2e-cleared-tabs", "1");
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("tabs")) {
        const tx = db.transaction("tabs", "readwrite");
        tx.objectStore("tabs").clear();
      }
      db.close();
    };
  });
}

/** Reads the number of persisted `chainRuns` rows for a given chain id, via the `by-chain` index. */
async function getChainRunsCount(page: Page, chainId: string): Promise<number> {
  return page.evaluate(
    (targetChainId) =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("requestly");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("chainRuns")) {
            db.close();
            resolve(0);
            return;
          }
          const tx = db.transaction("chainRuns", "readonly");
          const index = tx.objectStore("chainRuns").index("by-chain");
          const getReq = index.getAll(targetChainId);
          getReq.onsuccess = () => {
            db.close();
            resolve(getReq.result.length);
          };
          getReq.onerror = () => {
            db.close();
            reject(getReq.error);
          };
        };
      }),
    chainId,
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

async function openTab(page: Page) {
  const layout = getLayout(page);
  const btn = layout.getByTestId("new-tab-btn");
  const isVisible = await btn
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (isVisible) {
    await btn.first().click();
  } else {
    await page.keyboard.press("Control+t");
  }
  // Fall back to a direct click if the shortcut/button race left no tab open.
  const urlInputAppeared = await layout
    .getByTestId("url-input")
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (!urlInputAppeared) {
    await btn.first().click({ timeout: 3000 }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

/**
 * Creates a standalone chain via the Create New dropdown.
 * After pressing Enter, the router navigates to /chain/{id}.
 * Awaits the URL change before returning.
 */
async function createChain(page: Page, name: string) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByTestId("create-chain-item").click();
  const input = page.getByTestId("new-chain-name-input");
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(name);
  await page.keyboard.press("Enter");
  // waitUntil defaults to "load", but this is a client-side (App Router)
  // navigation via router.push — no new document is loaded, so the "load"
  // event never re-fires and the default wait condition can hang/time out
  // even though the URL and content have already updated. "commit" waits
  // only for the navigation itself, which is what a SPA route change is.
  await page.waitForURL("**/chain/**", { timeout: 5000, waitUntil: "commit" });
}

/** Returns the first chain-list-item locator and its extracted chain ID. */
async function getFirstChainItem(
  page: Page,
): Promise<{ item: Locator; chainId: string }> {
  const item = page.locator('[data-testid^="chain-list-item-"]').first();
  await expect(item).toBeVisible({ timeout: 5000 });
  const testId = (await item.getAttribute("data-testid")) ?? "";
  const chainId = testId.replace("chain-list-item-", "");
  return { item, chainId };
}

/** Opens the chain more-menu for the given chain item. */
async function openChainMoreMenu(
  page: Page,
  item: Locator,
  chainId: string,
): Promise<void> {
  await item.hover();
  await item.getByTestId(`chain-list-more-btn-${chainId}`).click();
}

// ---------------------------------------------------------------------------
// Block-node helpers
// ---------------------------------------------------------------------------

/**
 * Adds a non-API block node (condition / delay / display) to the canvas.
 * Requires the chain canvas to already be visible (at least one API node must exist).
 */
async function addBlockNode(
  page: Page,
  blockType:
    | "condition"
    | "delay"
    | "display"
    | "start"
    | "evaluate"
    | "validate"
    | "loop"
    | "collect",
  position: { x: number; y: number } = { x: 400, y: 200 },
) {
  await page.getByTestId("block-menu-trigger").click();
  await page.getByTestId(`block-menu-item-${blockType}`).click();
  // Start node doesn't require placement (no pane click)
  if (blockType === "start") {
    return;
  }
  // Move over the pane so cursorPos is set, then click to place the node
  const pane = page.locator(".react-flow__pane").first();
  await pane.hover({ position });
  await pane.click({ position });
}

// ---------------------------------------------------------------------------
// Collections helpers (needed for the "add API from collection" test)
// ---------------------------------------------------------------------------

async function createCollection(page: Page, name: string) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByTestId("create-collection-item").click();
  const input = page.getByTestId("new-collection-name-input");
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(name);
  await page.keyboard.press("Enter");
}

async function saveRequestToCollection(
  page: Page,
  requestName: string,
  url: string,
) {
  const layout = getLayout(page);
  await layout.getByTestId("url-input").fill(url);
  await page.keyboard.press("Escape");
  await layout.getByTestId("save-request-btn").click();
  await expect(page.getByTestId("save-request-modal")).toBeVisible({
    timeout: 5000,
  });
  await page.getByTestId("save-request-name-input").fill(requestName);
  await page
    .locator('[data-testid^="collection-picker-item-"]')
    .first()
    .click();
  await page.getByTestId("save-modal-save-btn").click();
  await expect(page.getByTestId("save-request-modal")).not.toBeVisible();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Chain", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.text().includes("MARKER")) console.log("BROWSER:", msg.text());
    });
    await clearChainsDB(page);
    await clearCollectionsDB(page);
    await clearHistoryDB(page);
    await clearTabsDB(page);
    // Reset sidebar accordion state so the Chains section is always expanded
    await page.addInitScript(() => {
      localStorage.removeItem("rq_sidebar_open_sections");
    });
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Create a standalone chain
  // -------------------------------------------------------------------------
  test("Create a standalone chain via the Create New dropdown", async ({
    page,
  }) => {
    await createChain(page, "Auth Flow");

    // Navigated to chain page — current breadcrumb item shows the chain name
    await expect(
      page.locator('[data-slot="breadcrumb-page"]'),
    ).toContainText("Auth Flow", { timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Scenario: Chain empty state on chain page
  // -------------------------------------------------------------------------
  test("Chain page shows empty state when no APIs have been added", async ({
    page,
  }) => {
    await createChain(page, "Empty Chain");

    await expect(page.getByTestId("chain-empty-state")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("No APIs in this chain")).toBeVisible();
    await expect(page.getByTestId("chain-add-api-btn")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Run Chain button disabled with no requests
  // -------------------------------------------------------------------------
  test("Run Chain button is disabled when the chain has no requests", async ({
    page,
  }) => {
    await createChain(page, "Disabled Test");

    const runBtn = page.getByTestId("run-chain-btn");
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await expect(runBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Scenario: Clear edges button is always visible
  // -------------------------------------------------------------------------
  test("Clear edges button is visible in the chain page header", async ({
    page,
  }) => {
    await createChain(page, "Edge Test");

    await expect(page.getByTestId("clear-edges-btn")).toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Rename a chain from the sidebar
  // -------------------------------------------------------------------------
  test("Rename a standalone chain from the sidebar", async ({ page }) => {
    await createChain(page, "Original Name");

    // Use client-side navigation (breadcrumb Home link) to preserve Zustand store state
    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL("/app", { waitUntil: "commit" });

    const { item, chainId } = await getFirstChainItem(page);
    await openChainMoreMenu(page, item, chainId);
    await page.getByTestId("chain-rename-btn").click();

    const renameInput = page.getByTestId("chain-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });
    await renameInput.fill("Renamed Chain");
    await page.keyboard.press("Enter");

    await expect(item).toContainText("Renamed Chain", { timeout: 5000 });
    await expect(item).not.toContainText("Original Name");
  });

  // -------------------------------------------------------------------------
  // Scenario: Delete a chain from the sidebar
  // -------------------------------------------------------------------------
  test("Delete a standalone chain from the sidebar", async ({ page }) => {
    await createChain(page, "Chain To Delete");

    // Use client-side navigation (breadcrumb Home link) to preserve Zustand store state
    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL("/app", { waitUntil: "commit" });

    const { item, chainId } = await getFirstChainItem(page);
    await openChainMoreMenu(page, item, chainId);
    await page.getByTestId("chain-delete-btn").click();

    // P4.4: deleting a chain now confirms via a shared ConfirmDeleteDialog
    // before mutating anything — cancel first to prove nothing changes, then
    // confirm to actually delete.
    const confirmDialog = page.getByRole("alertdialog", {
      name: "Delete chain?",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(
      page.locator('[data-testid^="chain-list-item-"]'),
    ).toBeVisible();

    await openChainMoreMenu(page, item, chainId);
    await page.getByTestId("chain-delete-btn").click();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Yes, delete chain" }).click();

    await expect(
      page.locator('[data-testid^="chain-list-item-"]'),
    ).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Scenario: Open API picker from empty state
  // -------------------------------------------------------------------------
  test("Open the API picker dialog from the empty state Add API button", async ({
    page,
  }) => {
    await createChain(page, "Picker Test");

    await page.getByTestId("chain-add-api-btn").click();

    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Add API Request")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: API picker has Collections and History tabs
  // -------------------------------------------------------------------------
  test("API picker dialog has Collections and History tabs", async ({
    page,
  }) => {
    await createChain(page, "Tabs Test");

    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });

    await expect(
      page.getByRole("tab", { name: "Collections" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "History" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Collections tab empty state
  // -------------------------------------------------------------------------
  test("API picker Collections tab shows empty state when no collections exist", async ({
    page,
  }) => {
    await createChain(page, "No Collections Test");

    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });

    // Collections tab is selected by default
    await expect(page.getByText("No collections yet")).toBeVisible({
      timeout: 3000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: History tab empty state
  // -------------------------------------------------------------------------
  test("API picker History tab shows empty state when no history exists", async ({
    page,
  }) => {
    await createChain(page, "No History Test");

    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("No history yet")).toBeVisible({
      timeout: 3000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Dismiss API picker with Escape
  // -------------------------------------------------------------------------
  test("Dismiss the API picker dialog with Escape", async ({ page }) => {
    await createChain(page, "Dismiss Test");

    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 3000,
    });

    // Empty state is still showing — no node was added
    await expect(page.getByTestId("chain-empty-state")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // NEW SCENARIOS — multi-node chains, blocks, run results
  // -------------------------------------------------------------------------

  // Scenario: Add multiple API nodes and verify request count updates
  test("Add multiple API nodes and verify request count updates", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Multi Node Collection");
    await saveRequestToCollection(
      page,
      "Request One",
      "https://dummyjson.com/products/1",
    );

    // Open a fresh tab for the second request
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Request Two",
      "https://dummyjson.com/products/2",
    );

    await createChain(page, "Multi Node Chain");

    // First request via empty-state button
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Request One").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 5000 },
    );

    // Second request via block menu
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Request Two").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );
  });

  // Scenario: Block menu shows all five block types
  test("Block menu shows all five block types", async ({ page }) => {
    await openTab(page);
    await createCollection(page, "Block Menu Collection");
    await saveRequestToCollection(
      page,
      "Starter",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Block Menu Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Starter").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 5000 },
    );

    await page.getByTestId("block-menu-trigger").click();

    await expect(page.getByTestId("block-menu-item-api")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-condition")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-delay")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-display")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-start")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-evaluate")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-validate")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-merge")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-loop")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-collect")).toBeVisible();
    await expect(page.getByTestId("block-menu-item-subchain")).toBeVisible();

    // P9.7: clicking "Sub-chain" actually places a node on the canvas, not
    // just a menu item — click it, place on the pane, and assert the node
    // renders (the sub-chain picker opens immediately after placement).
    await page.getByTestId("block-menu-item-subchain").click();
    const pane = page.locator(".react-flow__pane").first();
    await pane.hover({ position: { x: 400, y: 300 } });
    await pane.click({ position: { x: 400, y: 300 } });

    await expect(page.getByTestId("subchain-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-testid^="subchain-node-"]'),
    ).toHaveCount(1);
  });

  // Scenario: Add a Delay block and verify it appears with the default delay
  test("Add a Delay block and verify it appears on the canvas with default delay", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Delay Test Collection");
    await saveRequestToCollection(
      page,
      "Start Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Delay Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Start Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "delay");

    // Default delayMs is 1000 — shown on the value button
    await expect(page.getByTestId("delay-value-btn")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("delay-value-btn")).toContainText("1000");
  });

  // Scenario: Add a Display block and verify it appears on the canvas
  test("Add a Display block and verify it appears on the canvas", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Display Test Collection");
    await saveRequestToCollection(
      page,
      "Source Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Display Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Source Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "display");

    await expect(
      page.locator('[data-testid^="display-node-"]'),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("No response yet")).toBeVisible({
      timeout: 3000,
    });
  });

  // Scenario: Add an Evaluate block and verify it appears on the canvas with its config panel
  test("Add an Evaluate block and verify it appears on the canvas", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Evaluate Test Collection");
    await saveRequestToCollection(
      page,
      "Source Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Evaluate Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Source Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "evaluate");

    await expect(
      page.locator('[data-testid^="evaluate-node-"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  // Scenario: Add a Validate block and verify it appears on the canvas with its config panel
  test("Add a Validate block and verify it appears on the canvas", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Validate Test Collection");
    await saveRequestToCollection(
      page,
      "Source Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Validate Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Source Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "validate");

    await expect(
      page.locator('[data-testid^="validate-node-"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  // Scenario: Add a Condition block and verify the config panel opens automatically
  test("Add a Condition block and verify the config panel opens automatically", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Condition Test Collection");
    await saveRequestToCollection(
      page,
      "API Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Condition Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("API Request", { exact: true }).click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "condition");

    // Placing a condition node auto-opens the ConditionConfigPanel
    await expect(page.getByText("Configure Condition")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByPlaceholder("e.g. {{edgeId:alias}}"),
    ).toBeVisible();
  });

  // Scenario: Condition config panel can be saved and the node stays on the canvas
  test("Condition block config panel can be saved and node remains on the canvas", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Condition Save Collection");
    await saveRequestToCollection(
      page,
      "First Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Condition Save Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("First Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "condition");

    // Auto-opened config panel
    await expect(page.getByText("Configure Condition")).toBeVisible({
      timeout: 5000,
    });

    // Save the condition node as-is
    await page.getByRole("button", { name: "Save" }).click();

    // Panel closes and condition node is visible on the canvas
    await expect(page.getByText("Configure Condition")).not.toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.locator('[data-testid^="condition-node-"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  // Scenario: Run a single-API chain and see passed count in header
  test("Run a chain with a single API node shows passed count in header", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Run Single Collection");
    await saveRequestToCollection(
      page,
      "Get Product",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Run Single Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Get Product").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();

    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("1");
  });

  // Scenario: Run a chain with multiple API nodes shows correct pass count
  test("Run a chain with multiple API nodes shows correct pass count", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Multi Run Collection");
    await saveRequestToCollection(
      page,
      "Node One",
      "https://dummyjson.com/products/1",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Node Two",
      "https://dummyjson.com/products/2",
    );

    await createChain(page, "Multi Run Chain");

    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Node One").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Node Two").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );

    await page.getByTestId("run-chain-btn").click();

    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");
  });

  // Scenario: API node shows failed count in header when request returns an error
  test("API node shows failed count in header when request returns an error status", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Fail Test Collection");
    // dummyjson returns 404 for unknown paths — chain runner marks non-2xx as failed
    await saveRequestToCollection(
      page,
      "Bad Request",
      "https://dummyjson.com/nonexistent-404-path",
    );

    await createChain(page, "Fail Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Bad Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();

    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-failed-count")).toContainText("1");
  });

  // Scenario: Clear edges removes connections but keeps nodes on the canvas
  test("Clear edges removes connections but keeps nodes on the canvas", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Clear Edges Collection");
    await saveRequestToCollection(
      page,
      "Node A",
      "https://dummyjson.com/products/1",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Node B",
      "https://dummyjson.com/products/2",
    );

    await createChain(page, "Clear Edges Chain");

    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Node A").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Node B").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );

    await page.getByTestId("clear-edges-btn").click();

    // P4.7: clearing edges now confirms via a shared ConfirmDeleteDialog
    // before mutating the chain (added in P4.4) — confirm to proceed.
    await expect(
      page.getByRole("alertdialog", { name: "Clear all edges?" }),
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Yes, clear edges" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Clear all edges?" }),
    ).not.toBeVisible();

    // Nodes are still present — request count unchanged
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
    );
    // Run Chain stays enabled because nodes still exist
    await expect(page.getByTestId("run-chain-btn")).toBeEnabled();
  });

  // -------------------------------------------------------------------------
  // ORIGINAL SCENARIO: Add an API from a collection to the chain
  // -------------------------------------------------------------------------
  test("Add an API from a collection to the chain via the picker", async ({
    page,
  }) => {
    // Set up: open a tab, create a collection, save a request
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();

    await createCollection(page, "Products API");
    await expect(page.getByText("Products API")).toBeVisible({ timeout: 5000 });

    await saveRequestToCollection(
      page,
      "Get Product",
      "https://dummyjson.com/products/1",
    );

    // Create a chain — navigates to chain page
    await createChain(page, "Product Chain");

    // Open the picker
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });

    // The collection should be visible with "Get Product"
    await expect(page.getByText("Products API")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Get Product")).toBeVisible({ timeout: 3000 });

    // Click the request row to add it
    await page.getByText("Get Product").click();

    // Dialog closes after adding
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Chain now has 1 request — empty state is gone
    await expect(page.getByTestId("chain-empty-state")).not.toBeVisible({
      timeout: 5000,
    });

    // Header request count shows 1 request
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 5000 },
    );

    // Run Chain button becomes enabled
    await expect(page.getByTestId("run-chain-btn")).toBeEnabled({
      timeout: 3000,
    });
  });

  // Fixture verification: hermetic chain routes work with zero external requests
  test("Chain fixture provides deterministic responses without external requests", async ({
    page,
  }) => {
    // Install hermetic routes to intercept all /api/proxy requests
    await installChainRoutes(page);

    // Track external requests (should be zero if fixture routes are working)
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      // dummyjson is the only external domain in default tests
      if (
        request.url().includes("dummyjson.com") &&
        !request.url().includes("/api/proxy")
      ) {
        externalRequests.push(request.url());
      }
    });

    await openTab(page);
    await createCollection(page, "Fixture Test Collection");

    // Create a request pointing to our fixture /fast endpoint
    await saveRequestToCollection(
      page,
      "Fixture Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Fixture Test Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fixture Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Run the chain and verify it completes (proving the fixture works)
    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("1");

    // Verify chainRuns were created and are now cleared on next test setup
    // (This is implicitly tested by subsequent tests inheriting a clean DB state)
  });

  // -------------------------------------------------------------------------
  // Phase 2 scenarios
  // -------------------------------------------------------------------------

  // Scenario: error strip on a failing node (P2.4)
  test("Failing node shows an error strip on the canvas node", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Error Strip Collection");
    await saveRequestToCollection(
      page,
      "Failing Request",
      "https://example.com/api/fail",
    );

    await createChain(page, "Error Strip Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Failing Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();

    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15000,
    });

    // The node renders a compact "Error" strip; the full HTTP error message
    // is exposed via its title attribute (native tooltip) rather than as
    // visible text, to keep the badge short.
    const node = page.locator('[data-testid^="chain-node-"]').first();
    const errorStrip = node.locator("span[title]");
    await expect(errorStrip).toBeVisible({ timeout: 5000 });
    await expect(errorStrip).toHaveAttribute("title", /HTTP 500/);

    // Clicking the failed node opens its details panel, which surfaces the
    // same error in an "Error" section (P2.4 requires node + panel + log).
    await node.click();
    const detailsPanel = page.getByRole("dialog");
    await expect(
      detailsPanel.getByText("Error", { exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(detailsPanel.getByText(/HTTP 500/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detailsPanel).not.toBeVisible({ timeout: 5000 });

    // The run-log dock's Error tab for the failed step shows the same error.
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-step-id]').first().click();
    await page.getByRole("tab", { name: "Error" }).click();
    await expect(
      page.locator('[data-testid="run-log-dock"]').getByText(/HTTP 500/),
    ).toBeVisible();
  });

  // Scenario: Stop cancels a slow run (P2.5) — uses the hermetic fixture
  test("Stop cancels a slow run and marks it stopped without a late response", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Stop Run Collection");
    await saveRequestToCollection(
      page,
      "Slow Request",
      "https://example.com/api/slow",
    );

    await createChain(page, "Stop Run Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Slow Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();

    // Stop button appears while the slow request is in flight
    await expect(page.getByTestId("stop-chain-btn")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("stop-chain-btn").click();

    // Run button reappears once the run has stopped — well before the 5s delay elapses
    await expect(page.getByTestId("run-chain-btn")).toBeVisible({
      timeout: 3000,
    });

    // No passed count should ever appear — the slow response never had a chance to land
    await expect(page.getByTestId("chain-passed-count")).not.toBeVisible();
  });

  // Scenario: right-click a Display node shows its own menu, not the API menu (P2.6)
  test("Right-clicking a Display node shows its own context menu", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Display Menu Collection");
    await saveRequestToCollection(
      page,
      "Source Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Display Menu Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Source Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "display");
    const displayNode = page.locator('[data-testid^="display-node-"]').first();
    await expect(displayNode).toBeVisible({ timeout: 5000 });

    // Left-clicking the Display node opens the same data-mapping panel a
    // left-click on an edge would open (P2.1/P2.2 — Display click path).
    await displayNode.click();
    await expect(page.getByText("Configure Dependency")).toBeVisible({
      timeout: 5000,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByText("Configure Dependency")).not.toBeVisible({
      timeout: 5000,
    });

    await displayNode.click({ button: "right" });

    // Display's own menu — Configure / Duplicate / Delete node
    await expect(page.getByText("Configure", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Duplicate", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Delete node", { exact: true }),
    ).toBeVisible();

    // Not the API node's menu
    await expect(page.getByText("Add API after this")).not.toBeVisible();
    await expect(page.getByText("Run up to here")).not.toBeVisible();
  });

  // Scenario: map data across an edge and see it injected (P2.1, P2.2)
  test("Mapping data across an edge injects the value into the target request", async ({
    page,
  }) => {
    await installChainRoutes(page);

    // Capture the target node's outgoing request to assert the injected header.
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

    await openTab(page);
    await createCollection(page, "Edge Injection Collection");
    await saveRequestToCollection(
      page,
      "Token Source",
      "https://example.com/api/token",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Echo Target",
      "https://example.com/api/echo",
    );

    await createChain(page, "Edge Injection Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Token Source").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Echo Target").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );

    // Connect A's success handle to B's incoming handle to create the edge.
    const nodeA = page.locator('[data-testid^="chain-node-"]').nth(0);
    const nodeB = page.locator('[data-testid^="chain-node-"]').nth(1);
    const sourceHandle = nodeA.locator(".react-flow__handle-right").first();
    const targetHandle = nodeB.locator(".react-flow__handle-left").first();
    await sourceHandle.hover();
    await page.mouse.down();
    await targetHandle.hover();
    await page.mouse.up();

    await expect(page.locator('[data-testid^="rf__edge-"]')).toBeVisible({
      timeout: 5000,
    });

    // Default node positions have zero gap between adjacent nodes (280px
    // pitch == 280px max node width), so the edge's path — and its midpoint
    // hit-area — sits directly under a node's bounding box. Auto-arrange
    // spaces the nodes out so the edge midpoint becomes clickable, exactly
    // as a real user would need to do to interact with a cramped chain.
    await page.getByLabel("Auto-arrange nodes on the canvas").click();

    // Tailwind's "/" in the arbitrary group name (`group/edgelabel`) is a
    // literal character in the DOM class attribute, but Playwright's CSS
    // engine does not accept a backslash-escaped slash inside a class
    // selector (`.group\/edgelabel` never matches). Use an attribute
    // selector instead, which needs no escaping.
    const edgeMidpoint = page.locator('[class~="group/edgelabel"]').first();
    await edgeMidpoint.click();

    // ArrowConfigPanel opens bound to the edge
    await expect(page.getByText("Configure Dependency")).toBeVisible({
      timeout: 5000,
    });

    // Run the source API to populate the response tree
    const [sourceRunResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/proxy")),
      page.getByRole("button", { name: "Run Source API" }).first().click(),
    ]);
    await sourceRunResponse.finished();

    const useTokenBtn = page.getByLabel("Use $.data.token");
    await expect(useTokenBtn).toBeVisible({ timeout: 10000 });
    await useTokenBtn.click();

    // Target field defaults to "header" — set a distinctive header key
    const headerKeyInput = page.locator('input[placeholder="Authorization"]');
    await headerKeyInput.fill("x-injected-token");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Configure Dependency")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");

    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.["x-injected-token"]).toBe("secret-token-abc");
  });

  // Scenario: {{baseUrl}} resolved in a chain run (P2.3)
  test("A request using {{baseUrl}} resolves against the active environment in a chain run", async ({
    page,
  }) => {
    await installChainRoutes(page);

    let capturedUrl: string | null = null;
    await page.route("/api/proxy", async (route) => {
      const bodyText = route.request().postData();
      if (bodyText) {
        const parsed = JSON.parse(bodyText) as { url?: string };
        if (parsed.url?.includes("/fast")) {
          capturedUrl = parsed.url;
        }
      }
      await route.fallback();
    });

    await openTab(page);

    // Create an environment with a baseUrl variable — it becomes active immediately.
    const layout = getLayout(page);
    await layout.getByTestId("env-selector-trigger").click();
    await page.getByTestId("env-selector-manage-btn").click();
    await expect(page.getByTestId("env-manager-dialog")).toBeVisible();
    await page.getByTestId("add-env-btn").click();
    const envNameInput = page.getByTestId("env-item-rename-input");
    await envNameInput.fill("Chain Env");
    await page.keyboard.press("Enter");

    await page.getByTestId("add-variable-btn").click();
    const varRow = page.getByTestId("var-row").last();
    await varRow.getByTestId("var-key-input").fill("baseUrl");
    await varRow
      .getByTestId("var-initial-value-input")
      .fill("https://example.com/api");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");

    await createCollection(page, "Base URL Collection");
    await saveRequestToCollection(page, "Fast Request", "{{baseUrl}}/fast");

    await createChain(page, "Base URL Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // No unresolved-variable pill since baseUrl resolves from the active environment
    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node.getByText(/unresolved/)).not.toBeVisible();

    await page.getByTestId("run-chain-btn").click();

    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("1");

    expect(capturedUrl).toBe("https://example.com/api/fast");
  });

  // -------------------------------------------------------------------------
  // Phase 3 scenarios — run-log dock (P3.15)
  // -------------------------------------------------------------------------

  // Scenario: run log survives a page reload — the run history persists in
  // IDB and is reloaded (`loadRuns`) on mount, independent of the dock's own
  // open/collapsed UI state.
  test("Run log history survives a page reload", async ({ page }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Reload Run Collection");
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Reload Run Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 5000 },
    );

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });

    // The dock now auto-opens as soon as the run starts (P3.13/P3.14), so no
    // manual toggle click is needed here — it's already visible.
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/1 ✓/)).toBeVisible({ timeout: 5000 });

    // The chain record is written to IDB on a short debounce — give it a
    // moment to flush before reloading.
    await page.waitForTimeout(1000);

    await page.reload({ waitUntil: "commit" });
    // Wait for chain hydration to finish before interacting with the dock.
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 10000 },
    );

    // The dock's own open/collapsed state is not persisted, so reopen it —
    // the run history underneath must still reflect the run that happened
    // before the reload.
    await page.getByTestId("toggle-run-log-btn").click();
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/1 ✓/)).toBeVisible({ timeout: 5000 });
  });

  // Scenario: deleting a chain removes its persisted runs (P3.2 handleChainDeleted)
  test("Deleting a chain removes its persisted runs", async ({ page }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Delete Runs Collection");
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Delete Runs Chain");
    const chainId = page.url().split("/chain/")[1];

    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });

    await expect
      .poll(() => getChainRunsCount(page, chainId), { timeout: 5000 })
      .toBeGreaterThan(0);

    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL("/app", { waitUntil: "commit" });

    const { item } = await getFirstChainItem(page);
    await openChainMoreMenu(page, item, chainId);
    await page.getByTestId("chain-delete-btn").click();

    // P4.4: deletion now confirms via a shared ConfirmDeleteDialog — confirm
    // to proceed with the delete.
    const confirmDialog = page.getByRole("alertdialog", {
      name: "Delete chain?",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Yes, delete chain" }).click();

    await expect(
      page.locator('[data-testid^="chain-list-item-"]'),
    ).not.toBeVisible({ timeout: 5000 });

    await expect
      .poll(() => getChainRunsCount(page, chainId), { timeout: 5000 })
      .toBe(0);
  });

  // Scenario: the run log dock opens automatically the moment a run starts,
  // without the user ever touching the header toggle (P3.13/P3.14 auto-open).
  test("Run log dock opens automatically when a run starts", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Auto Open Collection");
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Auto Open Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByTestId("run-log-dock")).not.toBeVisible();

    await page.getByTestId("run-chain-btn").click();

    // No manual toggle click — the dock must appear on its own.
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });
  });

  // Scenario: the Failed filter in the steps timeline hides passed steps.
  test("Filtering the steps timeline by Failed hides non-failed steps", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Filter Failed Collection");
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Failing Request",
      "https://example.com/api/fail",
    );

    await createChain(page, "Filter Failed Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Failing Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });

    // Each node contributes exactly one row that transitions running →
    // passed/failed in place, so 2 requests produce 2 rows before filtering.
    const steps = page.locator('[data-step-id]');
    await expect(steps).toHaveCount(2);

    await page
      .getByTestId("run-log-dock")
      .getByRole("button", { name: "Failed" })
      .click();
    await expect(steps).toHaveCount(1);
    await expect(steps.first()).toContainText("Failing Request");
  });

  // -------------------------------------------------------------------------
  // Phase 9 scenario — sub-chain steps nested in the run log (P9.9)
  // -------------------------------------------------------------------------

  // Scenario: running a chain that references another chain via a Sub-chain
  // block nests the referenced chain's steps under the Sub-chain step in the
  // run log, and that group is collapsed by default and expandable (P9.8).
  test("Sub-chain steps appear nested and expandable under the Sub-chain step in the run log", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Sub-chain Collection");
    await saveRequestToCollection(
      page,
      "Sub Body Request",
      "https://example.com/api/fast",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Host Request",
      "https://example.com/api/fast",
    );

    // Build the referenced chain (B) with a single request.
    await createChain(page, "Referenced Chain");
    const referencedChainId = page.url().split("/chain/")[1];
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Sub Body Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 5000 },
    );

    // Build the host chain (A): one real request plus a Sub-chain block
    // referencing chain B.
    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL("/app", { waitUntil: "commit" });

    await createChain(page, "Host Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Host Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 request",
      { timeout: 5000 },
    );

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-subchain").click();
    const pane = page.locator(".react-flow__pane").first();
    // Place well away from the host request node (positioned near the pane's
    // default center) so this click can't land on the node's own clickable
    // area and open its details sheet instead of confirming ghost placement.
    await pane.hover({ position: { x: 700, y: 550 } });
    await pane.click({ position: { x: 700, y: 550 } });

    await expect(page.getByTestId("subchain-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page
      .getByTestId(`subchain-picker-item-${referencedChainId}`)
      .click();
    await expect(page.getByTestId("subchain-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator('[data-testid^="subchain-node-"]'),
    ).toHaveCount(1);

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });

    // Two top-level steps: the host request and the Sub-chain step. The
    // referenced chain's own step must not appear as a third top-level row —
    // it is nested under the Sub-chain step's toggle instead.
    const stepRows = page.locator('[data-step-id]');
    await expect(stepRows).toHaveCount(2);

    const subChainToggle = page.locator(
      '[data-testid^="subchain-toggle-"]',
    );
    await expect(subChainToggle).toHaveCount(1);
    await expect(subChainToggle).toHaveAttribute("aria-expanded", "false");

    // Nested step is hidden until the toggle is expanded.
    await expect(page.getByText("Sub Body Request")).not.toBeVisible();

    await subChainToggle.click();
    await expect(subChainToggle).toHaveAttribute("aria-expanded", "true");
    await expect(stepRows).toHaveCount(3);
    await expect(page.getByText("Sub Body Request")).toBeVisible();

    // Collapsing hides the nested step again without losing the run result.
    await subChainToggle.click();
    await expect(subChainToggle).toHaveAttribute("aria-expanded", "false");
    await expect(stepRows).toHaveCount(2);
  });

  // Scenario: each step-detail tab renders (switches panel) when clicked.
  test("Each step-detail tab (Input/Output/Assertions/Extracted/Error) renders when selected", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Step Tabs Collection");
    await saveRequestToCollection(
      page,
      "Failing Request",
      "https://example.com/api/fail",
    );

    await createChain(page, "Step Tabs Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Failing Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });

    // The node contributes a single row that ends in the "failed" state.
    await page.locator('[data-step-id]').first().click();

    // The failed step has an Error tab in addition to the base four.
    for (const tabName of [
      "Input",
      "Output",
      "Assertions",
      "Extracted",
      "Error",
    ]) {
      const tab = page.getByRole("tab", { name: tabName });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }
  });

  // Scenario: clicking a step in the timeline selects/highlights the
  // corresponding canvas node (two-way sync via `useRunSelectionSync`).
  test("Clicking a step in the timeline selects the corresponding canvas node", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Select Node Collection");
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Select Node Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });

    // The base node class always includes `focus-visible:ring-ring` (a11y
    // outline), so match the unprefixed, contiguous highlight sequence that
    // `isKeyboardFocused` appends instead of the bare `ring-ring` token.
    const highlightClasses =
      /ring-2 ring-ring ring-offset-2 ring-offset-background/;
    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node).not.toHaveClass(highlightClasses);

    await page.locator('[data-step-id]').first().click();

    await expect(node).toHaveClass(highlightClasses);
  });

  // -------------------------------------------------------------------------
  // Phase 4 — Undo/redo, confirmations, shortcuts (P4.12)
  // -------------------------------------------------------------------------

  test("Deleting a node then pressing Cmd+Z restores it", async ({ page }) => {
    await openTab(page);
    await createCollection(page, "Undo Delete Collection");
    await saveRequestToCollection(
      page,
      "Undo Delete Request A",
      "https://dummyjson.com/products/1",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Undo Delete Request B",
      "https://dummyjson.com/products/2",
    );

    await createChain(page, "Undo Delete Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Undo Delete Request A").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Undo Delete Request B").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );

    // Leaving one node behind after the delete keeps the chain canvas (and
    // its keyboard shortcuts) mounted — an empty chain swaps in the
    // page-level empty state instead, which has no ⌘Z binding.
    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click();
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
  });

  test("Dragging a node then pressing Cmd+Z returns it to its prior position", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Undo Drag Collection");
    await saveRequestToCollection(
      page,
      "Undo Drag Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Undo Drag Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Undo Drag Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    const before = await node.boundingBox();
    if (!before) throw new Error("node has no bounding box");

    await node.hover();
    await page.mouse.down();
    await page.mouse.move(
      before.x + before.width / 2 + 150,
      before.y + before.height / 2 + 120,
      { steps: 10 },
    );
    await page.mouse.up();

    const afterDrag = await node.boundingBox();
    if (!afterDrag) throw new Error("node has no bounding box after drag");
    expect(afterDrag.x).not.toBeCloseTo(before.x, 0);

    await page.keyboard.press("ControlOrMeta+z");

    await expect(async () => {
      const restored = await node.boundingBox();
      if (!restored) throw new Error("node has no bounding box after undo");
      expect(restored.x).toBeCloseTo(before.x, 0);
      expect(restored.y).toBeCloseTo(before.y, 0);
    }).toPass({ timeout: 5000 });
  });

  test("? opens the shortcuts overlay showing the Chain canvas group", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Shortcuts Overlay Collection");
    await saveRequestToCollection(
      page,
      "Shortcuts Overlay Request",
      "https://dummyjson.com/products/1",
    );

    // The chain canvas (and its shortcut bindings) only mounts once the
    // chain has at least one node — an empty chain shows the page-level
    // empty state instead.
    await createChain(page, "Shortcuts Overlay Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Shortcuts Overlay Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.keyboard.press("Shift+Slash");

    const dialog = page.getByRole("dialog", { name: "Keyboard Shortcuts" });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText("Chain canvas")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("Cmd+Shift+K opens the block menu while Cmd+K still opens the command palette", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Block Menu Shortcut Collection");
    await saveRequestToCollection(
      page,
      "Block Menu Shortcut Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Block Menu Shortcut Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Block Menu Shortcut Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.keyboard.press("ControlOrMeta+Shift+k");
    await expect(page.getByTestId("block-menu-item-delay")).toBeVisible({
      timeout: 5000,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("block-menu-item-delay")).not.toBeVisible();

    await page.keyboard.press("ControlOrMeta+k");
    await expect(
      page.getByPlaceholder("Search requests, actions..."),
    ).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });

  test("Copy/paste reproduces blocks", async ({ page }) => {
    await openTab(page);
    await createCollection(page, "Copy Paste Collection");
    await saveRequestToCollection(
      page,
      "Copy Paste Request",
      "https://dummyjson.com/products/1",
    );

    await createChain(page, "Copy Paste Source Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Copy Paste Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "delay");
    await expect(page.getByTestId("delay-value-btn")).toBeVisible({
      timeout: 5000,
    });

    // Click near the node's top-left (the clock icon) rather than its center —
    // the center overlaps the "delay-value-btn", which would open the inline
    // edit input and focus it, making the following Cmd+C a no-op (shortcuts
    // are suppressed while an editable input is focused).
    const delayNode = page.locator('[data-testid^="delay-node-"]').first();
    await delayNode.click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("ControlOrMeta+c");
    await page.keyboard.press("ControlOrMeta+v");

    // Pasting reproduces the copied block with a fresh id — two delay nodes
    // now exist on the same canvas.
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(2, {
      timeout: 5000,
    });
    await expect(page.getByTestId("delay-value-btn").first()).toBeVisible();
  });
  // ===== Phase 5: Start block scenarios (P5.10) =====

  // Scenario: Adding a Start block and declaring inputs shows them on the canvas node
  test("Adding a Start block and declaring inputs shows them on the canvas node", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Start Block Collection");
    await saveRequestToCollection(
      page,
      "Test Request",
      "https://example.com/api/test",
    );

    await createChain(page, "Start Block Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Test Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Add Start block
    await addBlockNode(page, "start");
    const startNode = page.locator('[data-testid^="start-node-"]').first();
    await expect(startNode).toBeVisible({ timeout: 5000 });
    await page.getByLabel("Auto-arrange nodes on the canvas").click();

    // Initially, should show "No inputs defined"
    await expect(startNode).toContainText("No inputs defined");

    // Open Start config panel by clicking the configure button
    await startNode.hover();
    await page.getByLabel("Configure start").click();

    // Add two inputs
    await page.getByTestId("start-config-add-input-btn").click();
    await page.getByTestId("start-config-input-key").first().fill("token");
    await page.getByTestId("start-config-default-value").first().fill("default-token");

    await page.getByTestId("start-config-add-input-btn").click();
    const inputKeys = page.getByTestId("start-config-input-key");
    await inputKeys.nth(1).fill("userId");
    const defaultValues = page.getByTestId("start-config-default-value");
    await defaultValues.nth(1).fill("user-123");

    // Save the config
    await page.getByTestId("start-config-save-btn").click();
    await expect(page.getByText("Configure Start")).not.toBeVisible({
      timeout: 5000,
    });

    // Verify the inputs are now shown on the node
    await expect(startNode).toContainText("token");
    await expect(startNode).toContainText("userId");
    await expect(startNode).not.toContainText("No inputs defined");
  });

  // Scenario: A Start input override reaches a downstream header
  test("A Start input override reaches a downstream request header", async ({
    page,
  }) => {
    await installChainRoutes(page);

    // Capture the outgoing request to assert the injected header
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

    await openTab(page);
    await createCollection(page, "Start Input Collection");

    // Save a request with a {{token}} header
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill("https://example.com/api/echo");
    await page.keyboard.press("Escape");
    await page.getByTestId("request-tab-headers").click();
    const headerRows = page.getByTestId("headers-draft-row-key");
    await headerRows.first().fill("x-chain-token");
    await page.getByTestId("headers-draft-row-value").first().fill("{{token}}");
    await layout.getByTestId("save-request-btn").click();
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("save-request-name-input").fill("Echo Target");
    await page
      .locator('[data-testid^="collection-picker-item-"]')
      .first()
      .click();
    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible({
      timeout: 5000,
    });

    await createChain(page, "Start Override Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Echo Target").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Add Start block with token input
    await addBlockNode(page, "start");
    const startNode = page.locator('[data-testid^="start-node-"]').first();
    await expect(startNode).toBeVisible({ timeout: 5000 });
    await page.getByLabel("Auto-arrange nodes on the canvas").click();

    await startNode.hover();
    await page.getByLabel("Configure start").click();

    await page.getByTestId("start-config-add-input-btn").click();
    await page.getByTestId("start-config-input-key").first().fill("token");
    await page.getByTestId("start-config-default-value").first().fill("default-token");

    await page.getByTestId("start-config-save-btn").click();
    await expect(page.getByText("Configure Start")).not.toBeVisible({
      timeout: 5000,
    });

    // Run with inputs and override the token
    await page.getByTestId("run-with-inputs-btn").click();
    await expect(page.getByTestId("run-with-inputs-popover")).toBeVisible({
      timeout: 5000,
    });
    
    // Find and fill the token input field
    await page.getByLabel("token").fill("override-token");

    await page
      .getByTestId("run-with-inputs-popover")
      .getByRole("button", { name: "Run" })
      .click();

    // Wait for the run to complete
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");

    // Verify the captured header has the override value
    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.["x-chain-token"]).toBe("override-token");
  });

  // Scenario: Run with inputs is hidden until the chain has a Start block
  test("Run with inputs button is hidden until the chain has a Start block", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "No Start Collection");
    await saveRequestToCollection(
      page,
      "Test Request",
      "https://example.com/api/test",
    );

    await createChain(page, "No Start Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Test Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Verify "Run with inputs" button is NOT visible
    await expect(page.getByTestId("run-with-inputs-btn")).not.toBeVisible();

    // Add a Start block
    await addBlockNode(page, "start");
    const startNode = page.locator('[data-testid^="start-node-"]').first();
    await expect(startNode).toBeVisible({ timeout: 5000 });
    await page.getByLabel("Auto-arrange nodes on the canvas").click();

    // Now "Run with inputs" button should be visible
    await expect(page.getByTestId("run-with-inputs-btn")).toBeVisible({
      timeout: 5000,
    });

    // Delete the Start block
    await startNode.hover();
    await page.getByLabel("Remove start from chain").click();

    // "Run with inputs" button should disappear again
    await expect(page.getByTestId("run-with-inputs-btn")).not.toBeVisible({
      timeout: 5000,
    });
  });

  // Scenario: an Evaluate node's return value is injected into a downstream
  // request's header, exactly like an API node's response would be (P6.11)
  test("Evaluate node result is injected into a downstream request header", async ({
    page,
  }) => {
    await installChainRoutes(page);

    // Capture the target node's outgoing request to assert the injected header.
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

    await openTab(page);
    await createCollection(page, "Evaluate Header Collection");
    await saveRequestToCollection(
      page,
      "Token Source",
      "https://example.com/api/token",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Echo Target",
      "https://example.com/api/echo",
    );

    await createChain(page, "Evaluate Header Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Token Source").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "evaluate");

    // Placing an Evaluate node auto-opens its config panel — reshape the
    // upstream token response into `{ token }` so the edge's default
    // `$.token` injection picks it up.
    await expect(page.getByText("Configure Evaluate")).toBeVisible({
      timeout: 5000,
    });
    const evaluateNode = page.locator('[data-testid^="evaluate-node-"]');

    await page.getByPlaceholder("e.g. token").fill("headerToken");
    const evaluateEditor = page.locator(".cm-content").first();
    await evaluateEditor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("return { token: data.response.data.token };", {
      delay: 20,
    });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Configure Evaluate")).not.toBeVisible({
      timeout: 5000,
    });

    // Connect Token Source -> Evaluate right after the node exists, before
    // adding the third node — mirrors the pattern from "Mapping data across
    // an edge injects the value into the target request" above, where
    // connecting immediately (before any auto-arrange) reliably grabs the
    // right handle.
    const nodeA = page.locator('[data-testid^="chain-node-"]').nth(0);
    await nodeA.locator('[data-handleid="success"]').hover();
    await page.mouse.down();
    await evaluateNode.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(1, {
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Echo Target").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    const nodeB = page.locator('[data-testid^="chain-node-"]').nth(1);
    await evaluateNode.locator(".react-flow__handle-right").first().hover();
    await page.mouse.down();
    await nodeB.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(2, {
      timeout: 5000,
    });

    // Default node positions have zero gap, so edge midpoints sit under a
    // node's bounding box — auto-arrange spaces nodes out so they're clickable.
    await page.getByLabel("Auto-arrange nodes on the canvas").click();

    // The Evaluate -> Echo Target edge is the one created most recently.
    const edgeMidpoint = page.locator('[class~="group/edgelabel"]').last();
    await edgeMidpoint.click();
    await expect(page.getByText("Configure Dependency")).toBeVisible({
      timeout: 5000,
    });

    // Default injection is already `$.token` -> header -> "Authorization";
    // only the header key needs to be made distinctive for the assertion.
    const headerKeyInput = page.locator('input[placeholder="Authorization"]');
    await headerKeyInput.fill("x-evaluated-token");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Configure Dependency")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("3");

    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.["x-evaluated-token"]).toBe("secret-token-abc");
  });

  // Scenario: a non-adjacent literal `{{alias}}` template (typed directly
  // into a request field, not via the edge-injection picker) resolves
  // through the shared value namespace even across a pass-through node.
  test("A literal {{alias}} typed directly into a request field resolves via a non-adjacent alias", async ({
    page,
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

    await openTab(page);
    await createCollection(page, "Literal Alias Collection");
    await saveRequestToCollection(
      page,
      "Token Source",
      "https://example.com/api/token",
    );

    await openTab(page);
    await saveRequestToCollection(
      page,
      "Passthrough",
      "https://example.com/api/fast",
    );

    // Echo Target's header value is a LITERAL `{{authToken}}` typed
    // directly into the header field — not written via the arrow-config
    // injection picker on any edge feeding this node.
    await openTab(page);
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill("https://example.com/api/echo");
    await page.keyboard.press("Escape");
    await page.getByTestId("request-tab-headers").click();
    await page
      .locator(':visible [data-testid="headers-draft-row-key"]')
      .fill("x-literal-alias");
    await page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .fill("{{authToken}}");
    await layout.getByTestId("url-input").click();
    await layout.getByTestId("save-request-btn").click();
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("save-request-name-input").fill("Echo Target");
    await page
      .locator('[data-testid^="collection-picker-item-"]')
      .first()
      .click();
    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible();

    await createChain(page, "Literal Alias Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Token Source").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Passthrough").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Connect A (Token Source) -> B (Passthrough) right after B exists,
    // before adding the third node — default node positions have zero gap,
    // so connecting immediately (before a node is stacked on top) reliably
    // grabs the right handle (mirrors the pattern used by "Evaluate node
    // result is injected into a downstream request header" above). This
    // edge carries an extraction that aliases the token as `authToken` —
    // the only place the alias is written into the shared namespace.
    const nodeA = page.locator('[data-testid^="chain-node-"]').nth(0);
    const nodeB = page.locator('[data-testid^="chain-node-"]').nth(1);

    await nodeA.locator('[data-handleid="success"]').hover();
    await page.mouse.down();
    await nodeB.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(1, {
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Echo Target").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "3 requests",
      { timeout: 5000 },
    );

    // Connect B (Passthrough) -> C (Echo Target) as a plain pass-through
    // edge — no injection is configured on it at all. Node C sits off the
    // right edge of the viewport at this zoom level (the canvas doesn't
    // auto-scroll into view like a normal page), so fit the view first or
    // the drag lands on nothing.
    await page.getByLabel("Fit View").click();
    const nodeC = page.locator('[data-testid^="chain-node-"]').nth(2);
    await nodeB.locator('[data-handleid="success"]').hover();
    await page.mouse.down();
    await nodeC.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(2, {
      timeout: 5000,
    });

    // Default node positions have zero gap, so edge midpoints sit under a
    // node's bounding box — auto-arrange spaces nodes out so they're clickable.
    await page.getByLabel("Auto-arrange nodes on the canvas").click();

    // Configure the A -> B edge's extraction/alias via the arrow-config panel.
    const edgeMidpoint = page.locator('[class~="group/edgelabel"]').first();
    await edgeMidpoint.click();
    await expect(page.getByText("Configure Dependency")).toBeVisible({
      timeout: 5000,
    });

    const [sourceRunResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/proxy")),
      page.getByRole("button", { name: "Run Source API" }).first().click(),
    ]);
    await sourceRunResponse.finished();

    const useTokenBtn = page.getByLabel("Use $.data.token");
    await expect(useTokenBtn).toBeVisible({ timeout: 10000 });
    await useTokenBtn.click();

    const targetKeyInput = page.locator('input[placeholder="Authorization"]');
    await targetKeyInput.fill("authToken");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Configure Dependency")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("3");

    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders?.["x-literal-alias"]).toBe("secret-token-abc");
  });

  // Scenario: a Validate node fails the chain when the upstream response
  // doesn't satisfy the configured JSON Schema (P6.11)
  test("Validate node fails the chain when the response doesn't match the schema", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Validate Fail Collection");
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Validate Fail Chain");
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "validate");

    // Placing a Validate node auto-opens its config panel — set a schema
    // the /fast fixture body (`{ id, title, price, timestamp }`) can never satisfy.
    await expect(page.getByText("Configure Validate")).toBeVisible({
      timeout: 5000,
    });
    const validateNode = page.locator('[data-testid^="validate-node-"]');

    const schemaEditor = page.locator(".cm-content").first();
    await schemaEditor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      '{"type":"object","required":["missingField"]}',
      { delay: 20 },
    );
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Configure Validate")).not.toBeVisible({
      timeout: 5000,
    });

    // Connect Fast Request -> Validate so it has an upstream response to check.
    const nodeA = page.locator('[data-testid^="chain-node-"]').first();
    await nodeA.locator(".react-flow__handle-right").first().hover();
    await page.mouse.down();
    await validateNode.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();
    await expect(page.locator('[data-testid^="rf__edge-"]')).toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();

    await expect(page.getByTestId("chain-failed-count")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("chain-failed-count")).toContainText("1");
    await expect(page.getByTestId("chain-passed-count")).toContainText("1");
  });

  // Scenario: two independent branches (no edge between them) both run and
  // complete concurrently rather than sequentially (P7.9) — uses the P2.12
  // hermetic fixture (/slow = 5000ms, /fast = 0ms), never live endpoints.
  test("Two independent branches both run, concurrently rather than sequentially", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Parallel Branches Collection");
    await saveRequestToCollection(
      page,
      "Slow Request",
      "https://example.com/api/slow",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Parallel Branches Chain");

    // Add both requests with no edge between them, so they form two
    // independent branches off the implicit start.
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Slow Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Fast Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 requests",
      { timeout: 5000 },
    );

    // No edge is drawn between the two nodes — they are independent branches.
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(0);

    const startedAt = Date.now();
    await page.getByTestId("run-chain-btn").click();

    // The fast branch reaches a passed state almost immediately — well
    // before the slow branch's 5000ms delay elapses. If branches ran
    // sequentially with the slow one first, this would never happen this
    // early.
    const fastRow = page.getByRole("option").filter({ hasText: "Fast Request" });
    await expect(fastRow).toBeVisible({ timeout: 5000 });
    const fastPassedAt = Date.now();
    expect(fastPassedAt - startedAt).toBeLessThan(4000);

    // Both branches eventually complete and pass.
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("chain-passed-count")).toContainText("2");
    const finishedAt = Date.now();

    // Total run time is close to the slow branch's own delay, not the sum
    // of both branches' delays — proving they ran concurrently.
    expect(finishedAt - startedAt).toBeLessThan(7000);

    // Run log shows distinct lane indicators for the two concurrent branches.
    const slowRow = page.getByRole("option").filter({ hasText: "Slow Request" });
    await expect(slowRow).toBeVisible({ timeout: 5000 });
    const fastLane = fastRow.locator('[data-testid^="step-lane-"]');
    const slowLane = slowRow.locator('[data-testid^="step-lane-"]');
    await expect(fastLane).toBeVisible();
    await expect(slowLane).toBeVisible();
    const fastLaneTestId = await fastLane.getAttribute("data-testid");
    const slowLaneTestId = await slowLane.getAttribute("data-testid");
    expect(fastLaneTestId).not.toBe(slowLaneTestId);
  });

  // Scenario: a Loop over the P2.12 hermetic fixture's 3-item `/list`
  // endpoint nests each iteration under its Loop step in the run log
  // (P8.8), rendering exactly three expandable iteration groups (P8.9).
  test("Loop over three items shows three iterations", async ({ page }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Loop Iterations Collection");
    await saveRequestToCollection(
      page,
      "List Request",
      "https://example.com/api/list",
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Item Request",
      "https://example.com/api/fast",
    );

    await createChain(page, "Loop Iterations Chain");

    // Node A: the source request the Loop iterates over.
    await page.getByTestId("chain-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("List Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Node B: the per-iteration body request, added standalone (wired below).
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await page.getByText("Item Request").click();
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    // Ensure no overlays are blocking interactions
    await page.keyboard.press("Escape");
    await page
      .locator('[data-slot="dialog-overlay"]')
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => {});

    // Place the Loop node; placement auto-opens its config panel.
    await addBlockNode(page, "loop", { x: 500, y: 320 });
    await expect(page.getByText("Configure Loop")).toBeVisible({
      timeout: 5000,
    });
    const loopNode = page.locator('[data-testid^="loop-node-"]');
    await expect(loopNode).toBeVisible({ timeout: 5000 });
    const loopTestId = (await loopNode.getAttribute("data-testid")) ?? "";
    const loopId = loopTestId.replace("loop-node-", "");

    // `/list` returns a bare 3-item array, so the root path "$" resolves to it.
    await page.getByPlaceholder("e.g. $.data.items").fill("$");
    await page.getByPlaceholder("e.g. item").fill("item");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Configure Loop")).not.toBeVisible({
      timeout: 5000,
    });
    // Ensure overlay is fully closed before next interaction
    await page.keyboard.press("Escape");
    await page
      .locator('[data-slot="dialog-overlay"]')
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => {});

    // Place the Collect node and pair it with the Loop via its config panel.
    // Position it lower to avoid overlapping with other nodes
    await addBlockNode(page, "collect", { x: 500, y: 450 });
    await expect(page.getByText("Configure Collect")).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: `Loop (item)` }).click();
    await page
      .getByRole("button", { name: "Save" })
      .click();
    await expect(page.getByText("Configure Collect")).not.toBeVisible({
      timeout: 5000,
    });
    // Ensure overlay is fully closed before wiring edges
    await page.keyboard.press("Escape");
    await page
      .locator('[data-slot="dialog-overlay"]')
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => {});
    // Click on empty canvas to deselect any nodes
    await page.locator(".react-flow__pane").first().click({ position: { x: 100, y: 100 } });

    // Wire List Request -> Loop (upstream, for the array to iterate over).
    const listNode = page
      .locator('[data-testid^="chain-node-"]')
      .filter({ hasText: "List Request" });
    await listNode.locator(".react-flow__handle-right").first().hover();
    await page.mouse.down();
    await loopNode.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();

    // Wire Loop's `body` handle -> Item Request (runs once per iteration).
    const itemNode = page
      .locator('[data-testid^="chain-node-"]')
      .filter({ hasText: "Item Request" });
    await loopNode.locator(".react-flow__handle-bottom").first().hover();
    await page.mouse.down();
    await itemNode.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();

    // Two edges: List Request -> Loop, and Loop(body) -> Item Request.
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(2, {
      timeout: 5000,
    });

    await page.getByTestId("run-chain-btn").click();

    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });

    // Exactly three iteration groups — not "at least one" — proving all
    // three /list items were iterated, not just the first.
    const iterationToggles = page.locator(
      `[data-testid^="iteration-toggle-${loopId}-"]`,
    );
    await expect(iterationToggles).toHaveCount(3, { timeout: 15000 });

    // No sub-step is visible until its iteration group is expanded.
    await expect(
      page.getByRole("option").filter({ hasText: "Item Request" }),
    ).toHaveCount(0);

    for (let i = 0; i < 3; i++) {
      const toggle = page.getByTestId(`iteration-toggle-${loopId}-${i}`);
      await expect(toggle).toBeVisible();
      await expect(toggle).toContainText(`Iteration ${i + 1}`);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      // Expanding reveals this iteration's own sub-step (the Item Request run).
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }

    // Once all three groups are expanded, each contributed exactly one
    // sub-step row — three distinct iterations, not one row repeated.
    const expandedSubSteps = page
      .getByRole("option")
      .filter({ hasText: "Item Request" });
    await expect(expandedSubSteps).toHaveCount(3);
    const subStepIds = await expandedSubSteps.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-step-id")),
    );
    expect(new Set(subStepIds).size).toBe(3);
  });
});
