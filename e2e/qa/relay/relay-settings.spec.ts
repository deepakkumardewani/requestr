import type { Page } from "@playwright/test";
import {
  openRelay,
  pressRelayShortcut,
  sendMessage,
  WORKSPACE_PATH,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes, startRelayGate } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";
import { openTab } from "../../fixtures/qaHelpers";

const SETTINGS_PATH = /\/settings$/;
const ENABLE_SWITCH = "relay-enabled-switch";
const PALETTE_RELAY_ENTRY = "Open Relay";
const PALETTE_RELAY_ENTRIES = [
  "New Relay thread",
  "Relay: ask about this request",
];
const PALETTE_CONTROL_ENTRY = "Compare JSON";
const TEXT_PART_ID = "qa-settings-text-1";
const PARTIAL_TEXT = "Working on it";
const QUESTION = "slow question for the settings spec";

const dock = (page: Page) => page.getByTestId("relay-dock");
const toggle = (page: Page) => page.getByTestId("relay-toggle");
const openInRelay = (page: Page) => page.getByTestId("open-in-relay-btn");
const enableSwitch = (page: Page) => page.getByTestId(ENABLE_SWITCH);

/** Client-side navigation to Settings, Relay: the store keeps its in-memory state. */
async function gotoRelaySettings(page: Page) {
  await page.getByTestId("sidebar-settings-btn").click();
  await expect(page).toHaveURL(SETTINGS_PATH);
  await page.getByTestId("nav-relay").click();
  await expect(page.getByTestId("relay-settings")).toBeVisible();
}

async function setEnabled(page: Page, on: boolean) {
  await gotoRelaySettings(page);
  await enableSwitch(page).click();
  await expect(enableSwitch(page)).toHaveAttribute(
    "aria-checked",
    String(on),
  );
}

/** Back to the workspace without a reload. */
async function backToWorkspace(page: Page) {
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${WORKSPACE_PATH}$`));
}

async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(
    page.getByRole("option", { name: PALETTE_CONTROL_ENTRY }),
  ).toBeVisible();
}

async function expectSurfacesVisible(page: Page) {
  await expect(toggle(page)).toBeVisible();
  await expect(openInRelay(page).first()).toBeVisible();
  await openPalette(page);
  await expect(
    page.getByRole("option", { name: PALETTE_RELAY_ENTRY }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("option", { name: PALETTE_CONTROL_ENTRY }),
  ).toBeHidden();
}

/** The request tab proves the page is the workspace, so the absences below are not vacuous. */
async function expectSurfacesHidden(page: Page) {
  await expect(page.getByTestId("method-selector").first()).toBeVisible();
  await expect(toggle(page)).toHaveCount(0);
  await expect(openInRelay(page)).toHaveCount(0);
  await expect(dock(page)).toHaveCount(0);
  await openPalette(page);
  await expect(
    page.getByRole("option", { name: PALETTE_RELAY_ENTRY }),
  ).toHaveCount(0);
  for (const entry of PALETTE_RELAY_ENTRIES) {
    await expect(page.getByRole("option", { name: entry })).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("option", { name: PALETTE_CONTROL_ENTRY }),
  ).toBeHidden();
}

async function startOnWorkspaceWithTab(page: Page) {
  await installRelayRoutes(page, { kind: "text", text: "Ready." });
  await page.goto(WORKSPACE_PATH);
  await openTab(page);
}

test.describe("Relay Settings Enable switch @qa", () => {
  test("[REL-V2-SETTINGS-01] with Enable off the dock, toggle, launcher, palette entry and Open-in-Relay are hidden and the shortcut does nothing",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await startOnWorkspaceWithTab(page);
      await expectSurfacesVisible(page);
      await openRelay(page);
      await expect(page.getByTestId("relay-picker-trigger")).toBeVisible();

      await setEnabled(page, false);
      // Reactive: the dock leaves the settings page the moment the switch flips.
      await expect(dock(page)).toHaveCount(0);
      await backToWorkspace(page);
      await expectSurfacesHidden(page);
      await expect(page.getByTestId("relay-picker-trigger")).toHaveCount(0);
      await expect(page.getByTestId("relay-launcher")).toHaveCount(0);

      await pressRelayShortcut(page);
      await expect(dock(page)).toHaveCount(0);
      await expect(toggle(page)).toHaveCount(0);
      await snap("01-disabled-workspace");
    });

  test("[REL-V2-SETTINGS-02] after reload with Enable off none of those surfaces appear",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await startOnWorkspaceWithTab(page);
      await openRelay(page);
      await setEnabled(page, false);

      await page.goto(WORKSPACE_PATH);
      await openTab(page);
      await expectSurfacesHidden(page);
      await pressRelayShortcut(page);
      await expect(dock(page)).toHaveCount(0);

      // The persisted choice is what the settings page reads back.
      await gotoRelaySettings(page);
      await expect(enableSwitch(page)).toHaveAttribute("aria-checked", "false");
    });

  test("[REL-V2-SETTINGS-03] turning Enable on restores them without a reload",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await startOnWorkspaceWithTab(page);
      await setEnabled(page, false);
      await backToWorkspace(page);
      await expectSurfacesHidden(page);

      await setEnabled(page, true);
      await backToWorkspace(page);
      await expectSurfacesVisible(page);
      await pressRelayShortcut(page);
      await expect(dock(page)).toBeVisible();
      await snap("03-reenabled-dock");
    });

  test("[REL-V2-SETTINGS-04] no Position control is present in Settings, Relay",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await page.goto("/settings");
      await page.getByTestId("nav-relay").click();
      const section = page.getByTestId("relay-settings");
      await expect(section).toBeVisible();
      // Guards against a vacuous absence: the section's own controls render.
      await expect(enableSwitch(page)).toBeVisible();
      await expect(page.getByTestId("relay-permission-select")).toBeVisible();

      await expect(section.getByText(/position/i)).toHaveCount(0);
      await expect(section.getByLabel(/position/i)).toHaveCount(0);
      await expect(section.getByRole("combobox", { name: /position/i })).toHaveCount(0);
      await expect(section.getByRole("radio")).toHaveCount(0);
    });

  test("[REL-V2-SETTINGS-05] disabling while a mocked turn is streaming aborts it, and re-enabling restores the last active thread",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const gate = await startRelayGate(page);
      const routes = await installRelayRoutes(page, [{ kind: "gated", gate }]);
      await page.goto(WORKSPACE_PATH);
      await openRelay(page);
      await sendMessage(page, QUESTION);
      await gate.push([
        { type: "text-start", id: TEXT_PART_ID },
        { type: "text-delta", id: TEXT_PART_ID, delta: PARTIAL_TEXT },
      ]);
      await expect(page.getByTestId("relay-message-assistant").last()).toContainText(
        PARTIAL_TEXT,
      );
      await expect(page.getByTestId("relay-stop")).toBeVisible();
      expect(routes.abortedCount()).toBe(0);

      await setEnabled(page, false);
      await expect(dock(page)).toHaveCount(0);
      await expect.poll(() => routes.abortedCount()).toBe(1);

      await enableSwitch(page).click();
      await expect(enableSwitch(page)).toHaveAttribute("aria-checked", "true");
      await expect(dock(page)).toBeVisible();
      await expect(page.getByTestId("relay-message-user").last()).toContainText(
        QUESTION,
      );
      // The turn stays stopped: no stop button, and no second request went out.
      await expect(page.getByTestId("relay-stop")).toHaveCount(0);
      expect(routes.requestBodies).toHaveLength(1);
    });

  test("[REL-V2-SETTINGS-06] the Settings, Relay section stays visible while disabled",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await startOnWorkspaceWithTab(page);
      await setEnabled(page, false);
      await expect(page.getByTestId("relay-settings")).toBeVisible();
      await expect(page.getByTestId("nav-relay")).toBeVisible();
      await expect(page.getByTestId("relay-permission-select")).toBeVisible();
      await expect(page.getByTestId("relay-share-values-switch")).toBeVisible();

      await page.reload();
      await page.getByTestId("nav-relay").click();
      await expect(page.getByTestId("relay-settings")).toBeVisible();
      await expect(enableSwitch(page)).toHaveAttribute("aria-checked", "false");
    });
});
