import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { seedQaData } from "./qaSeed";

/**
 * Shared fixtures for the QA walkthrough specs (e2e/qa/*.spec.ts).
 *
 * - `seededPage`: writes the merged seed data (e2e/fixtures/seed/*.json) into
 *   IndexedDB before the first navigation, so a test can open its chain
 *   directly by id/URL instead of rebuilding it through the UI.
 * - `consoleGuard` (auto): every QA test — seeded or not — fails if the page
 *   logs a console error, a console warning, or an uncaught page error
 *   during the test. Nothing is filtered. This replaces the old spec's single
 *   end-of-run assertion with a per-test guarantee that also pinpoints which
 *   test caused the issue.
 * - `snap(name)`: saves a screenshot under
 *   agent_docs/qa/<spec-basename>/<name>.png.
 */
type QaFixtures = {
  seededPage: import("@playwright/test").Page;
  consoleGuard: undefined;
  snap: (name: string) => Promise<void>;
};

export const test = base.extend<QaFixtures>({
  seededPage: async ({ page }, use) => {
    await seedQaData(page);
    await use(page);
  },

  consoleGuard: [
    async ({ page }, use) => {
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];
      const pageErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
        if (msg.type() === "warning") consoleWarnings.push(msg.text());
      });
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });

      await use(undefined);

      const issues = [
        ...consoleErrors.map((m) => `[console.error] ${m}`),
        ...consoleWarnings.map((m) => `[console.warning] ${m}`),
        ...pageErrors.map((m) => `[pageerror] ${m}`),
      ];
      expect(
        issues,
        `Expected zero console errors/warnings/page errors, got ${issues.length}:\n${issues.join("\n")}`,
      ).toHaveLength(0);
    },
    { auto: true },
  ],

  snap: async ({ page }, use, testInfo) => {
    const specBasename = path
      .basename(testInfo.file)
      .replace(/\.spec\.ts$/, "");
    await use(async (name: string) => {
      await page.screenshot({
        path: `agent_docs/qa/${specBasename}/${name}.png`,
      });
    });
  },
});

export { expect };
