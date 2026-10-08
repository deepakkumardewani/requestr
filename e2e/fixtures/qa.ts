import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { UNMOCKED_CONSOLE_MSG_PREFIX } from "./chainRoutes";
import { seedQaData } from "./qaSeed";

/** Exact console.error emitted when installChainRoutes answers 599 for an unmocked host. */
export const UNMOCKED_599_CONSOLE = new RegExp(
  `^${UNMOCKED_CONSOLE_MSG_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
);

/** Scoped allowlist for expected console.error patterns, keyed by Page instance. */
const pageAllowlist = new WeakMap<import("@playwright/test").Page, RegExp[]>();

/**
 * Opt-in helper: register an expected console.error pattern for this page.
 * Must be called before the action that triggers the error.
 * The default consoleGuard is unchanged for all other messages.
 *
 * Usage (scoped 599 allowlist):
 *   allowExpectedConsoleError(page, UNMOCKED_599_CONSOLE);
 */
export function allowExpectedConsoleError(
  page: import("@playwright/test").Page,
  pattern: RegExp,
): void {
  const sample = `${UNMOCKED_CONSOLE_MSG_PREFIX} https://example.com/api/missing`;
  const unrelated = "Unexpected application error";
  if (!pattern.test(sample) || pattern.test(unrelated)) {
    throw new Error(
      "allowExpectedConsoleError only accepts a pattern for the exact 599 mock console.error",
    );
  }
  const existing = pageAllowlist.get(page) ?? [];
  pageAllowlist.set(page, [...existing, pattern]);
}

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
        const text = msg.text();
        if (msg.type() === "error") {
          const allowed = pageAllowlist.get(page) ?? [];
          const isUnmocked599 = text.startsWith(UNMOCKED_CONSOLE_MSG_PREFIX);
          const allowed599 = isUnmocked599 && allowed.some((p) => p.test(text));
          if (!allowed599) {
            consoleErrors.push(text);
          }
        }
        if (msg.type() === "warning") consoleWarnings.push(text);
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
