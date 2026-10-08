/**
 * Chain e2e specs: simple API request, Start node, and Delay node scenarios.
 * Source of truth: e2e/scenarios/chain/chain-nodes-request-start-delay.feature.md
 * Seed data: e2e/fixtures/seed/chain-e2e.json
 */
import { IDB_DB_NAME } from "../../src/lib/idbSchema";
import { installChainRoutes } from "../fixtures/chainRoutes";
import {
  expectBarSummary,
  expectNode,
  expectRunSummary,
  expectStep,
  nodeBadge,
  openChain,
  openDetailTab,
  openNodeDetails,
  openNodePanel,
  openRunLog,
  openStepDetail,
  runChain,
  stepRow,
  stopChain,
  waitRunDone,
} from "../fixtures/chainE2eHelpers";
import {
  allowExpectedConsoleError,
  expect,
  test,
  UNMOCKED_599_CONSOLE,
} from "../fixtures/qa";

function detailPanel(page: import("@playwright/test").Page) {
  return page.locator("[data-slot='tabs-content']:not([inert])");
}

const TOKEN = "qa-e2e-req-token";
const ECHO = "qa-e2e-req-echo";
const USERS = "qa-e2e-req-users";
const ITEM = "qa-e2e-req-item";
const ASSERT = "qa-e2e-req-assert";
const START_DOWN = "qa-e2e-req-start-downstream";
const START_ENV_REQ = "qa-e2e-req-start-env";
const DELAY_DOWN = "qa-e2e-req-delay-downstream";
const SLOW_REQ = "qa-req-parallel-slow";
const FAST_REQ = "qa-req-parallel-fast";

test.describe("Chain E2E — Simple API / Start / Delay @qa", () => {
  test.beforeEach(async ({ seededPage: page }) => {
    await installChainRoutes(page);
  });

  test("[CHN-S-API-01] A single request passes and shows its status", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-single");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-single", "passed");
    await expectBarSummary(page, { text: /passed/i });
    await openRunLog(page);
    await expectRunSummary(page, { passed: 1 });
    await expectStep(page, "qa-e2e-req-single", "passed");
    const step = stepRow(page, "qa-e2e-req-single");
    await expect(step.getByTestId("step-http-status")).toHaveText("200");
    await expect(step).toContainText(/\d+ ms|\d+\.\d+ s/);
    await snap("chn-s-api-01-single-request-passes");
  });

  test("[CHN-S-API-02] Two chained requests run in order", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    await clearEdgeInjections(page, "qa-e2e-api-inject-hdr", "qa-e2e-edge-hdr");
    await page.reload();
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, TOKEN, "passed");
    await expectNode(page, ECHO, "passed");
    await expectBarSummary(page, { text: /passed/i });
    await openRunLog(page);
    await expectRunSummary(page, { passed: 2 });
    const steps = page.locator("[data-step-id]");
    await expect(steps.nth(0)).toHaveAttribute("data-step-id", TOKEN);
    await expect(steps.nth(1)).toHaveAttribute("data-step-id", ECHO);
    await snap("chn-s-api-02-chained-order");
  });

  test("[CHN-S-API-03] A value is injected into a downstream header", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ECHO, "passed");
    await openRunLog(page);
    await openStepDetail(page, ECHO);
    await openDetailTab(page, "Input");
    const input = detailPanel(page);
    await expect(input.getByTestId("injected-value").first()).toHaveText(
      "secret-token-abc",
    );
    await expect(input).toContainText("X-Token");
    await openDetailTab(page, "Extracted");
    await expect(detailPanel(page)).toContainText("$.data.token");
    await snap("chn-s-api-03-header-injection");
  });

  test("[CHN-S-API-04] A value is injected into a downstream query parameter", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-url");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ECHO, "passed");
    await openRunLog(page);
    await openStepDetail(page, ECHO);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("k=secret-token-abc");
    await snap("chn-s-api-04-query-injection");
  });

  test("[CHN-S-API-05a] A path injection replaces the named placeholder", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-path");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ITEM, "passed");
    await openRunLog(page);
    await openStepDetail(page, ITEM);
    await openDetailTab(page, "Input");
    const input = detailPanel(page);
    await expect(input).toContainText("/api/item/1");
    await expect(input).not.toContainText(":id");
    await snap("chn-s-api-05a-path-replace");
  });

  test("[CHN-S-API-05b] A path injection appends the value when there is no placeholder", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-path");
    await setRequestUrl(page, ITEM, "https://example.com/api/item");
    await page.reload();
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ITEM, "passed");
    await openRunLog(page);
    await openStepDetail(page, ITEM);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("/api/item/1");
    await snap("chn-s-api-05b-path-append");
  });

  test("[CHN-S-API-06a] A value is injected into a JSON body", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-body");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-echo-json", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-echo-json");
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("secret-token-abc");
    await snap("chn-s-api-06a-json-body");
  });

  test("[CHN-S-API-06b] Injecting into a non-JSON body fails the downstream request", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-badbody");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-echo-form", "failed");
    await expectBarSummary(page, { text: /failed/i });
    await openRunLog(page);
    await expect(stepRow(page, "qa-e2e-req-echo-form").getByTestId("step-error-line")).toContainText(
      /json body/i,
    );
    await snap("chn-s-api-06b-bad-body");
  });

  test("[CHN-S-API-07a] Concurrency of 1 runs independent requests one at a time", async ({
    seededPage: page,
    snap,
  }) => {
    test.setTimeout(60_000);
    await setConcurrency(page, 1);
    await openChain(page, "qa-polish-parallel-lanes");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, SLOW_REQ, "passed");
    await expectNode(page, FAST_REQ, "passed");
    await openRunLog(page);
    await expectRunSummary(page, { passed: 2 });
    await expect(page.getByTestId("step-lane-1")).toHaveCount(0);
    await snap("chn-s-api-07a-concurrency-1");
  });

  test("[CHN-S-API-07b] Concurrency of 4 runs independent requests together", async ({
    seededPage: page,
    snap,
  }) => {
    test.setTimeout(60_000);
    await setConcurrency(page, 4);
    await openChain(page, "qa-polish-parallel-lanes");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, SLOW_REQ, "passed");
    await expectNode(page, FAST_REQ, "passed");
    await openRunLog(page);
    await expect(page.getByTestId("step-lane-0").first()).toBeVisible();
    await expect(page.getByTestId("step-lane-1").first()).toBeVisible();
    await snap("chn-s-api-07b-concurrency-4");
  });

  test("[CHN-S-API-08] A missing JSONPath fails the target and the run ends Failed", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-miss");
    await runChain(page);
    await waitRunDone(page);
    await expectNode(page, ECHO, "failed");
    await expect(nodeBadge(page, ECHO)).toContainText(/extract failed/i);
    await expectBarSummary(page, { text: /failed/i });
    await openRunLog(page);
    await expectRunSummary(page, { passed: 1, failed: 1 });
    await expectStep(page, ECHO, "failed");
    await openStepDetail(page, ECHO);
    await openDetailTab(page, "Error");
    await expect(detailPanel(page)).toContainText(/could not extract/i);
    await snap("chn-s-api-08-extraction-miss");
  });

  test("[CHN-S-API-09] A non-JSON response is shown as raw text", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-text");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-text", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-text");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("plain text response");
    await snap("chn-s-api-09-raw-text");
  });

  test("[CHN-S-API-10] An empty-array response is a valid pass", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-empty-list");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-empty", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-empty");
    await openDetailTab(page, "Output");
    await expect(detailPanel(page)).toContainText("[]");
    await snap("chn-s-api-10-empty-array");
  });

  test("[CHN-S-API-11] A 404 response fails the request with an HTTP status error", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-404");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-404", "failed");
    await expect(nodeBadge(page, "qa-e2e-req-404")).toContainText(/error/i);
    await expectBarSummary(page, { text: /failed/i });
    await openRunLog(page);
    const step = stepRow(page, "qa-e2e-req-404");
    await expect(step.getByTestId("step-http-status")).toHaveText("404");
    await expect(step.getByTestId("step-error-line")).toContainText(/HTTP 404/i);
    await snap("chn-s-api-11-http-404");
  });

  test("[CHN-S-API-12] A proxied failure envelope fails as an HTTP status error", async ({
    seededPage: page,
    snap,
  }) => {
    allowExpectedConsoleError(page, UNMOCKED_599_CONSOLE);
    await openChain(page, "qa-e2e-api-unmocked");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-unmocked", "failed");
    await expectBarSummary(page, { text: /failed/i });
    await openRunLog(page);
    const step = stepRow(page, "qa-e2e-req-unmocked");
    await expect(step.getByTestId("step-http-status")).toHaveText("599");
    await expect(step.getByTestId("step-error-line")).toContainText(/HTTP 599/i);
    await snap("chn-s-api-12-http-599");
  });

  test("[CHN-S-API-13] A failing assertion fails the request", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-assert-fail");
    await openNodeDetails(page, ASSERT);
    await openAssertionsTab(page);
    await page.getByTestId("assertion-add-btn").click();
    const expected = page.locator("[data-testid^='assertion-expected-value-']").last();
    await expected.fill("201");
    await page.keyboard.press("Escape");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ASSERT, "failed");
    await openRunLog(page);
    await openStepDetail(page, ASSERT);
    await openDetailTab(page, "Assertions");
    await expect(detailPanel(page).getByLabel("fail").first()).toBeVisible();
    await expect(stepRow(page, ASSERT).getByTestId("step-error-line")).toContainText(
      /assertion/i,
    );
    await snap("chn-s-api-13-assertions-failed");
  });

  test("[CHN-S-API-14] A network-level failure is reported as a request failure", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-abort");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-abort", "failed");
    await expectBarSummary(page, { text: /failed/i });
    await openRunLog(page);
    const step = stepRow(page, "qa-e2e-req-abort");
    await expect(step.getByTestId("step-http-status")).toHaveCount(0);
    await expect(step.getByTestId("step-error-line")).toContainText(/request failed/i);
    await snap("chn-s-api-14-request-failed");
  });

  test("[CHN-S-API-15a] Assertions can target status, header, body path and duration", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-assert-pass");
    await openNodeDetails(page, ASSERT);
    await addAssertion(page, { source: "Status Code", expected: "200" });
    await addAssertion(page, {
      source: "Header",
      path: "content-type",
      operator: "exists",
    });
    await addAssertion(page, {
      source: "JSONPath",
      path: "$.id",
      operator: "exists",
    });
    await page.keyboard.press("Escape");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ASSERT, "passed");
    await openRunLog(page);
    await openStepDetail(page, ASSERT);
    await openDetailTab(page, "Assertions");
    const panel = detailPanel(page);
    await expect(panel.getByLabel("pass")).toHaveCount(3);
    await snap("chn-s-api-15a-assertion-sources");
  });

  test("[CHN-S-API-15b] Assertions support the equality, comparison, contains and exists operators", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-assert-pass");
    await openNodeDetails(page, ASSERT);
    await addAssertion(page, { source: "Status Code", operator: "equals", expected: "200" });
    await addAssertion(page, { source: "Status Code", operator: "greater than", expected: "100" });
    await addAssertion(page, {
      source: "Header",
      path: "content-type",
      operator: "contains",
      expected: "json",
    });
    await addAssertion(page, { source: "JSONPath", path: "$.id", operator: "exists" });
    await page.keyboard.press("Escape");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ASSERT, "passed");
    await openRunLog(page);
    await openStepDetail(page, ASSERT);
    await openDetailTab(page, "Assertions");
    await expect(detailPanel(page).getByLabel("pass")).toHaveCount(4);
    await snap("chn-s-api-15b-assertion-operators");
  });

  test("[CHN-S-API-16] A disabled assertion is not evaluated", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-assert-fail");
    await openNodeDetails(page, ASSERT);
    await openAssertionsTab(page);
    await page.getByTestId("assertion-enable-toggle-qa-e2e-assert-status-fail").click();
    await page.keyboard.press("Escape");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ASSERT, "passed");
    await openRunLog(page);
    await expect(stepRow(page, ASSERT).getByTestId("step-error-line")).toHaveCount(0);
    await openStepDetail(page, ASSERT);
    await openDetailTab(page, "Assertions");
    await expect(detailPanel(page)).toContainText(/no assertions/i);
    await snap("chn-s-api-16-disabled-assertion");
  });

  test("[CHN-S-API-17] An edge can be switched between success and fail routing and the choice persists", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-med-fail-handle");
    await page.locator(".react-flow__edge").first().click({ force: true });
    await page.getByTestId("arrow-config-handle-fail").click();
    await expect(page.getByTestId("arrow-config-handle-fail")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.reload();
    await expect(page.getByTestId("edge-status-label")).toHaveText("Fail");
    const branchId = await page.evaluate(async (dbName) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      return await new Promise<string>((resolve, reject) => {
        const tx = db.transaction("chains", "readonly");
        const get = tx.objectStore("chains").get("qa-e2e-med-fail-handle");
        get.onerror = () => reject(get.error);
        get.onsuccess = () => {
          const edge = (get.result as { edges?: Array<{ branchId?: string }> } | undefined)
            ?.edges?.[0];
          resolve(edge?.branchId ?? "missing");
        };
      });
    }, IDB_DB_NAME);
    expect(branchId, "persisted branchId").toBe("fail");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-fail500", "failed");
    await expectNode(page, ECHO, "passed");
    await openRunLog(page);
    await expectStep(page, ECHO, "passed");
    await snap("chn-s-api-17-fail-handle");
  });

  test("[CHN-S-API-18a] Removing one injection leaves the rest of the edge intact", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    await page.locator(".react-flow__edge").first().click({ force: true });
    await expect(page.getByTestId("injection-remove-btn-0")).toBeVisible();
    const before = await page.locator("[data-testid^='injection-remove-btn-']").count();
    await page.getByTestId("injection-remove-btn-0").click();
    await expect(page.locator("[data-testid^='injection-remove-btn-']")).toHaveCount(before - 1);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ECHO, "passed");
    await openRunLog(page);
    await openStepDetail(page, ECHO);
    await openDetailTab(page, "Input");
    const input = detailPanel(page);
    await expect(input).not.toContainText("X-Extra");
    await expect(input).toContainText("X-Token");
    await snap("chn-s-api-18a-remove-injection");
  });

  test("[CHN-S-API-18b] An edge can be deleted from its configuration", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await page.locator(".react-flow__edge").first().click({ force: true });
    await page.getByRole("button", { name: "Delete Config" }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
    await expect(page.getByTestId("run-log-dock")).toBeVisible();
    await snap("chn-s-api-18b-delete-edge");
  });

  test("[CHN-S-API-19] Two injections into the same header resolve to a single value", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-inject-hdr");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, ECHO, "passed");
    await openRunLog(page);
    await openStepDetail(page, ECHO);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("X-Token");
    await openDetailTab(page, "Extracted");
    const extracted = detailPanel(page);
    await expect(extracted).toContainText("$.data.token");
    await expect(extracted).toContainText("$['data']['token']");
    await snap("chn-s-api-19-duplicate-header");
  });

  test("[CHN-S-API-20] A request with an empty URL cannot produce a silent pass", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-nourl");
    const runBtn = page.getByTestId("run-chain-btn");
    await expect(nodeBadge(page, "qa-e2e-req-nourl")).toBeVisible();
    if (await runBtn.isDisabled()) {
      await expect(runBtn).toBeDisabled();
    } else {
      await runBtn.click();
      await waitRunDone(page);
      await expectNode(page, "qa-e2e-req-nourl", "failed");
      await openRunLog(page);
      await expect(stepRow(page, "qa-e2e-req-nourl").getByTestId("step-error-line")).toBeVisible();
    }
    await snap("chn-s-api-20-empty-url");
  });

  test("[CHN-S-API-21] An extracted value is promoted to an environment variable after a run", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-api-promote-env");
    await selectEnv(page, "QA E2E Env");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-req-promote-slow", "passed");
    await openRunLog(page);
    await openStepDetail(page, "qa-e2e-req-promote-slow");
    await openDetailTab(page, "Extracted");
    await expect(detailPanel(page)).toContainText("$.data.token");
    await expect(detailPanel(page)).toContainText(/promotedToken|secret-token-abc/);
    await expect.poll(() => readEnvVar(page, "QA E2E Env", "promotedToken")).toBe(
      "secret-token-abc",
    );
    await snap("chn-s-api-21-env-promotion");
  });

  test("[CHN-S-API-22] A stopped run does not promote values to the environment", async ({
    seededPage: page,
    snap,
  }) => {
    test.setTimeout(60_000);
    await openChain(page, "qa-e2e-api-promote-env");
    await selectEnv(page, "QA E2E Env");
    await runChain(page, { via: "button" });
    await expect(page.getByTestId("stop-chain-btn")).toBeVisible();
    await stopChain(page);
    await waitRunDone(page);
    await expect(page.getByRole("option", { name: /stopped/i }).first()).toBeVisible();
    await expect.poll(() => readEnvVar(page, "QA E2E Env", "promotedToken")).toBe("before");
    await snap("chn-s-api-22-stop-skips-promotion");
  });

  test("[CHN-S-STR-01] A Start default feeds a downstream request", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-literal");
    await expect(nodeBadge(page, "qa-e2e-start-block-literal")).toContainText("userId");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-start-block-literal", "passed");
    await expectNode(page, START_DOWN, "passed");
    await openRunLog(page);
    await openStepDetail(page, START_DOWN);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("user=42");
    await snap("chn-s-str-01-start-default");
  });

  test("[CHN-S-STR-02] A Start input can be switched to an environment variable", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-literal");
    await selectEnv(page, "QA E2E Env");
    await openNodePanel(page, "qa-e2e-start-block-literal");
    await page.getByTestId("start-config-source-env-btn").click();
    await page.getByTestId("start-config-env-var").fill("userId");
    await page.getByTestId("start-config-save-btn").click();
    await expect(nodeBadge(page, "qa-e2e-start-block-literal")).toContainText("userId");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await openRunLog(page);
    await openStepDetail(page, START_DOWN);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("user=99");
    await snap("chn-s-str-02-start-env");
  });

  test("[CHN-S-STR-03] Added Start inputs persist across reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-multi");
    await openNodePanel(page, "qa-e2e-start-block-multi");
    await page.getByTestId("start-config-add-input-btn").click();
    const keys = page.getByTestId("start-config-input-key");
    const values = page.getByTestId("start-config-default-value");
    await keys.last().fill("role");
    await values.last().fill("admin");
    await page.getByTestId("start-config-save-btn").click();
    await page.reload();
    await expect(nodeBadge(page, "qa-e2e-start-block-multi")).toContainText("userId");
    await expect(nodeBadge(page, "qa-e2e-start-block-multi")).toContainText("role");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, START_DOWN, "passed");
    await openRunLog(page);
    await expectRunSummary(page, { passed: 2 });
    await snap("chn-s-str-03-start-persist");
  });

  test("[CHN-S-STR-04] Run-with-inputs overrides environment and default values", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-env");
    await selectEnv(page, "QA E2E Env");
    await page.getByTestId("run-with-inputs-btn").click();
    const popover = page.getByTestId("run-with-inputs-popover");
    await popover.locator("input").first().fill("override-7");
    await popover.getByRole("button", { name: /run/i }).click();
    await waitRunDone(page);
    await expectNode(page, START_ENV_REQ, "passed");
    await openRunLog(page);
    await openStepDetail(page, START_ENV_REQ);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("user=override-7");
    await snap("chn-s-str-04-run-with-inputs");
  });

  test("[CHN-S-STR-05a] A single Start input can be deleted", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-multi");
    await openNodePanel(page, "qa-e2e-start-block-multi");
    await page.getByTestId("start-config-delete-input-btn").click();
    await page.getByTestId("start-config-save-btn").click();
    await expect(nodeBadge(page, "qa-e2e-start-block-multi")).not.toContainText("userId");
    await snap("chn-s-str-05a-delete-input");
  });

  test("[CHN-S-STR-05b] The Start block can be deleted from its panel", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-multi");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await openNodePanel(page, "qa-e2e-start-block-multi");
    await page.getByTestId("start-config-delete-btn").click();
    await expect(nodeBadge(page, "qa-e2e-start-block-multi")).toHaveCount(0);
    await openRunLog(page);
    await expectStep(page, "qa-e2e-start-block-multi", "passed");
    await snap("chn-s-str-05b-delete-start");
  });

  test("[CHN-S-STR-06] Cancelling the Start panel discards edits", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-literal");
    await openNodePanel(page, "qa-e2e-start-block-literal");
    await page.getByTestId("start-config-default-value").fill("changed");
    await page.getByTestId("start-config-cancel-btn").click();
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await openRunLog(page);
    await openStepDetail(page, START_DOWN);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("user=42");
    await snap("chn-s-str-06-cancel-discards");
  });

  test("[CHN-S-STR-07a] A Start input with an empty key is rejected", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-dup");
    await openNodePanel(page, "qa-e2e-start-block-dup");
    await page.getByTestId("start-config-add-input-btn").click();
    await page.getByTestId("start-config-input-key").last().fill("");
    await expect(page.getByTestId("start-config-save-btn")).toBeDisabled();
    await page.getByTestId("start-config-cancel-btn").click();
    await expect(nodeBadge(page, "qa-e2e-start-block-dup")).toContainText("userId");
    await snap("chn-s-str-07a-empty-key");
  });

  test("[CHN-S-STR-07b] A Start input with a duplicate key is rejected", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-dup");
    await openNodePanel(page, "qa-e2e-start-block-dup");
    await page.getByTestId("start-config-add-input-btn").click();
    await page.getByTestId("start-config-input-key").last().fill("userId");
    await expect(page.getByTestId("start-config-save-btn")).toBeDisabled();
    await page.getByTestId("start-config-cancel-btn").click();
    await expect(page.getByTestId("start-config-input-key")).toHaveCount(0);
    await expect(nodeBadge(page, "qa-e2e-start-block-dup")).toContainText("userId");
    await snap("chn-s-str-07b-duplicate-key");
  });

  test("[CHN-S-STR-08] A missing environment variable falls back to the default or flags it", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-env");
    await selectEnv(page, "QA E2E Env");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, START_ENV_REQ, "passed");
    await openRunLog(page);
    await openStepDetail(page, START_ENV_REQ);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("missing=fallback-missing");
    await snap("chn-s-str-08-missing-env");
  });

  test("[CHN-S-STR-09] A second Start block is refused", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-literal");
    await page.locator(".react-flow__pane").click({ button: "right" });
    await page.getByTestId("block-menu-item-start").click();
    await expect(page.getByText("Only one Start block is allowed per chain")).toBeVisible();
    await expect(page.locator("[data-testid^='start-node-']")).toHaveCount(1);
    await snap("chn-s-str-09-second-start");
  });

  test("[CHN-S-STR-10] A Start block cannot be the target of a connection", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-literal");
    const before = await page.locator(".react-flow__edge").count();
    const source = page
      .locator(".react-flow__node")
      .filter({ has: page.getByTestId("delay-node-qa-e2e-start-side-delay") })
      .locator(".react-flow__handle.source")
      .first();
    await source.dragTo(nodeBadge(page, "qa-e2e-start-block-literal"));
    await expect(page.locator(".react-flow__edge")).toHaveCount(before);
    await expectNoRunYet(page);
    await snap("chn-s-str-10-start-not-target");
  });

  test("[CHN-S-STR-11] Resetting run-with-inputs drops stale overrides after the default changes", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-start-multi");
    await page.getByTestId("run-with-inputs-btn").click();
    const popover = page.getByTestId("run-with-inputs-popover");
    await popover.locator("input").first().fill("stale");
    await page.keyboard.press("Escape");
    await openNodePanel(page, "qa-e2e-start-block-multi");
    await page.getByTestId("start-config-default-value").fill("11");
    await page.getByTestId("start-config-save-btn").click();
    await page.getByTestId("run-with-inputs-btn").click();
    await expect(page.getByTestId("run-with-inputs-popover").locator("input").first()).toHaveValue("11");
    await page.getByTestId("run-with-inputs-popover").getByRole("button", { name: /run/i }).click();
    await waitRunDone(page);
    await openRunLog(page);
    await openStepDetail(page, START_DOWN);
    await openDetailTab(page, "Input");
    await expect(detailPanel(page)).toContainText("user=11");
    await snap("chn-s-str-11-reset-overrides");
  });

  test("[CHN-S-DLY-01] A Delay runs for its configured time", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-short");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-delay-block-short", "passed");
    await expectNode(page, DELAY_DOWN, "passed");
    await openRunLog(page);
    const steps = page.locator("[data-step-id]");
    await expect(steps.nth(0)).toHaveAttribute("data-step-id", "qa-e2e-delay-block-short");
    await expect(steps.nth(1)).toHaveAttribute("data-step-id", DELAY_DOWN);
    const duration = await stepRow(page, "qa-e2e-delay-block-short").innerText();
    expect(parseDurationMs(duration)).toBeGreaterThanOrEqual(200);
    await snap("chn-s-dly-01-delay-runs");
  });

  test("[CHN-S-DLY-02] The delay value can be edited inline", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-short");
    await editDelay(page, "300");
    await expect(page.getByTestId("delay-value-btn")).toHaveText("300");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await openRunLog(page);
    const duration = await stepRow(page, "qa-e2e-delay-block-short").innerText();
    expect(parseDurationMs(duration)).toBeGreaterThanOrEqual(300);
    await expectNode(page, DELAY_DOWN, "passed");
    await snap("chn-s-dly-02-edit-inline");
  });

  test("[CHN-S-DLY-03a] An edited delay persists across reload", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-short");
    await editDelay(page, "450");
    await page.reload();
    await expect(page.getByTestId("delay-value-btn")).toHaveText("450", { timeout: 15_000 });
    await expectNoRunYet(page);
    await snap("chn-s-dly-03a-persist");
  });

  test("[CHN-S-DLY-03b] Undo restores the previous delay value", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-short");
    await editDelay(page, "450");
    await expect(page.getByTestId("delay-value-btn")).toHaveText("450");
    // Focusing the canvas wrapper avoids the pane click, which lands on the
    // edge and opens the dependency dialog (Cmd+Z is ignored while a dialog is open).
    await page.getByRole("application", { name: /Request chain canvas/ }).focus();
    await page.keyboard.press("Meta+z");
    await expect(page.getByTestId("delay-value-btn")).toHaveText("200");
    await expectNoRunYet(page);
    await snap("chn-s-dly-03b-undo");
  });

  test("[CHN-S-DLY-04] A zero-millisecond delay passes immediately", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-zero");
    await runChain(page, { via: "button" });
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-delay-block-zero", "passed");
    await openRunLog(page);
    const duration = await stepRow(page, "qa-e2e-delay-block-zero").innerText();
    expect(parseDurationMs(duration)).toBeLessThan(1000);
    await expectNode(page, DELAY_DOWN, "passed");
    await snap("chn-s-dly-04-zero");
  });

  test("[CHN-S-DLY-05] Invalid delay input is rejected", async ({
    seededPage: page,
    snap,
  }) => {
    await openChain(page, "qa-e2e-delay-short");
    await editDelay(page, "-5");
    await expect(page.getByTestId("delay-value-btn")).toHaveText("200");
    await editDelay(page, "");
    await expect(page.getByTestId("delay-value-btn")).toHaveText("200");
    await expectNoRunYet(page);
    await snap("chn-s-dly-05-invalid");
  });

  test("[CHN-S-DLY-06] Stopping a run during a Delay aborts it", async ({
    seededPage: page,
    snap,
  }) => {
    test.setTimeout(60_000);
    await openChain(page, "qa-e2e-delay-long");
    await runChain(page, { via: "button" });
    await expect(page.getByTestId("stop-chain-btn")).toBeVisible();
    await stopChain(page);
    await waitRunDone(page);
    await expectNode(page, "qa-e2e-delay-block-long", "aborted");
    await expectNode(page, DELAY_DOWN, "skipped");
    await openRunLog(page);
    await expect(page.getByRole("option", { name: /stopped/i }).first()).toBeVisible();
    await expect(stepRow(page, "qa-e2e-delay-block-long").getByTestId("step-error-line")).toContainText(
      /run stopped/i,
    );
    await snap("chn-s-dly-06-stop");
  });
});

async function setConcurrency(page: import("@playwright/test").Page, value: number) {
  await page.goto("/settings");
  await page.getByTestId("nav-general").click();
  const input = page.getByTestId("chain-concurrency-input");
  await input.fill(String(value));
  await expect(input).toHaveValue(String(value));
}

async function readEnvVar(
  page: import("@playwright/test").Page,
  envName: string,
  key: string,
): Promise<string | undefined> {
  return page.evaluate(
    async ({ dbName, envName, key }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      return await new Promise<string | undefined>((resolve, reject) => {
        const tx = db.transaction("environments", "readonly");
        const getAll = tx.objectStore("environments").getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => {
          const env = (
            getAll.result as Array<{
              name: string;
              variables: Array<{ key: string; currentValue?: string }>;
            }>
          ).find((item) => item.name === envName);
          resolve(env?.variables.find((variable) => variable.key === key)?.currentValue);
        };
      });
    },
    { dbName: IDB_DB_NAME, envName, key },
  );
}

async function selectEnv(page: import("@playwright/test").Page, name: string) {
  await page.evaluate(
    async ({ dbName, name }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      const envId = await new Promise<string>((resolve, reject) => {
        const tx = db.transaction("environments", "readonly");
        const getAll = tx.objectStore("environments").getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => {
          const env = (getAll.result as Array<{ id: string; name: string }>).find(
            (item) => item.name === name,
          );
          if (!env) reject(new Error(`missing environment ${name}`));
          else resolve(env.id);
        };
      });
      localStorage.setItem("requestly_active_env_id", envId);
    },
    { dbName: IDB_DB_NAME, name },
  );
  await page.reload();
}

async function setRequestUrl(
  page: import("@playwright/test").Page,
  requestId: string,
  url: string,
) {
  await page.evaluate(
    async ({ dbName, requestId, url }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("requests", "readwrite");
          const store = tx.objectStore("requests");
          const get = store.get(requestId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            const record = get.result as { url: string } | undefined;
            if (!record) {
              reject(new Error(`missing request ${requestId}`));
              return;
            }
            record.url = url;
            store.put(record);
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { dbName: IDB_DB_NAME, requestId, url },
  );
}

async function clearEdgeInjections(
  page: import("@playwright/test").Page,
  chainId: string,
  edgeId: string,
) {
  await page.evaluate(
    async ({ dbName, chainId, edgeId }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("chains", "readwrite");
          const store = tx.objectStore("chains");
          const get = store.get(chainId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            const chain = get.result as {
              edges: { id: string; injections: unknown[] }[];
            };
            const edge = chain.edges.find((item) => item.id === edgeId);
            if (!edge) {
              reject(new Error(`missing edge ${edgeId}`));
              return;
            }
            edge.injections = [];
            store.put(chain);
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { dbName: IDB_DB_NAME, chainId, edgeId },
  );
}

async function openAssertionsTab(page: import("@playwright/test").Page) {
  await page.getByRole("tab", { name: /^Assertions/ }).click();
}

async function addAssertion(
  page: import("@playwright/test").Page,
  options: { source: string; path?: string; operator?: string; expected?: string },
) {
  const add = page.getByTestId("assertion-add-btn");
  if (!(await add.isVisible())) await openAssertionsTab(page);
  await add.click();
  const source = page.locator("[data-testid^='assertion-source-select-']").last();
  await source.click();
  await page.getByRole("option", { name: options.source, exact: true }).click();
  if (options.path) {
    const path = page.locator("[data-testid^='assertion-source-path-']").last();
    await path.fill(options.path);
  }
  if (options.operator) {
    const operator = page.locator("[data-testid^='assertion-operator-select-']").last();
    await operator.click();
    await page.getByRole("option", { name: options.operator, exact: true }).click();
  }
  if (options.expected) {
    const expected = page.locator("[data-testid^='assertion-expected-value-']").last();
    await expected.fill(options.expected);
  }
}

async function expectNoRunYet(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("run-log-strip")).toContainText(/no runs yet/i);
}

async function editDelay(page: import("@playwright/test").Page, value: string) {
  await page.getByTestId("delay-value-btn").click();
  const input = page.getByRole("spinbutton", { name: "Delay duration in milliseconds" });
  await input.fill(value);
  await input.press("Enter");
  await expect(page.getByTestId("delay-value-btn")).toBeVisible();
}

function parseDurationMs(text: string): number {
  const ms = text.match(/(\d+)\s*ms/);
  if (ms) return Number(ms[1]);
  const seconds = text.match(/(\d+\.\d+)\s*s/);
  if (seconds) return Math.round(Number(seconds[1]) * 1000);
  return 0;
}
