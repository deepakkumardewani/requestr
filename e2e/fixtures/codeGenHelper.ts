import { expect, type Page } from "@playwright/test";

/**
 * Helper to test code generation for all supported languages.
 * Verifies that each language snippet includes method, URL, header name/value, and body.
 * Tests clipboard copy functionality for each language.
 *
 * Usage:
 *   await testCodeGenHelper(page);
 */
export async function testCodeGenHelper(page: Page): Promise<void> {
  // Get the code-gen panel or dialog
  let codeGenPanel = page.getByTestId("code-gen-panel");
  let codeGenLangSelect = page.getByTestId("code-gen-lang-select");

  // If panel isn't visible, try opening the code-gen dialog
  if (!(await codeGenPanel.isVisible().catch(() => false))) {
    const codeGenDialog = page.getByTestId("code-gen-dialog");
    if (await codeGenDialog.isVisible().catch(() => false)) {
      codeGenPanel = codeGenDialog;
      codeGenLangSelect = codeGenDialog.getByTestId("code-gen-lang-select");
    }
  }

  // If still not found, try to find via button
  if (!(await codeGenLangSelect.isVisible().catch(() => false))) {
    const codeGenBtn = page
      .getByRole("button", { name: /code|snippet/i })
      .first();
    if (await codeGenBtn.isVisible().catch(() => false)) {
      await codeGenBtn.click();
    }
  }

  // Ensure language selector is visible
  await expect(codeGenLangSelect).toBeVisible({ timeout: 5000 });

  // Get all available language options
  const languages = [
    "curl",
    "javascript",
    "python",
    "ruby",
    "go",
    "java",
    "csharp",
    "php",
    "bash",
  ];

  for (const lang of languages) {
    // Select language
    await codeGenLangSelect.selectOption(lang);

    // Get the generated code snippet
    const codeSnippet = page.locator('[data-testid="code-gen-snippet"]');
    await expect(codeSnippet).toBeVisible({ timeout: 2000 });

    const snippetText = await codeSnippet.textContent();
    expect(snippetText).toBeTruthy();

    // Verify snippet contains expected elements
    const snippetContent = snippetText || "";

    // Method should be POST (from setup)
    expect(snippetContent.toUpperCase()).toContain("POST");

    // URL should be present
    expect(snippetContent).toContain("echo");

    // Header should be present (X-Custom-Header)
    expect(snippetContent).toContain("X-Custom-Header");

    // Header value should be present
    expect(snippetContent).toContain("custom-value");

    // Body should be present
    expect(snippetContent).toContain("key");
    expect(snippetContent).toContain("value");

    // Test copy button
    const copyBtn = page.locator('[data-testid="code-gen-copy-btn"]');
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.click();

      // Verify "Copied to clipboard" toast appears
      await expect(page.getByText(/copied to clipboard/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify clipboard contents match snippet
      const clipboardText = await page.evaluate(
        "navigator.clipboard.readText()",
      );
      expect(clipboardText).toBe(snippetContent);
    }
  }
}
