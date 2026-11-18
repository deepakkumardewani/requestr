/**
 * Shared helpers for the Relay improvements e2e specs.
 * All functions use getByRole/getByTestId and web-first assertions.
 */
import { expect, type Page } from "@playwright/test";

const COLLECTION_TESTID = "collection-item-qa-e2e-relayimp-col";

/**
 * Opens a seeded saved request in a tab from the sidebar.
 * Uses web-first assertions to avoid race conditions.
 */
export async function openSavedRequest(
  page: Page,
  name: string,
): Promise<void> {
  const item = page.getByTestId("request-item").filter({ hasText: name });
  const collection = page.getByTestId(COLLECTION_TESTID);

  // Ensure collection is visible first
  await expect(collection).toBeVisible();

  // The accordion trigger button is a child of the collection item
  const collectionTrigger = collection.getByRole("button").first();

  // Expand the collection if it's not already expanded
  // The aria-expanded attribute is on the trigger button, not the item
  const isCollapsed = await collectionTrigger
    .getAttribute("aria-expanded")
    .then((attr) => attr !== "true");

  if (isCollapsed) {
    await collectionTrigger.click();
    // Wait for aria-expanded to become true
    await expect(collectionTrigger).toHaveAttribute("aria-expanded", "true");
  }

  // Wait for the item to be visible using web-first assertion
  await expect(item).toBeVisible();
  await item.click();
}
