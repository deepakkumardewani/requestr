import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  openRelay,
  pressRelayShortcut,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayGate,
  type RelayScript,
  startRelayGate,
} from "../../fixtures/relayRoutes";
import { waitCanvasReady } from "../../fixtures/chainE2eHelpers";

const WORKSPACE_PATH = "/app";
const EDIT_CHAIN_ID = "qa-e2e-relay-edit-chain";
const CHAIN_PATH = (id: string) => `/chain/${id}`;
const ME_ID = "qa-e2e-relay-me-req";
const NEW_CHAIN_NAME = "QA live chain";
const EXPECTED_NEW_NODES = 3;
const FINAL_TEXT = "Added the nodes.";
const GATE_TEXT = "Chain created.";

/** Every field a block carries; a tool call sets the ones its kind uses. */
const EMPTY_BLOCK = {
  kind: "delay",
  requestId: null,
  sourceJsonPath: null,
  schema: null,
  delayMs: null,
  itemAlias: null,
  maxIterations: null,
  variable: null,
  branches: null,
  targetField: null,
  targetKey: null,
} as const;

const createChainScript: RelayScript = {
  kind: "clientTools",
  calls: [
    {
      toolName: "create_chain",
      input: { name: NEW_CHAIN_NAME, collectionId: null },
    },
  ],
};

/** A write tool's step renders as its change card, which carries the live Open button. */
const createdChainCard = (page: Page) =>
  page.getByTestId("relay-change-card").filter({ hasText: NEW_CHAIN_NAME });
const openButton = (page: Page) =>
  createdChainCard(page).getByRole("button", { name: "Open" });
const delayNodes = (page: Page) =>
  page.locator('[data-testid^="delay-node-"]');

/** Every string value stored under `field` in the latest outputs the client sent back for `toolName`. */
function outputFields(
  bodies: unknown[],
  toolName: string,
  field: string,
): string[] {
  const body = bodies[bodies.length - 1] as { messages?: unknown[] };
  const found: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record[field] === "string") found.push(record[field] as string);
    Object.values(record).forEach(visit);
  };
  for (const message of body.messages ?? []) {
    for (const part of (message as { parts?: unknown[] }).parts ?? []) {
      const tool = part as { type?: string; output?: unknown };
      if (tool.type === `tool-${toolName}`) visit(tool.output);
    }
  }
  return found;
}

const delayNode = (after: string | null) => (chainId: string) => ({
  toolName: "add_chain_node",
  input: {
    chainId,
    block: { ...EMPTY_BLOCK, kind: "delay", delayMs: 10 },
    after,
    afterHandle: null,
  },
});

/** Opens the workspace with a held-open second response so the turn stays running. */
async function startGatedChainCreation(page: Page): Promise<RelayGate> {
  const gate = await startRelayGate(page);
  await installRelayRoutes(page, [
    createChainScript,
    { kind: "gated", gate },
  ]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, "Create a chain");
  return gate;
}

async function finishTurn(gate: RelayGate) {
  await gate.push([
    { type: "text-start", id: "live-text" },
    { type: "text-delta", id: "live-text", delta: GATE_TEXT },
    { type: "text-end", id: "live-text" },
  ]);
  await gate.end();
}

test.describe("Relay v2 chain live updates", () => {
  test("[REL-V2-CHAINLIVE-01] creating a chain via the mocked agent does not change the URL, and an Open button appears in the live step row",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const gate = await startGatedChainCreation(page);

      await expect(openButton(page)).toBeVisible();
      // The turn is still running (the second response is held open), yet the step row already offers Open.
      await expect(page.getByTestId("relay-stop")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${WORKSPACE_PATH}$`));
      expect(new URL(page.url()).pathname).toBe(WORKSPACE_PATH);
      await snap("01-open-in-live-row");

      await finishTurn(gate);
      await expect(page.getByText(GATE_TEXT)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(WORKSPACE_PATH);
    },
  );

  test("[REL-V2-CHAINLIVE-02] with the chain page open, a mocked agent adding 3 nodes shows them without a reload",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const chainOf = () => EDIT_CHAIN_ID;
      const routes = await installRelayRoutes(page, [
        { kind: "clientTools", calls: [delayNode(ME_ID)(chainOf())] },
        {
          kind: "clientTools",
          calls: (bodies) => [
            delayNode(outputFields(bodies, "add_chain_node", "nodeId")[0])(
              chainOf(),
            ),
          ],
        },
        {
          kind: "clientTools",
          calls: () => [delayNode(null)(chainOf())],
        },
        {
          kind: "clientTools",
          calls: (bodies) => {
            const [second, third] = outputFields(
              bodies,
              "add_chain_node",
              "nodeId",
            ).slice(1);
            return [
              {
                toolName: "connect_chain_nodes",
                input: {
                  chainId: chainOf(),
                  from: second,
                  to: third,
                  handle: null,
                  remove: null,
                },
              },
            ];
          },
        },
        { kind: "text", text: FINAL_TEXT },
      ]);
      await page.goto(CHAIN_PATH(EDIT_CHAIN_ID));
      await waitCanvasReady(page);
      // The chain page has no Relay toggle; the shortcut opens the dock.
      await pressRelayShortcut(page);
      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await expect(delayNodes(page)).toHaveCount(0);
      const loadsBefore = await page.evaluate(
        () => performance.getEntriesByType("navigation").length,
      );

      await sendMessage(page, "Add three delay nodes");
      await expect(page.getByText(FINAL_TEXT)).toBeVisible();

      await expect(delayNodes(page)).toHaveCount(EXPECTED_NEW_NODES);
      const ids = outputFields(
        routes.requestBodies,
        "add_chain_node",
        "nodeId",
      );
      expect(ids).toHaveLength(EXPECTED_NEW_NODES);
      for (const id of ids) {
        await expect(page.getByTestId(`delay-node-${id}`)).toBeVisible();
      }
      expect(
        outputFields(routes.requestBodies, "connect_chain_nodes", "edgeId"),
      ).toHaveLength(1);
      // Same document: no reload, no navigation away from the chain.
      expect(new URL(page.url()).pathname).toBe(CHAIN_PATH(EDIT_CHAIN_ID));
      expect(
        await page.evaluate(
          () => performance.getEntriesByType("navigation").length,
        ),
      ).toBe(loadsBefore);
      await snap("02-three-nodes-live");
    },
  );

  test("[REL-V2-CHAINLIVE-03] clicking Open navigates to /chain/<id>",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const gate = await startGatedChainCreation(page);
      await expect(openButton(page)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(WORKSPACE_PATH);

      await openButton(page).click();

      await expect(page).toHaveURL(/\/chain\/[^/]+$/);
      const chainId = new URL(page.url()).pathname.split("/").pop() ?? "";
      expect(chainId).not.toBe("");
      expect(chainId).not.toBe(EDIT_CHAIN_ID);
      await snap("03-chain-opened");
      await finishTurn(gate);
    },
  );
});
