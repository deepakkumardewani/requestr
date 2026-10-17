import type { Page } from "@playwright/test";
import { openRelay } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import {
  emitSpeech,
  failSpeech,
  installSpeechStub,
  removeSpeechGlobals,
  speechActive,
} from "../../fixtures/speechStub";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const INTERIM_TEXT = "list my col";
const FINAL_TEXT = "list my collections";
// Dictation never sends, so this scripted reply must stay unused.
const UNUSED_REPLY = "unused";
const VENDOR_NAMES = /google|apple|microsoft|chrome|safari|edge/i;

const mic = (page: Page) => page.getByTestId("relay-mic");
const composer = (page: Page) => page.getByTestId("relay-composer");

async function openWithStub(page: Page) {
  await installSpeechStub(page);
  await installRelayRoutes(page, [{ kind: "text", text: UNUSED_REPLY }]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
}

async function startDictation(page: Page) {
  await mic(page).click();
  await expect(mic(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => speechActive(page)).toBe(true);
}

test.describe("Relay voice dictation", () => {
  test("[REL-VOICE-01] with the stub the mic shows, interim text streams into the textfield and nothing is sent",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWithStub(page);
      await expect(mic(page)).toBeVisible();
      await startDictation(page);

      await emitSpeech(page, [{ transcript: INTERIM_TEXT, isFinal: false }]);
      await expect(composer(page)).toHaveValue(INTERIM_TEXT);

      await emitSpeech(page, [{ transcript: FINAL_TEXT, isFinal: true }]);
      await expect(composer(page)).toHaveValue(FINAL_TEXT);
      await expect(mic(page)).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("relay-message-user")).toHaveCount(0);
    }
  );

  test("[REL-VOICE-02] permission denied shows the inline error and the button returns to idle",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWithStub(page);
      await startDictation(page);

      await failSpeech(page, "not-allowed");
      await expect(page.getByTestId("relay-mic-error")).toContainText(
        /microphone access is blocked/i
      );
      await expect(mic(page)).toHaveAttribute("aria-pressed", "false");
    }
  );

  test("[REL-VOICE-03] with both globals removed no mic is rendered",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await removeSpeechGlobals(page);
      await installRelayRoutes(page, [{ kind: "text", text: UNUSED_REPLY }]);
      await page.goto(WORKSPACE_PATH);
      await openRelay(page);

      await expect(page.getByTestId("relay-composer-trailing")).toBeAttached();
      await expect(mic(page)).toHaveCount(0);
    }
  );

  test("[REL-VOICE-04] the first-use note appears once and names no vendor",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWithStub(page);
      await startDictation(page);

      const note = page.getByTestId("relay-speech-note");
      await expect(note).toBeVisible();
      await expect(note).not.toContainText(VENDOR_NAMES);

      await page.getByTestId("relay-speech-note-dismiss").click();
      await expect(note).toHaveCount(0);

      await mic(page).click();
      await expect(mic(page)).toHaveAttribute("aria-pressed", "false");
      await startDictation(page);
      await expect(note).toHaveCount(0);
    }
  );

  test("[REL-VOICE-05] Esc stops dictation and keeps the dictated text unsent",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWithStub(page);
      await startDictation(page);
      await emitSpeech(page, [{ transcript: FINAL_TEXT, isFinal: true }]);
      await expect(composer(page)).toHaveValue(FINAL_TEXT);

      await page.keyboard.press("Escape");
      await expect(mic(page)).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => speechActive(page)).toBe(false);
      await expect(composer(page)).toHaveValue(FINAL_TEXT);
      await expect(page.getByTestId("relay-message-user")).toHaveCount(0);
    }
  );
});
