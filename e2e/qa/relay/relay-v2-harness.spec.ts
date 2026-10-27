import type { Page } from "@playwright/test";
import { IDB_STORE_NAMES } from "../../../src/lib/idbSchema";
import { RELAY_MAX_STEPS } from "../../../src/lib/relay/constants";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  lastUserMessage,
  lastUserText,
} from "../../fixtures/relayRoutes";
import {
  computedColor,
  contrastRatio,
  downloadCapture,
  dumpIdb,
  dumpIdbStore,
  expectComputedColor,
  fakeAudioLaunchArgs,
  installSttMock,
  parseRgb,
  resolveCssColor,
  textContrast,
  twoContexts,
} from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const STT_PATH = "/api/relay/stt";
const STT_STATUS_PATH = "/api/relay/stt/status";
const STEP_CAP = RELAY_MAX_STEPS;
const SCRIPT_METADATA = { harness: "metadata-roundtrip" };
const EXPORT_FILENAME = "harness-export.json";
const EXPORT_PAYLOAD = { harness: true, rows: [1, 2, 3] };
const MAX_CONTRAST = 21;
const MIN_CONTRAST = 1;
const PALE_GREY: [number, number, number] = [200, 200, 200];
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];
const SEEDED_ENV_ID = "qa-env-1";
const SEEDED_COLLECTION_ID = "qa-collection-1";
const STT_TRANSCRIPT = "hello harness transcript";
const STT_LANGUAGE = "en";
const ASK_QUESTION = "Which environment should I use?";
const ASK_OPTIONS = ["Staging", "Production"];

const askCard = (page: Page) => page.getByTestId("relay-ask-card");
const toolGroup = (page: Page) => page.getByTestId("relay-tool-group");
const stepIndicator = (page: Page) => page.getByTestId("relay-step-indicator");

async function openWithScripts(
  page: Page,
  scripts: Parameters<typeof installRelayRoutes>[1],
) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

/** Same zero-tolerance guard as qa.ts consoleGuard, for pages outside the `page` fixture. */
function collectPageIssues(page: Page): string[] {
  const issues: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      issues.push(`[console.${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => issues.push(`[pageerror] ${err.message}`));
  return issues;
}

// Worker-level: the flags only add a fake microphone and auto-grant its prompt.
test.use({ launchOptions: { args: [...fakeAudioLaunchArgs] } });

test.describe("Relay v2 harness self-test", () => {
  test("[REL-V2-HARNESS-01] a scripted ask_user stream renders a question card and the body capture helper returns the last user message",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        {
          kind: "askUser",
          question: ASK_QUESTION,
          options: ASK_OPTIONS,
          metadata: { harness: true },
        },
      ]);
      const prompt = `ask me something ${Date.now()}`;
      await sendMessage(page, prompt);

      await expect(askCard(page)).toBeVisible();
      await expect(askCard(page)).toContainText(ASK_QUESTION);
      await expect(page.getByTestId("relay-ask-option")).toHaveText(
        ASK_OPTIONS,
      );

      expect(routes.requestBodies).toHaveLength(1);
      expect(lastUserText(routes.requestBodies)).toBe(prompt);
      const message = lastUserMessage(routes.requestBodies, 0);
      expect(message.role).toBe("user");
      expect(message.parts[0]).toMatchObject({ type: "text", text: prompt });
    },
  );

  test("[REL-V2-HARNESS-02] a scripted multi-step tool turn with delays and a step-cap hit completes deterministically",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      const routes = await openWithScripts(page, [
        {
          kind: "steps",
          steps: [
            {
              toolName: "list_collections",
              input: {},
              output: { collections: [] },
              delayMs: 150,
            },
            {
              toolName: "list_environments",
              input: {},
              output: { environments: [] },
              delayMs: 150,
            },
          ],
          text: "Steps finished.",
          metadata: SCRIPT_METADATA,
        },
        { kind: "stepCap", steps: STEP_CAP },
      ]);

      await sendMessage(page, "run two steps");
      await expect(page.getByText("Steps finished.")).toBeVisible();
      await expect(toolGroup(page)).toHaveCount(1);
      await expect(page.getByTestId("relay-send")).toBeVisible();
      await expect(stepIndicator(page)).toHaveCount(0);

      await sendMessage(page, "hit the step cap");
      await expect(stepIndicator(page)).toHaveText(
        `Step ${STEP_CAP} of ${STEP_CAP}`,
      );
      // The streamed message-metadata chunk comes back as history on the next request.
      expect(routes.requestBodies).toHaveLength(2);
      const history = (
        routes.requestBodies[1] as {
          messages: { role: string; metadata?: unknown }[];
        }
      ).messages;
      expect(
        history.find((m) => m.role === "assistant")?.metadata,
      ).toMatchObject(SCRIPT_METADATA);
      await expect(page.getByTestId("relay-send")).toBeVisible();
      await expect(page.getByTestId("relay-dock-error")).toHaveCount(0);
    },
  );

  test("[REL-V2-HARNESS-03] the IDB dump helper returns per-store records for seeded data",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await page.goto(WORKSPACE_PATH);

      await expect
        .poll(async () =>
          (await dumpIdbStore(page, "environments")).map(
            (row) => (row as { id: string }).id,
          ),
        )
        .toContain(SEEDED_ENV_ID);

      const dump = await dumpIdb(page);
      expect(Object.keys(dump).sort()).toEqual([...IDB_STORE_NAMES].sort());
      const collectionIds = dump.collections.map((row) => (row as { id: string }).id);
      expect(collectionIds).toContain(SEEDED_COLLECTION_ID);
      expect(dump.requests.length).toBeGreaterThan(0);

      const subset = await dumpIdb(page, ["environments"]);
      expect(Object.keys(subset)).toEqual(["environments"]);
    },
  );

  test("[REL-V2-HARNESS-04] the computed-colour helper returns an rgb that differs from the var(--primary) probe",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWithScripts(page, [{ kind: "text", text: "unused" }]);
      const title = page.getByTestId("relay-title");
      await expect(title).toBeVisible();

      const primary = parseRgb(await resolveCssColor(title, "var(--primary)"));
      const text = parseRgb(await computedColor(title, "color"));
      expect(text).not.toEqual(primary);

      // A probe resolves to the same rgb as an element painted with the token.
      await title.evaluate((el) => {
        el.style.color = "var(--primary)";
      });
      await expectComputedColor(title, "color");
      expect(parseRgb(await computedColor(title, "color"))).toEqual(primary);

      // Contrast maths: pure ratios, then a measured element with a known palette.
      expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(MAX_CONTRAST, 1);
      expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(MIN_CONTRAST, 5);
      await title.evaluate((el) => {
        el.style.color = "rgb(0, 0, 0)";
        el.style.backgroundColor = "rgb(255, 255, 255)";
      });
      expect(await textContrast(title)).toBeCloseTo(MAX_CONTRAST, 1);
      await title.evaluate((el, grey) => {
        el.style.backgroundColor = `rgb(${grey.join(", ")})`;
      }, PALE_GREY);
      const greyContrast = await textContrast(title);
      expect(greyContrast).toBeGreaterThan(MIN_CONTRAST);
      expect(greyContrast).toBeCloseTo(contrastRatio(BLACK, PALE_GREY), 5);
      expect(greyContrast).toBeLessThan(MAX_CONTRAST);
    },
  );

  test("[REL-V2-HARNESS-05] the twoContexts helper opens two isolated profiles with separate IndexedDB",
    { tag: ["@qa", "@high"] },
    async ({ browser }) => {
      const { source, target, close } = await twoContexts(browser);
      const issues = [...collectPageIssues(source), ...collectPageIssues(target)];
      try {
        await Promise.all([
          source.goto(WORKSPACE_PATH),
          target.goto(WORKSPACE_PATH),
        ]);
        const envIds = async (page: Page) =>
          (await dumpIdbStore(page, "environments")).map(
            (row) => (row as { id: string }).id,
          );

        await expect.poll(() => envIds(source)).toContain(SEEDED_ENV_ID);
        expect(await envIds(target)).not.toContain(SEEDED_ENV_ID);
        expect(source.context()).not.toBe(target.context());

        // A synthetic blob download stands in for a backup export.
        const exported = await downloadCapture(source, () =>
          source.evaluate(
            ({ filename, payload }) => {
              const link = document.createElement("a");
              link.href = URL.createObjectURL(
                new Blob([JSON.stringify(payload)], {
                  type: "application/json",
                }),
              );
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              link.remove();
            },
            { filename: EXPORT_FILENAME, payload: EXPORT_PAYLOAD },
          ),
        );
        expect(exported.filename).toBe(EXPORT_FILENAME);
        expect(exported.json()).toEqual(EXPORT_PAYLOAD);
      } finally {
        await close();
      }
      expect(issues, issues.join("\n")).toHaveLength(0);
    },
  );

  test("[REL-V2-HARNESS-06] the fake-audio flags plus STT page.route mock return a transcript",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      const stt = await installSttMock(page, {
        replies: [{ kind: "ok", text: STT_TRANSCRIPT, language: STT_LANGUAGE }],
      });
      await page.goto(WORKSPACE_PATH);

      const result = await page.evaluate(
        async ({ path, statusPath }) => {
          const status = await (await fetch(statusPath)).json();
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const recorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];
          const stopped = new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
          });
          recorder.ondataavailable = (event) => chunks.push(event.data);
          recorder.start();
          recorder.stop();
          await stopped;
          stream.getTracks().forEach((track) => track.stop());
          const form = new FormData();
          form.append("file", new Blob(chunks), "clip.webm");
          const response = await fetch(path, { method: "POST", body: form });
          return {
            status,
            audioTracks: stream.getAudioTracks().length,
            body: await response.json(),
          };
        },
        { path: STT_PATH, statusPath: STT_STATUS_PATH },
      );

      expect(result.status).toEqual({ configured: true });
      expect(result.audioTracks).toBe(1);
      expect(result.body).toMatchObject({
        text: STT_TRANSCRIPT,
        language: STT_LANGUAGE,
      });
      expect(stt.uploads).toHaveLength(1);
      expect(stt.uploads[0].contentType).toContain("multipart/form-data");
    },
  );
});
