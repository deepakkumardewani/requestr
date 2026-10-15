import type { Locator, Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import {
  expectDockWidth,
  openRelay,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const LOCAL_WORKSPACE = "local";
const THREADS_STORE = "relay_threads";
const THEME_STORAGE_KEY = "theme";
const DEFAULT_WIDTH_PX = 400;
const MIN_WIDTH_PX = 320;
const MOBILE_VIEWPORT = { width: 375, height: 800 };
const LONG_THREAD_PAIRS = 40;
const LONG_THREAD_BASE_TIME_MS = 1_700_000_100_000;
const WHEEL_UP_PX = -100_000;
const OPAQUE_ALPHA = 1;
const POSITION_TOLERANCE_PX = 1;
const MISTAKES_NOTE = /can make mistakes/i;
const TOOL_PAGES = [{ path: "/transform" }, { path: "/json-compare" }, { path: "/json-visualize" }] as const;

type Box = { x: number; y: number; width: number; height: number };

const dock = (page: Page) => page.getByTestId("relay-dock");
const composer = (page: Page) => page.getByTestId("relay-composer");
const send = (page: Page) => page.getByTestId("relay-send");
const footer = (page: Page) => page.getByTestId("relay-footer");
const jumpPill = (page: Page) => page.getByTestId("relay-jump-latest");

async function box(locator: Locator): Promise<Box> {
  const result = await locator.boundingBox();
  if (!result) throw new Error("Expected the element to have a bounding box");
  return result;
}

function longThread() {
  const messages = Array.from({ length: LONG_THREAD_PAIRS * 2 }, (_, index) => {
    const isUser = index % 2 === 0;
    const label = String(index).padStart(3, "0");
    return {
      id: `qa-layout-msg-${label}`,
      role: isUser ? "user" : "assistant",
      parts: [
        {
          type: "text",
          text: `${isUser ? "Question" : "Answer"} ${label}: a message long enough that the list needs scrolling.`,
        },
      ],
    };
  });
  return {
    id: "qa-layout-long-thread",
    title: "QA long thread",
    workspaceId: LOCAL_WORKSPACE,
    createdAt: LONG_THREAD_BASE_TIME_MS,
    updatedAt: LONG_THREAD_BASE_TIME_MS,
    messages,
    interruptedMessageId: null,
  };
}

/** Writes the long thread straight into IndexedDB, the way an earlier session would have left it. */
async function putLongThread(page: Page) {
  await page.evaluate(
    ({ dbName, store, row }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(row);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, store: THREADS_STORE, row: longThread() },
  );
}

/** Loads the workspace with the long thread stored, then opens the dock on it. */
async function openWithLongThread(page: Page) {
  await installRelayRoutes(page, { kind: "text", text: "ok" });
  await page.goto(WORKSPACE_PATH);
  await putLongThread(page);
  await page.reload();
  await openRelay(page);
  await expect(page.getByTestId("relay-message-user").first()).toBeVisible();
}

/** Opens the dock with the coach marked seen so it cannot shift the layout under test. */
async function openDockWithoutCoach(page: Page) {
  await installRelayRoutes(page, { kind: "text", text: "ok" });
  await page.addInitScript(() => localStorage.setItem("rq_relay_onboarded", "true"));
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

async function dragHandleTo(page: Page, clientX: number) {
  const handle = await box(page.getByTestId("relay-resize-handle"));
  const y = handle.y + handle.height / 2;
  await page.mouse.move(handle.x + handle.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(clientX, y, { steps: 5 });
  await page.mouse.up();
}

/** Send must share the textarea's row, to its right, inside the dock. */
async function expectSendBesideTextarea(page: Page) {
  await expect(send(page)).toBeVisible();
  await expect
    .poll(async () => {
      const [field, button, shell] = await Promise.all([
        box(composer(page)),
        box(send(page)),
        box(dock(page)),
      ]);
      const sameRow =
        button.y < field.y + field.height && button.y + button.height > field.y;
      const toTheRight = button.x >= field.x + field.width - POSITION_TOLERANCE_PX;
      const insideDock =
        button.x + button.width <= shell.x + shell.width + POSITION_TOLERANCE_PX;
      return { sameRow, toTheRight, insideDock };
    })
    .toEqual({ sameRow: true, toTheRight: true, insideDock: true });
}

async function scrollListUp(page: Page) {
  await page.getByTestId("relay-messages").hover();
  await page.mouse.wheel(0, WHEEL_UP_PX);
  await expect(jumpPill(page)).toBeVisible();
}

/** Alpha of a computed CSS colour in rgb()/rgba()/oklch()/color() notation. */
function alphaOf(color: string): number {
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)/);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const legacy = color.match(/^rgba\(\s*[^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/);
  return legacy ? Number(legacy[1]) : OPAQUE_ALPHA;
}

async function expectPillSolid(page: Page) {
  const style = await jumpPill(page).evaluate((el) => {
    const computed = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return {
      background: computed.backgroundColor,
      borderWidth: Number.parseFloat(computed.borderTopWidth),
      borderStyle: computed.borderTopStyle,
      borderColor: computed.borderTopColor,
      shadow: computed.boxShadow,
      isTopmost: top === el || el.contains(top),
    };
  });
  expect(alphaOf(style.background)).toBe(OPAQUE_ALPHA);
  expect(style.borderWidth).toBeGreaterThan(0);
  expect(style.borderStyle).not.toBe("none");
  expect(alphaOf(style.borderColor)).toBeGreaterThan(0);
  expect(style.shadow).not.toBe("none");
  expect(style.isTopmost).toBe(true);
}

test.describe("Relay layout @qa", () => {
  test("[REL-LAYOUT-01] The jump pill is opaque with a border and shadow in light and dark (FR-110, AC-02)", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openWithLongThread(page);
    await scrollListUp(page);
    await expectPillSolid(page);
    await snap("01-pill-dark");

    // The theme is a class on <html>; toggling it re-resolves every theme token.
    await page.evaluate((key) => {
      localStorage.setItem(key, "light");
      document.documentElement.classList.replace("dark", "light");
    }, THEME_STORAGE_KEY);
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(jumpPill(page)).toBeVisible();
    await expectPillSolid(page);
    await snap("02-pill-light");
  });

  test("[REL-LAYOUT-02] Send sits in the textarea row on its right at 320px, 400px and mobile sheet width (FR-111, AC-03)", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openDockWithoutCoach(page);
    await expectDockWidth(page, DEFAULT_WIDTH_PX);
    await expectSendBesideTextarea(page);
    await snap("01-400px");

    const viewportWidth = page.viewportSize()?.width ?? 0;
    await dragHandleTo(page, viewportWidth);
    await expectDockWidth(page, MIN_WIDTH_PX);
    await expectSendBesideTextarea(page);
    await snap("02-320px");

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.reload();
    await expect(dock(page)).toBeVisible();
    await expectDockWidth(page, MOBILE_VIEWPORT.width);
    await expectSendBesideTextarea(page);
    await snap("03-mobile-sheet");
  });

  test("[REL-LAYOUT-03] The footer stays visible and onboarding mentions it once (FR-112, AC-04)", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await installRelayRoutes(page, { kind: "text", text: "ok" });
    await page.goto(WORKSPACE_PATH);
    await openRelay(page);

    const coach = page.getByTestId("relay-onboarding");
    const next = page.getByTestId("relay-onboarding-next");
    await expect(coach).toBeVisible();

    await expect(footer(page)).toBeVisible();
    await expect(footer(page)).toHaveText(MISTAKES_NOTE);
    await expect(coach).not.toContainText(MISTAKES_NOTE);
    await snap("01-step-1");

    await next.click();
    await expect(footer(page)).toBeVisible();
    await expect(coach).not.toContainText(MISTAKES_NOTE);

    await next.click();
    await expect(footer(page)).toBeVisible();
    await expect(coach.getByText(MISTAKES_NOTE)).toHaveCount(1);
    await snap("02-last-step");

    await next.click();
    await expect(coach).toBeHidden();
    await expect(footer(page)).toBeVisible();
    await expect(dock(page).getByText(MISTAKES_NOTE)).toHaveCount(1);
  });

  test("[REL-LAYOUT-04] The Home breadcrumb on the tool pages links to the workspace (FR-160, AC-14)", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
  }) => {
    for (const { path } of TOOL_PAGES) {
      await page.goto(path);
      const home = page
        .getByRole("navigation", { name: "breadcrumb" })
        .getByRole("link", { name: "Home", exact: true });
      await expect(home).toHaveAttribute("href", WORKSPACE_PATH);
      await home.click();
      await expect(page).toHaveURL(new RegExp(`${WORKSPACE_PATH}$`));
    }
  });

  test("[REL-LAYOUT-05] After a reload with a long thread the composer row and footer are unchanged (persistence)", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await openWithLongThread(page);
    const measure = async () => ({
      textarea: await box(composer(page)),
      send: await box(send(page)),
      footer: await box(footer(page)),
    });
    const before = await measure();
    await snap("01-before-reload");

    // The open state persists, so the dock is already showing after the reload.
    await page.reload();
    await expect(dock(page)).toBeVisible();
    await expect(page.getByTestId("relay-message-user").first()).toBeVisible();
    await expect(footer(page)).toBeVisible();
    await expect
      .poll(measure)
      .toEqual(before);
    await snap("02-after-reload");
  });
});
