import type { Page } from "@playwright/test";
import {
  attachCurrentTab,
  attachFromPicker,
  closeRelay,
  expandWorkedGroups,
  openRelay,
  sendMessage,
  typeAndSend,
} from "../../fixtures/relayE2eHelpers";
import {
  installProxyReply,
  installRelayRoutes,
  lastUserMessage,
  lastUserText,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const SETTINGS_PATH = "/settings";
const STOP_BUDGET_MS = 300;
const RETRY_AFTER_SECONDS = 2;
const COUNTDOWN_TIMEOUT_MS = 5_000;
const PENDING_DELAY_MS = 150;

const messages = (page: Page) => page.getByTestId("relay-messages");
const userBubbles = (page: Page) => page.getByTestId("relay-message-user");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const composer = (page: Page) => page.getByTestId("relay-composer");

async function openWithRoutes(
  page: Page,
  ...args: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R
    : never
) {
  const routes = await installRelayRoutes(page, ...args);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

const ACTIVE_ENV_KEY = "requestly_active_env_id";
const RELAY_ENV_ID = "qa-e2e-relay-env";
const COLLECTION_TESTID = "collection-item-qa-collection-1";
const COLLECTION_NAME = "QA Collection";
const SECRET_REQUEST = "QA E2E Relay - Secret request";
const BIG_REQUEST = "QA E2E Relay - Large response request";
const SECRET_VALUES = [
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxYS1yZWxheSJ9.c2lnbmF0dXJlLXZhbHVl",
  "qa-relay-cookie-3b9e",
  "qa-relay-query-key-55",
  "qa-relay-env-secret-7c1d",
];
/** Far over the 4096-character response cap. */
const LARGE_BODY_FILLER = 20_000;
const ENV_NAME = "QA E2E Relay Env";

const chips = (page: Page) => page.getByTestId("relay-composer-pill");
const emptyState = (page: Page) => page.getByTestId("relay-empty");
const suggestions = (page: Page) =>
  emptyState(page).getByTestId("relay-suggestion");

/** Opens the workspace with the secret-bearing environment active. */
async function openWorkspace(
  page: Page,
  scripts: Parameters<typeof installRelayRoutes>[1]
) {
  await page.addInitScript(
    ([key, id]) => localStorage.setItem(key, id),
    [ACTIVE_ENV_KEY, RELAY_ENV_ID]
  );
  return openWithRoutes(page, scripts);
}

/** Opens a seeded saved request in a tab from the sidebar. */
async function openSavedRequest(page: Page, name: string) {
  const item = page.getByTestId("request-item").filter({ hasText: name });
  if (!(await item.isVisible()))
    await page.getByTestId(COLLECTION_TESTID).click();
  await item.click();
}

/** Sends the open request so it gets a stored response Relay can read. */
async function sendOpenRequest(page: Page, statusText: string) {
  await page.getByTestId("send-request-btn").click();
  await expect(page.getByTestId("response-status-text")).toHaveText(statusText);
}

function expectNoSecrets(payloads: unknown) {
  const text = JSON.stringify(payloads);
  for (const secret of SECRET_VALUES) expect(text).not.toContain(secret);
}

const SAMPLE_REQUEST = "QA E2E Relay - Sample request";
const FAILING_STATUS = 499;
const FAILING_STATUS_TEXT = "Client Closed Request";
const LEGACY_EXPLANATION = "Legacy explanation from the old endpoint";
const TELEMETRY_EVENT = "relay:telemetry";
const PRIVATE_PROMPT = "secret-looking prompt text";

/** Gives the sample request a stored 499 response, with the dock still closed. */
async function openFailingResponse(page: Page) {
  await installProxyReply(page, {
    status: FAILING_STATUS,
    statusText: FAILING_STATUS_TEXT,
    body: '{"error":"client_closed"}',
  });
  const routes = await installRelayRoutes(page, {
    kind: "text",
    text: "unused",
  });
  await page.goto(WORKSPACE_PATH);
  await openSavedRequest(page, SAMPLE_REQUEST);
  await sendOpenRequest(page, FAILING_STATUS_TEXT);
  return routes;
}

async function openRelaySettings(page: Page) {
  await page.goto(SETTINGS_PATH);
  await page.getByTestId("nav-relay").click();
  await expect(page.getByTestId("relay-settings")).toBeVisible();
}

test.describe("Relay chat @qa", () => {
  test("[REL-CHAT-01] A message streams into a reply (FR-20, AC-18)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, {
      kind: "text",
      text: "Hello from Relay",
      delayMs: PENDING_DELAY_MS,
    });

    await composer(page).fill("hi there");
    await composer(page).press("Enter");

    await expect(userBubbles(page)).toHaveText("hi there");
    await expect(assistantBubbles(page)).toContainText("Hello from Relay");
    await expect(composer(page)).toHaveText("");
    await expect(page.getByTestId("relay-send")).toBeDisabled();
    await snap("01-streamed-reply");
  });

  test("[REL-CHAT-02] Stop aborts the request within 300ms and the thread stays usable (FR-20, AC-18)", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openWithRoutes(page, [
      { kind: "hang" },
      { kind: "text", text: "back again" },
    ]);

    await sendMessage(page, "first");
    await composer(page).fill("");
    await expect(page.getByTestId("relay-stop")).toBeVisible();
    await snap("02-generating");

    await page.getByTestId("relay-stop").click();
    await expect
      .poll(() => routes.abortedCount(), { timeout: STOP_BUDGET_MS })
      .toBe(1);
    await expect(page.getByTestId("relay-send")).toBeVisible();

    await sendMessage(page, "second");
    await expect(assistantBubbles(page).last()).toContainText("back again");
  });

  test("[REL-CHAT-03] Regenerate replaces the last assistant turn (FR-20)", async ({
    seededPage: page,
  }) => {
    const routes = await openWithRoutes(page, [
      { kind: "text", text: "first answer" },
      { kind: "text", text: "second answer" },
    ]);

    await sendMessage(page, "question");
    await expect(assistantBubbles(page)).toContainText("first answer");

    await page.getByTestId("relay-regenerate").focus();
    await page.keyboard.press("Enter");

    await expect(assistantBubbles(page)).toHaveCount(1);
    await expect(assistantBubbles(page)).toContainText("second answer");
    await expect(assistantBubbles(page)).not.toContainText("first answer");
    expect(routes.requestBodies).toHaveLength(2);
  });

  test("[REL-CHAT-04] A rate limit shows a Retry-After countdown (FR-70, FR-72, AC-19)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, [
      { kind: "rateLimited", retryAfterSeconds: RETRY_AFTER_SECONDS },
      { kind: "text", text: "recovered" },
    ]);

    await sendMessage(page, "ping");

    const banner = page.getByTestId("relay-banner");
    const retry = page.getByTestId("relay-retry");
    await expect(banner).toHaveAttribute("role", "alert");
    await expect(banner).toHaveAttribute("data-error-code", "rate_limited");
    await expect(retry).toBeDisabled();
    await snap("04-countdown");
    await expect(retry).toBeEnabled({ timeout: COUNTDOWN_TIMEOUT_MS });

    await retry.click();
    await expect(assistantBubbles(page)).toContainText("recovered");
    await expect(banner).toBeHidden();
  });

  test("[REL-CHAT-05] A server without Relay configured shows setup copy and no environment details (FR-70, FR-62, AC-19)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "notConfigured" });

    await sendMessage(page, "ping");

    const banner = page.getByTestId("relay-banner");
    await expect(banner).toHaveAttribute("data-error-code", "not_configured");
    await expect(banner).toContainText("Relay isn't set up on this server");
    await expect(banner).not.toContainText(/KEY|ENV|RELAY_|process/);
    await expect(page.getByTestId("relay-retry")).toHaveCount(0);
    await snap("05-not-configured");
  });

  test("[REL-CHAT-06] Going offline disables the composer with an inline notice (FR-71, AC-19)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "ok" });

    await page.context().setOffline(true);
    await expect(composer(page)).toHaveAttribute("contenteditable", "false");
    await expect(page.getByTestId("relay-send")).toBeDisabled();
    await expect(page.getByTestId("relay-offline-notice")).toBeVisible();
    await snap("06-offline");

    await page.context().setOffline(false);
    await expect(composer(page)).toHaveAttribute("contenteditable", "true");
    await expect(page.getByTestId("relay-offline-notice")).toBeHidden();
  });

  test("[REL-CHAT-07] Markdown renders and raw HTML stays text (FR-23, FR-24)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, {
      kind: "text",
      text: 'Try this:\n\n```json\n{"a": 1}\n```\n\n<img src=x alt="boom"> done',
    });

    await sendMessage(page, "show me");

    const reply = assistantBubbles(page);
    await expect(reply.locator("pre")).toContainText('{"a": 1}');
    await expect(reply.getByTestId("relay-copy-code")).toBeVisible();
    await expect(reply).toContainText('<img src=x alt="boom">');
    await expect(messages(page).locator("img")).toHaveCount(0);
    await snap("07-markdown");
  });

  test("[REL-CTX-01] Context chips show what is sent and removing one changes the payload (AC-14)", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openWorkspace(page, { kind: "text", text: "ok" });
    await openSavedRequest(page, SECRET_REQUEST);

    // Opening a request attaches nothing; the Current tab row attaches it explicitly.
    await expect(chips(page)).toHaveCount(0);
    // The collection goes first so the tab pill ends up last and Backspace (the inline-pill removal gesture) hits it.
    await attachFromPicker(page, "collection", COLLECTION_NAME);
    await expect(chips(page)).toHaveCount(1);
    await attachCurrentTab(page);
    await expect(chips(page)).toHaveCount(2);
    await expect(chips(page).filter({ hasText: /Secret request/ })).toHaveCount(1);
    await snap("01-chips");

    // Attaching leaves one trailing space; the next Backspace removes the pill whole.
    await composer(page).focus();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Backspace");
    await expect(chips(page)).toHaveCount(2);
    await page.keyboard.press("Backspace");
    await expect(chips(page).filter({ hasText: SECRET_REQUEST })).toHaveCount(0);
    await expect(chips(page)).toHaveCount(1);

    await typeAndSend(page, "hello");
    await expect(assistantBubbles(page)).toContainText("ok");
    // Attachments are resolved per turn into the user message, not the context chip list.
    const message = lastUserMessage(routes.requestBodies);
    expect(
      (message.metadata?.attachments as Array<{ kind: string }>).map(
        (item) => item.kind
      )
    ).toEqual(["collection"]);
    const text = lastUserText(routes.requestBodies);
    expect(text).toContain(`- collection `);
    expect(text).toContain(`: ${COLLECTION_NAME}`);
    expect(text).not.toMatch(/^- tab /m);
    expect(text).not.toMatch(
      new RegExp(`^- request .*: ${SECRET_REQUEST}$`, "m")
    );
    const [payload] = routes.requestBodies as Array<{
      context: { chips: unknown[]; activeTab?: unknown };
    }>;
    expect(payload.context.chips).toEqual([]);
    expect(payload.context.activeTab).toBeUndefined();
  });

  test("[REL-CTX-02] Secrets never leave the browser in the payload (AC-16)", async ({
    seededPage: page,
  }) => {
    const routes = await openWorkspace(page, { kind: "text", text: "ok" });
    await openSavedRequest(page, SECRET_REQUEST);
    await attachCurrentTab(page);
    await expect(chips(page).first()).toBeVisible();

    await typeAndSend(page, "what does this request do?");
    await expect(assistantBubbles(page)).toContainText("ok");

    expect(JSON.stringify(routes.requestBodies)).toContain(SECRET_REQUEST);
    expectNoSecrets(routes.requestBodies);
  });

  test("[REL-CTX-03] Asking why a request returned 401 reads its last response (US3, FR-52)", async ({
    seededPage: page,
    snap,
  }) => {
    await installProxyReply(page, {
      status: 401,
      statusText: "Unauthorized",
      body: '{"error":"invalid_token","message":"Token expired"}',
    });
    const routes = await openWorkspace(page, [
      {
        kind: "readTool",
        toolName: "get_last_response",
        input: { requestId: "qa-e2e-relay-ctx-req", part: "summary" },
      },
      { kind: "text", text: "The token expired." },
    ]);
    await openSavedRequest(page, SECRET_REQUEST);
    await sendOpenRequest(page, "Unauthorized");

    await sendMessage(page, "why did this 401?");
    await expect(assistantBubbles(page)).toContainText("The token expired.");
    await expandWorkedGroups(page);
    await expect(page.getByTestId("relay-reads-line")).toContainText(
      /^Read 1 (request|item)/
    );
    await expect(
      page.locator('[data-testid="relay-tool-row"][data-state="failed"]')
    ).toHaveCount(0);
    await snap("03-read-response");

    expect(routes.requestBodies).toHaveLength(2);
    const followUp = JSON.stringify(routes.requestBodies[1]);
    expect(followUp).toContain("401");
    expectNoSecrets(routes.requestBodies);
  });

  test("[REL-CTX-04] Empty-state suggestions follow the open tab and attach no context on their own", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openWorkspace(page, { kind: "text", text: "sure" });

    // Only the active environment is open, so the suggestions are about it.
    await expect(suggestions(page)).toHaveText([
      `Explain ${ENV_NAME}`,
      `Summarize ${ENV_NAME}`,
      `Add or change variables in ${ENV_NAME}`,
    ]);
    await snap("04-workspace-suggestions");

    // Opening a request swaps in request suggestions; nothing is attached until one is used.
    await openSavedRequest(page, SECRET_REQUEST);
    await expect(suggestions(page)).toHaveText([
      `Explain ${SECRET_REQUEST}`,
      `Run ${SECRET_REQUEST}`,
      `Write assertions for ${SECRET_REQUEST}`,
    ]);
    await expect(chips(page)).toHaveCount(0);

    await suggestions(page).filter({ hasText: `Explain ${SECRET_REQUEST}` }).click();
    await expect(userBubbles(page)).toContainText("/explain");
    await expect(userBubbles(page).locator("[data-relay-pill]")).toContainText(
      SECRET_REQUEST,
    );
    await expect(assistantBubbles(page)).toContainText("sure");
    expect(routes.requestBodies).toHaveLength(1);
  });

  test("[REL-CTX-05] An oversize response body is head and tail truncated in the tool result (FR-52)", async ({
    seededPage: page,
  }) => {
    await installProxyReply(page, {
      status: 200,
      statusText: "OK",
      body: `RELAY-HEAD-MARKER ${"x".repeat(
        LARGE_BODY_FILLER
      )} RELAY-TAIL-MARKER`,
      contentType: "text/plain",
    });
    const routes = await openWorkspace(page, [
      {
        kind: "readTool",
        toolName: "get_last_response",
        input: { requestId: "qa-e2e-relay-big-req", part: "body" },
      },
      { kind: "text", text: "Large body read." },
    ]);
    await openSavedRequest(page, BIG_REQUEST);
    await sendOpenRequest(page, "OK");

    await sendMessage(page, "what is in the export?");
    await expect(assistantBubbles(page)).toContainText("Large body read.");

    const followUp = JSON.stringify(routes.requestBodies[1]);
    expect(followUp).toContain("RELAY-HEAD-MARKER");
    expect(followUp).toContain("RELAY-TAIL-MARKER");
    expect(followUp).toMatch(/\[truncated \d+ characters\]/);
  });

  test("[REL-ENTRY-01] Open in Relay from a failing response prefills the composer (AC-20, FR-32)", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openFailingResponse(page);

    await page
      .getByTestId("error-explainer")
      .getByTestId("open-in-relay-btn")
      .click();

    await expect(page.getByTestId("relay-dock")).toBeVisible();
    await expect(composer(page)).toHaveText(/499/);
    await expect(chips(page).filter({ hasText: SAMPLE_REQUEST })).toHaveCount(
      1
    );
    await snap("04-open-in-relay-prefill");

    expect(routes.requestBodies).toHaveLength(0);
  });

  test("[REL-ENTRY-02] The existing AI buttons still return results unchanged (AC-20, FR-32)", async ({
    seededPage: page,
  }) => {
    await page.route("**/api/ai", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ explanation: LEGACY_EXPLANATION }),
      })
    );
    await openFailingResponse(page);

    await page.getByTestId("ai-explain-btn").click();

    await expect(page.getByTestId("ai-explanation")).toHaveText(
      LEGACY_EXPLANATION
    );
    await expect(page.getByTestId("relay-dock")).toBeHidden();
  });

  test("[REL-ENTRY-03] Relay settings expose only privacy controls (FR-81)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "Hello from Relay" });
    await sendMessage(page, "hello");
    await expect(assistantBubbles(page)).toContainText("Hello from Relay");

    await openRelaySettings(page);
    const settings = page.getByTestId("relay-settings");
    await expect(settings.getByRole("textbox")).toHaveCount(0);
    await expect(settings).not.toContainText(/\b(model|vendor|api key)\b/i);
    await snap("05-relay-settings");

    await page.getByTestId("relay-share-values-switch").click();
    await expect(page.getByTestId("relay-share-values-switch")).toBeChecked();
    await page.reload();
    await openRelaySettings(page);
    await expect(page.getByTestId("relay-share-values-switch")).toBeChecked();

    await page.getByTestId("relay-clear-history-btn").click();
    await page.getByTestId("relay-clear-history-confirm").click();
    await expect(page.getByTestId("relay-clear-history-confirm")).toBeHidden();

    await page.goto(WORKSPACE_PATH);
    // The dock reopens from its stored state without taking focus.
    await expect(page.getByTestId("relay-dock")).toBeVisible();
    await page.getByTestId("relay-thread-trigger").click();
    await expect(page.getByTestId("relay-thread-item")).toHaveCount(0);
    await expect(userBubbles(page)).toHaveCount(0);
  });

  test("[REL-ENTRY-04] The first-open coach appears once and dismisses (FR-84)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "unused" });

    const coach = page.getByTestId("relay-onboarding");
    await expect(coach).toBeVisible();
    await snap("06-onboarding-coach");
    await page.getByTestId("relay-onboarding-next").click();
    await page.getByTestId("relay-onboarding-next").click();
    await page.getByTestId("relay-onboarding-next").click();
    await expect(coach).toBeHidden();

    await closeRelay(page);
    await page.reload();
    await openRelay(page);
    await expect(coach).toBeHidden();
  });

  test("[REL-ENTRY-05] Usage events carry names and counts but never prompt text (FR-82)", async ({
    seededPage: page,
  }) => {
    await page.addInitScript((eventName) => {
      const events: unknown[] = [];
      (window as unknown as { __relayEvents: unknown[] }).__relayEvents =
        events;
      window.addEventListener(eventName, (event) =>
        events.push((event as CustomEvent).detail)
      );
    }, TELEMETRY_EVENT);
    await openWithRoutes(page, { kind: "text", text: "Hello from Relay" });

    await sendMessage(page, PRIVATE_PROMPT);
    await expect(assistantBubbles(page)).toContainText("Hello from Relay");

    const events = () =>
      page.evaluate(
        () => (window as unknown as { __relayEvents: unknown[] }).__relayEvents
      );
    await expect
      .poll(async () =>
        (await events()).map((event) => (event as { name: string }).name)
      )
      .toEqual(["relay_opened", "relay_message_sent"]);
    const recorded = JSON.stringify(await events());
    expect(recorded).toContain(`"length":${PRIVATE_PROMPT.length}`);
    expect(recorded).not.toContain(PRIVATE_PROMPT);
  });
});
