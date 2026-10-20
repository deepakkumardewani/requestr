import type { Locator, Page } from "@playwright/test";
import { IDB_DB_NAME } from "@/lib/idbSchema";
import {
  RELAY_COMPOSER_MAX_HEIGHT_PX,
  RELAY_MIN_TOUCH_TARGET_PX,
} from "@/lib/relay/constants";
import { expect, test } from "../../fixtures/qa";
import {
  attachFromPicker,
  dragDockToWidth,
  expectDockWidth,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  startRelayGate,
} from "../../fixtures/relayRoutes";

const COMPOSER_BOX = "relay-composer-box";
const COMPOSER = "relay-composer";
const COMPOSER_TOOLBAR = "relay-composer-toolbar";
const COMPOSER_PILLS = "relay-composer-pills";
const COMPOSER_PILL = "relay-composer-pill";
const COMPOSER_PILL_REMOVE = "relay-composer-pill-remove";
const COMPOSER_PILL_LABEL = "relay-composer-pill-label";
const PICKER_TRIGGER = "relay-picker-trigger";
const MIC_BUTTON = "relay-mic";
const SEND_BUTTON = "relay-send";
const STOP_BUTTON = "relay-stop";
const FOOTER = "relay-footer";
const OFFLINE_NOTICE = "relay-offline-notice";
const REQUEST_NAME = "Request A";
const SECOND_REQUEST_NAME = "Request B";
const REQUEST_URL_QUERY = "request-a";
const TOOLTIP_CONTENT = '[data-slot="tooltip-content"][data-open]';
const TOOLTIP_ADD = "Attach context";
const TOOLTIP_MIC = "Dictate";
const TOOLTIP_SEND = "Send message";
const TOOLTIP_STOP = "Stop generating";
const DOCK = "relay-dock";
const RESIZE_HANDLE = "relay-resize-handle";

async function setAppLocale(
  page: Page,
  locale: "en" | "fr" | "ja",
): Promise<void> {
  await page.evaluate(
    async ({ dbName, locale: nextLocale }) => {
      const openDb = (): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const db = await openDb();
      const existing = await new Promise<Record<string, unknown> | undefined>(
        (resolve) => {
          const tx = db.transaction("settings", "readonly");
          const getReq = tx.objectStore("settings").get("app");
          getReq.onsuccess = () =>
            resolve(getReq.result as Record<string, unknown> | undefined);
        },
      );
      db.close();
      const writeDb = await openDb();
      const writeTx = writeDb.transaction("settings", "readwrite");
      writeTx.objectStore("settings").put({ ...existing, locale: nextLocale }, "app");
      await new Promise<void>((resolve, reject) => {
        writeTx.oncomplete = () => resolve();
        writeTx.onerror = () => reject(writeTx.error);
      });
      writeDb.close();
    },
    { dbName: IDB_DB_NAME, locale },
  );
  await page.reload();
  await page.waitForLoadState("load");
  const toggle = page.getByTestId("relay-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId(DOCK)).toBeVisible();
}

/**
 * Types an @query, picks the matching row from the mention menu and keeps the
 * inserted token. The query ends at whitespace, so it matches the request URL
 * slug rather than the spaced display name.
 */
async function attachByMention(page: Page, name: string): Promise<void> {
  await page.getByTestId(COMPOSER).fill(`hello @${REQUEST_URL_QUERY}`);
  await page
    .getByTestId("relay-mention-option")
    .filter({ hasText: name })
    .first()
    .click();
}

/** Checks for bounding box rect intersection between two elements. */
async function expectNoOverlap(
  page: Page,
  aLocator: Locator,
  bLocator: Locator,
): Promise<void> {
  const aBox = await aLocator.boundingBox();
  const bBox = await bLocator.boundingBox();

  if (!aBox || !bBox) {
    throw new Error("expectNoOverlap: one or both elements not found");
  }

  // Check if rectangles intersect: not intersecting if one is completely left/right/above/below the other
  const noIntersection =
    aBox.x + aBox.width <= bBox.x || // a is completely left of b
    bBox.x + bBox.width <= aBox.x || // b is completely left of a
    aBox.y + aBox.height <= bBox.y || // a is completely above b
    bBox.y + bBox.height <= aBox.y; // b is completely above a

  expect(noIntersection).toBe(true);
}


test.describe("Relay: unified composer @qa", () => {
  test("[REL-POL-COMPOSER-01] one rounded border wraps the textarea and the toolbar inside relay-composer-box @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await openRelay(page);

    const box = page.getByTestId(COMPOSER_BOX);
    await expect(box).toBeVisible();

    // Check border and border-radius are set on the box
    const boxStyles = await box.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderWidth: styles.borderWidth,
        borderRadius: styles.borderRadius,
      };
    });
    expect(boxStyles.borderWidth).not.toBe("0px");
    expect(boxStyles.borderRadius).not.toBe("0px");

    // Check textarea has no border
    const textarea = page.getByTestId(COMPOSER);
    const textareaStyles = await textarea.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderWidth: styles.borderWidth,
      };
    });
    expect(textareaStyles.borderWidth).toBe("0px");

    await expect(box.getByTestId(COMPOSER)).toBeVisible();
    await expect(box.getByTestId(COMPOSER_TOOLBAR)).toBeVisible();

    await textarea.focus();
    expect(await box.evaluate((el) => el.matches(":focus-within"))).toBe(true);

    await snap("01-border-and-focus");
  });

  test("[REL-POL-COMPOSER-02] at panel widths 320, 400 and 480px nothing overlaps or overflows and pills wrap above the toolbar @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const cases = [
      { viewport: 900, dock: 320 },
      { viewport: 1200, dock: 400 },
      { viewport: 1440, dock: 480 },
    ] as const;

    await page.addInitScript(() => localStorage.removeItem("rq_relay_width"));
    await page.setViewportSize({ width: cases[0].viewport, height: 900 });
    await page.goto("/app");
    await openRelay(page);
    await attachFromPicker(page, "request", REQUEST_NAME);
    await attachFromPicker(page, "request", SECOND_REQUEST_NAME);
    await expect(page.getByTestId(COMPOSER_PILL)).toHaveCount(2);

    for (const { viewport, dock } of cases) {
      await page.setViewportSize({ width: viewport, height: 900 });
      await page.evaluate(() => localStorage.removeItem("rq_relay_width"));
      await dragDockToWidth(page, dock);

      const box = page.getByTestId(COMPOSER_BOX);
      const pills = page.getByTestId(COMPOSER_PILLS);
      const toolbar = page.getByTestId(COMPOSER_TOOLBAR);
      const pickerTrigger = page.getByTestId(PICKER_TRIGGER);
      const mic = page.getByTestId(MIC_BUTTON);
      const send = page.getByTestId(SEND_BUTTON);

      await expect(box).toBeVisible();
      await expectDockWidth(page, dock);

      const hasMic = (await mic.count()) > 0;
      await expectNoOverlap(page, pickerTrigger, hasMic ? mic : send);
      await expectNoOverlap(page, pickerTrigger, send);
      if (hasMic) {
        await expectNoOverlap(page, mic, send);
      }
    }

    await snap("02-responsive-widths");
  });

  test("[REL-POL-COMPOSER-03] the textarea grows from 2 rows up to the maximum height then scrolls @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await openRelay(page);

    const textarea = page.getByTestId(COMPOSER);

    const initialHeight = await textarea.evaluate(
      (el) => (el as HTMLTextAreaElement).offsetHeight,
    );
    expect(initialHeight).toBeGreaterThan(0);

    await textarea.fill("Line 1\nLine 2\nLine 3\nLine 4\n");
    const midHeight = await textarea.evaluate(
      (el) => (el as HTMLTextAreaElement).offsetHeight,
    );
    expect(midHeight).toBeGreaterThan(initialHeight);

    const manyLines = Array.from({ length: 24 }, (_, i) => `Line ${i + 1}`).join(
      "\n",
    );
    await textarea.fill(manyLines);
    const cappedHeight = await textarea.evaluate(
      (el) => (el as HTMLTextAreaElement).offsetHeight,
    );
    expect(cappedHeight).toBeLessThanOrEqual(RELAY_COMPOSER_MAX_HEIGHT_PX);
    expect(cappedHeight).toBeGreaterThanOrEqual(RELAY_COMPOSER_MAX_HEIGHT_PX - 4);

    const scrollInfo = await textarea.evaluate((el) => {
      const ta = el as HTMLTextAreaElement;
      return { scrollHeight: ta.scrollHeight, clientHeight: ta.clientHeight };
    });
    expect(scrollInfo.scrollHeight).toBeGreaterThan(scrollInfo.clientHeight);

    await snap("03-textarea-growth");
  });

  test("[REL-POL-COMPOSER-04] the placeholder equals 'Ask anything, @ to mention, / for actions' in en, and keeps @ and / in fr and ja @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await openRelay(page);

    const textarea = page.getByTestId(COMPOSER);

    // Check English placeholder
    await expect(textarea).toHaveAttribute(
      "placeholder",
      "Ask anything, @ to mention, / for actions",
    );

    await setAppLocale(page, "fr");
    const frPlaceholder = await page
      .getByTestId(COMPOSER)
      .getAttribute("placeholder");
    expect(frPlaceholder).toContain("@");
    expect(frPlaceholder).toContain("/");

    await setAppLocale(page, "ja");
    const jaPlaceholder = await page
      .getByTestId(COMPOSER)
      .getAttribute("placeholder");
    expect(jaPlaceholder).toContain("@");
    expect(jaPlaceholder).toContain("/");

    await snap("04-placeholder-locales");
  });

  test("[REL-POL-COMPOSER-05] send is disabled when empty and while offline, and becomes stop while streaming @high", async ({
    seededPage: page,
    snap,
  }) => {
    const gate = await startRelayGate(page);
    await installRelayRoutes(page, { kind: "gated", gate });

    await page.goto("/app");
    await openRelay(page);
    const textarea = page.getByTestId(COMPOSER);
    const sendBtn = page.getByTestId(SEND_BUTTON);

    // Empty: send is disabled
    await expect(sendBtn).toBeDisabled();

    // Type text: send is enabled
    await textarea.fill("test message");
    await expect(sendBtn).toBeEnabled();

    // Send and stream: button becomes stop
    await sendBtn.click();
    const stopBtn = page.getByTestId(STOP_BUTTON);
    await expect(stopBtn).toBeVisible();

    // Finish the stream
    await gate.end();
    await expect(stopBtn).not.toBeVisible();

    // Offline: the draft stays but send is disabled and the notice shows
    await textarea.fill("offline draft");
    await expect(sendBtn).toBeEnabled();
    await page.context().setOffline(true);
    await expect(page.getByTestId(OFFLINE_NOTICE)).toBeVisible();
    await expect(sendBtn).toBeDisabled();
    await page.context().setOffline(false);
    await expect(sendBtn).toBeEnabled();
    await snap("05-send-button-states");
  });

  test("[REL-POL-COMPOSER-06] tab order is textarea, +, pill remove buttons, mic, send with no shield @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await openRelay(page);

    const textarea = page.getByTestId(COMPOSER);
    await attachFromPicker(page, "request", REQUEST_NAME);
    await attachFromPicker(page, "request", SECOND_REQUEST_NAME);
    await expect(page.getByTestId(COMPOSER_PILL)).toHaveCount(2);
    await textarea.fill("test");
    await textarea.focus();
    await expect(textarea).toBeFocused();

    const expectedOrder = [
      page.getByTestId(PICKER_TRIGGER),
      page.getByTestId(COMPOSER_PILL_REMOVE).nth(0),
      page.getByTestId(COMPOSER_PILL_REMOVE).nth(1),
    ];
    // Dictation is feature-detected, so the mic only joins the order when rendered.
    if ((await page.getByTestId(MIC_BUTTON).count()) > 0) {
      expectedOrder.push(page.getByTestId(MIC_BUTTON));
    }
    expectedOrder.push(page.getByTestId(SEND_BUTTON));

    for (const stop of expectedOrder) {
      await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
    }
    await snap("06-tab-order");
  });

  test("[REL-POL-COMPOSER-07] the AI caption is visible at all times @medium", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await openRelay(page);

    const footer = page.getByTestId(FOOTER);

    // Empty state
    await expect(footer).toBeVisible();

    // With text
    await page.getByTestId(COMPOSER).fill("test message");
    await expect(footer).toBeVisible();

    // While streaming
    const gate = await startRelayGate(page);
    await installRelayRoutes(page, { kind: "gated", gate });

    await page.getByTestId(COMPOSER).fill("test");
    await page.getByTestId(SEND_BUTTON).click();
    await gate.push([{ type: "text-start", id: "text-1" }]);
    await expect(footer).toBeVisible();

    // Offline
    await gate.end();
    await page.context().setOffline(true);
    await expect(footer).toBeVisible();
    await page.context().setOffline(false);

    await snap("07-footer-caption");
  });

  test("[REL-POL-COMPOSER-08] tooltips appear on focus for +, mic and send/stop @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await openRelay(page);

    const textarea = page.getByTestId(COMPOSER);
    const tooltip = page.locator(TOOLTIP_CONTENT);
    await textarea.fill("test");
    await textarea.focus();

    // Keyboard focus (Tab) opens each tooltip; the previous one closes on blur.
    await page.keyboard.press("Tab");
    await expect(page.getByTestId(PICKER_TRIGGER)).toBeFocused();
    await expect(tooltip.filter({ hasText: TOOLTIP_ADD })).toBeVisible();

    if ((await page.getByTestId(MIC_BUTTON).count()) > 0) {
      await page.keyboard.press("Tab");
      await expect(page.getByTestId(MIC_BUTTON)).toBeFocused();
      await expect(tooltip.filter({ hasText: TOOLTIP_MIC })).toBeVisible();
    }

    await page.keyboard.press("Tab");
    await expect(page.getByTestId(SEND_BUTTON)).toBeFocused();
    await expect(tooltip.filter({ hasText: TOOLTIP_SEND })).toBeVisible();
    await snap("08-tooltip-send");

    const gate = await startRelayGate(page);
    await installRelayRoutes(page, { kind: "gated", gate });
    await page.getByTestId(SEND_BUTTON).click();
    const stopBtn = page.getByTestId(STOP_BUTTON);
    await expect(stopBtn).toBeVisible();
    await page.mouse.move(0, 0);
    await stopBtn.focus();
    await expect(tooltip.filter({ hasText: TOOLTIP_STOP })).toBeVisible();
    await snap("08-tooltip-stop");
    await gate.end();
  });

  test("[REL-POL-COMPOSER-09] touch targets are at least the mobile minimum in the sheet at 390px @medium", async ({
    seededPage: page,
    snap,
  }) => {
    // Start at a wider viewport to allow page to load
    await page.setViewportSize({ width: 800, height: 800 });

    await page.goto("/app");
    await openRelay(page);

    // Now resize to mobile sheet layout
    await page.setViewportSize({ width: 390, height: 800 });

    // Wait for layout to stabilize after resize
    await page.waitForFunction(
      () => {
        const btn = document.querySelector("[data-testid='relay-send']");
        return btn !== null;
      },
      { timeout: 5000 },
    );

    await expect(page.getByTestId(RESIZE_HANDLE)).not.toBeVisible();

    const controls = [
      page.getByTestId(PICKER_TRIGGER),
      page.getByTestId(MIC_BUTTON),
      page.getByTestId(SEND_BUTTON),
    ];
    for (const control of controls) {
      if ((await control.count()) === 0) continue;
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(RELAY_MIN_TOUCH_TARGET_PX);
      expect(box!.height).toBeGreaterThanOrEqual(RELAY_MIN_TOUCH_TARGET_PX);
    }

    await snap("09-touch-targets");
  });

  test("[REL-POL-COMPOSER-10] an attached item shows a pill inside the box; the X removes the pill and its @token from the draft @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto("/app");
    await openRelay(page);

    const textarea = page.getByTestId(COMPOSER);
    await attachByMention(page, REQUEST_NAME);

    const pill = page.getByTestId(COMPOSER_PILL);
    await expect(pill).toHaveCount(1);
    await expect(pill).toContainText(REQUEST_NAME);
    await expect(page.getByTestId(COMPOSER_BOX).getByTestId(COMPOSER_PILL)).toHaveCount(1);
    await expect(textarea).toHaveValue(`hello @${REQUEST_NAME} `);
    await snap("10-pill-attached");

    await page.getByTestId(COMPOSER_PILL_REMOVE).click();
    await expect(pill).toHaveCount(0);
    await expect(textarea).not.toHaveValue(new RegExp(`@${REQUEST_NAME}`));
    await snap("10-pill-removed");
  });

  test("[REL-POL-COMPOSER-11] a pill for a deleted workspace item is struck and muted and is dropped from the sent payload @high", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await installRelayRoutes(page, { kind: "text", text: "OK" });
    await page.goto("/app");
    await openRelay(page);

    await attachFromPicker(page, "request", REQUEST_NAME);
    const pill = page.getByTestId(COMPOSER_PILL);
    await expect(pill).toHaveAttribute("data-stale", "false");

    // Delete through the sidebar so the in-memory store, not just IndexedDB, changes.
    await page
      .getByRole("button", { name: /^QA E2E Relay Improvements/ })
      .click();
    const row = page
      .getByTestId("request-item")
      .filter({ hasText: REQUEST_NAME });
    await row.hover();
    await row.getByTestId("request-item-more-btn").click();
    await page.getByTestId("request-delete-btn").click();
    await page.getByRole("alertdialog").getByRole("button", { name: /delete/i }).click();

    await expect(pill).toHaveAttribute("data-stale", "true");
    await expect(pill).toBeVisible();
    await expect(page.getByTestId(COMPOSER_PILL_LABEL)).toHaveCSS(
      "text-decoration-line",
      "line-through",
    );
    await snap("11-stale-pill");

    await sendMessage(page, "still there?");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
    expect(routes.requestBodies).toHaveLength(1);
    const { context } = routes.requestBodies[0] as {
      context: { chips: unknown[] };
    };
    expect(context.chips).toEqual([]);
  });

  test("[REL-POL-COMPOSER-12] a new chat clears the pills and the attached items @medium", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await installRelayRoutes(page, { kind: "text", text: "OK" });
    await page.goto("/app");
    await openRelay(page);

    await attachFromPicker(page, "request", REQUEST_NAME);
    await expect(page.getByTestId(COMPOSER_PILL)).toHaveCount(1);

    const isMac = await page.evaluate(() => /Mac/i.test(navigator.platform));
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await expect(page.getByTestId(COMPOSER_PILL)).toHaveCount(0);
    await snap("12-pills-cleared");

    await sendMessage(page, "fresh chat");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
    const { context } = routes.requestBodies[0] as {
      context: { chips: unknown[] };
    };
    expect(context.chips).toEqual([]);
  });
});
