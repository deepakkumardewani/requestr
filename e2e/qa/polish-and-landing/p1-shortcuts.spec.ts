import type { Page } from "@playwright/test";
import { findShortcut } from "../../../src/app/settings/constants";
import { getShortcutKeyParts } from "../../../src/lib/shortcutFormat";
import shortcutMessages from "../../../messages/en/shortcuts.json";
import { expect, test } from "../../fixtures/qa";

const APP_PATH = "/app";
const SETTINGS_PATH = "/settings#shortcuts";
const RELAY_ENABLED_KEY = "rq_relay_enabled";

const PLATFORMS = [
  { name: "MacIntel", onMac: true, relayChord: "Meta+i", relayLabel: "⌘+I" },
  {
    name: "Win32",
    onMac: false,
    relayChord: "Control+Shift+L",
    relayLabel: "Ctrl+Shift+L",
  },
] as const;

/** Actions rendered on every surface that lists the registry. */
const CHECKED_ACTIONS = [
  "newTab",
  "newRequest",
  "openSettings",
  "relayToggle",
] as const;

const messages = shortcutMessages as Record<string, string>;

async function overridePlatform(page: Page, platform: string) {
  await page.addInitScript((value) => {
    Object.defineProperty(Navigator.prototype, "platform", {
      get: () => value,
      configurable: true,
    });
  }, platform);
}

/** Caps of the row whose label is `label`, scoped to `scope`. */
async function rowCaps(scope: ReturnType<Page["locator"]>, label: string) {
  const row = scope.getByText(label, { exact: true }).first().locator("..");
  await expect(row).toBeVisible();
  return row.locator("kbd").allInnerTexts();
}

function expectedParts(actionKey: string, onMac: boolean): string[] {
  return getShortcutKeyParts(findShortcut(actionKey, onMac), onMac);
}

test.describe("P1 shortcut labels and Relay tooltip @qa", () => {
  for (const platform of PLATFORMS) {
    test(`@critical hovering the tab-bar plus shows Ctrl+T on ${platform.name}`, async ({
      page,
      snap,
    }) => {
      await overridePlatform(page, platform.name);
      await page.goto(APP_PATH);

      await page.getByTestId("tab-bar").getByTestId("new-tab-btn").hover();
      const tooltip = page.locator("[data-slot=tooltip-content]");
      await expect(tooltip).toContainText("New Request");
      await expect(tooltip).toContainText("Ctrl+T");
      await snap(`01-new-tab-tooltip-${platform.name}`);
    });

    test(`@critical hovering the Relay icon shows Toggle Relay with the chord on ${platform.name}`, async ({
      page,
      snap,
    }) => {
      await overridePlatform(page, platform.name);
      await page.goto(APP_PATH);

      const toggle = page.getByTestId("relay-toggle");
      await toggle.hover();
      const tooltip = page.locator("[data-slot=tooltip-content]");
      await expect(tooltip).toContainText("Toggle Relay");
      await expect(tooltip).toContainText(platform.relayLabel);
      await snap(`02-relay-tooltip-${platform.name}`);

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      await page.keyboard.press(platform.relayChord);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    });
  }

  test("@high command palette, shortcuts modal and Settings show the registry labels", async ({
    page,
    snap,
  }) => {
    await overridePlatform(page, "Win32");
    await page.goto(APP_PATH);

    const palette = page.getByRole("dialog");
    // Retry the chord: the key listener attaches only after hydration.
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(palette).toBeVisible({ timeout: 1_000 });
    }).toPass();
    const paletteRows = [
      ["New Request", "newRequest"],
      ["Open Settings", "openSettings"],
    ] as const;
    for (const [label, action] of paletteRows) {
      const item = palette.getByRole("option", { name: new RegExp(label) });
      await expect(item).toContainText(expectedParts(action, false).join("+"));
    }
    await snap("03-palette");
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    const modal = page.getByRole("dialog");
    await page.keyboard.press("Control+/");
    await expect(modal).toBeVisible();
    for (const action of CHECKED_ACTIONS) {
      expect(await rowCaps(modal, messages[action])).toEqual(
        expectedParts(action, false),
      );
    }
    await snap("04-shortcuts-modal");

    await page.goto(SETTINGS_PATH);
    await expect(page.getByTestId("shortcut-group").first()).toBeVisible();
    for (const action of CHECKED_ACTIONS) {
      expect(await rowCaps(page.locator("body"), messages[action])).toEqual(
        expectedParts(action, false),
      );
    }
    await snap("05-settings-shortcuts");
  });

  test("@medium with Relay disabled the icon and its shortcut are gone", async ({
    page,
    snap,
  }) => {
    await overridePlatform(page, "Win32");
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "false");
    }, RELAY_ENABLED_KEY);
    await page.goto(APP_PATH);

    await expect(page.getByTestId("tab-bar").getByTestId("new-tab-btn")).toBeVisible();
    await expect(page.getByTestId("relay-toggle")).toHaveCount(0);
    await page.keyboard.press("Control+Shift+L");
    await expect(page.getByTestId("relay-dock")).toHaveCount(0);
    await snap("06-relay-disabled");
  });
});
