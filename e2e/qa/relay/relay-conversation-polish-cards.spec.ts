import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const NODE_COUNT = 4;
const DELAY_MS = 10;
const MAX_CARD_HEIGHT_PX = 32;
const CARD_GAP_PX = 4;
const GAP_TOLERANCE_PX = 2;

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

const groupCards = (page: Page) => page.getByTestId("relay-change-group-card");
const singleCards = (page: Page) => page.getByTestId("relay-change-card");
const summary = (page: Page) => page.getByTestId("relay-changes-summary");
const workedToggle = (page: Page) =>
  page.getByTestId("relay-worked-group").getByRole("button").first();

/** The first string `field` in the latest `toolName` output the client sent back. */
function outputField(bodies: unknown[], toolName: string, field: string) {
  const body = bodies[bodies.length - 1] as { messages?: unknown[] };
  let found: string | undefined;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (found === undefined && typeof record[field] === "string") {
      found = record[field] as string;
    }
    Object.values(record).forEach(visit);
  };
  for (const message of body.messages ?? []) {
    for (const part of (message as { parts?: unknown[] }).parts ?? []) {
      const tool = part as { type?: string; output?: unknown };
      if (tool.type === `tool-${toolName}`) visit(tool.output);
    }
  }
  if (!found) throw new Error(`no ${toolName}.${field} in the tool outputs`);
  return found;
}

const chainScripts = (name: string): RelayScript[] => {
  const nodeTurn: RelayScript = {
    kind: "clientTools",
    calls: (bodies) => [
      {
        toolName: "add_chain_node",
        input: {
          chainId: outputField(bodies, "create_chain", "chainId"),
          block: EMPTY_BLOCK,
          after: null,
          afterHandle: null,
        },
      },
    ],
  };
  return [
    { kind: "clientTools", calls: [{ toolName: "create_chain", input: { name } }] },
    ...Array.from({ length: NODE_COUNT }, () => nodeTurn),
    {
      kind: "clientTools",
      calls: (bodies) => [
        {
          toolName: "open_item",
          input: { kind: "chain", id: outputField(bodies, "create_chain", "chainId") },
        },
      ],
    },
    { kind: "text", text: "Chain built." },
  ];
};

async function start(page: Page, scripts: RelayScript[], prompt: string) {
  await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, prompt);
}

/** Runs the chain build and expands the Worked group so its cards are visible. */
async function buildChain(page: Page, name: string) {
  await start(page, chainScripts(name), "Build a chain");
  await expect(page.getByText("Chain built.")).toBeVisible();
  await workedToggle(page).click();
  await expect(groupCards(page)).toHaveCount(1);
}

test.describe("Relay conversation polish: compact and grouped cards", () => {
  test("[REL-CP-CARDS-01] a 4-node chain build shows ONE grouped card with the node count",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP group ${Date.now()}`;
      await buildChain(page, name);

      await expect(groupCards(page)).toContainText(name);
      const count = page.getByTestId("relay-change-group-count");
      await expect(count).toContainText(`${NODE_COUNT} nodes`);
      await expect(count).toBeVisible();
      // The count lives beside the truncating head inside the label container.
      // Had it been inside the truncating span, overflow:hidden would clip it
      // and its right edge would land past the label's (and Undo's) edge.
      const label = groupCards(page).locator("span[title]");
      const overflows = await label.evaluate(
        (el) => el.scrollWidth > el.clientWidth,
      );
      expect(overflows).toBe(false);
      const [countBox, labelBox, undoBox] = await Promise.all([
        count.boundingBox(),
        label.boundingBox(),
        groupCards(page).getByRole("button", { name: "Undo" }).boundingBox(),
      ]);
      const countRight = countBox!.x + countBox!.width;
      expect(countRight).toBeLessThanOrEqual(labelBox!.x + labelBox!.width);
      expect(countRight).toBeLessThanOrEqual(undoBox!.x);
      await expect(singleCards(page)).toHaveCount(0);
      await snap("01-grouped-card");
    },
  );

  test("[REL-CP-CARDS-02] cards are at most 32px tall and consecutive cards sit about 4px apart",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const stamp = Date.now();
      await start(
        page,
        [
          {
            kind: "clientTools",
            calls: [
              { toolName: "create_environment", input: { name: `CP env a ${stamp}`, variables: null } },
              { toolName: "create_environment", input: { name: `CP env b ${stamp}`, variables: null } },
            ],
          },
          { kind: "text", text: "Two envs." },
        ],
        "Create two environments",
      );
      await expect(page.getByText("Two envs.")).toBeVisible();
      await workedToggle(page).click();
      await expect(singleCards(page)).toHaveCount(2);

      // One evaluate so both rects come from the same layout frame.
      const [first, second] = await singleCards(page).evaluateAll((els) =>
        els.slice(0, 2).map((el) => {
          const { y, height } = el.getBoundingClientRect();
          return { y, height };
        }),
      );
      expect(first.height).toBeGreaterThan(0);
      expect(first.height).toBeLessThanOrEqual(MAX_CARD_HEIGHT_PX);
      expect(second.height).toBeLessThanOrEqual(MAX_CARD_HEIGHT_PX);
      const gap = second.y - (first.y + first.height);
      expect(Math.abs(gap - CARD_GAP_PX)).toBeLessThanOrEqual(GAP_TOLERANCE_PX);
      await snap("02-compact-cards");
    },
  );

  test("[REL-CP-CARDS-03] group Undo undoes the whole chain build and removes Open",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const name = `CP undo ${Date.now()}`;
      await buildChain(page, name);
      const card = groupCards(page);
      await expect(card.getByRole("button", { name: "Open" })).toBeVisible();

      await card.getByRole("button", { name: "Undo" }).click();

      await expect(card).toHaveAttribute("data-status", "undone");
      await expect(card.getByRole("button", { name: "Open" })).toHaveCount(0);
      await expect(card.getByRole("button", { name: "Undo" })).toHaveCount(0);
      await expect
        .poll(async () =>
          ((await dumpIdbStore(page, "chains")) as { name?: string }[]).filter(
            (c) => c.name === name,
          ).length,
        )
        .toBe(0);
      await snap("03-group-undone");
    },
  );

  test("[REL-CP-CARDS-04] a single change shows no end-of-turn summary; 2+ changes show Undo all",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const stamp = Date.now();
      await start(
        page,
        [
          { kind: "clientTools", calls: [{ toolName: "create_environment", input: { name: `CP one ${stamp}`, variables: null } }] },
          { kind: "text", text: "One change." },
        ],
        "Create one environment",
      );
      await expect(page.getByText("One change.")).toBeVisible();
      await workedToggle(page).click();
      await expect(singleCards(page)).toHaveCount(1);
      await expect(summary(page)).toHaveCount(0);
      await snap("04-single-no-summary");

      await installRelayRoutes(page, [
        {
          kind: "clientTools",
          calls: [
            { toolName: "create_environment", input: { name: `CP two a ${stamp}`, variables: null } },
            { toolName: "create_environment", input: { name: `CP two b ${stamp}`, variables: null } },
          ],
        },
        { kind: "text", text: "Two changes." },
      ]);
      await sendMessage(page, "Create two more");
      await expect(page.getByText("Two changes.")).toBeVisible();
      await expect(summary(page)).toHaveCount(1);
      await expect(summary(page).getByRole("button", { name: "Undo all" })).toBeVisible();
      await snap("05-two-changes-summary");
    },
  );
});
