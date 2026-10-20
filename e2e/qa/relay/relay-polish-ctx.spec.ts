import type { Page } from "@playwright/test";
import {
  attachCurrentTab,
  attachFromPicker,
  LOCAL_WORKSPACE,
  openList,
  openRelay,
  putThreads,
  sendMessage,
  WORKSPACE_PATH,
  type StoredThread,
} from "../../fixtures/relayE2eHelpers";
import { openSavedRequest } from "../../fixtures/relayImprovements";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const ACTIVE_ENV_KEY = "requestly_active_env_id";
const SHARE_VALUES_KEY = "rq_relay_share_values";
const RELAY_ENV_ID = "qa-e2e-relayimp-env";
const ENV_NAME = "QA Relay Improvements Env";
const SECRET_VALUE = "qa-relayimp-secret-value";
const LEGACY_RAW_SECRET = "qa-legacy-raw-jwt-secret-9f3a7c";
const REQ_A = "Request A";
const REQ_B = "Request B";
const IMPLICIT_KEYS = ["activeTab", "collection", "environment"] as const;
const EXPECTED_STARTERS = [
  "What can you do?",
  "Create a sample collection",
  "How do I set up an environment?",
];

type Body = { context: Record<string, unknown> & { chips: unknown[] } };
const contextOf = (body: unknown) => (body as Body).context;

const pills = (page: Page) => page.getByTestId("relay-context-chip");

function expectNoImplicitKeys(context: Record<string, unknown>) {
  for (const key of IMPLICIT_KEYS) expect(context).not.toHaveProperty(key);
}

/** Installs routes, optionally activates the seeded environment, and opens the dock. */
async function open(
  page: Page,
  scripts: Parameters<typeof installRelayRoutes>[1],
  options: { activeEnv?: boolean; shareValues?: boolean } = {},
) {
  await page.addInitScript(
    ({ activeEnvKey, envId, activeEnv, shareKey, share }) => {
      if (activeEnv) localStorage.setItem(activeEnvKey, envId);
      localStorage.setItem(shareKey, String(share));
    },
    {
      activeEnvKey: ACTIVE_ENV_KEY,
      envId: RELAY_ENV_ID,
      activeEnv: options.activeEnv ?? false,
      shareKey: SHARE_VALUES_KEY,
      share: options.shareValues ?? false,
    },
  );
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

test.describe("Relay explicit context", () => {
  test("[REL-POL-CTX-01] with a request, collection and environment open and nothing attached, the composer has no pill and the chat body has no activeTab, collection or environment key", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
    const routes = await open(page, { kind: "text", text: "OK" }, { activeEnv: true });
    await openSavedRequest(page, REQ_A);
    await expect(pills(page)).toHaveCount(0);

    await sendMessage(page, "hello");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

    expect(routes.requestBodies).toHaveLength(1);
    const context = contextOf(routes.requestBodies[0]);
    expectNoImplicitKeys(context);
    expect(context.chips).toEqual([]);
    await expect(pills(page)).toHaveCount(0);
  });

  test('[REL-POL-CTX-02] no "Using: ... current tab" text exists in the DOM', { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
    await open(page, { kind: "text", text: "OK" });
    await openSavedRequest(page, REQ_A);
    await expect(page.locator("body")).not.toContainText(/Using:/);

    await attachCurrentTab(page);
    await expect(pills(page)).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText(/Using:/);
  });

  test("[REL-POL-CTX-03] the Current tab row in the picker attaches a tab pill and the next body has activeTab for that tab and nothing else implicit", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
    const routes = await open(page, { kind: "text", text: "OK" }, { activeEnv: true });
    await openSavedRequest(page, REQ_A);
    await attachCurrentTab(page);

    await expect(pills(page)).toHaveCount(1);
    await expect(pills(page).first()).toHaveAttribute("data-kind", "tab");
    await expect(pills(page).first()).toContainText(REQ_A);

    await sendMessage(page, "what is this?");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

    const context = contextOf(routes.requestBodies[0]);
    expect(context.activeTab).toMatchObject({ name: REQ_A });
    expect(context).not.toHaveProperty("collection");
    expect(context).not.toHaveProperty("environment");
    expect(context).not.toHaveProperty("attached");
    expect(context.chips).toHaveLength(1);
    expect(context.chips[0]).toMatchObject({ kind: "tab" });
  });

  test('[REL-POL-CTX-04] with no tab open the Current tab row is disabled with "No tab open"', { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
    await open(page, { kind: "text", text: "OK" });
    await page.getByTestId("relay-picker-trigger").click();

    const row = page.getByTestId("relay-picker-current-tab");
    await expect(row).toBeDisabled();
    await expect(row).toContainText("No tab open");
  });

  test("[REL-POL-CTX-05] attaching a request sends exactly that request's description; a duplicate attach does not duplicate it", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
    const routes = await open(page, { kind: "text", text: "OK" });

    await attachFromPicker(page, "request", REQ_A);
    await attachFromPicker(page, "request", REQ_A);
    await expect(pills(page)).toHaveCount(1);

    await sendMessage(page, "describe it");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

    const context = contextOf(routes.requestBodies[0]);
    expectNoImplicitKeys(context);
    expect(context.attached).toEqual([
      {
        kind: "request",
        id: "qa-e2e-relayimp-req-a",
        name: REQ_A,
        method: "GET",
        url: "https://example.com/api/request-a",
      },
    ]);
  });

  test("[REL-POL-CTX-06] starting a new chat clears attached items", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
    const routes = await open(page, { kind: "text", text: "OK" });
    await openSavedRequest(page, REQ_A);
    await attachCurrentTab(page);
    await sendMessage(page, "first");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
    expect(contextOf(routes.requestBodies[0])).toHaveProperty("activeTab");

    await page.getByTestId("relay-new-thread").click();
    await expect(page.getByTestId("relay-empty")).toBeVisible();
    await expect(pills(page)).toHaveCount(0);

    await sendMessage(page, "second");
    await expect.poll(() => routes.requestBodies.length).toBe(2);
    expectNoImplicitKeys(contextOf(routes.requestBodies[1]));
  });

  test("[REL-POL-CTX-07] the empty-state starters are identical regardless of which tab is open", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
    await open(page, { kind: "text", text: "OK" });
    const starters = page.getByTestId("relay-suggestion");

    await expect(starters).toHaveText(EXPECTED_STARTERS);
    await openSavedRequest(page, REQ_A);
    await expect(starters).toHaveText(EXPECTED_STARTERS);
    await openSavedRequest(page, REQ_B);
    await expect(starters).toHaveText(EXPECTED_STARTERS);
  });

  test('[REL-POL-CTX-08] a scripted "explain this response" with nothing attached gets a reply that asks the user to attach Current tab, with no get_active_context data', { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
    const reply = "Nothing is attached yet. Please attach Current tab so I can see it.";
    const routes = await open(page, { kind: "text", text: reply });
    await openSavedRequest(page, REQ_A);

    await sendMessage(page, "explain this response");

    await expect(page.getByTestId("relay-message-assistant")).toContainText(
      "attach Current tab",
    );
    expectNoImplicitKeys(contextOf(routes.requestBodies[0]));
    await expect(page.getByTestId("relay-tool-row")).toHaveCount(0);
    expect(JSON.stringify(routes.requestBodies[0])).not.toContain(
      "get_active_context",
    );
  });

  test("[REL-POL-CTX-09] a seeded persisted thread containing an old get_active_context tool part renders, continues, and its payload is redacted", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
    const routes = await open(page, { kind: "text", text: "Continued" });
    const now = Date.now();
    const thread: StoredThread = {
      id: "qa-e2e-relay-polish-ctx-thread",
      title: "Legacy context thread",
      workspaceId: LOCAL_WORKSPACE,
      createdAt: now,
      updatedAt: now,
      interruptedMessageId: null,
      messages: [
        {
          id: "qa-ctx-user-1",
          role: "user",
          parts: [{ type: "text", text: "What am I looking at?" }],
        },
        {
          id: "qa-ctx-assistant-1",
          role: "assistant",
          parts: [
            {
              type: "tool-get_active_context",
              toolCallId: "qa-ctx-tool-1",
              state: "output-available",
              input: {},
              output: {
                activeTab: { name: REQ_A, method: "GET" },
                environment: {
                  name: ENV_NAME,
                  variables: [{ key: "JWT_SECRET", value: LEGACY_RAW_SECRET }],
                },
              },
            },
            { type: "text", text: "You are looking at Request A." },
          ],
        },
      ],
    };
    await putThreads(page, [thread]);

    await openList(page);
    await page
      .getByTestId("relay-thread-item")
      .filter({ hasText: thread.title })
      .getByTestId("relay-thread-select")
      .click();
    await expect(page.getByTestId("relay-message-assistant")).toContainText(
      "You are looking at Request A.",
    );
    await expect(page.getByTestId("relay-tool-row")).toHaveCount(1);

    await sendMessage(page, "and now?");
    await expect(
      page.getByTestId("relay-message-assistant").last(),
    ).toContainText("Continued");

    const body = routes.requestBodies[0];
    expectNoImplicitKeys(contextOf(body));
    const serialized = JSON.stringify(body);
    // The legacy part was stored with a raw secret; the outgoing history must be redacted.
    expect(serialized).toContain("JWT_SECRET");
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain(LEGACY_RAW_SECRET);
  });

  test("[REL-POL-CTX-10] secret environment values stay [redacted] in the body when the environment is attached with Share variable values on and off", { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
    const routes = await open(page, { kind: "text", text: "OK" });
    await attachFromPicker(page, "environment", ENV_NAME);
    await sendMessage(page, "share off");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

    const off = JSON.stringify(routes.requestBodies[0]);
    expect(off).not.toContain(SECRET_VALUE);

    // Init scripts run in registration order, so this later one wins on reload.
    await page.addInitScript(
      (key) => localStorage.setItem(key, "true"),
      SHARE_VALUES_KEY,
    );
    await page.reload();
    // The dock stays open across a reload (see REL-ICTX-08), so only wait for it.
    await expect(page.getByTestId("relay-composer")).toBeVisible();
    await attachFromPicker(page, "environment", ENV_NAME);
    await sendMessage(page, "share on");
    await expect.poll(() => routes.requestBodies.length).toBe(2);

    const onBody = routes.requestBodies[1];
    const variables = (
      contextOf(onBody).environment as { variables: { key: string; value?: string }[] }
    ).variables;
    expect(variables.find((v) => v.key === "relaySecret")?.value).toBe(
      "[redacted]",
    );
    expect(JSON.stringify(onBody)).not.toContain(SECRET_VALUE);
  });
});
