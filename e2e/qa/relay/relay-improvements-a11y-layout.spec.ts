import type { Locator, Page } from "@playwright/test";
import { expectDockWidth, openRelay } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { installSpeechStub } from "../../fixtures/speechStub";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const ONBOARDED_KEY = "rq_relay_onboarded";
const DEFAULT_WIDTH_PX = 400;
const MIN_WIDTH_PX = 320;
const MOBILE_VIEWPORT = { width: 375, height: 800 };
const MIN_TOUCH_TARGET_PX = 36;
const POSITION_TOLERANCE_PX = 1;
// The composer never sends here, so this scripted reply must stay unused.
const UNUSED_REPLY = "unused";

type Box = { x: number; y: number; width: number; height: number };

const dock = (page: Page) => page.getByTestId("relay-dock");
const composer = (page: Page) => page.getByTestId("relay-composer");
const plus = (page: Page) => page.getByTestId("relay-picker-trigger");
const mic = (page: Page) => page.getByTestId("relay-mic");
const send = (page: Page) => page.getByTestId("relay-send");

async function box(locator: Locator): Promise<Box> {
  const result = await locator.boundingBox();
  if (!result) throw new Error("Expected the element to have a bounding box");
  return result;
}

/** Opens the dock with the speech stub (so the mic renders) and the coach marked seen. */
async function openComposerDock(page: Page) {
  await installSpeechStub(page);
  await installRelayRoutes(page, [{ kind: "text", text: UNUSED_REPLY }]);
  await page.addInitScript((key) => localStorage.setItem(key, "true"), ONBOARDED_KEY);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await expect(mic(page)).toBeVisible();
}

async function dragHandleTo(page: Page, clientX: number) {
  const handle = await box(page.getByTestId("relay-resize-handle"));
  const y = handle.y + handle.height / 2;
  await page.mouse.move(handle.x + handle.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(clientX, y, { steps: 5 });
  await page.mouse.up();
}

/** "+" | textarea | mic | send, left to right, on one row, inside the dock. */
async function expectRowOrder(page: Page) {
  await expect
    .poll(async () => {
      const [shell, add, field, microphone, sendButton] = await Promise.all([
        box(dock(page)),
        box(plus(page)),
        box(composer(page)),
        box(mic(page)),
        box(send(page)),
      ]);
      const overlapsRow = (b: Box) => b.y < field.y + field.height && b.y + b.height > field.y;
      const tol = POSITION_TOLERANCE_PX;
      return {
        plusLeftOfField: add.x + add.width <= field.x + tol,
        micRightOfField: microphone.x >= field.x + field.width - tol,
        sendRightOfMic: sendButton.x >= microphone.x + microphone.width - tol,
        oneRow: [add, microphone, sendButton].every(overlapsRow),
        insideDock:
          add.x >= shell.x - tol && sendButton.x + sendButton.width <= shell.x + shell.width + tol,
      };
    })
    .toEqual({
      plusLeftOfField: true,
      micRightOfField: true,
      sendRightOfMic: true,
      oneRow: true,
      insideDock: true,
    });
}

test.describe("Relay composer layout and touch targets @qa", () => {
  test("[REL-IA11Y-04] composer buttons have >= 36px touch targets at mobile sheet width", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    // The toggle is not shown at sheet width, so open at desktop size and reload narrow (open state persists).
    await openComposerDock(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.reload();
    await expect(dock(page)).toBeVisible();
    await expectDockWidth(page, MOBILE_VIEWPORT.width);
    await expect(mic(page)).toBeVisible();

    for (const [name, control] of [["plus", plus(page)], ["mic", mic(page)], ["send", send(page)]] as const) {
      await expect(control, name).toBeVisible();
      const { width, height } = await box(control);
      expect(width, `${name} width`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      expect(height, `${name} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    }
    await snap("01-touch-targets");
  });

  test('[REL-IA11Y-05] at 320px, 400px and mobile sheet width "+" is left of the textarea and mic and send are right of it, on one row', { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openComposerDock(page);
    await expectDockWidth(page, DEFAULT_WIDTH_PX);
    await expectRowOrder(page);
    await snap("01-400px");

    await dragHandleTo(page, page.viewportSize()?.width ?? 0);
    await expectDockWidth(page, MIN_WIDTH_PX);
    await expectRowOrder(page);
    await snap("02-320px");

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.reload();
    await expect(dock(page)).toBeVisible();
    await expectDockWidth(page, MOBILE_VIEWPORT.width);
    await expect(mic(page)).toBeVisible();
    await expectRowOrder(page);
    await snap("03-mobile-sheet");
  });
});
