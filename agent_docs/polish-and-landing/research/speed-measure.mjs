#!/usr/bin/env node
/**
 * Speed measurement for the landing comparison strip (SPEC FR-55, AC-55).
 *
 * Prerequisites (this script never builds and never starts the dev server):
 *   1. Port 3100 is free, then start the isolated prod preview:
 *        E2E_DIST_DIR=.next-e2e bun run build
 *        E2E_DIST_DIR=.next-e2e bun run start -p 3100 &      (note the PID)
 *   2. Chromium for Playwright is installed (`bunx playwright install chromium`).
 *   3. Run from the repo root:  bun agent_docs/polish-and-landing/research/speed-measure.mjs
 *   4. Afterwards `kill <PID>` so port 3100 is free again.
 *
 * Metrics (each RUNS times, median kept, outliers kept in `runs`):
 *   - lcp           Lighthouse mobile, default simulated throttling, ms
 *   - firstLoadJs   Lighthouse resource-summary Script transferSize, bytes
 *   - ttfr          fresh Playwright context: goto /app -> new tab -> fill URL -> Send ->
 *                   response status badge visible, ms
 *   - downloads     Playwright `download` events during each TTFR run
 *
 * TTFR target is a same-machine HTTP server this script starts on an ephemeral
 * port, so the number has no internet variance. Any failure exits non-zero and
 * no partial raw file is written.
 */
import { resolve } from "node:path";

const PREVIEW_ORIGIN = "http://localhost:3100";
const PAGE_PATH = "/app";
const RUNS = 3;
const PLAYWRIGHT_MODULE = "@playwright/test";
const TTFR_TIMEOUT_MS = 15_000;
const VIEWPORT = { width: 1440, height: 900 };
const THROTTLING_PROFILE =
  "Lighthouse mobile emulation, default simulated throttling (4x CPU slowdown, 150 ms RTT, 1.6 Mbps)";
const RAW_PATH = resolve(import.meta.dir, "speed-measure.raw.json");
const REPO_ROOT = resolve(import.meta.dir, "../../..");

function fail(message) {
  console.error(`speed-measure: FAIL - ${message}`);
  process.exit(1);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(runs, unit) {
  return {
    unit,
    runs,
    median: median(runs),
    min: Math.min(...runs),
    max: Math.max(...runs),
  };
}

async function assertPreviewServing() {
  try {
    const res = await fetch(`${PREVIEW_ORIGIN}${PAGE_PATH}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    fail(
      `prod preview is not serving ${PREVIEW_ORIGIN}${PAGE_PATH} (${error.message}). ` +
        "Start it first: E2E_DIST_DIR=.next-e2e bun run build && E2E_DIST_DIR=.next-e2e bun run start -p 3100",
    );
  }
}

function run(command) {
  const result = Bun.spawnSync(command, { cwd: REPO_ROOT, stderr: "inherit" });
  if (result.exitCode !== 0)
    fail(`${command.join(" ")} exited ${result.exitCode}`);
  return result.stdout.toString();
}

function runLighthouse() {
  const report = JSON.parse(
    run([
      "bunx",
      "lighthouse",
      `${PREVIEW_ORIGIN}${PAGE_PATH}`,
      "--form-factor=mobile",
      "--screenEmulation.mobile",
      "--only-categories=performance",
      "--output=json",
      "--output-path=stdout",
      "--quiet",
      "--chrome-flags=--headless=new",
    ]),
  );
  const scriptRow = report.audits["resource-summary"].details.items.find(
    (item) => item.resourceType === "script",
  );
  if (!scriptRow) fail("Lighthouse resource-summary has no script row");
  return {
    lcpMs: report.audits["largest-contentful-paint"].numericValue,
    scriptBytes: scriptRow.transferSize,
    version: report.lighthouseVersion,
  };
}

function startTtfrTarget() {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
  };
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (req) =>
      new Response(
        req.method === "OPTIONS" ? "" : JSON.stringify({ ok: true }),
        { headers },
      ),
  });
}

async function measureTtfrRun(browser, targetUrl) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });
  try {
    const start = performance.now();
    await page.goto(`${PREVIEW_ORIGIN}${PAGE_PATH}`, { waitUntil: "commit" });
    const layout = page.locator('[data-testid="desktop-layout"]');
    // A fresh context has no open tab, so a new request tab is part of the timed path.
    await layout.getByTestId("new-tab-btn").first().click();
    const urlInput = layout.getByTestId("url-input").first();
    await urlInput.waitFor({ state: "visible", timeout: TTFR_TIMEOUT_MS });
    await urlInput.fill(targetUrl);
    await page.keyboard.press("Escape");
    await layout.getByTestId("send-request-btn").first().click();
    await layout
      .getByTestId("response-status-badge")
      .first()
      .waitFor({ state: "visible", timeout: TTFR_TIMEOUT_MS });
    return { ttfrMs: performance.now() - start, downloads };
  } finally {
    await context.close();
  }
}

async function measureTtfr(chromium, targetUrl) {
  const browser = await chromium.launch();
  try {
    const version = browser.version();
    const results = [];
    for (let i = 0; i < RUNS; i += 1)
      results.push(await measureTtfrRun(browser, targetUrl));
    return { version, results };
  } finally {
    await browser.close();
  }
}

async function readPlaywrightVersion() {
  const pkg = await Bun.file(
    resolve(REPO_ROOT, "node_modules/@playwright/test/package.json"),
  ).json();
  return pkg.version;
}

async function main() {
  await assertPreviewServing();
  const buildCommit = run(["git", "rev-parse", "HEAD"]).trim();

  let target;
  let lighthouseRuns;
  let ttfr;
  try {
    target = startTtfrTarget();
  } catch (error) {
    fail(`TTFR target unavailable: ${error.message}`);
  }
  const targetUrl = `http://127.0.0.1:${target.port}/`;
  const ttfrTarget = `${targetUrl} (same-machine Bun.serve server started by this script, returns 200 JSON)`;
  try {
    lighthouseRuns = Array.from({ length: RUNS }, runLighthouse);
    // Variable specifier keeps bundlers (the task's `bun build` syntax check) from inlining Playwright.
    const { chromium } = await import(PLAYWRIGHT_MODULE);
    ttfr = await measureTtfr(chromium, targetUrl);
  } catch (error) {
    fail(error.message);
  } finally {
    target.stop(true);
  }

  const raw = {
    timestamp: new Date().toISOString(),
    buildCommit,
    page: PAGE_PATH,
    previewOrigin: PREVIEW_ORIGIN,
    toolVersions: {
      lighthouse: lighthouseRuns[0].version,
      playwright: await readPlaywrightVersion(),
      chromium: ttfr.version,
      bun: Bun.version,
    },
    throttlingProfile: THROTTLING_PROFILE,
    ttfrTarget,
    runsPerMetric: RUNS,
    metrics: {
      lcp: summarize(
        lighthouseRuns.map((r) => r.lcpMs),
        "ms",
      ),
      firstLoadJs: summarize(
        lighthouseRuns.map((r) => r.scriptBytes),
        "bytes",
      ),
      ttfr: summarize(
        ttfr.results.map((r) => r.ttfrMs),
        "ms",
      ),
      downloads: summarize(
        ttfr.results.map((r) => r.downloads),
        "count",
      ),
    },
  };
  await Bun.write(RAW_PATH, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`speed-measure: wrote ${RAW_PATH}`);
  console.log(JSON.stringify(raw.metrics, null, 2));
}

main().catch((error) => fail(error.stack ?? error.message));
