import type { Page } from "@playwright/test";
import { closeRelay, openRelayEditor } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import {
  FAKE_AUDIO_LAUNCH_ARGS,
  installSpeechStub,
  removeSpeechGlobals,
  speechActive,
} from "../../fixtures/speechStub";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const SPEECH_ENGINE_KEY = "rq_relay_speech_engine";
const STT_STATUS_PATH = "**/api/relay/stt/status";
const VENDOR_NAMES = /grok|xai/i;
// Dictation never sends, so this scripted reply must stay unused.
const UNUSED_REPLY = "unused";

// Chromium's fake audio device stands in for the microphone (meter needs a real stream).
test.use({
  permissions: ["microphone"],
  launchOptions: { args: [...FAKE_AUDIO_LAUNCH_ARGS] },
});

const mic = (page: Page) => page.getByTestId("relay-mic");

async function mockSttStatus(page: Page, configured: boolean) {
  await page.route(STT_STATUS_PATH, (route) =>
    route.fulfill({
      json: { configured },
      headers: { "Cache-Control": "no-store" },
    }),
  );
}

type OpenOptions = { stub?: boolean; configured?: boolean };

async function openRelayWith(page: Page, options: OpenOptions = {}) {
  const { stub = true, configured = false } = options;
  if (stub) await installSpeechStub(page);
  else await removeSpeechGlobals(page);
  await mockSttStatus(page, configured);
  await installRelayRoutes(page, [{ kind: "text", text: UNUSED_REPLY }]);
  await page.goto(WORKSPACE_PATH);
  await openRelayEditor(page);
}

async function openRelaySettings(page: Page) {
  await closeRelay(page);
  await page.getByTestId("sidebar-settings-btn").click();
  await page.getByTestId("nav-relay").click();
  await expect(page.getByTestId("relay-settings")).toBeVisible();
}

test.describe("Relay dictation without a picker", () => {
  test("[REL-CP-VOICE-01] browser-mode dictation (STT unconfigured) shows the level meter while listening",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openRelayWith(page);
      await expect(mic(page)).toBeVisible();
      await expect(page.getByTestId("relay-mic-meter")).toHaveCount(0);

      await mic(page).click();
      await expect(mic(page)).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => speechActive(page)).toBe(true);
      await expect(page.getByTestId("relay-mic-meter")).toBeVisible();
      await snap("01-browser-mode-meter");

      await mic(page).click();
      await expect(mic(page)).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByTestId("relay-mic-meter")).toHaveCount(0);
    }
  );

  test("[REL-CP-VOICE-02] the Settings Relay section has no dictation engine control",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openRelayWith(page);
      await openRelaySettings(page);

      const settings = page.getByTestId("relay-settings");
      await expect(page.getByTestId("relay-speech-engine-select")).toHaveCount(0);
      await expect(
        settings.getByRole("combobox", { name: /dictation|speech|engine|voice/i }),
      ).toHaveCount(0);
      await expect(settings.getByText(/dictation engine/i)).toHaveCount(0);
      await snap("02-settings-no-engine");
    }
  );

  test("[REL-CP-VOICE-03] no Grok or xAI text on the dock, settings or mic error states",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      // Configured server so the AI engine (the one that used to be vendor-named) is active.
      await page.addInitScript(() => {
        const realFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (!url.endsWith("/api/relay/stt") || init?.method !== "POST") {
            return realFetch(input, init);
          }
          return new Response(JSON.stringify({ error: "upstream_auth" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        };
      });
      await openRelayWith(page, { configured: true });
      const dock = page.getByTestId("relay-dock");

      await mic(page).hover();
      await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText("(AI)");
      await expect(dock).not.toContainText(VENDOR_NAMES);

      await mic(page).click();
      await expect(mic(page)).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("relay-speech-note")).toBeVisible();
      // Keep recording past the minimum length, then stop to trigger the mocked 401.
      await expect(page.getByTestId("relay-mic-meter")).toBeVisible();
      const startedAt = Date.now();
      await expect.poll(() => Date.now() - startedAt, { intervals: [100] }).toBeGreaterThan(1200);
      await mic(page).click();

      const error = page.getByTestId("relay-mic-error");
      await expect(error).toBeVisible();
      await expect(error).not.toContainText(/settings/i);
      await expect(dock).not.toContainText(VENDOR_NAMES);
      await snap("03-ai-error-no-vendor");

      await openRelaySettings(page);
      await expect(page.getByTestId("relay-settings")).not.toContainText(VENDOR_NAMES);
    }
  );

  test("[REL-CP-VOICE-04] the mic is hidden when no engine works",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openRelayWith(page, { stub: false, configured: false });

      await expect(page.getByTestId("relay-composer-box")).toBeAttached();
      await expect(mic(page)).toHaveCount(0);
      await snap("04-mic-hidden");
    }
  );

  test("[REL-CP-VOICE-05] a stale rq_relay_speech_engine=grok key is cleared on load and the mic still works",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await page.addInitScript(
        ([key]) => localStorage.setItem(key, "grok"),
        [SPEECH_ENGINE_KEY],
      );
      await openRelayWith(page);

      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), SPEECH_ENGINE_KEY))
        .toBeNull();
      await mic(page).click();
      await expect(mic(page)).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => speechActive(page)).toBe(true);
      await expect(page.getByTestId("relay-composer-box")).toBeVisible();
    }
  );
});
