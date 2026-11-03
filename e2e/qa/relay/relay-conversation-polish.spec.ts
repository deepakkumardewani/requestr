import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  expandWorkedGroups,
  openRelay,
  openRelayEditor,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";
import {
  FAKE_AUDIO_LAUNCH_ARGS,
  installSpeechStub,
  speechActive,
} from "../../fixtures/speechStub";

const WORKSPACE_PATH = "/app";
const STT_STATUS_PATH = "**/api/relay/stt/status";
const NODE_COUNT = 4;
const DELAY_MS = 10;
const VENDOR_NAMES = /grok|xai/i;
const EDGE_TOLERANCE_PX = 1;
const QUESTION = "Which environment should I use?";
const OPTIONS = ["Staging", "Production", "Local"];

// Chromium's fake audio device stands in for the microphone (the meter needs a real stream).
test.use({
  permissions: ["microphone"],
  launchOptions: { args: [...FAKE_AUDIO_LAUNCH_ARGS] },
});

const EMPTY_BLOCK = {
  kind: "delay",
  requestId: null,
  sourceJsonPath: null,
  schema: null,
  delayMs: DELAY_MS,
  itemAlias: null,
  maxIterations: null,
  variable: null,
  branches: null,
  targetField: null,
  targetKey: null,
} as const;

type Row = { id: string; name?: string };

const groupCards = (page: Page) => page.getByTestId("relay-change-group-card");
const singleCards = (page: Page) => page.getByTestId("relay-change-card");
const openButtons = (page: Page) =>
  page.getByRole("log", { name: "Relay conversation" }).getByRole("button", { name: "Open" });

/** The first string `field` in the latest `toolName` output the client sent back. */
function outputField(bodies: unknown[], toolName: string, field: string) {
  const body = bodies.at(-1) as { messages?: unknown[] };
  const parts = (body.messages ?? []).flatMap(
    (message) => (message as { parts?: unknown[] }).parts ?? [],
  ) as { type?: string; output?: unknown }[];
  const output = parts.filter((p) => p.type === `tool-${toolName}`).at(-1)?.output;
  const search = (node: unknown): string | undefined => {
    if (!node || typeof node !== "object") return undefined;
    const record = node as Record<string, unknown>;
    if (typeof record[field] === "string") return record[field];
    return Object.values(record).map(search).find(Boolean);
  };
  const value = search(output);
  if (!value) throw new Error(`no ${field} in ${toolName} output`);
  return value;
}

const rowsOf = async (page: Page, store: string) =>
  (await dumpIdbStore(page, store)) as Row[];

async function start(page: Page, scripts: RelayScript[], prompt: string) {
  await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, prompt);
}

function chainBuildScripts(name: string): RelayScript[] {
  const chainId = (bodies: unknown[]) => outputField(bodies, "create_chain", "chainId");
  const nodeTurn: RelayScript = {
    kind: "clientTools",
    calls: (bodies) => [
      {
        toolName: "add_chain_node",
        input: { chainId: chainId(bodies), block: EMPTY_BLOCK, after: null, afterHandle: null },
      },
    ],
  };
  return [
    { kind: "clientTools", calls: [{ toolName: "create_chain", input: { name } }] },
    ...Array.from({ length: NODE_COUNT }, () => nodeTurn),
    { kind: "text", text: "Chain built." },
  ];
}

test.describe("Relay conversation polish: objective flows", () => {
  test("[REL-CP-ALL-01] a sample chain creates no collection and shows one grouped card",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP all chain ${Date.now()}`;
      await page.goto(WORKSPACE_PATH);
      const before = (await rowsOf(page, "collections")).map((c) => c.id).sort();

      await start(page, chainBuildScripts(name), "Create a sample chain with 4 nodes");
      await expect(page.getByText("Chain built.")).toBeVisible();
      await expandWorkedGroups(page);

      await expect(groupCards(page)).toHaveCount(1);
      await expect(groupCards(page)).toContainText(name);
      await expect(page.getByTestId("relay-change-group-count")).toContainText(
        String(NODE_COUNT),
      );
      const after = (await rowsOf(page, "collections")).map((c) => c.id).sort();
      expect(after).toEqual(before);
      await snap("01-grouped-card");
    },
  );

  test("[REL-CP-ALL-02] create a chain and open it ends at /chain/<id>",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP all open ${Date.now()}`;
      await start(
        page,
        [
          { kind: "clientTools", calls: [{ toolName: "create_chain", input: { name } }] },
          { kind: "text", text: "Chain created." },
        ],
        "Create a chain and open it",
      );
      await expect(page.getByText("Chain created.")).toBeVisible();
      await expandWorkedGroups(page);
      await expect(singleCards(page)).toHaveCount(1);
      await snap("02-compact-card");

      const chain = (await rowsOf(page, "chains")).find((c) => c.name === name);
      expect(chain).toBeDefined();
      await singleCards(page).getByRole("button", { name: "Open" }).click();
      await expect(page).toHaveURL(new RegExp(`/chain/${chain?.id}/?$`));
    },
  );

  test("[REL-CP-ALL-03] an undone change leaves no dead Open anywhere in the conversation",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP all undo ${Date.now()}`;
      await start(
        page,
        [
          { kind: "clientTools", calls: [{ toolName: "create_chain", input: { name } }] },
          { kind: "text", text: "Chain created." },
        ],
        "Create a chain",
      );
      await expect(page.getByText("Chain created.")).toBeVisible();
      await expandWorkedGroups(page);
      await expect(openButtons(page)).toHaveCount(1);

      await singleCards(page).getByRole("button", { name: "Undo" }).click();
      await expect(openButtons(page)).toHaveCount(0);
      await snap("03-undone-no-open");
    },
  );

  test("[REL-CP-ALL-04] the ask card stacks its options with one left edge and width",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await installRelayRoutes(page, [
        { kind: "askUser", question: QUESTION, options: OPTIONS },
        { kind: "text", text: "Using your choice." },
      ]);
      await page.goto(WORKSPACE_PATH);
      await openRelayEditor(page);
      await sendMessage(page, "which env?");

      const card = page.getByTestId("relay-ask-card");
      await expect(card).toContainText(QUESTION);
      const options = page.getByTestId("relay-ask-option");
      await expect(options).toHaveCount(OPTIONS.length);
      const boxes = await options.evaluateAll((els) =>
        els.map((el) => {
          const { x, y, width } = el.getBoundingClientRect();
          return { x, y, width };
        }),
      );
      for (const box of boxes) {
        expect(Math.abs(box.x - boxes[0].x)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
        expect(Math.abs(box.width - boxes[0].width)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      }
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
      }
      await snap("04-ask-card");
    },
  );

  test("[REL-CP-ALL-05] no Grok or xAI text on the dock or the Relay settings",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await installRelayRoutes(page, [{ kind: "text", text: "unused" }]);
      await page.goto(WORKSPACE_PATH);
      await openRelayEditor(page);
      await expect(page.getByTestId("relay-mic")).toBeVisible();
      expect(await page.getByRole("complementary", { name: "Relay" }).innerText()).not.toMatch(
        VENDOR_NAMES,
      );

      await page.getByTestId("sidebar-settings-btn").click();
      await page.getByTestId("nav-relay").click();
      await expect(page.getByTestId("relay-settings")).toBeVisible();
      expect(await page.getByTestId("relay-settings").innerText()).not.toMatch(VENDOR_NAMES);
      await snap("05-no-vendor-names");
    },
  );

  test("[REL-CP-ALL-06] browser-mode dictation shows the waveform meter while listening",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await installSpeechStub(page);
      await page.route(STT_STATUS_PATH, (route) =>
        route.fulfill({
          json: { configured: false },
          headers: { "Cache-Control": "no-store" },
        }),
      );
      await installRelayRoutes(page, [{ kind: "text", text: "unused" }]);
      await page.goto(WORKSPACE_PATH);
      await openRelayEditor(page);

      const mic = page.getByTestId("relay-mic");
      await mic.click();
      await expect(mic).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => speechActive(page)).toBe(true);
      await expect(page.getByTestId("relay-mic-meter")).toBeVisible();
      await snap("06-browser-waveform");
    },
  );
});
