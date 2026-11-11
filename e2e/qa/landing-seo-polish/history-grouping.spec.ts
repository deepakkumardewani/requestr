import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

// Seed: e2e/fixtures/seed/history-landing-seo.json (all on one host so other
// seeds' history rows never collide with these assertions).
const HOST = "https://h.test";
const ORDERS_URL = `${HOST}/orders`;
const SHORT_URL = `${HOST}/s`;
const LONG_URL_FRAGMENT = `${HOST}/very/long/path/segment-number-00-padding`;
const TOOLTIP_DELAY_ELAPSED_MS = 1000;
const LONG_URL_END = "?token=abcdefghijklmnopqrstuvwxyz";

async function openHistory(page: Page) {
  await page.goto("/app");
  await page.getByTestId("sidebar-tab-history").click();
  await expect(page.getByTestId("history-list")).toBeVisible();
}

const ordersGroup = (page: Page) =>
  page.getByTestId("history-group").filter({ hasText: ORDERS_URL });

const searchBox = (page: Page) => page.getByPlaceholder("Search...");

async function expandOrders(page: Page): Promise<Locator> {
  const group = ordersGroup(page);
  await group.getByTestId("history-group-toggle").click();
  await expect(page.getByTestId("history-run")).toHaveCount(3);
  return group;
}

test.describe("History grouping @qa", () => {
  test("@critical same request run 3 times shows one row with x 3, latest status and time; no duplicate method+URL per day", async ({
    seededPage: page,
    snap,
  }) => {
    await openHistory(page);

    const group = ordersGroup(page);
    await expect(group).toHaveCount(1);
    await expect(group.getByTestId("history-group-count")).toHaveText("x 3");
    // Latest run (newest timestamp) was a 404; older runs were 200 / 201.
    await expect(group).toContainText("404");
    await expect(group).not.toContainText("201");
    await expect(group.getByTestId("history-group-url")).toHaveText(ORDERS_URL);
    await expect(group).toContainText(/ago|now|in /i);
    // Collapsed by default: no individual runs rendered.
    await expect(page.getByTestId("history-run")).toHaveCount(0);

    // Walk the rendered rows in order; no day may list one method+URL twice.
    const rows = page.locator(
      '[data-testid="history-day-header"], [data-testid="history-group"], [data-testid="history-item"]'
    );
    const seen = await rows.evaluateAll((els) => {
      let day = "";
      const keys: string[] = [];
      for (const el of els) {
        if (el.getAttribute("data-testid") === "history-day-header") {
          day = el.textContent ?? "";
          continue;
        }
        const url =
          el.querySelector('[data-testid$="url"]')?.textContent?.trim() ?? "";
        const method =
          /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.exec(
            (el as HTMLElement).innerText
          )?.[1] ?? "";
        keys.push(`${day}|${method} ${url}`);
      }
      return keys;
    });
    // Guard against a vacuous pass: the seeded rows must actually be present.
    expect(seen.filter((k) => k.endsWith(ORDERS_URL)).length).toBeGreaterThan(
      2
    );
    expect(new Set(seen).size).toBe(seen.length);

    await snap("01-group-collapsed");
  });

  test("@critical expand shows 3 runs; clicking a run restores that run; deleting latest updates summary; deleting all removes the group", async ({
    seededPage: page,
    snap,
  }) => {
    await openHistory(page);
    const group = await expandOrders(page);
    await expect(group.getByTestId("history-group-toggle")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await snap("02-group-expanded");

    // Restore two different runs: each opens its own tab with its own request
    // name (the second must not just refocus the first run's tab).
    const runs = page.getByTestId("history-run");
    const tabs = page.getByTestId("tab");
    await runs.nth(2).click();
    await expect(tabs.filter({ hasText: "Orders run 1" })).toBeVisible();
    await runs.nth(0).click();
    await expect(tabs.filter({ hasText: "Orders run 3" })).toBeVisible();
    await expect(tabs.filter({ hasText: "Orders run 1" })).toBeVisible();
    await expect(tabs.filter({ hasText: /Orders run/ })).toHaveCount(2);

    // Delete the latest run (404): summary drops to x 2 and shows 201.
    await runs.nth(0).hover();
    await page.getByTestId("history-run-delete").first().click();
    await expect(group.getByTestId("history-group-count")).toHaveText("x 2");
    await expect(group).toContainText("201");
    await expect(group).not.toContainText("404");
    await expect(page.getByTestId("history-run")).toHaveCount(2);

    // Deleting down to one run dissolves the group into a lone row.
    await page.getByTestId("history-run-delete").first().click();
    await expect(ordersGroup(page)).toHaveCount(0);
    await expect(page.getByTestId("history-run")).toHaveCount(0);
    const lone = page
      .getByTestId("history-item")
      .filter({ hasText: ORDERS_URL })
      .filter({ hasText: "GET" })
      .filter({ hasText: "200" });
    await expect(lone).toHaveCount(1);

    // Deleting the last run removes it completely.
    await lone.hover();
    // The delete button is the item button's sibling inside the row wrapper.
    await lone.locator("..").getByTestId("history-item-delete").click();
    await expect(lone).toHaveCount(0);
    // Unrelated rows survive: the previous day's lone GET /orders run.
    await expect(
      page
        .getByTestId("history-item")
        .filter({ hasText: ORDERS_URL })
        .filter({ hasText: "500" })
    ).toBeVisible();

    await snap("03-group-deleted");
  });

  test("@high search by URL fragment shows only matching runs with matching counts", async ({
    seededPage: page,
    snap,
  }) => {
    await openHistory(page);
    await searchBox(page).fill(`${HOST}/orders`);

    await expect(ordersGroup(page)).toHaveCount(1);
    await expect(
      ordersGroup(page).getByTestId("history-group-count")
    ).toHaveText("x 3");
    // POST /orders and the prior day's GET /orders also match, as lone rows.
    await expect(page.getByTestId("history-item")).toHaveCount(2);
    // Non-matching rows are filtered out.
    await expect(page.getByText(SHORT_URL, { exact: true })).toHaveCount(0);
    await expect(page.getByText(LONG_URL_FRAGMENT)).toHaveCount(0);
    await snap("04-search-match");

    // Method search narrows to one lone run: a filtered group loses its count.
    await searchBox(page).fill("post");
    await expect(
      page.getByTestId("history-item").filter({ hasText: HOST })
    ).toHaveCount(1);
    await expect(page.getByTestId("history-group")).toHaveCount(0);

    await searchBox(page).fill("zz-no-such-history-fragment");
    await expect(page.getByText("No matches")).toBeVisible();
    await expect(page.getByTestId("history-group")).toHaveCount(0);
    await snap("05-search-no-match");
  });

  test("@high empty history renders the empty state", async ({
    page,
    snap,
  }) => {
    // Unseeded context: nothing in the history store.
    await openHistory(page);
    await expect(page.getByText("No requests sent yet")).toBeVisible();
    await expect(page.getByTestId("history-group")).toHaveCount(0);
    await expect(page.getByTestId("history-item")).toHaveCount(0);
    await snap("06-empty");
  });

  test("@high tooltip with the full URL appears only for a truncated URL", async ({
    seededPage: page,
    snap,
  }) => {
    // Fake timers must be installed before the app loads; time still flows
    // naturally, runFor below only jumps it ahead.
    await page.clock.install();
    await openHistory(page);
    await searchBox(page).fill(`${HOST}/`);

    const urlOf = (fragment: string) =>
      page
        .getByTestId("history-item")
        .filter({ hasText: fragment })
        .getByTestId("history-item-url");
    const shortUrl = urlOf(SHORT_URL);
    const longUrl = urlOf(LONG_URL_FRAGMENT);

    // Preconditions: the short URL fits, the long one is clipped.
    await expect(shortUrl).toBeVisible();
    await expect(longUrl).toBeVisible();
    expect(
      await shortUrl.evaluate((el) => el.scrollWidth > el.clientWidth)
    ).toBe(false);
    expect(
      await longUrl.evaluate((el) => el.scrollWidth > el.clientWidth)
    ).toBe(true);

    const tooltip = page.locator('[data-slot="tooltip-content"]');
    await shortUrl.hover();
    // Fast-forward the fake clock past the 300 ms tooltip open delay so
    // absence is a real signal, without waiting in real time.
    await page.clock.runFor(TOOLTIP_DELAY_ELAPSED_MS);
    await expect(tooltip).toHaveCount(0);

    await longUrl.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(LONG_URL_END);
    await snap("07-tooltip-truncated");
  });

  test("@medium reload keeps history entries while expansion state resets", async ({
    seededPage: page,
    snap,
  }) => {
    await openHistory(page);
    await expandOrders(page);

    await page.reload();
    await page.getByTestId("sidebar-tab-history").click();

    const group = ordersGroup(page);
    await expect(group).toHaveCount(1);
    await expect(group.getByTestId("history-group-count")).toHaveText("x 3");
    await expect(group.getByTestId("history-group-toggle")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(page.getByTestId("history-run")).toHaveCount(0);
    await snap("08-after-reload");
  });
});
