import type { Locator, Page } from "@playwright/test";
import {
  expandWorkedGroups,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import { dumpIdbStore } from "../../fixtures/relayV2Helpers";
import {
  installProxyRoutes,
  installRelayRoutes,
  type ProxyDecision,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const RELAY_ENV_ID = "qa-e2e-relay-env";
const SEED_COLLECTION_TESTID = "collection-item-qa-collection-1";

const SAMPLE_ID = "qa-e2e-relay-req";
const SAMPLE_NAME = "QA E2E Relay - Sample request";
const TARGET_ID = "qa-e2e-relay-write-req";
const TARGET_NAME = "QA E2E Relay - Write target";
const BIG_ID = "qa-e2e-relay-big-req";
const BIG_NAME = "QA E2E Relay - Large response request";
const ENV_SECRET_KEY = "relaySecret";
const ENV_SECRET_VALUE = "qa-relay-env-secret-7c1d";
const LITERAL_TOKEN = "sk-live-qa-relay-literal-9f2a41c7";
const MISSING_REQUEST_ID = "qa-e2e-relay-missing-request";

const LOGIN_ID = "qa-e2e-relay-login-req";
const LOGIN_URL = "relay-login";
const ME_ID = "qa-e2e-relay-me-req";
const ME_NAME = "QA E2E Relay - Me";
const ME_URL = "relay-me";
const EDIT_CHAIN_ID = "qa-e2e-relay-edit-chain";
const EDIT_CHAIN_NAME = "QA E2E Relay - Edit chain";
const EDIT_CHAIN_NODE_COUNT = "2";
const SLOW_CHAIN_ID = "qa-e2e-relay-slow-chain";
const STOPPED_RUN_STATUS = '"status":"stopped"';
const LOGIN_TOKEN_BODY = '{"token":"tok-relay-chain"}';

const NULL_PATCH = { method: null, url: null } as const;
const NO_AUTH_FIELDS = {
  username: null,
  password: null,
  keyName: null,
  keyValue: null,
  addTo: null,
} as const;

const changeCards = (page: Page) => page.getByTestId("relay-change-card");
const toolRows = (page: Page) => page.getByTestId("relay-tool-row");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const cardFor = (page: Page, summary: string) =>
  changeCards(page).filter({ hasText: summary });
const requestItem = (page: Page, name: string) =>
  page.getByTestId("request-item").filter({ hasText: name });

const rename = (requestId: string, name: string) => ({
  toolName: "update_request",
  input: { requestId, name, ...NULL_PATCH },
});

/** The output of the most recent `toolName` call in the last outbound chat body. */
function lastToolOutput(bodies: unknown[], toolName: string): unknown {
  const body = bodies[bodies.length - 1] as { messages?: unknown[] };
  const parts = (body.messages ?? []).flatMap(
    (message) => (message as { parts?: unknown[] }).parts ?? [],
  ) as { type?: string; output?: unknown }[];
  const part = parts.filter((item) => item.type === `tool-${toolName}`).at(-1);
  if (!part) throw new Error(`no ${toolName} output in the last request`);
  return part.output;
}

/** Finds a string field anywhere in the latest output the client sent back for `toolName`. */
function findOutputField(
  bodies: unknown[],
  toolName: string,
  field: string,
): string {
  const search = (node: unknown): string | undefined => {
    if (!node || typeof node !== "object") return undefined;
    const record = node as Record<string, unknown>;
    if (typeof record[field] === "string") return record[field];
    return Object.values(record).map(search).find(Boolean);
  };
  const value = search(lastToolOutput(bodies, toolName));
  if (!value) throw new Error(`no ${field} in ${toolName} output`);
  return value;
}

type ChainRead = {
  nodes: { id: string; type: string }[];
  edges: { from: string; to: string }[];
};

/** The chain the latest get_chain call returned to the model. */
function readChain(bodies: unknown[]): ChainRead {
  const output = lastToolOutput(bodies, "get_chain") as {
    data?: ChainRead;
  } & ChainRead;
  return output.data ?? output;
}

async function openWorkspace(page: Page, scripts: RelayScript[]) {
  await page.addInitScript(
    ([key, id]) => localStorage.setItem(key, id),
    [ACTIVE_ENV_KEY, RELAY_ENV_ID],
  );
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

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

async function openWorkspaceWithProxy(
  page: Page,
  scripts: RelayScript[],
  reply: (url: string) => ProxyDecision,
) {
  const proxy = await installProxyRoutes(page, reply);
  const routes = await openWorkspace(page, scripts);
  return { routes, proxy };
}

/** Expands a collection row unless its requests are already showing. */
async function expandIfCollapsed(
  page: Page,
  collection: Locator,
  probe: Locator,
) {
  if (!(await probe.isVisible())) await collection.click();
  await expect(probe).toBeVisible();
}

async function expandSeedCollection(page: Page) {
  await expandIfCollapsed(
    page,
    page.getByTestId(SEED_COLLECTION_TESTID),
    requestItem(page, SAMPLE_NAME),
  );
}

/** Renames a sidebar request by hand, the way a user editing alongside Relay would. */
async function renameByHand(page: Page, from: string, to: string) {
  const item = requestItem(page, from);
  await item.hover();
  await item.getByTestId("request-item-more-btn").click();
  await page.getByTestId("request-rename-btn").click();
  // While editing, the name lives in an input value, which `item`'s text filter no longer matches.
  const input = page.getByTestId("request-item").getByRole("textbox");
  await input.fill(to);
  await input.press("Enter");
}

test.describe("Relay write @qa", () => {
  test("[REL-WRITE-01] Create a collection Orders with GET and POST /orders (FR-41, AC-5)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [
          {
            toolName: "create_collection",
            input: { name: "Orders", parentId: null },
          },
        ],
      },
      {
        kind: "clientTools",
        calls: (bodies) => {
          const collectionId = findOutputField(
            bodies,
            "create_collection",
            "collectionId",
          );
          const base = { collectionId, folderId: null };
          return [
            {
              toolName: "create_request",
              input: {
                ...base,
                name: "List orders",
                method: "GET",
                url: "https://api.example.com/orders",
                headers: null,
                params: null,
                body: null,
                auth: null,
              },
            },
            {
              toolName: "create_request",
              input: {
                ...base,
                name: "Create order",
                method: "POST",
                url: "https://api.example.com/orders",
                headers: null,
                params: null,
                body: null,
                auth: null,
              },
            },
          ];
        },
      },
      { kind: "text", text: "Created Orders with GET and POST /orders." },
    ]);

    await sendMessage(page, "Create a collection Orders with GET and POST /orders");

    await expect(assistantBubbles(page)).toContainText(
      "Created Orders with GET and POST /orders.",
    );
    await expandWorkedGroups(page);
    await expect(changeCards(page)).toHaveCount(3);
    await expect(cardFor(page, 'Created collection "Orders"')).toBeVisible();
    await expect(cardFor(page, 'Created GET "List orders"')).toBeVisible();
    await expect(cardFor(page, 'Created POST "Create order"')).toBeVisible();

    const orders = page
      .locator('[data-testid^="collection-item-"]')
      .filter({ hasText: "Orders" });
    await expect(orders).toHaveCount(1);
    await expandIfCollapsed(page, orders, requestItem(page, "List orders"));
    await expect(requestItem(page, "Create order")).toBeVisible();
    await snap("01-orders-created");
  });

  test("[REL-WRITE-02] Undo on one card reverts exactly that change (FR-41, AC-6)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [
          rename(SAMPLE_ID, "Renamed by Relay A"),
          rename(TARGET_ID, "Renamed by Relay B"),
        ],
      },
      { kind: "text", text: "Renamed two requests." },
    ]);
    await expandSeedCollection(page);

    await sendMessage(page, "Rename two requests");
    await expandWorkedGroups(page);
    await expect(changeCards(page)).toHaveCount(2);
    await expect(requestItem(page, "Renamed by Relay A")).toBeVisible();

    const renameCard = cardFor(page, `Updated "${SAMPLE_NAME}"`);
    await renameCard.getByRole("button", { name: "Undo" }).click();

    await expect(requestItem(page, SAMPLE_NAME)).toBeVisible();
    await expect(requestItem(page, "Renamed by Relay B")).toBeVisible();
    await expect(renameCard.getByTestId("relay-change-undone")).toBeVisible();
    await expect(renameCard.getByRole("button", { name: "Undo" })).toHaveCount(
      0,
    );
    await snap("02-single-undo");
  });

  test("[REL-WRITE-03] Undo all reverts the whole turn (FR-41, AC-6)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [
          rename(SAMPLE_ID, "Renamed by Relay A"),
          rename(TARGET_ID, "Renamed by Relay B"),
          rename(BIG_ID, "Renamed by Relay C"),
        ],
      },
      { kind: "text", text: "Renamed three requests." },
    ]);
    await expandSeedCollection(page);

    await sendMessage(page, "Rename three requests");
    await expandWorkedGroups(page);
    await expect(changeCards(page)).toHaveCount(3);
    await expect(page.getByTestId("relay-changes-row")).toHaveCount(3);

    await page
      .getByTestId("relay-changes-summary")
      .getByRole("button", { name: "Undo all" })
      .click();

    for (const name of [SAMPLE_NAME, TARGET_NAME, BIG_NAME]) {
      await expect(requestItem(page, name)).toBeVisible();
    }
    await expect(page.getByTestId("relay-change-undone")).toHaveCount(3);
    await expect(page.getByRole("button", { name: /Undo all/ })).toHaveCount(0);
    await snap("03-undo-all");
  });

  test("[REL-WRITE-04] Undo after a manual edit is blocked with an explanation (FR-44, AC-6)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [rename(TARGET_ID, "Renamed by Relay")],
      },
      { kind: "text", text: "Renamed the request." },
    ]);
    await expandSeedCollection(page);

    await sendMessage(page, "Rename the write target");
    await expandWorkedGroups(page);
    const card = cardFor(page, `Updated "${TARGET_NAME}"`);
    await expect(card).toBeVisible();
    await expect(requestItem(page, "Renamed by Relay")).toBeVisible();

    await renameByHand(page, "Renamed by Relay", "Renamed by me");
    await expect(requestItem(page, "Renamed by me")).toBeVisible();

    await card.getByRole("button", { name: "Undo" }).click();

    await expect(card.getByTestId("relay-change-blocked")).toContainText(
      "edited after the change",
    );
    await expect(requestItem(page, "Renamed by me")).toBeVisible();
    await expect(card.getByRole("button", { name: "Undo" })).toBeVisible();
    await snap("04-undo-blocked");
  });

  test("[REL-WRITE-05] A literal bearer token is refused with guidance and a variable is accepted (FR-43, FR-61, AC-7)", async ({
    seededPage: page,
    snap,
  }) => {
    const bearer = (token: string) => ({
      toolName: "set_request_auth",
      input: {
        requestId: TARGET_ID,
        auth: { type: "bearer", token, ...NO_AUTH_FIELDS },
      },
    });
    await openWorkspace(page, [
      { kind: "clientTools", calls: [bearer(LITERAL_TOKEN)] },
      { kind: "clientTools", calls: [bearer("{{token}}")] },
      { kind: "text", text: "Bearer auth now uses your token variable." },
    ]);

    await sendMessage(page, "Add bearer authentication");
    await expect(assistantBubbles(page)).toContainText(
      "Bearer auth now uses your token variable.",
    );

    await expandWorkedGroups(page);
    const refused = toolRows(page).and(page.locator('[data-state="failed"]'));
    await expect(refused).toHaveCount(1);
    await expect(refused.getByTestId("relay-tool-error")).toContainText(
      "environment variable reference",
    );

    // Exactly one card, and its "before" is the untouched auth: the refused attempt wrote nothing.
    await expect(changeCards(page)).toHaveCount(1);
    // The Show details table is gone; the stored change record carries the same before/after.
    const [record] = (await dumpIdbStore(page, "relay_changes")) as {
      before: unknown;
      after: unknown;
    }[];
    expect(JSON.stringify(record.before)).not.toContain("{{token}}");
    expect(JSON.stringify(record.after)).toContain("{{token}}");
    expect(JSON.stringify(record.after)).not.toContain(LITERAL_TOKEN);

    await expect(page.locator("body")).not.toContainText(LITERAL_TOKEN);
    await snap("05-bearer-refused-then-variable");
  });

  test("[REL-WRITE-06] Secret environment values are neither readable nor writable (FR-60, FR-61, AC-8)", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [
          {
            toolName: "get_environment",
            input: { environmentId: RELAY_ENV_ID },
          },
        ],
      },
      {
        kind: "clientTools",
        calls: [
          {
            toolName: "set_env_variables",
            input: {
              environmentId: RELAY_ENV_ID,
              upsert: [
                { key: ENV_SECRET_KEY, value: "overwritten", secret: null },
              ],
              remove: null,
            },
          },
          {
            toolName: "set_env_variables",
            input: {
              environmentId: RELAY_ENV_ID,
              upsert: [{ key: "newSecretToken", value: null, secret: true }],
              remove: null,
            },
          },
        ],
      },
      { kind: "text", text: "Added newSecretToken for you to fill in." },
    ]);

    await sendMessage(page, "Update my secrets");
    await expect(assistantBubbles(page)).toContainText(
      "Added newSecretToken for you to fill in.",
    );

    await expandWorkedGroups(page);
    const refused = toolRows(page).and(page.locator('[data-state="failed"]'));
    await expect(refused).toHaveCount(1);
    await expect(refused.getByTestId("relay-tool-error")).toContainText(
      `"${ENV_SECRET_KEY}" is a secret`,
    );

    await expect(changeCards(page)).toHaveCount(1);
    await expect(page.getByTestId("relay-change-needs-value")).toContainText(
      "newSecretToken",
    );

    const outbound = JSON.stringify(routes.requestBodies);
    expect(outbound).not.toContain(ENV_SECRET_VALUE);
    await expect(page.locator("body")).not.toContainText(ENV_SECRET_VALUE);
    await snap("06-secrets");
  });

  test("[REL-WRITE-07] A tool failure shows a recoverable error card (FR-43, AC-19)", async ({
    seededPage: page,
    snap,
  }) => {
    await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [rename(MISSING_REQUEST_ID, "Never applied")],
      },
      { kind: "text", text: "I could not find that request." },
      { kind: "text", text: "Ready for another try." },
    ]);

    await sendMessage(page, "Rename the missing request");
    await expandWorkedGroups(page);
    const alert = page.getByRole("alert").filter({
      hasText: `request not found: ${MISSING_REQUEST_ID}`,
    });
    await expect(alert).toBeVisible();
    await expect(assistantBubbles(page)).toContainText(
      "I could not find that request.",
    );
    await expect(changeCards(page)).toHaveCount(0);
    await snap("07-tool-failure");

    await sendMessage(page, "Try again");
    await expect(assistantBubbles(page).last()).toContainText(
      "Ready for another try.",
    );
  });

  test("[REL-CHAIN-01] Adding an assertion node after a node can be undone (FR-44, AC-12)", async ({
    seededPage: page,
    snap,
  }) => {
    const getChain = { toolName: "get_chain", input: { chainId: EDIT_CHAIN_ID } };
    const routes = await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [
          {
            toolName: "add_chain_node",
            input: {
              chainId: EDIT_CHAIN_ID,
              block: { ...EMPTY_BLOCK, kind: "assertion", schema: '{"type":"object"}' },
              after: ME_ID,
              afterHandle: null,
            },
          },
        ],
      },
      { kind: "clientTools", calls: [getChain] },
      { kind: "text", text: "Added the assertion." },
      { kind: "clientTools", calls: [getChain] },
      { kind: "text", text: "The chain is back as it was." },
    ]);

    await sendMessage(page, "Add an assertion after the Me request");
    await expect(assistantBubbles(page)).toContainText("Added the assertion.");
    await expandWorkedGroups(page);
    const card = cardFor(page, "Added assertion node");
    await expect(card).toBeVisible();
    const added = readChain(routes.requestBodies);
    expect(added.nodes).toHaveLength(3);
    expect(added.edges).toHaveLength(2);
    await snap("01-assertion-added");

    await card.getByRole("button", { name: "Undo" }).click();
    await expect(card.getByTestId("relay-change-undone")).toBeVisible();

    await sendMessage(page, "Show the chain again");
    await expect(assistantBubbles(page).last()).toContainText(
      "The chain is back as it was.",
    );
    const restored = readChain(routes.requestBodies);
    expect(restored.nodes.map((node) => node.id)).toEqual([LOGIN_ID, ME_ID]);
    expect(restored.edges).toHaveLength(1);
    await snap("01-assertion-undone");
  });

  test("[REL-CHAIN-02] After login, extract the token and call /me (US5, FR-43)", async ({
    seededPage: page,
    snap,
  }) => {
    const addNode = (chainId: string, block: object, after: string | null) => ({
      toolName: "add_chain_node",
      input: { chainId, block: { ...EMPTY_BLOCK, ...block }, after, afterHandle: null },
    });
    const chainIdOf = (bodies: unknown[]) =>
      findOutputField(bodies, "create_chain", "chainId");
    const { routes, proxy } = await openWorkspaceWithProxy(
      page,
      [
        {
          kind: "clientTools",
          calls: [
            { toolName: "create_chain", input: { name: "Login then me", collectionId: null } },
          ],
        },
        {
          kind: "clientTools",
          calls: (bodies) => [
            addNode(chainIdOf(bodies), { kind: "request", requestId: LOGIN_ID }, null),
          ],
        },
        {
          kind: "clientTools",
          calls: (bodies) => [
            addNode(
              chainIdOf(bodies),
              {
                kind: "extract",
                sourceJsonPath: "$.token",
                targetField: "header",
                targetKey: "Authorization",
              },
              LOGIN_ID,
            ),
          ],
        },
        {
          kind: "clientTools",
          calls: (bodies) => [
            addNode(
              chainIdOf(bodies),
              { kind: "request", requestId: ME_ID },
              findOutputField(bodies, "add_chain_node", "nodeId"),
            ),
          ],
        },
        {
          kind: "clientTools",
          calls: (bodies) => [
            { toolName: "get_chain", input: { chainId: chainIdOf(bodies) } },
          ],
        },
        {
          kind: "clientTools",
          calls: (bodies) => [
            {
              toolName: "run_chain",
              input: { chainId: chainIdOf(bodies), fromNodeId: null },
            },
          ],
        },
        {
          kind: "clientTools",
          calls: (bodies) => [
            { toolName: "get_chain_run", input: { chainId: chainIdOf(bodies) } },
          ],
        },
        { kind: "text", text: "Logged in and called me with the token." },
      ],
      (url) => ({
        status: 200,
        statusText: "OK",
        body: url.includes(LOGIN_URL) ? LOGIN_TOKEN_BODY : "{}",
      }),
    );

    await sendMessage(page, "Log in, take the token and call me");

    await expect(changeCards(page)).toHaveCount(4);
    await expect(page.getByTestId("relay-confirm-card")).toBeVisible();
    expect(proxy.requestedUrls).toHaveLength(0);
    await snap("02-built");

    await page.getByTestId("relay-confirm-approve").click();
    await expect(assistantBubbles(page)).toContainText(
      "Logged in and called me with the token.",
    );

    const chainBody = routes.requestBodies[5];
    const built = readChain([chainBody]);
    expect(built.nodes.map((node) => node.type)).toEqual(["request", "request", "display"]);
    const [login, me, extract] = built.nodes.map((node) => node.id);
    expect(built.edges.map((edge) => [edge.from, edge.to])).toEqual([
      [login, extract],
      [extract, me],
    ]);
    expect(proxy.requestedUrls).toHaveLength(2);
    expect(proxy.requestedUrls[0]).toContain(LOGIN_URL);
    expect(proxy.requestedUrls[1]).toContain(ME_URL);
    const run = lastToolOutput(routes.requestBodies, "get_chain_run") as {
      data?: { nodes: { nodeId: string; state: string }[] };
      nodes?: { nodeId: string; state: string }[];
    };
    const states = (run.data ?? run).nodes?.map((node) => [node.nodeId, node.state]);
    expect(states).toContainEqual([extract, "passed"]);
    await snap("02-run");
  });

  test("[REL-CHAIN-03] Deleting a chain node needs Approve and can be undone (AC-9, FR-42)", async ({
    seededPage: page,
    snap,
  }) => {
    const getChain = { toolName: "get_chain", input: { chainId: EDIT_CHAIN_ID } };
    const routes = await openWorkspace(page, [
      {
        kind: "clientTools",
        calls: [
          { toolName: "delete_chain_node", input: { chainId: EDIT_CHAIN_ID, nodeId: ME_ID } },
        ],
      },
      { kind: "text", text: "Removed the Me node." },
      { kind: "clientTools", calls: [getChain] },
      { kind: "text", text: "Both nodes are back." },
    ]);

    await sendMessage(page, "Remove the Me node from the edit chain");
    const confirm = page.getByTestId("relay-confirm-card");
    await expect(confirm).toContainText(ME_NAME);
    await expect(page.getByTestId("relay-confirm-children")).toContainText(
      EDIT_CHAIN_NODE_COUNT,
    );
    expect(routes.requestBodies).toHaveLength(1);
    await snap("03-confirm");

    await page.getByTestId("relay-confirm-approve").click();
    await expect(assistantBubbles(page)).toContainText("Removed the Me node.");
    await expandWorkedGroups(page);
    const card = cardFor(page, `Removed "${ME_NAME}"`);
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Undo" }).click();
    await expect(card.getByTestId("relay-change-undone")).toBeVisible();

    await sendMessage(page, "Show the chain");
    await expect(assistantBubbles(page).last()).toContainText("Both nodes are back.");
    const restored = readChain(routes.requestBodies);
    expect(restored.nodes.map((node) => node.id)).toEqual([LOGIN_ID, ME_ID]);
    expect(restored.edges).toHaveLength(1);
    await snap("03-restored");
  });

  test("[REL-CHAIN-04] Stop aborts an approved chain run (AC-10)", async ({
    seededPage: page,
    snap,
  }) => {
    const { routes, proxy } = await openWorkspaceWithProxy(
      page,
      [
        {
          kind: "clientTools",
          calls: [
            { toolName: "run_chain", input: { chainId: SLOW_CHAIN_ID, fromNodeId: null } },
          ],
        },
        { kind: "text", text: "The run was stopped." },
      ],
      () => ({ status: 200, statusText: "OK", body: "{}" }),
    );

    await sendMessage(page, "Run the slow chain");
    await expect(page.getByTestId("relay-confirm-card")).toContainText(
      "QA E2E Relay - Slow chain",
    );
    expect(proxy.requestedUrls).toHaveLength(0);

    await page.getByTestId("relay-confirm-approve").click();
    await expect.poll(() => proxy.requestedUrls.length).toBe(1);
    await snap("04-waiting");

    await page.getByTestId("relay-stop").click();

    await expect(page.getByTestId("relay-send")).toBeVisible();
    await expect.poll(() => routes.requestBodies.length).toBe(2);
    expect(JSON.stringify(routes.requestBodies[1])).toContain(STOPPED_RUN_STATUS);
    await expect(assistantBubbles(page).last()).toContainText("The run was stopped.");
    expect(proxy.requestedUrls).toHaveLength(1);
    expect(proxy.requestedUrls.join()).not.toContain(ME_URL);
  });
});
