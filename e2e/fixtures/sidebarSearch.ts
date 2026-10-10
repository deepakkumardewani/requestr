import { expect, type Page } from "@playwright/test";

/**
 * Reusable helper for sidebar search functionality.
 * Used in E-COL-04 (Collections) and E-CHN-06 (Chains).
 */

/**
 * Search the sidebar for a query term.
 * Assumes the search input is already visible in the sidebar.
 */
export async function searchSidebar(page: Page, query: string) {
  // Get the search input — it's typically at the top of the sidebar.
  // The SidebarSearch component may be nested in different places, so use a flexible selector.
  const searchInput = page
    .locator('input[placeholder*="Search"], input[placeholder*="search"]')
    .first();
  await expect(searchInput).toBeVisible({ timeout: 3000 });
  await searchInput.fill(query);
}

/**
 * Clear the sidebar search by clicking the X button or pressing Escape.
 */
export async function clearSidebarSearch(
  page: Page,
  method: "button" | "escape" = "button",
) {
  if (method === "button") {
    const clearBtn = page.getByRole("button", { name: /clear search|x/i });
    if (await clearBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearBtn.click();
    }
  } else {
    await page.keyboard.press("Escape");
  }
}

/**
 * Verify that search results appear for requests.
 * Returns the result items for further inspection.
 */
export async function getRequestResults(page: Page) {
  // The SidebarSearchResults component renders items with "Requests" grouping.
  // Look for items matching the search — they should be in a list.
  const results = page.locator(
    '[data-testid^="search-result-"], [role="button"]:has-text("Requests")',
  );
  return results;
}

/**
 * Verify that the "No results" message appears.
 */
export async function expectNoResults(page: Page, query: string) {
  const noResultsText = page.getByText(
    new RegExp(`no results for.*${query}`, "i"),
  );
  await expect(noResultsText).toBeVisible({ timeout: 3000 });
}

/**
 * Click a search result to open it.
 * This is typically used for request results.
 */
export async function clickSearchResult(page: Page, resultText: string) {
  const result = page.locator(`[data-testid^="search-result-"]`).filter({
    hasText: resultText,
  });
  await expect(result).toBeVisible({ timeout: 3000 });
  await result.click();
}
