import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Budgets asserted in code (AC-10, AC-11, AC-12). Numbers of record come from
// the isolated prod preview (E2E_SERVER=prod / port 3100); see p2-profile.md.
const CLICK_TO_PAINT_BUDGET_MS = 100;
const MAX_ROWS_IN_DOM = 40;
const MIN_VISIBLE_ROWS_WHILE_SCROLLING = 9;
const TOGGLE_CYCLES = 3;
const SCROLL_STEP_PX = 40;

const OPENAI = { id: "qa-p2sb-openai", requests: 148 };
const SYNTHETIC = { id: "qa-p2sb-synthetic", requests: 500 };
const EMPTY = { id: "qa-p2sb-empty" };

declare global {
  interface Window {
    __longTasks?: number[];
  }
}

/** Collects long task durations; the browser only reports tasks over 50 ms (the AC-10/12 budget), so any entry is a violation. */
async function observeLongTasks(page: Page) {
  await page.evaluate(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__longTasks?.push(entry.duration);
      }
    }).observe({ type: "longtask" });
  });
}

async function longTasks(page: Page): Promise<number[]> {
  // Observer callbacks are queued; yield one frame so late entries land.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve))
  );
  return page.evaluate(() => window.__longTasks ?? []);
}

/** In-page click, resolved after the next paint: click-to-next-paint in ms. */
function clickToNextPaint(trigger: Locator): Promise<number> {
  return trigger.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        (el as HTMLElement).click();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            setTimeout(() => resolve(performance.now() - start), 0)
          )
        );
      })
  );
}

function collectionItem(page: Page, id: string) {
  return page.getByTestId(`collection-item-${id}`);
}

function trigger(page: Page, id: string) {
  return collectionItem(page, id).getByRole("button").first();
}

async function openSidebar(page: Page, id: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app");
  await expect(trigger(page, id)).toBeVisible();
  await expect(trigger(page, id)).toHaveAttribute("aria-expanded", "false");
  await observeLongTasks(page);
}

async function measureToggleCycles(
  page: Page,
  id: string,
  expectedRows: number
) {
  const rows = collectionItem(page, id).getByTestId("request-item");
  const expandMs: number[] = [];
  const collapseMs: number[] = [];
  for (let i = 0; i < TOGGLE_CYCLES; i++) {
    expandMs.push(await clickToNextPaint(trigger(page, id)));
    await expect(trigger(page, id)).toHaveAttribute("aria-expanded", "true");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThanOrEqual(expectedRows);

    collapseMs.push(await clickToNextPaint(trigger(page, id)));
    await expect(trigger(page, id)).toHaveAttribute("aria-expanded", "false");
    await expect(rows).toHaveCount(0);
  }
  return { expandMs, collapseMs };
}

test.describe("P2 sidebar expand/collapse performance @qa", () => {
  test("@critical expand and collapse the 148-request collection: click-to-next-paint <= 100 ms and no long task > 50 ms", async ({
    seededPage: page,
    snap,
  }) => {
    await openSidebar(page, OPENAI.id);
    await expect(page.getByTestId(`collection-count-${OPENAI.id}`)).toHaveText(
      String(OPENAI.requests)
    );

    const { expandMs, collapseMs } = await measureToggleCycles(
      page,
      OPENAI.id,
      OPENAI.requests
    );

    expect(expandMs).toHaveLength(TOGGLE_CYCLES);
    expect(collapseMs).toHaveLength(TOGGLE_CYCLES);
    for (const ms of [...expandMs, ...collapseMs]) {
      expect(ms).toBeLessThanOrEqual(CLICK_TO_PAINT_BUDGET_MS);
    }
    expect(await longTasks(page)).toEqual([]);

    await clickToNextPaint(trigger(page, OPENAI.id));
    await expect(
      collectionItem(page, OPENAI.id).getByTestId("request-item").first()
    ).toBeVisible();
    await snap("01-openai-expanded");
  });

  test("@critical expanded list renders <= 40 request rows in the DOM", async ({
    seededPage: page,
    snap,
  }) => {
    await openSidebar(page, OPENAI.id);
    await trigger(page, OPENAI.id).click();
    const rows = collectionItem(page, OPENAI.id).getByTestId("request-item");
    await expect(rows.first()).toBeVisible();
    await expect(page.getByTestId("virtualized-request-list")).toBeVisible();

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(MAX_ROWS_IN_DOM);
    await snap("02-row-count-bounded");
  });

  test("@high scrolling the expanded list produces no long task > 50 ms and no blank rows", async ({
    seededPage: page,
    snap,
  }) => {
    await openSidebar(page, OPENAI.id);
    await trigger(page, OPENAI.id).click();
    const list = page.getByTestId("virtualized-request-list");
    await expect(list).toBeVisible();
    await expect(list.getByTestId("request-item").first()).toBeVisible();

    // Scroll end to end one step per frame; at every frame count the rows
    // that overlap the list viewport.
    const result = await list.evaluate(
      async (el, { step, rowSelector }) => {
        const visibleRowCounts: number[] = [];
        const frame = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          );
        while (el.scrollTop + el.clientHeight < el.scrollHeight) {
          el.scrollTop += step;
          await frame();
          const box = el.getBoundingClientRect();
          const visible = Array.from(el.querySelectorAll(rowSelector)).filter(
            (row) => {
              const r = row.getBoundingClientRect();
              return r.bottom > box.top + 1 && r.top < box.bottom - 1;
            }
          ).length;
          visibleRowCounts.push(visible);
        }
        return { visibleRowCounts, scrollTop: el.scrollTop };
      },
      { step: SCROLL_STEP_PX, rowSelector: '[data-testid="request-item"]' }
    );

    expect(result.visibleRowCounts.length).toBeGreaterThan(50);
    expect(Math.min(...result.visibleRowCounts)).toBeGreaterThanOrEqual(
      MIN_VISIBLE_ROWS_WHILE_SCROLLING
    );
    expect(await longTasks(page)).toEqual([]);
    await expect(list.getByTestId("request-item").last()).toContainText(
      "OA request 147"
    );
    await snap("03-scrolled-to-end");
  });

  test("@medium 0-request collection shows the empty hint and expands without error", async ({
    seededPage: page,
    snap,
  }) => {
    await openSidebar(page, EMPTY.id);
    await expect(page.getByTestId(`collection-count-${EMPTY.id}`)).toHaveText(
      "0"
    );

    await trigger(page, EMPTY.id).click();
    await expect(trigger(page, EMPTY.id)).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await expect(collectionItem(page, EMPTY.id)).toContainText(
      "No requests yet"
    );
    await expect(
      collectionItem(page, EMPTY.id).getByTestId("request-item")
    ).toHaveCount(0);
    await snap("04-empty-collection");
  });

  test("@medium 500-request collection stays within the budget and row cap", async ({
    seededPage: page,
    snap,
  }) => {
    await openSidebar(page, SYNTHETIC.id);
    await expect(
      page.getByTestId(`collection-count-${SYNTHETIC.id}`)
    ).toHaveText(String(SYNTHETIC.requests));

    const { expandMs, collapseMs } = await measureToggleCycles(
      page,
      SYNTHETIC.id,
      SYNTHETIC.requests
    );
    for (const ms of [...expandMs, ...collapseMs]) {
      expect(ms).toBeLessThanOrEqual(CLICK_TO_PAINT_BUDGET_MS);
    }
    expect(await longTasks(page)).toEqual([]);

    await trigger(page, SYNTHETIC.id).click();
    const rows = collectionItem(page, SYNTHETIC.id).getByTestId("request-item");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThanOrEqual(MAX_ROWS_IN_DOM);
    await snap("05-synthetic-500-expanded");
  });
});
