import type { Page, Route } from "@playwright/test";
import { closeRelay, openRelayEditor } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const STT_PATH = "**/api/relay/stt";
const STT_STATUS_PATH = "**/api/relay/stt/status";
const TOGGLE = "relay-toggle";
const TOOLTIP_CONTENT = '[data-slot="tooltip-content"][data-open]';
// Dictation never sends, so this scripted reply must stay unused.
const UNUSED_REPLY = "unused";
const MOCK_TEXT = "list my collections please";
const RETRY_TEXT = "retried transcript text";
// Comfortably above STT_MIN_RECORDING_MS (500), measured in captured audio.
const RECORD_MS = 1200;
const POLL_INTERVAL_MS = 100;
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY = 429;

// Chromium's fake audio device stands in for the microphone; scoped to this spec only.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

const mic = (page: Page) => page.getByTestId("relay-mic");
const composer = (page: Page) => page.getByTestId("relay-composer");
const micError = (page: Page) => page.getByTestId("relay-mic-error");

type StubOptions = {
  configured: boolean;
  onStt: (route: Route, calls: Route[]) => Promise<void> | void;
};

type Stub = { calls: Route[]; chatBodies: unknown[] };

/** Mocks the status and transcribe routes (the engine is chosen automatically), opens Relay. */
async function openRelayWithStt(page: Page, options: StubOptions) {
  await page.route(STT_STATUS_PATH, (route) =>
    route.fulfill({
      json: { configured: options.configured },
      headers: { "Cache-Control": "no-store" },
    }),
  );
  const calls: Route[] = [];
  await page.route(STT_PATH, async (route) => {
    calls.push(route);
    await options.onStt(route, calls);
  });
  const chat = await installRelayRoutes(page, [
    { kind: "text", text: UNUSED_REPLY },
  ]);
  await page.goto(WORKSPACE_PATH);
  await openRelayEditor(page);
  return { calls, chatBodies: chat.requestBodies } satisfies Stub;
}

const replyText = (text: string) => (route: Route) =>
  route.fulfill({ json: { text } });

/** Starts recording and keeps it open for `RECORD_MS` of wall-clock capture. */
async function startRecording(page: Page) {
  await mic(page).click();
  await expect(mic(page)).toHaveAttribute("aria-pressed", "true");
}

/** Polls the clock (not a sleep): the fake device must deliver `ms` of audio before stopping. */
async function keepRecording(page: Page, ms: number) {
  const startedAt = Date.now();
  await expect
    .poll(() => Date.now() - startedAt, { intervals: [POLL_INTERVAL_MS] })
    .toBeGreaterThan(ms);
}

async function recordFor(page: Page, ms: number) {
  await startRecording(page);
  await keepRecording(page, ms);
  await mic(page).click();
}

test.describe("Relay AI dictation", () => {
  test("[REL-V2-STT-01] with the status route mocked as configured the AI engine is used automatically, recording then stopping lands the mocked text at the composer caret and does not send",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const stub = await openRelayWithStt(page, {
        configured: true,
        onStt: replyText(MOCK_TEXT),
      });
      await composer(page).pressSequentially("before after");
      await composer(page).press("ArrowLeft");
      await composer(page).press("ArrowLeft");
      await composer(page).press("ArrowLeft");
      await composer(page).press("ArrowLeft");
      await composer(page).press("ArrowLeft");
      await composer(page).press("ArrowLeft");

      await startRecording(page);
      await expect(page.getByTestId("relay-mic-meter")).toBeVisible();
      await snap("01-recording");
      await keepRecording(page, RECORD_MS);
      await mic(page).click();

      await expect(composer(page)).toContainText(MOCK_TEXT);
      const text = (await composer(page).textContent()) ?? "";
      expect(text.indexOf("before")).toBe(0);
      expect(text.indexOf(MOCK_TEXT)).toBeGreaterThan("before".length - 1);
      expect(text.indexOf(MOCK_TEXT)).toBeLessThan(text.indexOf("after"));
      expect(stub.calls).toHaveLength(1);
      expect(stub.chatBodies).toHaveLength(0);
      await expect(page.getByTestId("relay-message-user")).toHaveCount(0);
      await snap("02-text-inserted");
    }
  );

  test("[REL-V2-STT-02] the AI engine label is visible on the mic button",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openRelayWithStt(page, {
        configured: true,
        onStt: replyText(MOCK_TEXT),
      });
      await expect(mic(page)).toBeVisible();
      await mic(page).hover();
      await expect(page.locator(TOOLTIP_CONTENT)).toContainText("(AI)");
    }
  );

  test("[REL-V2-STT-03] with status mocked as unconfigured the browser engine is used, no engine picker exists and no vendor name shows",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openRelayWithStt(page, {
        configured: false,
        onStt: replyText(MOCK_TEXT),
      });
      await mic(page).hover();
      await expect(page.locator(TOOLTIP_CONTENT)).toContainText("(Browser)");
      await expect(page.locator(TOOLTIP_CONTENT)).not.toContainText(/grok|xai/i);

      await closeRelay(page);
      await page.getByTestId("sidebar-settings-btn").click();
      await page.getByTestId("nav-relay").click();
      await expect(page.getByTestId("relay-settings")).toBeVisible();
      await expect(page.getByTestId("relay-speech-engine-select")).toHaveCount(0);
      await expect(page.getByTestId("relay-settings")).not.toContainText(
        /grok|xai/i,
      );
      await snap("03-no-engine-picker");
    }
  );

  test("[REL-V2-STT-04] a mocked 401 shows the not-set-up message and a mocked 429 shows the busy message, and Retry resends the kept recording",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      // The browser logs every failed HTTP resource as a console error, which the
      // console guard rejects; failing statuses are therefore answered in-page, and
      // only the final success reaches the page.route mock.
      await page.addInitScript(
        ([failures]) => {
          const realFetch = window.fetch.bind(window);
          const sizes: number[] = [];
          (window as unknown as { __sttSizes: number[] }).__sttSizes = sizes;
          window.fetch = async (input, init) => {
            const url = typeof input === "string" ? input : (input as Request).url;
            if (!url.endsWith("/api/relay/stt") || init?.method !== "POST") {
              return realFetch(input, init);
            }
            const audio = (init.body as FormData).get("audio") as Blob;
            sizes.push(audio.size);
            const failure = failures[sizes.length - 1];
            if (!failure) return realFetch(input, init);
            return new Response(JSON.stringify({ error: failure.error }), {
              status: failure.status,
              headers: { "Content-Type": "application/json" },
            });
          };
        },
        [
          [
            { status: HTTP_UNAUTHORIZED, error: "upstream_auth" },
            { status: HTTP_TOO_MANY, error: "rate_limited" },
          ],
        ] as const,
      );
      const stub = await openRelayWithStt(page, {
        configured: true,
        onStt: replyText(RETRY_TEXT),
      });

      await recordFor(page, RECORD_MS);
      await expect(micError(page)).toContainText(
        "AI transcription isn't available right now",
      );
      await snap("04-not-set-up");

      await page.getByTestId("relay-mic-retry").click();
      await expect(micError(page)).toContainText("Voice service is busy");
      await snap("05-busy");

      await page.getByTestId("relay-mic-retry").click();
      await expect(composer(page)).toContainText(RETRY_TEXT);
      await expect(micError(page)).toHaveCount(0);

      // The two failures never reached the network; the third did, with the same kept WAV.
      expect(stub.calls).toHaveLength(1);
      const sizes = await page.evaluate(
        () => (window as unknown as { __sttSizes: number[] }).__sttSizes,
      );
      expect(sizes).toHaveLength(3);
      expect(sizes[0]).toBeGreaterThan(1000);
      expect(sizes).toEqual([sizes[0], sizes[0], sizes[0]]);
    }
  );

  test("[REL-V2-STT-05] denied microphone permission shows the inline error and sends no request",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () =>
          Promise.reject(new DOMException("denied", "NotAllowedError"));
      });
      const stub = await openRelayWithStt(page, {
        configured: true,
        onStt: replyText(MOCK_TEXT),
      });

      await mic(page).click();
      await expect(micError(page)).toContainText("Microphone access is blocked");
      await expect(mic(page)).toHaveAttribute("aria-pressed", "false");
      expect(stub.calls).toHaveLength(0);
      await snap("06-denied");
    }
  );

  test("[REL-V2-STT-06] a recording under half a second shows \"Didn't catch that\" and sends no request",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      const stub = await openRelayWithStt(page, {
        configured: true,
        onStt: replyText(MOCK_TEXT),
      });

      await startRecording(page);
      await mic(page).click();

      await expect(micError(page)).toContainText("Didn't catch that.");
      expect(stub.calls).toHaveLength(0);
      await expect(composer(page)).toHaveText("");
    }
  );

  test("[REL-V2-STT-07] the mic is disabled while transcribing and closing the dock mid-transcription inserts nothing",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      let release: () => void = () => {};
      let markHandled: () => void = () => {};
      const handled = new Promise<void>((resolve) => {
        markHandled = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const stub = await openRelayWithStt(page, {
        configured: true,
        onStt: async (route) => {
          await gate;
          try {
            await route.fulfill({ json: { text: MOCK_TEXT } });
          } catch {
            // A fixed app aborts the request on close, so fulfilling may fail.
          } finally {
            markHandled();
          }
        },
      });

      await recordFor(page, RECORD_MS);
      await expect(page.getByTestId("relay-mic-transcribing")).toBeVisible();
      await expect(mic(page)).toBeDisabled();
      await snap("07-transcribing");
      expect(stub.calls).toHaveLength(1);

      await closeRelay(page);
      release();
      await handled;
      await page.getByTestId(TOGGLE).click();
      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await expect(composer(page)).toHaveText("");
      await expect(page.getByTestId("relay-mic-transcribing")).toHaveCount(0);
      await expect(mic(page)).toBeEnabled();
    }
  );

  test("[REL-V2-STT-08] the uploaded request is audio/wav and carries the mapped language",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const stub = await openRelayWithStt(page, {
        configured: true,
        onStt: replyText(MOCK_TEXT),
      });

      await recordFor(page, RECORD_MS);
      await expect(composer(page)).toContainText(MOCK_TEXT);

      expect(stub.calls).toHaveLength(1);
      const request = stub.calls[0].request();
      expect(request.method()).toBe("POST");
      expect(request.headers()["content-type"]).toMatch(/^multipart\/form-data/);
      const body = request.postDataBuffer()?.toString("latin1") ?? "";
      // The app locale "en" maps to the ISO-639-1 code "en".
      expect(body).toMatch(/name="language"\r\n\r\nen\r\n/);
      expect(body).toMatch(
        /name="audio"; filename="audio\.wav"\r\nContent-Type: audio\/wav\r\n\r\nRIFF/,
      );
      expect(body).toContain("WAVE");
    }
  );
});
