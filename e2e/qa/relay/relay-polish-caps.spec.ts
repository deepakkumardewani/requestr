import type { Locator, Page } from "@playwright/test";
import {
  openLauncher,
  openRelay,
  WORKSPACE_PATH,
} from "../../fixtures/relayE2eHelpers";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const HEADER_CAPABILITIES = "relay-header-capabilities";
const CAPABILITIES_POPOVER = "relay-capabilities-popover";
const CAPABILITIES_PANEL = "relay-capabilities-panel";
const CAPABILITY_TAB_SEE = "relay-capability-tab-see";
const CAPABILITY_CATEGORY_PREFIX = "relay-capability-category-";
const CAPABILITY_BADGE = "relay-capability-badge";
const CAPABILITY_STARTER = "relay-capability-starter";
const ENTITY_PILL = "relay-entity-pill-static";
const CAPABILITY_SETTINGS_LINK = "relay-capability-settings-link";
const CAPABILITY_CHANGE_MODE = "relay-capability-change-mode";
const EMPTY_STATE = "relay-empty";
const LAUNCHER = "relay-launcher";
const LAUNCHER_SECTION_SETTINGS = "relay-launcher-section-settings";
const LAUNCHER_SECTION_RECENT = "relay-launcher-section-recent";
const LAUNCHER_SECTION_ATTACH = "relay-launcher-section-attach";
const LAUNCHER_SECTION_ACTIONS = "relay-launcher-section-actions";
const LAUNCHER_ROW = "relay-launcher-row";
const COMPOSER = "relay-composer";
const MENTION_MENU = "relay-mention-menu";
const PERMISSION_POPOVER = "relay-permission-popover";
const PERMISSION_TRIGGER = "relay-permission-trigger";
const RECENT_STORAGE_KEY = "rq_relay_recent";
const PERMISSION_MODE_STORAGE_KEY = "rq_relay_permission_mode";

const CATEGORIES = ["read", "write", "run", "organize", "transfer"];
const SEEDED_RECENT = { kind: "request", id: "qa-caps-recent", name: "QA Recent Request" };
const SEEDED_REQUEST_NAME = "Request A";

async function readBadges(
  panel: Locator,
): Promise<{ badge: string | null; text: string }[]> {
  return panel
    .locator(`[data-testid="${CAPABILITY_BADGE}"]`)
    .evaluateAll((elements) =>
      elements.map((el) => ({
        badge: el.getAttribute("data-badge"),
        text: el.textContent || "",
      })),
    );
}

async function openCapabilitiesPopover(page: Page): Promise<void> {
  const button = page.getByTestId(HEADER_CAPABILITIES);
  await button.click();
  await expect(page.getByTestId(CAPABILITIES_POPOVER)).toBeVisible();
}

async function closePopoverAndVerifyFocus(page: Page): Promise<void> {
  const button = page.getByTestId(HEADER_CAPABILITIES);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(CAPABILITIES_POPOVER)).toBeHidden();
  await expect(button).toBeFocused();
}

async function openWithRoutes(
  page: Page,
  ...args: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R
    : never
) {
  const handle = await installRelayRoutes(page, ...args);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return handle;
}

async function seedPermissionMode(page: Page, mode: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [PERMISSION_MODE_STORAGE_KEY, mode] as const,
  );
}

test.describe("Relay Polish: Capabilities and Empty State @qa", () => {
  test("[REL-POL-CAPS-01] the header button (tooltip \"What Relay can do\") opens a popover, focus moves inside, Esc closes it and focus returns to the button @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    const button = page.getByTestId(HEADER_CAPABILITIES);
    await expect(button).toBeVisible();

    await expect(button).toHaveAttribute("aria-label", "What Relay can do");

    await button.hover();
    await expect(page.getByTestId("relay-header-tooltip")).toHaveText(
      "What Relay can do",
    );

    await openCapabilitiesPopover(page);

    const focusInPopover = await page.evaluate(
      (selector) => {
        const popoverEl = document.querySelector(selector);
        const activeEl = document.activeElement;
        return popoverEl && activeEl ? popoverEl.contains(activeEl) : false;
      },
      `[data-testid="${CAPABILITIES_POPOVER}"]`,
    );
    expect(focusInPopover).toBe(true);

    await closePopoverAndVerifyFocus(page);

    await snap("01-focus-management");
  });

  test("[REL-POL-CAPS-02] five categories render, each with 2 to 3 starters @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const popover = page.getByTestId(CAPABILITIES_POPOVER);
    for (const category of CATEGORIES) {
      const categorySection = popover.getByTestId(
        `${CAPABILITY_CATEGORY_PREFIX}${category}`,
      );
      await expect(categorySection).toBeVisible();

      const starters = categorySection.locator(
        `[data-testid="${CAPABILITY_STARTER}"]`,
      );
      const starterCount = await starters.count();
      expect(starterCount).toBeGreaterThanOrEqual(2);
      expect(starterCount).toBeLessThanOrEqual(3);
    }

    await snap("02-five-categories");
  });

  test("[REL-POL-CAPS-03] a target-free starter sends its prompt to /api/relay/chat @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const handle = await openWithRoutes(page, { kind: "text", text: "init" });

    await openCapabilitiesPopover(page);

    const starterButton = page
      .getByTestId(CAPABILITIES_POPOVER)
      .locator(`[data-testid="${CAPABILITY_STARTER}"][data-example="read-2"]`);

    await expect(starterButton).toBeVisible();
    await starterButton.click();

    await expect.poll(() => handle.requestBodies.length).toBe(1);

    const body = handle.requestBodies[0] as {
      messages: { role: string; parts: { text?: string }[] }[];
    };
    expect(body.messages).toBeDefined();
    const userMessage = body.messages.find(
      (m) => m.role === "user",
    );
    expect(userMessage).toBeDefined();
    const userText = userMessage?.parts[0]?.text || "";
    expect(userText).toContain("Summarize my collections");

    await snap("03-target-free-starter");
  });

  test("[REL-POL-CAPS-04] a starter that needs a target with nothing attached opens the mention menu with a hint @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const handle = await openWithRoutes(page, { kind: "text", text: "init" });

    await openCapabilitiesPopover(page);

    const starterButton = page
      .getByTestId(CAPABILITIES_POPOVER)
      .locator(`[data-testid="${CAPABILITY_STARTER}"][data-example="run-1"]`);

    await expect(starterButton).toBeVisible();
    await starterButton.click();

    const mentionMenu = page.getByTestId(MENTION_MENU);
    await expect(mentionMenu).toBeVisible();
    await expect(mentionMenu).toContainText("Pick a request to run");

    const composer = page.getByTestId(COMPOSER);
    await expect(composer).toContainText("Run the request I have open");

    expect(handle.requestBodies.length).toBe(0);

    await snap("04-mention-menu");
  });

  test("[REL-POL-CAPS-05] the See tab lists attached items, the workspace index, on-demand lookups, env values only with Share variable values, and secrets hidden @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const seeTab = page.getByTestId(CAPABILITY_TAB_SEE);
    await seeTab.click();

    await expect(seeTab).toHaveAttribute("aria-selected", "true");

    const popover = page.getByTestId(CAPABILITIES_POPOVER);

    for (const id of ["attached", "index", "lookups", "envValues", "secrets"]) {
      await expect(popover.getByTestId(`relay-capability-see-${id}`)).toBeVisible();
    }

    const attachedItem = popover.getByTestId("relay-capability-see-attached");
    const pills = attachedItem.locator(`[data-testid="${ENTITY_PILL}"]`);
    await expect(pills.first()).toBeVisible();

    const envValuesItem = popover.getByTestId("relay-capability-see-envValues");
    const settingsLink = envValuesItem.locator(
      `[data-testid="${CAPABILITY_SETTINGS_LINK}"]`,
    );
    await expect(settingsLink).toBeVisible();
    await expect(envValuesItem).toContainText("Share variable values");

    await snap("05-see-tab");
  });

  test("[REL-POL-CAPS-06] approval badges read \"Runs directly\" or \"Asks first\" per the current mode, and bulk tools read \"Asks first when more than 10 items\" @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await seedPermissionMode(page, "skip");

    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const panel = page.getByTestId(CAPABILITIES_PANEL);
    const badges = panel.locator(`[data-testid="${CAPABILITY_BADGE}"]`);

    await expect(badges).toHaveCount(13);
    const skipBadges = await readBadges(panel);
    expect(skipBadges.every((b) => b.badge === "runs")).toBe(true);

    const firstBadge = badges.first();
    await expect(firstBadge).toHaveAttribute("data-badge", "runs");
    await expect(firstBadge).toContainText("Runs directly");

    await page.keyboard.press("Escape");
    await seedPermissionMode(page, "review");
    await page.reload();
    await openCapabilitiesPopover(page);

    const reviewBadges = await readBadges(panel);
    expect(reviewBadges.length).toBe(13);

    const asksBulkBadges = reviewBadges.filter((b) => b.badge === "asksBulk");
    expect(asksBulkBadges.length).toBe(1);
    expect(asksBulkBadges[0]?.text).toContain("Asks first when more than 10 items");

    const runsBadges = reviewBadges.filter((b) => b.badge === "runs");
    expect(runsBadges.length).toBe(9);

    const asksOnlyBadges = reviewBadges.filter(
      (b) => b.badge === "asks" && b.text === "Asks first",
    );
    expect(asksOnlyBadges.length).toBe(3);

    const writeCategoryPanel = page.getByTestId(
      `${CAPABILITY_CATEGORY_PREFIX}write`,
    );
    const writeBadges = await readBadges(writeCategoryPanel);
    const writeAsksBulk = writeBadges.find((b) => b.badge === "asksBulk");
    expect(writeAsksBulk?.badge).toBe("asksBulk");

    await page.keyboard.press("Escape");
    await seedPermissionMode(page, "always-ask");
    await page.reload();
    await openCapabilitiesPopover(page);

    const alwaysAskBadges = await readBadges(panel);
    const askCountBadges = alwaysAskBadges.filter((b) => b.badge === "asks");
    expect(askCountBadges.length).toBe(10);
    expect(askCountBadges[0]?.text).toBe("Asks first");

    await snap("06-approval-badges");
  });

  test("[REL-POL-CAPS-07] after changing the mode via the shield, reopening the popover shows the updated badges @high", async ({
    seededPage: page,
    snap,
  }) => {
    await seedPermissionMode(page, "skip");

    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const panel = page.getByTestId(CAPABILITIES_PANEL);
    const badges = panel.locator(`[data-testid="${CAPABILITY_BADGE}"]`);
    await expect(badges).toHaveCount(13);
    const skipBadges = await readBadges(panel);
    expect(skipBadges.every((b) => b.badge === "runs")).toBe(true);

    const popover = page.getByTestId(CAPABILITIES_POPOVER);
    const permissionTrigger = page.getByTestId(PERMISSION_TRIGGER);
    await permissionTrigger.click();

    await expect(popover).toBeHidden();
    const permissionPopover = page.getByTestId(PERMISSION_POPOVER);
    await expect(permissionPopover).toBeVisible();

    const alwaysAskOption = page.getByTestId("relay-permission-option-always-ask");
    await alwaysAskOption.click();

    await openCapabilitiesPopover(page);

    const alwaysAskBadges = await readBadges(panel);
    const askCount = alwaysAskBadges.filter((v) => v.badge === "asks").length;
    expect(askCount).toBe(10);

    await snap("07-switching-mode");
  });

  test("[REL-POL-CAPS-08] \"Change approval mode\" opens the shield popover @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const popover = page.getByTestId(CAPABILITIES_POPOVER);
    const changeMode = popover.getByTestId(CAPABILITY_CHANGE_MODE);
    await changeMode.click();

    await expect(popover).toBeHidden();
    const permissionPopover = page.getByTestId(PERMISSION_POPOVER);
    await expect(permissionPopover).toBeVisible();

    await snap("08-shield-popover");
  });

  test("[REL-POL-CAPS-09] the new-chat empty state shows the large logo, title, description and the same starters @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    const emptyState = page.getByTestId(EMPTY_STATE);
    await expect(emptyState).toBeVisible();

    const logo = emptyState.locator("svg").first();
    await expect(logo).toBeVisible();

    const title = emptyState.locator("h3");
    await expect(title).toBeVisible();
    await expect(title).toContainText("How can Relay help?");

    const description = emptyState.locator("p").first();
    await expect(description).toBeVisible();

    const starters = emptyState.locator(
      `[data-testid="${CAPABILITY_STARTER}"]`,
    );
    const starterCount = await starters.count();
    expect(starterCount).toBe(15);

    await snap("09-empty-state");
  });

  test("[REL-POL-CAPS-10] the empty state is identical whichever tab is open and shows no tab-derived text @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    const emptyState = page.getByTestId(EMPTY_STATE);
    await expect(emptyState).toBeVisible();

    const starters = emptyState.locator(
      `[data-testid="${CAPABILITY_STARTER}"]`,
    );
    const initialTexts = await starters.allTextContents();
    expect(initialTexts.length).toBe(15);

    await openSavedRequest(page, SEEDED_REQUEST_NAME);

    const requestTab = page
      .getByTestId("tab")
      .filter({ hasText: SEEDED_REQUEST_NAME });
    await expect(requestTab).toBeVisible();

    const emptyStateAfterOpen = page.getByTestId(EMPTY_STATE);
    const startersAfterOpen = emptyStateAfterOpen.locator(
      `[data-testid="${CAPABILITY_STARTER}"]`,
    );

    // Use web-first assertion that retries to handle timing races
    await expect(startersAfterOpen).toHaveText(initialTexts);

    const emptyStateContent = await emptyStateAfterOpen.textContent();
    expect(emptyStateContent).not.toContain(SEEDED_REQUEST_NAME);

    await snap("10-empty-state-consistency");
  });

  test("[REL-POL-CAPS-11] the launcher Settings section opens the capabilities popover @medium", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    const settingsSection = page.getByTestId(LAUNCHER_SECTION_SETTINGS);
    await expect(settingsSection).toBeVisible();

    const settingsRows = settingsSection.getByTestId(LAUNCHER_ROW);
    const capabilitiesRow = settingsRows.filter({
      hasText: /what relay can do|capabilities/i,
    });

    const rowCount = await capabilitiesRow.count();
    expect(rowCount).toBeGreaterThan(0);

    await capabilitiesRow.first().click();

    const popover = page.getByTestId(CAPABILITIES_POPOVER);
    await expect(popover).toBeVisible();

    const launcher = page.getByTestId(LAUNCHER);
    await expect(launcher).toBeHidden();

    await snap("11-launcher-settings");
  });

  test("[REL-POL-CAPS-12] the final + launcher shows exactly four sections in the order Recent, Attach, Actions, Settings, and Settings holds Permission mode and What Relay can do @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.addInitScript(
      ([key, item]) => localStorage.setItem(key, JSON.stringify([item])),
      [RECENT_STORAGE_KEY, SEEDED_RECENT] as const,
    );

    await openWithRoutes(page, { kind: "text", text: "init" });
    await openLauncher(page);

    const launcher = page.getByTestId(LAUNCHER);
    await expect(launcher).toBeVisible();

    const sections = launcher.locator("[data-testid^='relay-launcher-section-']");
    await expect(sections).toHaveCount(4);

    const sectionIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const section = sections.nth(i);
      const testId = await section.getAttribute("data-testid");
      if (testId) sectionIds.push(testId);
    }

    expect(sectionIds).toEqual([
      LAUNCHER_SECTION_RECENT,
      LAUNCHER_SECTION_ATTACH,
      LAUNCHER_SECTION_ACTIONS,
      LAUNCHER_SECTION_SETTINGS,
    ]);

    const settingsSection = launcher.getByTestId(LAUNCHER_SECTION_SETTINGS);
    const rows = settingsSection.getByTestId(LAUNCHER_ROW);
    await expect(rows).toHaveCount(2);

    const rowTexts = await rows.allTextContents();
    expect(rowTexts[0]).toMatch(/^Permission mode/);
    expect(rowTexts[1]).toMatch(/^What Relay can do/);

    await snap("12-launcher-structure");
  });
});
