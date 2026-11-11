import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Entries are built relative to "now" at test time: Today/Yesterday labels
// cannot be asserted from a static seed file, so this spec writes its own
// history rows straight into IndexedDB (setup only; the list UI is the SUT).

const ENTRY_COUNT = 500;
const TODAY_COUNT = 100;
const YESTERDAY_COUNT = 100;
const OLDER_DAYS = 4; // remaining entries are spread over this many older days
const GROUPED_URL = "https://qa-virt.example.com/grouped";
const GROUPED_RUNS = 4;
const GROUPED_DAY_OFFSET = 3;
const MAX_RENDERED_ROWS = 60;
const LONG_TASK_MS = 50;
const SCROLL_STEP_PX = 400;
const ROW_HEIGHT_PX = 44;
// Scroll container has 4px top padding; the pinned header sits within it.
const PINNED_TOLERANCE_PX = 6;
// Row index of the grouped request: Today, Yesterday, day 1 and day 2 blocks.
const GROUP_ROW_INDEX = 329;

type SeedEntry = Record<string, unknown>;

function buildEntries(now: number): SeedEntry[] {
  const noonOf = (daysAgo: number) => {
    const d = new Date(now);
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() - daysAgo,
      12,
    ).getTime();
  };
  const olderCount = ENTRY_COUNT - TODAY_COUNT - YESTERDAY_COUNT;
  const perOlderDay = olderCount / OLDER_DAYS;

  return Array.from({ length: ENTRY_COUNT }, (_, i) => {
    let timestamp: number;
    let url = `https://qa-virt.example.com/r/${i}`;
    if (i < TODAY_COUNT) {
      timestamp = now - i * 100;
    } else if (i < TODAY_COUNT + YESTERDAY_COUNT) {
      timestamp = noonOf(1) - (i - TODAY_COUNT) * 1000;
    } else {
      const older = i - TODAY_COUNT - YESTERDAY_COUNT;
      const dayOffset = 2 + Math.floor(older / perOlderDay);
      timestamp = noonOf(dayOffset) - (older % perOlderDay) * 1000;
      // A repeated request in the middle of a day builds one expandable group.
      const slot = older % perOlderDay;
      if (dayOffset === GROUPED_DAY_OFFSET && slot >= 50 && slot < 50 + GROUPED_RUNS) {
        url = GROUPED_URL;
      }
    }
    return {
      id: `qa-virt-${i}`,
      method: "GET",
      url,
      status: 200,
      duration: 20,
      size: 64,
      timestamp,
      request: {
        tabId: `qa-virt-tab-${i}`,
        requestId: null,
        type: "http",
        name: url,
        isDirty: false,
        method: "GET",
        url,
        headers: [],
        params: [],
        auth: { type: "none" },
        body: { type: "none", content: "" },
        preScript: "",
        postScript: "",
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 20,
        size: 64,
        url,
        method: "GET",
        timestamp,
      },
    };
  });
}

async function seedHistory(page: Page) {
  await page.goto("/app");
  const entries = buildEntries(Date.now());
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("requestly");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction("history", "readwrite");
          const store = tx.objectStore("history");
          store.clear();
          for (const row of rows) store.put(row);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    entries,
  );
  await page.reload();
  await page.getByTestId("sidebar-tab-history").click();
  await expect(page.getByTestId("history-scroll")).toBeVisible();
}

const renderedRows = (page: Page) =>
  page
    .getByTestId("history-scroll")
    .evaluate((el) => el.querySelectorAll("[data-index]").length);

const scrollTo = (page: Page, top: number) =>
  page.getByTestId("history-scroll").evaluate((el, y) => {
    el.scrollTop = y;
  }, top);

test.describe("History virtualization @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await seedHistory(page);
  });

  test("@critical 500 seeded entries: row node count stays below 60 and scrolling to the bottom and back shows no long task over 50 ms", async ({
    page,
    snap,
  }) => {
    const scroll = page.getByTestId("history-scroll");
    await expect(page.getByTestId("history-day-header").first()).toHaveText(
      "Today",
    );
    expect(await renderedRows(page)).toBeLessThan(MAX_RENDERED_ROWS);

    // Long-task entries are delivered asynchronously, and takeRecords() alone
    // returns nothing right after a task ends. So the observer is flushed
    // deterministically: block deliberately, then await the callback that
    // delivers that block's entry (event-driven, no timer). Entries arrive in
    // order, so everything before the sentinel has been delivered too.
    await page.evaluate(() => {
      type Lt = {
        seen: { start: number; duration: number }[];
        waiter: ((e: PerformanceEntry) => void) | null;
      };
      const lt: Lt = { seen: [], waiter: null };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          lt.seen.push({ start: e.startTime, duration: e.duration });
          lt.waiter?.(e);
        }
      }).observe({ type: "longtask" });
      (window as unknown as { __lt: Lt }).__lt = lt;
      (window as unknown as { __flush: (ms: number) => Promise<number> }).__flush =
        (ms) =>
          new Promise<number>((resolve) => {
            requestAnimationFrame(() => {
              const start = performance.now();
              lt.waiter = (e) => {
                if (e.startTime >= start - 1) {
                  lt.waiter = null;
                  resolve(start);
                }
              };
              while (performance.now() < start + ms) {
                /* deliberate block */
              }
            });
          });
    });
    // Control: the observer must see a deliberately blocking task, then reset.
    const control = await page.evaluate(async (ms) => {
      const w = window as unknown as {
        __flush: (ms: number) => Promise<number>;
        __lt: { seen: unknown[] };
      };
      await w.__flush(ms);
      const detected = w.__lt.seen.length;
      w.__lt.seen.length = 0;
      return detected;
    }, LONG_TASK_MS * 3);
    expect(control, "longtask observer must see a blocking task").toBeGreaterThan(0);

    // Scroll to the bottom and back in frame-paced steps, tracking max rows.
    const result = await scroll.evaluate(
      async (el, { step, maxRows }) => {
        let peakRows = 0;
        let frames = 0;
        const frame = () => new Promise((r) => requestAnimationFrame(r));
        // Re-read scrollHeight each frame: measured rows resize the total.
        const atBottom = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        const step1 = async (delta: number) => {
          el.scrollTop += delta;
          await frame();
          frames += 1;
          peakRows = Math.max(peakRows, el.querySelectorAll("[data-index]").length);
        };
        while (!atBottom()) await step1(step);
        const bottom = el.scrollTop;
        while (el.scrollTop > 0) await step1(-step);
        return { peakRows, frames, bottom, maxRows };
      },
      { step: SCROLL_STEP_PX, maxRows: MAX_RENDERED_ROWS },
    );
    // Flush: sentinel block delivers every earlier entry; exclude the sentinel.
    const longTasks = await page.evaluate(async (ms) => {
      const w = window as unknown as {
        __flush: (ms: number) => Promise<number>;
        __lt: { seen: { start: number; duration: number }[] };
      };
      const sentinelStart = await w.__flush(ms);
      return w.__lt.seen
        .filter((e) => e.start < sentinelStart - 1)
        .map((e) => e.duration);
    }, LONG_TASK_MS * 3);

    expect(result.bottom).toBeGreaterThan(ENTRY_COUNT * ROW_HEIGHT_PX * 0.5);
    expect(result.frames).toBeGreaterThan(20);
    expect(result.peakRows).toBeLessThan(MAX_RENDERED_ROWS);
    expect(longTasks.filter((d) => d > LONG_TASK_MS)).toEqual([]);
    await snap("01-virtualized-500");
  });

  test("@high day headers read Today and Yesterday for seeded timestamps and stay pinned while scrolling their day", async ({
    page,
    snap,
  }) => {
    const scroll = page.getByTestId("history-scroll");
    const headers = page.getByTestId("history-day-header");
    await expect(headers.first()).toHaveText("Today");

    // Yesterday header sits right after TODAY_COUNT run rows + Today header.
    const yesterdayTop = (TODAY_COUNT + 1) * ROW_HEIGHT_PX;
    for (const offset of [ROW_HEIGHT_PX * 5, ROW_HEIGHT_PX * 40]) {
      await scrollTo(page, yesterdayTop + offset);
      const pinned = headers.filter({ hasText: "Yesterday" });
      await expect(pinned).toHaveCount(1);
      await expect
        .poll(async () => {
          const h = await pinned.boundingBox();
          const c = await scroll.boundingBox();
          return h && c ? Math.abs(h.y - c.y) : Number.POSITIVE_INFINITY;
        })
        .toBeLessThanOrEqual(PINNED_TOLERANCE_PX);
    }
    await snap("02-yesterday-pinned");

    // Older days use a date label, not Today/Yesterday.
    await scrollTo(page, (TODAY_COUNT + YESTERDAY_COUNT + 3) * ROW_HEIGHT_PX);
    const older = headers.last();
    await expect(older).not.toHaveText(/^(Today|Yesterday)$/);
  });

  test("@high an expanded group inside a virtualized list keeps its position when scrolled away and back", async ({
    page,
    snap,
  }) => {
    const scroll = page.getByTestId("history-scroll");
    const toggle = page.getByRole("button", { name: `Show ${GROUPED_RUNS} runs` });

    await expect(toggle).toHaveCount(0);
    await scrollTo(page, GROUP_ROW_INDEX * ROW_HEIGHT_PX);
    await expect(toggle).toHaveCount(1);
    await toggle.click();
    await expect(
      page.getByRole("button", { name: `Hide ${GROUPED_RUNS} runs` }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("history-run")).toHaveCount(GROUPED_RUNS);

    const groupOffset = () =>
      page
        .getByTestId("history-group")
        .evaluate((g) => {
          const wrapper = g.closest("[data-index]") as HTMLElement;
          return Number.parseFloat(
            wrapper.style.transform.replace(/translateY\((.*)px\)/, "$1"),
          );
        });
    const before = await groupOffset();
    const scrollBefore = await scroll.evaluate((el) => el.scrollTop);
    await snap("03-group-expanded");

    await scrollTo(page, 0);
    await expect(page.getByTestId("history-group")).toHaveCount(0);
    await scrollTo(page, scrollBefore);

    await expect(page.getByTestId("history-group")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: `Hide ${GROUPED_RUNS} runs` }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("history-run")).toHaveCount(GROUPED_RUNS);
    expect(await groupOffset()).toBe(before);
  });
});
