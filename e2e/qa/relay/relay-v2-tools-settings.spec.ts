import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  startRelayGate,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { installSttMock } from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const SETTINGS_PATH = "/settings";
const SETTINGS_RECORD_KEY = "app";
const ANSWER = "Done with your settings.";
const TEXT_PART_ID = "qa-toolset-text";
const PROXY_PASSWORD = "PROXY-PASS-7c41";
const SECRET_HEADER_VALUE = "SECRET-AUTH-9d2e";
const PROXY_URL = "http://proxy.example.com:8080";
const GLOBAL_BASE_URL = "https://toolset-global.example.com";
const PLAIN_HEADER_VALUE = "plain-header-value-31";

const summary = (page: Page) => page.getByTestId("relay-changes-summary");
const rows = (page: Page) => page.getByTestId("relay-changes-row");
const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");

type ToolCall = { toolName: string; input: unknown };

/** The latest `toolName` part (with its output or error) the client sent back to the model. */
function toolPart(bodies: unknown[], toolName: string): unknown {
  const body = bodies.at(-1) as { messages?: unknown[] };
  const parts = (body.messages ?? []).flatMap(
    (message) => (message as { parts?: unknown[] }).parts ?? [],
  ) as { type?: string }[];
  const part = parts.filter((p) => p.type === `tool-${toolName}`).at(-1);
  if (!part) throw new Error(`no ${toolName} part sent back to the model`);
  return part;
}

/** Every `toolName` output in the chat request body, oldest first. */
function toolOutputs(body: unknown, toolName: string): unknown[] {
  const messages = (body as { messages?: { parts?: unknown[] }[] }).messages ?? [];
  return messages
    .flatMap((message) => message.parts ?? [])
    .filter((part) => (part as { type?: string }).type === `tool-${toolName}`)
    .map((part) => (part as { output?: unknown }).output);
}

const turn = (...calls: ToolCall[]): RelayScript[] => [
  { kind: "clientTools", calls },
  { kind: "text", text: ANSWER },
];

/** Overwrites fields of the persisted global settings record before the app loads. */
async function seedSettings(page: Page, patch: Record<string, unknown>) {
  await page.goto(SETTINGS_PATH);
  await page.evaluate(
    ({ values, key }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("settings", "readwrite");
          const store = tx.objectStore("settings");
          const read = store.get(key);
          read.onsuccess = () =>
            store.put({ ...(read.result ?? {}), ...values }, key);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { values: patch, key: SETTINGS_RECORD_KEY },
  );
}

async function openApp(page: Page, scripts: RelayScript[]) {
  const handle = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return handle;
}

async function runTurn(page: Page, scripts: RelayScript[], prompt: string) {
  const handle = await openApp(page, scripts);
  await sendMessage(page, prompt);
  await expect(page.getByText(ANSWER)).toBeVisible();
  return handle;
}

async function openSettingsSection(page: Page, section: string) {
  await page.goto(SETTINGS_PATH);
  await page.getByTestId(`nav-${section}`).click();
}

const undoAll = (page: Page) =>
  summary(page).getByRole("button", { name: "Undo all" });

test.describe("Relay v2 settings tools @qa", () => {
  test("[REL-V2-TOOLSET-01] a mocked agent calls get_app_settings and the reply masks proxy credentials and, with shareValues off, header values",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await seedSettings(page, {
        proxyUrl: `http://proxyuser:${PROXY_PASSWORD}@proxy.example.com:8080`,
        globalBaseUrl: "https://toolset.example.com",
        globalHeaders: [
          { id: "qa-ts-h1", key: "Authorization", value: SECRET_HEADER_VALUE, enabled: true },
          { id: "qa-ts-h2", key: "X-Trace", value: PLAIN_HEADER_VALUE, enabled: true },
        ],
      });
      const handle = await runTurn(
        page,
        [
          { kind: "readTool", toolName: "get_app_settings", input: {} },
          { kind: "text", text: ANSWER },
        ],
        "What are my settings?",
      );

      const sent = JSON.stringify(toolPart(handle.requestBodies, "get_app_settings"));
      // Non-vacuous: the real settings reached the model, only the secrets did not.
      expect(sent).toContain("proxy.example.com");
      expect(sent).toContain("https://toolset.example.com");
      expect(sent).toContain("Authorization");
      expect(sent).toContain("X-Trace");
      expect(sent).not.toContain(PROXY_PASSWORD);
      expect(sent).not.toContain(SECRET_HEADER_VALUE);
      // Only secret-named headers are masked: a plain header value stays readable.
      expect(sent).toContain(PLAIN_HEADER_VALUE);
      await snap("01-get-app-settings-answer");
    },
  );

  test("[REL-V2-TOOLSET-02] a mocked set_theme changes the theme, the summary offers Open Settings, and Undo restores the previous theme",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openSettingsSection(page, "appearance");
      await page.getByTestId("theme-dark").click();
      await expect(page.locator("html")).toHaveClass(/dark/);

      await runTurn(
        page,
        turn({ toolName: "set_theme", input: { theme: "light" } }),
        "Switch to the light theme",
      );
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(summary(page)).toBeVisible();
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText("light");
      await snap("02-theme-light-summary");

      await rows(page).first().getByRole("button", { name: "Open Settings" }).click();
      await expect(page).toHaveURL(/\/settings#appearance$/);

      // The dock survives the in-app navigation, so Undo works from the Settings page.
      await expect(undoAll(page)).toBeVisible();
      await undoAll(page).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(rows(page).first().getByTestId("relay-changes-reason")).toHaveText("Undone");
      await snap("02-theme-undone");
    },
  );
  test("[REL-V2-TOOLSET-03] set_language and update_proxy_settings apply the same way as the Settings UI",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await runTurn(
        page,
        turn(
          { toolName: "set_language", input: { locale: "fr" } },
          {
            toolName: "update_proxy_settings",
            input: {
              proxyUrl: PROXY_URL,
              sslVerify: false,
              followRedirects: false,
            },
          },
        ),
        "Use French and a proxy",
      );
      await expect(rows(page)).toHaveCount(2);
      await snap("03-language-proxy-summary");

      await openSettingsSection(page, "proxy");
      await expect(page.getByTestId("proxy-url-input")).toHaveValue(PROXY_URL);
      await expect(page.getByTestId("ssl-verification-switch")).not.toBeChecked();
      await expect(page.getByTestId("follow-redirects-switch")).not.toBeChecked();
      await snap("03-proxy-settings-page");

      await openSettingsSection(page, "language");
      await expect(page.getByRole("combobox")).toHaveText(/^fr/);
      await snap("03-language-settings-page");

      // The values survive a reload, as if the user had set them in the Settings UI.
      await page.reload();
      await openSettingsSection(page, "proxy");
      await expect(page.getByTestId("proxy-url-input")).toHaveValue(PROXY_URL);
    },
  );

  test("[REL-V2-TOOLSET-04] set_global_variables updates the Global section and Undo restores it",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await runTurn(
        page,
        turn({
          toolName: "set_global_variables",
          input: {
            baseUrl: GLOBAL_BASE_URL,
            headers: [{ key: "X-Toolset", value: PLAIN_HEADER_VALUE, enabled: true }],
          },
        }),
        "Set the global base URL",
      );
      await expect(rows(page)).toHaveCount(1);
      await rows(page).first().getByRole("button", { name: "Open Settings" }).click();
      await expect(page).toHaveURL(/\/settings#global$/);
      await expect(page.getByTestId("global-base-url-input")).toHaveValue(GLOBAL_BASE_URL);
      await expect(page.getByPlaceholder("Header").first()).toHaveValue("X-Toolset");
      await expect(page.getByPlaceholder("Value").first()).toHaveValue(PLAIN_HEADER_VALUE);
      await snap("04-global-applied");

      await undoAll(page).click();
      await expect(page.getByTestId("global-base-url-input")).toHaveValue("");
      await expect(page.getByPlaceholder("Header").first()).toHaveValue("");
      await snap("04-global-undone");
    },
  );

  test("[REL-V2-TOOLSET-05] set_relay_preferences with enabled false shows an approval card and applies only after the turn ends",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const gate = await startRelayGate(page);
      await openApp(page, [
        {
          kind: "clientTools",
          calls: [
            {
              toolName: "set_relay_preferences",
              input: { shareValues: null, speechEngine: null, enabled: false },
            },
          ],
        },
        { kind: "gated", gate },
      ]);
      await sendMessage(page, "Turn Relay off");

      await expect(confirmCard(page)).toBeVisible();
      await snap("05-approval-card");
      await confirmCard(page).getByTestId("relay-confirm-approve").click();

      // The turn is still open (the reply is held), so Relay stays on.
      await gate.push([
        { type: "text-start", id: TEXT_PART_ID },
        { type: "text-delta", id: TEXT_PART_ID, delta: ANSWER },
      ]);
      await expect(page.getByText(ANSWER)).toBeVisible();
      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await expect(page.getByTestId("relay-composer")).toBeVisible();
      await snap("05-turn-open-still-on");

      await gate.push([{ type: "text-end", id: TEXT_PART_ID }]);
      await gate.end();
      await expect(page.getByTestId("relay-dock")).toHaveCount(0);
      await openSettingsSection(page, "relay");
      await expect(page.getByTestId("relay-enabled-switch")).not.toBeChecked();
      await snap("05-relay-off");
    },
  );

  test("[REL-V2-TOOLSET-06] set_relay_preferences rejects permissionMode and speechEngine grok when status reports unconfigured",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await installSttMock(page, { configured: false });
      await openSettingsSection(page, "relay");
      const mode = await page.getByTestId("relay-permission-select").textContent();
      const handle = await runTurn(
        page,
        [
          {
            kind: "clientTools",
            calls: [
              {
                toolName: "set_relay_preferences",
                input: {
                  shareValues: null,
                  speechEngine: null,
                  enabled: null,
                  permissionMode: "skip",
                },
              },
            ],
          },
          {
            kind: "clientTools",
            calls: [
              {
                toolName: "set_relay_preferences",
                input: { shareValues: null, speechEngine: "grok", enabled: null },
              },
            ],
          },
          { kind: "text", text: ANSWER },
        ],
        "Skip approvals and use Grok",
      );

      const outputs = toolOutputs(handle.requestBodies.at(-1), "set_relay_preferences");
      expect(outputs).toEqual([
        { ok: false, error: expect.stringContaining('Unrecognized key: "permissionMode"') },
        { ok: false, error: expect.stringContaining("not set up on this server") },
      ]);
      await expect(rows(page)).toHaveCount(0);
      await snap("06-rejected");

      await openSettingsSection(page, "relay");
      await expect(page.getByTestId("relay-permission-select")).toHaveText(mode ?? "");
    },
  );
});
