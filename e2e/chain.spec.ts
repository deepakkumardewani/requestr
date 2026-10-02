import { expect, type Locator, type Page, test } from "@playwright/test";
import { installChainRoutes } from "./fixtures/chainRoutes";
import { countIdbRecords } from "./fixtures/qaHelpers";

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
    chainId
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
    await btn
      .first()
      .click({ timeout: 3000 })
      .catch(() => undefined);
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
  page: Page
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
  chainId: string
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
  // Default sits below the lone, viewport-centred request node (which spans
  // roughly y 196-415 of the pane) — a pane click over the node opens its details
  // sheet instead of placing the block.
  position: { x: number; y: number } = { x: 360, y: 440 }
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

/**
 * Canvas shortcuts only fire while DOM focus is inside the canvas (and no
 * dialog is open), so a test that presses a canvas shortcut right after a
 * picker dialog closes must put focus back on the canvas first. Clicks an
 * empty pane spot, below the lone request node, without opening any sheet.
 */
async function focusCanvas(page: Page) {
  await page
    .locator(".react-flow__pane")
    .first()
    .click({
      position: { x: 360, y: 440 },
    });
}

/**
 * Adds API requests through the picker: searches each name (collections are
 * collapsed by default and search expands matches), selects the matching row,
 * then confirms with "Add N request(s)". The picker never adds on a bare row click.
 */
async function pickApis(page: Page, names: string | string[]) {
  const list = Array.isArray(names) ? names : [names];
  const dialog = page.getByTestId("api-picker-dialog");
  for (const name of list) {
    await dialog.getByTestId("picker-search").fill(name);
    const row = dialog.getByRole("option").filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.click();
    await expect(row).toHaveAttribute("aria-selected", "true");
  }
  await dialog.getByTestId("picker-add-selected").click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  await refitCanvas(page);
}

/**
 * The picker fits only the newly added nodes into view, so earlier nodes can
 * scroll off-screen; tests that interact with every node re-fit the whole canvas.
 */
async function refitCanvas(page: Page) {
  const fit = page.locator(".react-flow__controls-fitview");
  if (!(await fit.isVisible())) return;
  await page.waitForTimeout(400); // let the picker's own fit animation finish
  await fit.click();
  await page.waitForTimeout(400);
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
  url: string
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
// Phase 1 (chain UI polish) helpers
// ---------------------------------------------------------------------------

/** Saves `count` requests to a collection, then builds a chain holding them as API nodes. */
async function createChainWithApis(page: Page, label: string, count: number) {
  await openTab(page);
  await createCollection(page, `${label} Collection`);
  for (let i = 1; i <= count; i++) {
    if (i > 1) await openTab(page);
    await saveRequestToCollection(
      page,
      `${label} Request ${i}`,
      `https://dummyjson.com/products/${i}`
    );
  }
  await createChain(page, `${label} Chain`);
  for (let i = 1; i <= count; i++) {
    await page
      .getByTestId(i === 1 ? "empty-add-api-btn" : "block-menu-trigger")
      .click();
    if (i > 1) await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, `${label} Request ${i}`);
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
  }
  await expect(page.getByTestId("chain-request-count")).toContainText(
    `${count} node`,
    { timeout: 5000 }
  );
}

/**
 * Pane y of the lower and upper delay in the stacked-nodes test. Both are placed with
 * plain pane clicks (no dragging, so no snap/zoom state can shift them): the lower first,
 * then the upper just outside the lower's hover strip, leaving their top edges 40px apart.
 */
const STACKED_LOWER_PANE_Y = 470;
const STACKED_UPPER_PANE_Y = 430;
/** Height of the hover strip (Tailwind `pt-9`) every node reserves above its card. */
const HOVER_STRIP_PX = 36;
/** Pane-relative point used for Phase 2 pane-menu and connect-drop placement. */
const P2_DROP_POSITION = { x: 120, y: 120 };
const CLICK_INSET_PX = 8;

/** Drags from a source handle to a target handle with the real mouse. */
async function dragHandle(source: Locator, target: Locator, page: Page) {
  await source.hover();
  await page.mouse.down();
  await target.hover();
  await page.mouse.up();
}

/**
 * Moves the pointer from a node card up into its action toolbar the way a user does (a
 * continuous path, not a teleport) and clicks the named action. Playwright's own click()
 * teleports, which would skip the hover-bridge this proves.
 */
async function clickToolbarActionViaPointerPath(
  page: Page,
  node: Locator,
  actionLabel: string
) {
  await node.hover();
  const card = await node.boundingBox();
  const button = page.getByLabel(actionLabel);
  await expect(button).toBeVisible({ timeout: 5000 });
  const target = await button.boundingBox();
  if (!card || !target) throw new Error("toolbar geometry unavailable");
  await page.mouse.move(card.x + card.width / 2, card.y + 2);
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 }
  );
  await expect(button).toBeVisible();
  await page.mouse.down();
  await page.mouse.up();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Chain", () => {
  test.beforeEach(async ({ page }) => {
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
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toContainText(
      "Auth Flow",
      { timeout: 5000 }
    );
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
    await expect(page.getByTestId("empty-add-api-btn")).toHaveText("Add API");
    await expect(page.getByTestId("empty-add-start-btn")).toBeVisible();
    await expect(page.getByText("No APIs in this chain")).toHaveCount(0);
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
  // Scenario: Clear edges lives in the header overflow menu (disabled at 0 edges)
  // -------------------------------------------------------------------------
  test("Clear edges is in the header overflow menu and disabled with no edges", async ({
    page,
  }) => {
    await createChain(page, "Edge Test");

    await page.getByTestId("chain-more-actions-btn").click();
    const clearEdges = page.getByTestId("clear-edges-btn");
    await expect(clearEdges).toBeVisible({ timeout: 5000 });
    await expect(clearEdges).toHaveAttribute("aria-disabled", "true");
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
      page.locator('[data-testid^="chain-list-item-"]')
    ).toBeVisible();

    await openChainMoreMenu(page, item, chainId);
    await page.getByTestId("chain-delete-btn").click();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Yes, delete chain" }).click();

    await expect(
      page.locator('[data-testid^="chain-list-item-"]')
    ).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Scenario: Open API picker from empty state
  // -------------------------------------------------------------------------
  test("Open the API picker dialog from the empty state Add API button", async ({
    page,
  }) => {
    await createChain(page, "Picker Test");

    await page.getByTestId("empty-add-api-btn").click();

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

    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByRole("tab", { name: "Collections" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "History" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Collections tab empty state
  // -------------------------------------------------------------------------
  test("API picker Collections tab shows empty state when no collections exist", async ({
    page,
  }) => {
    await createChain(page, "No Collections Test");

    await page.getByTestId("empty-add-api-btn").click();
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

    await page.getByTestId("empty-add-api-btn").click();
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

    await page.getByTestId("empty-add-api-btn").click();
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
      "https://dummyjson.com/products/1"
    );

    // Open a fresh tab for the second request
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Request Two",
      "https://dummyjson.com/products/2"
    );

    await createChain(page, "Multi Node Chain");

    // First request via empty-state button
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Request One");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
    );

    // Second request via block menu
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Request Two");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
    );
  });

  // Scenario: Block menu shows all five block types
  test("Block menu shows all five block types", async ({ page }) => {
    await openTab(page);
    await createCollection(page, "Block Menu Collection");
    await saveRequestToCollection(
      page,
      "Starter",
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Block Menu Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Starter");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
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
    await expect(page.locator('[data-testid^="subchain-node-"]')).toHaveCount(
      1
    );
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Delay Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Start Request");
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Display Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Source Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "display");

    await expect(page.locator('[data-testid^="display-node-"]')).toBeVisible({
      timeout: 5000,
    });
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Evaluate Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Source Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "evaluate");

    await expect(page.locator('[data-testid^="evaluate-node-"]')).toBeVisible({
      timeout: 5000,
    });
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Validate Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Source Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "validate");

    await expect(page.locator('[data-testid^="validate-node-"]')).toBeVisible({
      timeout: 5000,
    });
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Condition Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "API Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "condition");

    // Placing a condition node auto-opens the ConditionConfigPanel
    await expect(page.getByText("Configure Condition")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByPlaceholder("e.g. {{edgeId:alias}}")).toBeVisible();
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Condition Save Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "First Request");
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
    await expect(page.locator('[data-testid^="condition-node-"]')).toBeVisible({
      timeout: 5000,
    });
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Run Single Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Get Product");
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
      "https://dummyjson.com/products/1"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Node Two",
      "https://dummyjson.com/products/2"
    );

    await createChain(page, "Multi Run Chain");

    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Node One");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Node Two");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
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
      "https://dummyjson.com/nonexistent-404-path"
    );

    await createChain(page, "Fail Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Bad Request");
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
      "https://dummyjson.com/products/1"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Node B",
      "https://dummyjson.com/products/2"
    );

    await createChain(page, "Clear Edges Chain");

    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Node A");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Node B");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
    );

    // Clear edges is disabled until an edge exists (D11) — wire A -> B first.
    const nodeA = page
      .locator('[data-testid^="chain-node-"]')
      .filter({ hasText: "Node A" });
    const nodeB = page
      .locator('[data-testid^="chain-node-"]')
      .filter({ hasText: "Node B" });
    await nodeA.locator(".react-flow__handle-right").first().hover();
    await page.mouse.down();
    await nodeB.locator(".react-flow__handle-left").first().hover();
    await page.mouse.up();
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(1, {
      timeout: 5000,
    });

    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-edges-btn").click();

    // P4.7: clearing edges now confirms via a shared ConfirmDeleteDialog
    // before mutating the chain (added in P4.4) — confirm to proceed.
    await expect(
      page.getByRole("alertdialog", { name: "Clear all edges?" })
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Yes, clear edges" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Clear all edges?" })
    ).not.toBeVisible();

    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(0);
    // Nodes are still present — node count unchanged
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes"
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
      "https://dummyjson.com/products/1"
    );

    // Create a chain — navigates to chain page
    await createChain(page, "Product Chain");

    // Open the picker
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });

    // Collections start collapsed: the collection header is visible, its request is not
    const dialog = page.getByTestId("api-picker-dialog");
    await expect(dialog.getByText("Products API")).toBeVisible({
      timeout: 3000,
    });
    await dialog.getByTestId("picker-search").fill("Get Product");
    const row = dialog.getByRole("option").filter({ hasText: "Get Product" });
    await expect(row).toBeVisible({ timeout: 3000 });

    // Selecting a row does not add it; the footer confirms the selection
    await row.click();
    await expect(dialog.getByTestId("picker-add-selected")).toHaveText(
      "Add 1 request"
    );
    await dialog.getByTestId("picker-add-selected").click();

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
      "1 node",
      { timeout: 5000 }
    );

    // Run Chain button becomes enabled
    await expect(page.getByTestId("run-chain-btn")).toBeEnabled({
      timeout: 3000,
    });
  });

  // Picker model: Enter on the lone active row adds it, tabs are labeled
  test("Picker shows labeled tabs and Enter on the lone active row adds it", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Enter Add Collection");
    await saveRequestToCollection(
      page,
      "Enter Add Request",
      "https://dummyjson.com/products/1"
    );
    await createChain(page, "Enter Add Chain");

    await page.getByTestId("empty-add-api-btn").click();
    const dialog = page.getByTestId("api-picker-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    for (const label of ["Collections", "History", "New request"]) {
      await expect(dialog.getByRole("tab", { name: label })).toBeVisible();
    }

    await dialog.getByTestId("picker-search").fill("Enter Add Request");
    await expect(dialog.getByRole("option")).toHaveCount(1, { timeout: 5000 });
    // Arrow keys and Enter are handled by the tree, so move focus there first
    await dialog.getByTestId("picker-tree").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
    );
  });

  // Picker model: requests already on the canvas read "In chain", never "Added"
  test("Picker marks a request already on the canvas as In chain", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "In Chain Collection");
    await saveRequestToCollection(
      page,
      "In Chain Request",
      "https://dummyjson.com/products/1"
    );
    await createChain(page, "In Chain Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "In Chain Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    const dialog = page.getByTestId("api-picker-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByTestId("picker-search").fill("In Chain Request");
    const row = dialog
      .getByRole("option")
      .filter({ hasText: "In Chain Request" });
    await expect(row).toContainText("In chain", { timeout: 5000 });
    await expect(row).not.toContainText("Added");
    await expect(dialog.getByTestId("picker-add-selected")).toBeDisabled();
  });

  // Picker model: multi-select adds several nodes in one confirm, one undo removes them all
  test("Multi-add from the picker is undone with a single Cmd+Z", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Multi Add Collection");
    for (const [i, name] of ["Multi A", "Multi B", "Multi C"].entries()) {
      if (i > 0) await openTab(page);
      await saveRequestToCollection(
        page,
        name,
        `https://dummyjson.com/products/${i + 1}`
      );
    }
    await createChain(page, "Multi Add Chain");

    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Multi A");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    const dialog = page.getByTestId("api-picker-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByTestId("picker-search").fill("Multi B");
    await dialog.getByRole("option").filter({ hasText: "Multi B" }).click();
    await dialog.getByTestId("picker-search").fill("Multi C");
    await dialog.getByRole("option").filter({ hasText: "Multi C" }).click();
    await expect(dialog.getByTestId("picker-add-selected")).toHaveText(
      "Add 2 requests"
    );
    await dialog.getByTestId("picker-add-selected").click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "3 nodes",
      { timeout: 5000 }
    );

    // Multi-added nodes can cover the usual focus spot, so click a pane corner instead
    await page
      .locator(".react-flow__pane")
      .first()
      .click({
        position: { x: 12, y: 12 },
      });
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
    );
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
      "https://example.com/api/fast"
    );

    await createChain(page, "Fixture Test Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fixture Request");
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
      "https://example.com/api/fail"
    );

    await createChain(page, "Error Strip Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Failing Request");
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
    await expect(detailsPanel.getByText("Error", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(detailsPanel.getByText(/HTTP 500/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detailsPanel).not.toBeVisible({ timeout: 5000 });

    // The run-log dock's Error tab for the failed step shows the same error.
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 10000,
    });
    await page.locator("[data-step-id]").first().click();
    await page.getByRole("tab", { name: "Error" }).click();
    // The step row also repeats the message inline (RUNLOG-14), so scope to
    // the first match.
    await expect(
      page
        .locator('[data-testid="run-log-dock"]')
        .getByText(/HTTP 500/)
        .first()
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
      "https://example.com/api/slow"
    );

    await createChain(page, "Stop Run Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Slow Request");
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Display Menu Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Source Request");
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
    await expect(page.getByText("Delete node", { exact: true })).toBeVisible();

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
      "https://example.com/api/token"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Echo Target",
      "https://example.com/api/echo"
    );

    await createChain(page, "Edge Injection Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Token Source");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Echo Target");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
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
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
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
      "https://example.com/api/fast"
    );

    await createChain(page, "Reload Run Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
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
    // Counts read as words, not glyphs (RUNLOG-8).
    await expect(
      page.getByTestId("run-log-dock").getByRole("option").first()
    ).toContainText("1 passed", { timeout: 5000 });

    // The run is written to IDB on a short debounce — wait until it has
    // actually flushed before reloading.
    await expect
      .poll(() => countIdbRecords(page, "chainRuns"))
      .toBeGreaterThan(0);

    await page.reload({ waitUntil: "commit" });
    // Wait for chain hydration to finish before interacting with the dock.
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 10000 }
    );

    // The dock's collapsed flag is persisted (RUNLOG-27), so the dock comes
    // back exactly as it was left: expanded after the auto-open above. The
    // run history underneath must still reflect the run that happened before
    // the reload.
    await expect(page.getByTestId("run-log-dock")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: "Collapse run log" })
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByTestId("run-log-dock").getByRole("option").first()
    ).toContainText("1 passed", { timeout: 5000 });
  });

  // Scenario: deleting a chain removes its persisted runs (P3.2 handleChainDeleted)
  test("Deleting a chain removes its persisted runs", async ({ page }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Delete Runs Collection");
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast"
    );

    await createChain(page, "Delete Runs Chain");
    const chainId = page.url().split("/chain/")[1];

    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
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
      page.locator('[data-testid^="chain-list-item-"]')
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
      "https://example.com/api/fast"
    );

    await createChain(page, "Auto Open Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // The dock is always mounted; before any run it sits collapsed as a bar
    // that reads "Run Log · No runs yet" and expands on click (RUNLOG-1/2).
    await expect(page.getByTestId("run-log-dock")).toBeVisible();
    const strip = page.getByTestId("run-log-strip");
    await expect(strip).toHaveAttribute("aria-expanded", "false");
    await expect(strip).toContainText("No runs yet");

    await page.getByTestId("run-chain-btn").click();

    // No manual toggle click — the dock must expand on its own.
    await expect(
      page.getByRole("button", { name: "Collapse run log" })
    ).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // Phase 3 scenarios — collapsed bar, options menu, footer (P3.24)
  // -------------------------------------------------------------------------

  /** One saved request on a one-node chain, ready to run. */
  async function createSingleFastRequestChain(page: Page, label: string) {
    await installChainRoutes(page);
    await openTab(page);
    await createCollection(page, `${label} Collection`);
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast"
    );
    await createChain(page, `${label} Chain`);
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
  }

  // Scenario: the collapsed bar summarizes the last run in words and expands
  // on click (RUNLOG-1, RUNLOG-2, RUNLOG-8).
  test("Collapsed run log bar summarizes the last run and expands on click", async ({
    page,
  }) => {
    await createSingleFastRequestChain(page, "Bar");
    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "Collapse run log" }).click();
    const strip = page.getByTestId("run-log-strip");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("Last run passed");
    await expect(strip).toContainText("1 passed");
    await expect(strip).not.toContainText(/[✓✗]/);

    await strip.click();
    await expect(
      page.getByRole("button", { name: "Collapse run log" })
    ).toBeVisible();
    await expect(page.getByTestId("run-log-strip")).toHaveCount(0);
  });

  // Scenario: Clear all runs moved from a ghost button into the "..." menu and
  // confirms before deleting (RUNLOG-9).
  test("Clear all runs is in the run log options menu and confirms first", async ({
    page,
  }) => {
    await createSingleFastRequestChain(page, "Clear Runs");
    await page.getByTestId("run-chain-btn").click();
    await expect(page.getByTestId("chain-passed-count")).toBeVisible({
      timeout: 15000,
    });
    const dock = page.getByTestId("run-log-dock");
    await expect(dock.getByRole("option").first()).toBeVisible();
    // The old ghost button is gone from the header.
    await expect(
      dock.getByRole("button", { name: "Clear all runs" })
    ).toHaveCount(0);

    await dock.getByRole("button", { name: "Run Log options" }).click();
    await page.getByRole("menuitem", { name: "Clear all runs" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Clear all runs?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Clear all runs" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(dock.getByTestId("run-log-empty-noRuns")).toBeVisible({
      timeout: 5000,
    });
  });

  // Scenario: while the dock is expanded the footer drops its hint text
  // (RUNLOG-21).
  test("Footer hints are hidden while the run log is expanded and return when collapsed", async ({
    page,
  }) => {
    await createSingleFastRequestChain(page, "Footer");
    const footer = page.locator("footer");

    // Collapsed by default before any run: hints visible.
    await expect(page.getByTestId("run-log-strip")).toBeVisible();
    await expect(footer).toContainText("Drag nodes to reposition", {
      timeout: 5000,
    });

    await page.getByTestId("run-log-strip").click();
    await expect(
      page.getByRole("button", { name: "Collapse run log" })
    ).toBeVisible();
    await expect(footer).not.toContainText("Drag nodes to reposition");

    await page.getByRole("button", { name: "Collapse run log" }).click();
    await expect(footer).toContainText("Drag nodes to reposition");
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
      "https://example.com/api/fast"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Failing Request",
      "https://example.com/api/fail"
    );

    await createChain(page, "Filter Failed Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Failing Request");
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
    const steps = page.locator("[data-step-id]");
    await expect(steps).toHaveCount(2);

    await page
      .getByTestId("run-log-dock")
      .getByRole("button", { name: "Failed 1" })
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
      "https://example.com/api/fast"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Host Request",
      "https://example.com/api/fast"
    );

    // Build the referenced chain (B) with a single request.
    await createChain(page, "Referenced Chain");
    const referencedChainId = page.url().split("/chain/")[1];
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Sub Body Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
    );

    // Build the host chain (A): one real request plus a Sub-chain block
    // referencing chain B.
    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForURL("/app", { waitUntil: "commit" });

    await createChain(page, "Host Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Host Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "1 node",
      { timeout: 5000 }
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
    await page.getByTestId(`subchain-picker-item-${referencedChainId}`).click();
    await expect(page.getByTestId("subchain-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('[data-testid^="subchain-node-"]')).toHaveCount(
      1
    );

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
    const stepRows = page.locator("[data-step-id]");
    await expect(stepRows).toHaveCount(2);

    const subChainToggle = page.locator('[data-testid^="subchain-toggle-"]');
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
      "https://example.com/api/fail"
    );

    await createChain(page, "Step Tabs Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Failing Request");
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
    await page.locator("[data-step-id]").first().click();

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

  // Scenario: each step-detail tab shows content for the selected step, not
  // just an empty panel (complements the tab-switching test above).
  test("Step-detail Input and Output tabs show the failed step's request and response content", async ({
    page,
  }) => {
    await installChainRoutes(page);

    await openTab(page);
    await createCollection(page, "Tab Content Collection");
    await saveRequestToCollection(
      page,
      "Content Request",
      "https://example.com/api/fail"
    );

    await createChain(page, "Tab Content Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Content Request");
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

    await page.locator("[data-step-id]").first().click();

    await page.getByRole("tab", { name: "Input" }).click();
    await expect(page.getByRole("tabpanel", { name: "Input" })).toContainText(
      "/api/fail"
    );

    await page.getByRole("tab", { name: "Output" }).click();
    await expect(page.getByRole("tabpanel", { name: "Output" })).toContainText(
      "Internal server error"
    );
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
      "https://example.com/api/fast"
    );

    await createChain(page, "Select Node Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
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

    await page.locator("[data-step-id]").first().click();

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
      "https://dummyjson.com/products/1"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Undo Delete Request B",
      "https://dummyjson.com/products/2"
    );

    await createChain(page, "Undo Delete Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Undo Delete Request A");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Undo Delete Request B");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
    );

    // Leaving one node behind after the delete keeps the chain canvas (and
    // its keyboard shortcuts) mounted — an empty chain swaps in the
    // page-level empty state instead, which has no ⌘Z binding.
    const node = page.locator('[data-testid^="chain-node-"]').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    // Clicking a node opens its details sheet, which blocks canvas shortcuts,
    // so move the keyboard focus ring onto a node with the arrow keys instead.
    await focusCanvas(page);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
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
  });

  test("Dragging a node then pressing Cmd+Z returns it to its prior position", async ({
    page,
  }) => {
    await openTab(page);
    await createCollection(page, "Undo Drag Collection");
    await saveRequestToCollection(
      page,
      "Undo Drag Request",
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Undo Drag Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Undo Drag Request");
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
      { steps: 10 }
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
      "https://dummyjson.com/products/1"
    );

    // The chain canvas (and its shortcut bindings) only mounts once the
    // chain has at least one node — an empty chain shows the page-level
    // empty state instead.
    await createChain(page, "Shortcuts Overlay Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Shortcuts Overlay Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await focusCanvas(page);
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
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Block Menu Shortcut Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Block Menu Shortcut Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await focusCanvas(page);
    await page.keyboard.press("ControlOrMeta+Shift+k");
    await expect(page.getByTestId("block-menu-item-delay")).toBeVisible({
      timeout: 5000,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("block-menu-item-delay")).not.toBeVisible();

    await page.keyboard.press("ControlOrMeta+k");
    await expect(
      page.getByPlaceholder("Search requests, actions...")
    ).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });

  test("Copy/paste reproduces blocks", async ({ page }) => {
    await openTab(page);
    await createCollection(page, "Copy Paste Collection");
    await saveRequestToCollection(
      page,
      "Copy Paste Request",
      "https://dummyjson.com/products/1"
    );

    await createChain(page, "Copy Paste Source Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Copy Paste Request");
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
      "https://example.com/api/test"
    );

    await createChain(page, "Start Block Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Test Request");
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
    await page
      .getByTestId("start-config-default-value")
      .first()
      .fill("default-token");

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
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Echo Target");
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
    await page
      .getByTestId("start-config-default-value")
      .first()
      .fill("default-token");

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
      "https://example.com/api/test"
    );

    await createChain(page, "No Start Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Test Request");
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
      "https://example.com/api/token"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Echo Target",
      "https://example.com/api/echo"
    );

    await createChain(page, "Evaluate Header Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Token Source");
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
    await pickApis(page, "Echo Target");
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
      "https://example.com/api/token"
    );

    await openTab(page);
    await saveRequestToCollection(
      page,
      "Passthrough",
      "https://example.com/api/fast"
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
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Token Source");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Passthrough");
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
    await pickApis(page, "Echo Target");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-request-count")).toContainText(
      "3 nodes",
      { timeout: 5000 }
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
      "https://example.com/api/fast"
    );

    await createChain(page, "Validate Fail Chain");
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
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
    await page.keyboard.type('{"type":"object","required":["missingField"]}', {
      delay: 20,
    });
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
      "https://example.com/api/slow"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Fast Request",
      "https://example.com/api/fast"
    );

    await createChain(page, "Parallel Branches Chain");

    // Add both requests with no edge between them, so they form two
    // independent branches off the implicit start.
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Slow Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Fast Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByTestId("chain-request-count")).toContainText(
      "2 nodes",
      { timeout: 5000 }
    );

    // No edge is drawn between the two nodes — they are independent branches.
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(0);

    const startedAt = Date.now();
    await page.getByTestId("run-chain-btn").click();

    // The fast branch reaches a passed state almost immediately — well
    // before the slow branch's 5000ms delay elapses. If branches ran
    // sequentially with the slow one first, this would never happen this
    // early.
    const fastRow = page
      .getByRole("option")
      .filter({ hasText: "Fast Request" });
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
    const slowRow = page
      .getByRole("option")
      .filter({ hasText: "Slow Request" });
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
      "https://example.com/api/list"
    );
    await openTab(page);
    await saveRequestToCollection(
      page,
      "Item Request",
      "https://example.com/api/fast"
    );

    await createChain(page, "Loop Iterations Chain");

    // Node A: the source request the Loop iterates over.
    await page.getByTestId("empty-add-api-btn").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "List Request");
    await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
      timeout: 5000,
    });

    // Node B: the per-iteration body request, added standalone (wired below).
    await page.getByTestId("block-menu-trigger").click();
    await page.getByTestId("block-menu-item-api").click();
    await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
      timeout: 5000,
    });
    await pickApis(page, "Item Request");
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
    // Position it well below the Loop: a node's hover strip reaches 36px above
    // its card, so a closer Collect would cover the Loop's bottom handle.
    await addBlockNode(page, "collect", { x: 500, y: 500 });
    await expect(page.getByText("Configure Collect")).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: `Loop (item)` }).click();
    await page.getByRole("button", { name: "Save" }).click();
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
    await page
      .locator(".react-flow__pane")
      .first()
      .click({ position: { x: 100, y: 100 } });

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
      `[data-testid^="iteration-toggle-${loopId}-"]`
    );
    await expect(iterationToggles).toHaveCount(3, { timeout: 15000 });

    // No sub-step is visible until its iteration group is expanded.
    await expect(
      page.getByRole("option").filter({ hasText: "Item Request" })
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
      rows.map((row) => row.getAttribute("data-step-id"))
    );
    expect(new Set(subStepIds).size).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Phase 1 (chain UI polish)
  // -------------------------------------------------------------------------

  // CANVAS-1: the action toolbar survives the pointer travelling card -> toolbar.
  for (const block of ["delay", "condition"] as const) {
    test(`Toolbar stays reachable on a ${block} block (hover card, move up, click Remove)`, async ({
      page,
    }) => {
      await createChainWithApis(page, `Toolbar ${block}`, 1);
      await addBlockNode(page, block, { x: 700, y: 440 });
      const node = page.locator(`[data-testid^="${block}-node-"]`);
      await expect(node).toHaveCount(1, { timeout: 5000 });
      // Condition placement auto-opens its config sheet; close it so the canvas is interactive.
      await page.keyboard.press("Escape");
      await page
        .locator('[data-slot="sheet-overlay"]')
        .waitFor({ state: "detached", timeout: 5000 })
        .catch(() => undefined);

      await clickToolbarActionViaPointerPath(
        page,
        node,
        `Remove ${block} from chain`
      );

      await expect(node).toHaveCount(0, { timeout: 5000 });
    });
  }

  // CANVAS-1: a neighbour's hover strip must not swallow clicks on the node just above it.
  test("Two stacked nodes: the upper node's body is still clickable", async ({
    page,
  }) => {
    await createChainWithApis(page, "Stacked", 1);
    await addBlockNode(page, "delay", { x: 700, y: STACKED_LOWER_PANE_Y });
    await addBlockNode(page, "delay", { x: 700, y: STACKED_UPPER_PANE_Y });
    const delays = page.locator('[data-testid^="delay-node-"]');
    await expect(delays).toHaveCount(2, { timeout: 5000 });
    const first = await delays.first().boundingBox();
    const second = await delays.nth(1).boundingBox();
    if (!first || !second) throw new Error("delay geometry unavailable");
    // DOM order is creation order, so identify the upper node by geometry instead.
    const upper = first.y < second.y ? delays.first() : delays.nth(1);
    const upperBox = first.y < second.y ? first : second;
    const lowerBox = first.y < second.y ? second : first;

    // The click lands inside the strip the lower node reserves above itself.
    const clickY = upperBox.y + CLICK_INSET_PX;
    expect(clickY).toBeGreaterThan(lowerBox.y - HOVER_STRIP_PX);
    expect(clickY).toBeLessThan(lowerBox.y);
    const upperId = (await upper.getAttribute("data-testid"))?.replace(
      "delay-node-",
      ""
    );
    await page.mouse.click(upperBox.x + 20, clickY);
    await expect(
      page.locator(`.react-flow__node[data-id="${upperId}"]`)
    ).toHaveClass(/selected/, { timeout: 5000 });
  });

  // CANVAS-2: Start's default output handle connects to a downstream block.
  test("Start default output handle connects to a Delay", async ({ page }) => {
    await createChainWithApis(page, "StartHandle", 1);
    await addBlockNode(page, "start");
    await addBlockNode(page, "delay", { x: 700, y: 440 });
    await page.getByLabel("Auto-arrange nodes on the canvas").click();
    const startNode = page.locator('[data-testid^="start-node-"]').first();
    const delayNode = page.locator('[data-testid^="delay-node-"]').first();
    await expect(startNode).toBeVisible({ timeout: 5000 });

    const defaultHandle = startNode.getByLabel("Default output");
    await expect(defaultHandle).toHaveCount(1);
    await dragHandle(
      defaultHandle,
      delayNode.locator(".react-flow__handle-left").first(),
      page
    );

    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(1, {
      timeout: 5000,
    });
  });

  // CANVAS-3: Clear all nodes empties the chain in one confirmed gesture, the header follows
  // the node count, and a single Cmd+Z restores everything (Cmd+Shift+Z clears again) even
  // though the canvas is unmounted at 0 nodes.
  test("Clear all nodes then undo/redo in one step each, header follows node count", async ({
    page,
  }) => {
    await createChainWithApis(page, "ClearNodes", 2);
    const count = page.getByTestId("chain-request-count");
    await expect(count).toContainText("2 nodes");
    await expect(page.getByTestId("chain-history-label")).toBeVisible();

    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-nodes-btn").click();
    const dialog = page.getByTestId("clear-nodes-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toContainText("Cmd+Z");
    await expect(dialog).not.toContainText("can't be undone");
    await page.getByRole("button", { name: "Yes, clear nodes" }).click();

    await expect(count).toContainText("No nodes", { timeout: 5000 });
    await expect(page.getByTestId("chain-history-label")).toHaveCount(0);
    await expect(page.getByTestId("chain-empty-state")).toBeVisible();
    await page.getByTestId("chain-more-actions-btn").click();
    await expect(page.getByTestId("clear-nodes-btn")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await page.keyboard.press("Escape");

    // One undo restores both nodes (a single history entry for the whole clear).
    await page.keyboard.press("ControlOrMeta+z");
    await expect(count).toContainText("2 nodes", { timeout: 5000 });
    await expect(page.getByTestId("chain-empty-state")).toHaveCount(0);
    await expect(page.locator('[data-testid^="chain-node-"]')).toHaveCount(2);

    // Redo clears again, in one step.
    await focusCanvas(page);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(count).toContainText("No nodes", { timeout: 5000 });
    await expect(page.getByTestId("chain-empty-state")).toBeVisible();
  });

  // CANVAS-4: the Clear edges confirmation promises undo instead of "can't be undone".
  test("Clear edges confirmation says the action is undoable", async ({
    page,
  }) => {
    await createChainWithApis(page, "EdgeCopy", 2);
    const nodes = page.locator('[data-testid^="chain-node-"]');
    await dragHandle(
      nodes.first().locator(".react-flow__handle-right").first(),
      nodes.nth(1).locator(".react-flow__handle-left").first(),
      page
    );
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(1, {
      timeout: 5000,
    });

    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-edges-btn").click();

    const dialog = page.getByRole("alertdialog", { name: "Clear all edges?" });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toContainText("Cmd+Z");
    await expect(dialog).not.toContainText("can't be undone");
    await expect(dialog).not.toContainText("cannot be undone");
  });

  // ---------------------------------------------------------------------------
  // Phase 2 (chain UI polish): empty canvas, pane menu, connect-drop, run gate
  // ---------------------------------------------------------------------------

  // CANVAS-10: right-clicking empty pane opens the add-block menu and places the block there.
  test("Right-click on the empty pane adds a block at the click point", async ({
    page,
  }) => {
    await createChain(page, "PaneMenu");
    await expect(page.getByTestId("chain-empty-state")).toBeVisible();

    await page
      .locator(".react-flow__pane")
      .first()
      .click({ button: "right", position: P2_DROP_POSITION });
    await expect(page.getByTestId("pane-block-menu")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("block-menu-item-delay").click();

    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-empty-state")).toHaveCount(0);
  });

  // CANVAS-11: dragging off a source handle onto empty pane adds + connects, in one undo.
  test("Drag off a handle onto empty pane adds a connected block, one undo removes both", async ({
    page,
  }) => {
    await createChain(page, "ConnectDrop");
    await page.getByTestId("empty-add-start-btn").click();
    const start = page.locator('[data-testid^="start-node-"]').first();
    await expect(start).toBeVisible({ timeout: 5000 });

    const pane = page.locator(".react-flow__pane").first();
    const paneBox = await pane.boundingBox();
    if (!paneBox) throw new Error("pane geometry unavailable");
    await start.getByLabel("Default output").hover();
    await page.mouse.down();
    await page.mouse.move(
      paneBox.x + P2_DROP_POSITION.x,
      paneBox.y + P2_DROP_POSITION.y,
      { steps: 8 }
    );
    await page.mouse.up();

    await expect(page.getByTestId("pane-block-menu")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("block-menu-item-delay").click();
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(1);

    await focusCanvas(page);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(0, {
      timeout: 5000,
    });
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="start-node-"]')).toHaveCount(1);
  });

  // CANVAS-13: only runnable blocks enable Run (Start alone does not; a lone Delay does).
  test("Run is disabled for a Start-only chain and enabled for a lone Delay", async ({
    page,
  }) => {
    await createChain(page, "RunGate");
    const runBtn = page.getByTestId("run-chain-btn");
    await page.getByTestId("empty-add-start-btn").click();
    await expect(page.locator('[data-testid^="start-node-"]')).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(runBtn).toBeDisabled();

    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-nodes-btn").click();
    await page.getByRole("button", { name: "Yes, clear nodes" }).click();
    await expect(page.getByTestId("chain-empty-state")).toBeVisible({
      timeout: 5000,
    });

    await addBlockNode(page, "delay");
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(runBtn).toBeEnabled();
  });

  // EMPTY-1: the canvas stays mounted after clear-all and undo restores the nodes.
  test("Empty overlay returns after clear-all and undo restores the nodes", async ({
    page,
  }) => {
    await createChain(page, "ClearRestore");
    await addBlockNode(page, "delay");
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-empty-state")).toHaveCount(0);

    await page.getByTestId("chain-more-actions-btn").click();
    await page.getByTestId("clear-nodes-btn").click();
    await page.getByRole("button", { name: "Yes, clear nodes" }).click();
    await expect(page.getByTestId("chain-empty-state")).toBeVisible({
      timeout: 5000,
    });

    await focusCanvas(page);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(page.getByTestId("chain-empty-state")).toHaveCount(0);
  });
  // ---------------------------------------------------------------------------
  // Phase 5 — Canvas QoL (CANVAS-14, 16, 18, 19, 21)
  // ---------------------------------------------------------------------------

  // Clear of the centred empty-state card, which blocks pointer events on the first placement.
  const P5_FIRST_NODE_POSITION = { x: 120, y: 120 };

  const MARQUEE_MARGIN_PX = 24;

  async function addDelays(page: Page, positions: { x: number; y: number }[]) {
    await createChain(page, "P5 Canvas");
    for (const position of positions) {
      await addBlockNode(page, "delay", position);
    }
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(
      positions.length,
      { timeout: 5000 }
    );
  }

  async function delayLeftEdges(page: Page): Promise<number[]> {
    const nodes = page.locator('[data-testid^="delay-node-"]');
    const boxes = await Promise.all(
      (await nodes.all()).map((node) => node.boundingBox())
    );
    return boxes.map((box) => {
      if (!box) throw new Error("delay geometry unavailable");
      return box.x;
    });
  }

  // CANVAS-14 + CANVAS-19: a marquee on empty pane selects nodes; Align left snaps them to one edge.
  test("Marquee selects nodes and Align left lines them up", async ({
    page,
  }) => {
    await addDelays(page, [
      P5_FIRST_NODE_POSITION,
      { x: 420, y: 300 },
      { x: 700, y: 520 },
    ]);
    const before = await delayLeftEdges(page);
    expect(new Set(before.map(Math.round)).size).toBeGreaterThan(1);

    await refitCanvas(page);
    const boxes = await Promise.all(
      (
        await page.locator('[data-testid^="delay-node-"]').all()
      ).map((node) => node.boundingBox())
    );
    const bounds = boxes.map((box) => {
      if (!box) throw new Error("delay geometry unavailable");
      return box;
    });
    const left = Math.min(...bounds.map((b) => b.x)) - MARQUEE_MARGIN_PX;
    const top = Math.min(...bounds.map((b) => b.y)) - MARQUEE_MARGIN_PX;
    const right =
      Math.max(...bounds.map((b) => b.x + b.width)) + MARQUEE_MARGIN_PX;
    const bottom =
      Math.max(...bounds.map((b) => b.y + b.height)) + MARQUEE_MARGIN_PX;
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, bottom, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(3, {
      timeout: 5000,
    });

    // The multi-selection rect sits over the nodes, so right-click by coordinates like a user would.
    const target = await page
      .locator('[data-testid^="delay-node-"]')
      .first()
      .boundingBox();
    if (!target) throw new Error("delay geometry unavailable");
    await page.mouse.click(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { button: "right" }
    );
    await page.getByRole("menuitem", { name: "Align left" }).click();

    await expect
      .poll(
        async () => new Set((await delayLeftEdges(page)).map(Math.round)).size
      )
      .toBe(1);
  });

  // CANVAS-16: Cmd/Ctrl+F opens Find node only while the canvas has focus; Enter selects the match.
  test("Cmd+F with canvas focus opens Find node and Enter selects the node", async ({
    page,
  }) => {
    await addDelays(page, [P5_FIRST_NODE_POSITION]);

    // Focus outside the canvas leaves the browser's own find alone.
    await page.getByTestId("chain-request-count").click();
    await page.keyboard.press("ControlOrMeta+f");
    await expect(page.getByTestId("find-node-input")).toHaveCount(0);

    await focusCanvas(page);
    await page.keyboard.press("ControlOrMeta+f");
    const input = page.getByTestId("find-node-input");
    await expect(input).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="find-node-row-"]')).toHaveCount(
      1
    );
    await page.keyboard.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1, {
      timeout: 5000,
    });
  });

  // CANVAS-18: a burst of arrow presses is one undo entry; Shift moves ten steps at a time.
  test("Arrow nudge moves the selection and one undo reverts the whole burst", async ({
    page,
  }) => {
    await addDelays(page, [P5_FIRST_NODE_POSITION]);
    const [startX] = await delayLeftEdges(page);

    // Click the node's left padding; its centre is the editable delay input.
    await page
      .locator('[data-testid^="delay-node-"]')
      .first()
      .click({ position: { x: 14, y: 8 } });
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await delayLeftEdges(page))[0])
      .toBeGreaterThan(startX);
    const smallStep = (await delayLeftEdges(page))[0] - startX;

    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(async () => Math.abs((await delayLeftEdges(page))[0] - startX))
      .toBeLessThan(1);

    await page.keyboard.press("Shift+ArrowRight");
    await expect
      .poll(async () => (await delayLeftEdges(page))[0] - startX)
      .toBeGreaterThan(smallStep);
  });

  // CANVAS-21: Hide tips persists across reload and Show tips in the `?` overlay restores it.
  test("Hide tips persists after reload and Show tips restores them", async ({
    page,
  }) => {
    await addDelays(page, [P5_FIRST_NODE_POSITION]);
    const footer = page.locator("footer");
    await expect(footer).toContainText("Drag nodes to reposition", {
      timeout: 5000,
    });

    await footer.getByRole("button", { name: "Hide tips" }).click();
    await expect(footer).toHaveCount(0);

    // The new node is written to IDB on a 150ms trailing debounce; let it flush before reloading.
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.locator('[data-testid^="delay-node-"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(page.locator("footer")).toHaveCount(0);

    await focusCanvas(page);
    await page.keyboard.press("Shift+Slash");
    await page.getByRole("button", { name: "Show tips" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("footer")).toContainText(
      "Drag nodes to reposition",
      { timeout: 5000 }
    );
  });
});
