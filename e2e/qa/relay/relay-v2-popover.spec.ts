import type { Page } from "@playwright/test";
import { openRelay, WORKSPACE_PATH } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const HEADER_CAPABILITIES = "relay-header-capabilities";
const POPOVER = "relay-capabilities-popover";
const LIST = "relay-capability-list";
const CATEGORY_PREFIX = "relay-capability-category-";
const MARKER = "relay-capability-marker";
const SEE_LIST = "relay-capability-see-list";
const SETTINGS_LINK = "relay-capability-settings-link";
const CHANGE_MODE = "relay-capability-change-mode";
const PERMISSION_POPOVER = "relay-permission-popover";
const PERMISSION_MODE_STORAGE_KEY = "rq_relay_permission_mode";
const CATEGORIES = ["read", "write", "run", "organize", "transfer"];
const MAX_LIST_HEIGHT_PX = 384;
const SHORT_VIEWPORT = { width: 1280, height: 520 };
const MAX_TAB_PRESSES = 30;

type Mode = "always-ask" | "review" | "skip";

async function openPopover(page: Page, mode?: Mode) {
  if (mode) {
    await page.addInitScript(
      // Only seed once, so a later reload keeps a mode changed by the test.
      ([key, value]) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      },
      [PERMISSION_MODE_STORAGE_KEY, mode] as const,
    );
  }
  await installRelayRoutes(page, { kind: "text", text: "init" });
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await page.getByTestId(HEADER_CAPABILITIES).click();
  await expect(page.getByTestId(POPOVER)).toBeVisible();
}

/** Marker text per category id, "" when the row shows no marker. */
async function readMarkers(page: Page): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const id of CATEGORIES) {
    const marker = page
      .getByTestId(`${CATEGORY_PREFIX}${id}`)
      .getByTestId(MARKER);
    result[id] = (await marker.count()) ? ((await marker.textContent()) ?? "") : "";
  }
  return result;
}

test.describe("Relay V2: single-list capabilities popover @qa", () => {
  test("[REL-V2-POPOVER-01] the popover has no tablist and the \"What Relay can see\" footer is visible @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openPopover(page);
    const popover = page.getByTestId(POPOVER);

    await expect(popover.getByRole("tablist")).toHaveCount(0);
    await expect(popover.getByRole("tab")).toHaveCount(0);
    for (const id of CATEGORIES) {
      await expect(popover.getByTestId(`${CATEGORY_PREFIX}${id}`)).toBeVisible();
    }

    const footer = popover.getByTestId(SEE_LIST);
    await expect(footer).toBeVisible();
    await expect(
      footer.getByRole("heading", { name: "What Relay can see" }),
    ).toBeVisible();
    await expect(footer).toContainText("Secret values, never");
    await expect(popover.getByTestId(SETTINGS_LINK)).toBeVisible();

    await snap("01-single-list-footer");
  });

  test("[REL-V2-POPOVER-02] the list scrolls inside a max height and every row and action is keyboard reachable @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    await openPopover(page);
    const popover = page.getByTestId(POPOVER);
    const list = popover.getByTestId(LIST);

    const maxHeight = await list.evaluate((el) => getComputedStyle(el).maxHeight);
    expect(maxHeight).toBe(`${MAX_LIST_HEIGHT_PX}px`);
    expect(await list.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
    const listBox = await list.boundingBox();
    expect(listBox?.height).toBeLessThanOrEqual(MAX_LIST_HEIGHT_PX);

    // The short viewport forces overflow: only the list scrolls, the footer and action stay in view.
    await expect
      .poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight))
      .toBe(true);
    await expect(popover.getByTestId(SEE_LIST)).toBeInViewport();
    await expect(popover.getByTestId(CHANGE_MODE)).toBeInViewport();

    // Keyboard: the list is a tab stop that scrolls, then the link and action follow in order.
    await list.focus();
    await expect(list).toBeFocused();
    await page.keyboard.press("End");
    await expect
      .poll(() =>
        list.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1),
      )
      .toBe(true);
    await expect(
      popover.getByTestId(`${CATEGORY_PREFIX}transfer`),
    ).toBeInViewport();

    const link = popover.getByTestId(SETTINGS_LINK);
    const action = popover.getByTestId(CHANGE_MODE);
    let linkFocused = false;
    for (let i = 0; i < MAX_TAB_PRESSES; i++) {
      await page.keyboard.press("Tab");
      if (await link.evaluate((el) => el === document.activeElement)) {
        linkFocused = true;
        break;
      }
    }
    expect(linkFocused).toBe(true);
    await page.keyboard.press("Tab");
    await expect(action).toBeFocused();

    await snap("02-scroll-keyboard");
  });

  test("[REL-V2-POPOVER-03] the asks-first marker appears only on areas where approval applies @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openPopover(page, "review");
    const popover = page.getByTestId(POPOVER);

    const review = await readMarkers(page);
    await snap("03-markers-review");

    // Markers never appear on the read area, and at least one area runs without a marker.
    expect(review.read).toBe("");
    const markedReview = Object.values(review).filter(Boolean);
    expect(markedReview.length).toBeGreaterThan(0);
    expect(markedReview.length).toBeLessThan(CATEGORIES.length);
    expect(review.write).toBe("Asks first for more than 10 items");
    await expect(popover.getByText("Runs directly")).toHaveCount(0);

    // Always-ask: every area that changes anything asks first.
    await page.keyboard.press("Escape");
    await page.evaluate(
      ([key]) => localStorage.setItem(key, "always-ask"),
      [PERMISSION_MODE_STORAGE_KEY],
    );
    await page.reload();
    await page.getByTestId(HEADER_CAPABILITIES).click();
    await expect(popover).toBeVisible();
    const alwaysAsk = await readMarkers(page);
    expect(alwaysAsk.read).toBe("");
    for (const id of CATEGORIES.filter((c) => c !== "read")) {
      expect(alwaysAsk[id], id).toBe("Asks first");
    }
    await snap("03-markers-always-ask");
  });

  test("[REL-V2-POPOVER-04] \"Change approval mode\" still opens the mode selector @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openPopover(page);
    const popover = page.getByTestId(POPOVER);

    await popover.getByRole("button", { name: "Change approval mode" }).click();

    await expect(popover).toBeHidden();
    const modeSelector = page.getByTestId(PERMISSION_POPOVER);
    await expect(modeSelector).toBeVisible();
    await expect(
      modeSelector.getByTestId("relay-permission-option-review"),
    ).toBeVisible();

    await snap("04-mode-selector");
  });
});
