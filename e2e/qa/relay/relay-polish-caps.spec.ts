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
const CAPABILITY_SEE_LIST = "relay-capability-see-list";
const CAPABILITY_SEE_VALUES = "relay-capability-see-values";
const CAPABILITY_LIST = "relay-capability-list";
const CAPABILITY_MARKER = "relay-capability-marker";
const SUGGESTION = "relay-suggestion";
const SEE_EVERYTHING = "relay-see-everything";
const SHARE_VALUES_KEY = "rq_relay_share_values";
const CAPABILITY_CATEGORY_PREFIX = "relay-capability-category-";
const CAPABILITY_STARTER = "relay-capability-starter";
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
const CATEGORY_TITLES: Record<string, string> = {
  read: "Read & explain",
  write: "Create & edit",
  run: "Run & test",
  organize: "Organize",
  transfer: "Import & export",
};
const GENERIC_STARTERS = [
  "Create a new request",
  "Import a cURL command",
  "Explore my workspace",
  "Explain a request",
];
const SEEDED_RECENT = { kind: "request", id: "qa-caps-recent", name: "QA Recent Request" };
const SEEDED_REQUEST_NAME = "Request A";

type Marker = { badge: string | null; text: string } | "";

/** Marker per category id; "" when the row shows none. */
async function readMarkers(panel: Locator): Promise<Record<string, Marker>> {
  const result: Record<string, Marker> = {};
  for (const id of CATEGORIES) {
    const marker = panel
      .getByTestId(`${CAPABILITY_CATEGORY_PREFIX}${id}`)
      .getByTestId(CAPABILITY_MARKER);
    result[id] = (await marker.count())
      ? {
          badge: await marker.getAttribute("data-badge"),
          text: (await marker.textContent()) ?? "",
        }
      : "";
  }
  return result;
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

  test("[REL-POL-CAPS-02] five categories render in one list, each with a title and description and no starter buttons @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const popover = page.getByTestId(CAPABILITIES_POPOVER);
    await expect(popover.getByRole("tablist")).toHaveCount(0);
    for (const category of CATEGORIES) {
      const row = popover.getByTestId(`${CAPABILITY_CATEGORY_PREFIX}${category}`);
      await expect(row).toBeVisible();
      await expect(row).toContainText(CATEGORY_TITLES[category]);
      await expect(row.getByRole("button")).toHaveCount(0);
    }
    await expect(popover.locator(`[data-testid="${CAPABILITY_STARTER}"]`)).toHaveCount(0);

    await snap("02-five-categories");
  });

  test("[REL-POL-CAPS-03] a target-free context-aware starter sends its prompt to /api/relay/chat @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const handle = await openWithRoutes(page, { kind: "text", text: "init" });

    const starterButton = page
      .getByTestId(EMPTY_STATE)
      .getByTestId(SUGGESTION)
      .filter({ hasText: "Explore my workspace" });
    await expect(starterButton).toBeVisible();
    await starterButton.click();

    await expect.poll(() => handle.requestBodies.length).toBe(1);

    const body = handle.requestBodies[0] as {
      messages: { role: string; parts: { text?: string }[] }[];
    };
    const userMessage = body.messages.find((m) => m.role === "user");
    expect(userMessage?.parts[0]?.text).toContain("Explore my workspace");

    await snap("03-target-free-starter");
  });

  test("[REL-POL-CAPS-04] a starter that needs a target with nothing attached opens the mention menu with a hint @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const handle = await openWithRoutes(page, { kind: "text", text: "init" });

    const starterButton = page
      .getByTestId(EMPTY_STATE)
      .getByTestId(SUGGESTION)
      .filter({ hasText: "Explain a request" });
    await expect(starterButton).toBeVisible();
    await starterButton.click();

    const mentionMenu = page.getByTestId(MENTION_MENU);
    await expect(mentionMenu).toBeVisible();
    await expect(mentionMenu).toContainText("Pick a request to explain");
    await expect(page.getByTestId(COMPOSER)).toContainText("Explain a request");
    expect(handle.requestBodies.length).toBe(0);

    await snap("04-mention-menu");
  });

  test("[REL-POL-CAPS-05] the \"What Relay can see\" footer lists attached items, the workspace index, variable values only with Share variable values, and secrets hidden @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const popover = page.getByTestId(CAPABILITIES_POPOVER);
    const footer = popover.getByTestId(CAPABILITY_SEE_LIST);
    await expect(footer).toBeVisible();
    await expect(
      footer.getByRole("heading", { name: "What Relay can see" }),
    ).toBeVisible();
    await expect(footer).toContainText("Items you attach with + or @");
    await expect(footer).toContainText("The names, ids and counts of your requests");
    await expect(footer.getByTestId(CAPABILITY_SEE_VALUES)).toHaveText(
      "Variable values, only when you turn on Share variable values",
    );
    await expect(footer).toContainText("Secret values, never");
    await expect(footer.getByTestId(CAPABILITY_SETTINGS_LINK)).toBeVisible();

    // With Share variable values on, the variable line says so.
    await page.keyboard.press("Escape");
    await page.evaluate(([key]) => localStorage.setItem(key, "true"), [SHARE_VALUES_KEY]);
    await page.reload();
    await openCapabilitiesPopover(page);
    await expect(popover.getByTestId(CAPABILITY_SEE_VALUES)).toHaveText(
      "Variable values, because Share variable values is on",
    );

    await snap("05-see-tab");
  });

  test("[REL-POL-CAPS-06] approval markers read \"Asks first\" or \"Asks first for more than 10 items\" per the current mode, and areas that run directly show none @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await seedPermissionMode(page, "skip");
    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const panel = page.getByTestId(CAPABILITIES_PANEL);
    for (const category of CATEGORIES) {
      await expect(panel.getByTestId(`${CAPABILITY_CATEGORY_PREFIX}${category}`)).toBeVisible();
    }
    await expect(panel.getByTestId(CAPABILITY_MARKER)).toHaveCount(0);
    await expect(panel.getByText("Runs directly")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await seedPermissionMode(page, "review");
    await page.reload();
    await openCapabilitiesPopover(page);

    const review = await readMarkers(panel);
    expect(review.read).toBe("");
    expect(review.write).toEqual({ badge: "asksBulk", text: "Asks first for more than 10 items" });
    const reviewMarked = Object.values(review).filter((m) => m !== "");
    expect(reviewMarked.length).toBeGreaterThan(0);
    expect(reviewMarked.length).toBeLessThan(CATEGORIES.length);

    await page.keyboard.press("Escape");
    await seedPermissionMode(page, "always-ask");
    await page.reload();
    await openCapabilitiesPopover(page);

    const alwaysAsk = await readMarkers(panel);
    expect(alwaysAsk.read).toBe("");
    for (const category of CATEGORIES.filter((c) => c !== "read")) {
      expect(alwaysAsk[category], category).toEqual({ badge: "asks", text: "Asks first" });
    }

    await snap("06-approval-badges");
  });

  test("[REL-POL-CAPS-07] after changing the mode via the shield, reopening the popover shows the updated markers @high", async ({
    seededPage: page,
    snap,
  }) => {
    await seedPermissionMode(page, "skip");

    await openWithRoutes(page, { kind: "text", text: "init" });
    await openCapabilitiesPopover(page);

    const panel = page.getByTestId(CAPABILITIES_PANEL);
    await expect(panel.getByTestId(CAPABILITY_CATEGORY_PREFIX + "write")).toBeVisible();
    await expect(panel.getByTestId(CAPABILITY_MARKER)).toHaveCount(0);

    const popover = page.getByTestId(CAPABILITIES_POPOVER);
    await page.getByTestId(PERMISSION_TRIGGER).click();

    await expect(popover).toBeHidden();
    await expect(page.getByTestId(PERMISSION_POPOVER)).toBeVisible();
    await page.getByTestId("relay-permission-option-always-ask").click();

    await openCapabilitiesPopover(page);

    const alwaysAsk = await readMarkers(panel);
    expect(alwaysAsk.read).toBe("");
    for (const category of CATEGORIES.filter((c) => c !== "read")) {
      expect(alwaysAsk[category], category).toEqual({ badge: "asks", text: "Asks first" });
    }

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

  test("[REL-POL-CAPS-09] the new-chat empty state shows the large logo, title, description and the context-aware starters with a quiet link to the full list @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    const emptyState = page.getByTestId(EMPTY_STATE);
    await expect(emptyState).toBeVisible();
    await expect(emptyState.locator("svg").first()).toBeVisible();
    await expect(emptyState.locator("h3")).toHaveText("How can Relay help?");
    await expect(emptyState.locator("p").first()).toBeVisible();

    await expect(emptyState.getByTestId(SUGGESTION)).toHaveText(GENERIC_STARTERS);
    await expect(emptyState.getByTestId(CAPABILITY_LIST)).toHaveCount(0);
    await expect(emptyState.getByTestId(SEE_EVERYTHING)).toBeVisible();

    await snap("09-empty-state");
  });

  test("[REL-POL-CAPS-10] the empty state follows what is open: generic starters with nothing open, request starters naming the open request @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    const emptyState = page.getByTestId(EMPTY_STATE);
    const suggestions = emptyState.getByTestId(SUGGESTION);
    await expect(suggestions).toHaveText(GENERIC_STARTERS);
    expect(await emptyState.textContent()).not.toContain(SEEDED_REQUEST_NAME);

    await openSavedRequest(page, SEEDED_REQUEST_NAME);
    await expect(
      page.getByTestId("tab").filter({ hasText: SEEDED_REQUEST_NAME }),
    ).toBeVisible();

    await expect(
      suggestions.filter({ hasText: `Explain ${SEEDED_REQUEST_NAME}` }),
    ).toHaveCount(1);
    await expect(suggestions.filter({ hasText: "Explore my workspace" })).toHaveCount(0);

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
