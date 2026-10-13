/**
 * Thin helpers for the Relay e2e specs (e2e/qa/relay/*.spec.ts).
 * All functions use getByTestId / web-first assertions. No fixed sleeps.
 *
 * `sendMessage` and `expectBanner` target the conventional `relay-send` and
 * `relay-banner` test ids; the components that own them arrive in the chat
 * phases, so they are not exercised by the shell spec.
 */
import { expect, type Page } from "@playwright/test";

/** Maximum distance in px between an expected and a measured dock width. */
const WIDTH_TOLERANCE_PX = 1;

const RELAY_CHORD_MAC = "Meta+i";
const RELAY_CHORD_OTHER = "Control+Shift+L";

const TOGGLE = "relay-toggle";
const DOCK = "relay-dock";
const CLOSE = "relay-close";
const COMPOSER = "relay-composer";
const SEND = "relay-send";
const BANNER = "relay-banner";

/** Presses the platform's Relay chord (Cmd+I on Mac, Ctrl+Shift+L elsewhere). */
export async function pressRelayShortcut(page: Page): Promise<void> {
  const onMac = await page.evaluate(() =>
    /Mac|iPhone|iPad|iPod/.test(navigator.platform),
  );
  await page.keyboard.press(onMac ? RELAY_CHORD_MAC : RELAY_CHORD_OTHER);
}

/** Opens the dock through the toggle button and waits until it is usable. */
export async function openRelay(page: Page): Promise<void> {
  const toggle = page.getByTestId(TOGGLE);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId(DOCK)).toBeVisible();
  await expect(page.getByTestId(COMPOSER)).toBeFocused();
}

/** Closes the dock through its header close button. */
export async function closeRelay(page: Page): Promise<void> {
  await page.getByTestId(CLOSE).click();
  await expect(page.getByTestId(DOCK)).toBeHidden();
}

/** Asserts the dock is `widthPx` wide, waiting out the open transition. */
export async function expectDockWidth(
  page: Page,
  widthPx: number,
): Promise<void> {
  await expect
    .poll(async () => (await page.getByTestId(DOCK).boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(widthPx - WIDTH_TOLERANCE_PX);
  await expect
    .poll(async () => (await page.getByTestId(DOCK).boundingBox())?.width ?? 0)
    .toBeLessThanOrEqual(widthPx + WIDTH_TOLERANCE_PX);
}

/** Types a message into the composer and sends it. */
export async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByTestId(COMPOSER).fill(text);
  await page.getByTestId(SEND).click();
}

/** Asserts the status banner is visible and contains `text`. */
export async function expectBanner(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  await expect(page.getByTestId(BANNER)).toContainText(text);
}
