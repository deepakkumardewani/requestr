import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Copy-me skeletons (e.g. e2e/qa/_template.spec.ts) aren't real specs. */
  testIgnore: "**/_*.spec.ts",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. Locally, cap workers — the prebuilt
   * Next.js server + external network calls (dummyjson, GraphQL) become
   * resource-contended above ~2 concurrent workers, producing flaky
   * timeouts unrelated to app or test correctness (verified: 157/157 pass
   * at workers=2, but failures appear at higher counts on an 8-core box). */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
     * "on" records a trace for every test, which is expensive across the many
     * independent QA specs (each opens/tears down its own browser context);
     * "retain-on-failure" keeps traces only for failures, which is all we
     * ever actually open, while keeping full runs fast. */
    trace: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * Next.js app + local Socket.IO echo (`scripts/run-socketio-echo.sh`).
   * If you already run the echo on :3333, Playwright reuses it when not in CI.
   * Set PLAYWRIGHT_TEST_BASE_URL to point at an already-running dev server
   * (e.g. http://localhost:3001) to skip spawning a second Next.js instance.
   */
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : [
        {
          // Run against a production build rather than `next dev`. Dev mode
          // compiles routes on demand — under Playwright's default parallel
          // workers, several workers hitting an uncompiled route (e.g.
          // /chain/[collectionId]) at once can make that first compile take
          // longer than test timeouts, producing non-deterministic
          // navigation timeouts unrelated to app behavior. A prebuilt app
          // serves every route at consistent, fast latency.
          command: "bun run build && bun run start",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
        {
          command: "bash scripts/run-socketio-echo.sh",
          url: "http://127.0.0.1:3333/socket.io/?EIO=4&transport=polling",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
