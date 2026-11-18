import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const COLLECTION_ID = "qa-e2e-relayimp-col";
const COLLECTION_TESTID = `collection-item-${COLLECTION_ID}`;
const TABS_STORE = "tabs";
const REQ_A_NAME = "Request A";
const REPLY_TEXT = "Done.";

const GQL = {
  name: "Countries query",
  url: "https://countries.example.com/graphql",
  query: "query Countries { countries { code name } }",
  variables: '{"first": 5}',
  operationName: "Countries",
  headerKey: "X-Trace",
  headerValue: "trace-1",
} as const;
const WS = {
  name: "Echo socket",
  url: "wss://echo.example.com/ws",
  headerKey: "X-Room",
  headerValue: "lobby",
  draft: '{"hello":"world"}',
  newDraft: '{"hello":"changed"}',
} as const;
const SIO = {
  name: "Chat socket",
  url: "https://chat.example.com",
  eventName: "chat:message",
  draft: '{"text":"hi"}',
} as const;
const HTTP = {
  name: "List orders",
  url: "https://api.example.com/orders",
} as const;
const BAD_VARIABLES = "not json at all";

type Call = { toolName: string; input: unknown };

const tabs = (page: Page) => page.getByTestId("tab");
const tabNamed = (page: Page, name: string) =>
  tabs(page).filter({ hasText: name });
const urlInput = (page: Page) => page.getByTestId("url-input");
const messageInput = (page: Page) => page.getByTestId("ws-message-input");
const toolRows = (page: Page) => page.getByTestId("relay-tool-row");

const clientTools = (...calls: Call[]) =>
  ({ kind: "clientTools", calls }) satisfies RelayScript;
const reply = () => ({ kind: "text", text: REPLY_TEXT }) satisfies RelayScript;

const createGraphql = (variables: string | null = GQL.variables): Call => ({
  toolName: "create_graphql_request",
  input: {
    name: GQL.name,
    url: GQL.url,
    query: GQL.query,
    variables,
    operationName: GQL.operationName,
    headers: [{ key: GQL.headerKey, value: GQL.headerValue, enabled: true }],
    auth: null,
  },
});
const createWebsocket = (): Call => ({
  toolName: "create_websocket_request",
  input: {
    name: WS.name,
    url: WS.url,
    headers: [{ key: WS.headerKey, value: WS.headerValue, enabled: true }],
    draft: WS.draft,
  },
});
const createSocketio = (): Call => ({
  toolName: "create_socketio_request",
  input: {
    name: SIO.name,
    url: SIO.url,
    headers: null,
    draft: SIO.draft,
    eventName: SIO.eventName,
  },
});
const updateTab = (
  tabId: string,
  kind: "graphql" | "websocket" | "socketio",
  fields: Record<string, string>,
): Call => ({
  toolName: "update_tab_request",
  input: {
    tabId,
    kind,
    name: null,
    url: null,
    headers: null,
    query: null,
    variables: null,
    operationName: null,
    auth: null,
    draft: null,
    eventName: null,
    ...fields,
  },
});

async function openWorkspace(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

/** The persisted tab id of a tab by name; the DOM does not expose it. */
async function persistedTabId(page: Page, tabName: string): Promise<string> {
  let found = "";
  await expect
    .poll(async () => {
      found = await page.evaluate(
        ({ dbName, store, name }) =>
          new Promise<string>((resolve, reject) => {
            const open = indexedDB.open(dbName);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const all = db.transaction(store).objectStore(store).getAll();
              all.onsuccess = () => {
                db.close();
                const rows = all.result as { tabId: string; name: string }[];
                resolve(rows.find((row) => row.name === name)?.tabId ?? "");
              };
              all.onerror = () => reject(all.error);
            };
          }),
        { dbName: IDB_DB_NAME, store: TABS_STORE, name: tabName },
      );
      return found;
    })
    .not.toBe("");
  return found;
}

async function expectHeader(page: Page, key: string, value: string) {
  await page.getByTestId("request-tab-headers").click();
  // Exactly one header is seeded per scenario, so the first row is the one.
  await expect(page.getByTestId(/row-key-/).first()).toHaveValue(key);
  await expect(page.getByTestId(/row-value-/).first()).toHaveValue(value);
}

async function expectNotConnected(page: Page) {
  await expect(page.getByTestId("connect-btn")).toBeVisible();
  await expect(page.getByTestId("disconnect-btn")).toHaveCount(0);
}

test.describe("Relay GraphQL, WebSocket and Socket.IO tools", () => {
  test("[REL-KIND-01] create_graphql_request opens a graphql tab with query, variables and operationName",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, [clientTools(createGraphql()), reply()]);

      await sendMessage(page, "Create a GraphQL request for countries");

      await expect(tabNamed(page, GQL.name)).toBeVisible();
      await expect(urlInput(page)).toHaveValue(GQL.url);
      const query = page.getByTestId("graphql-query-editor");
      await expect(query).toContainText("query Countries");
      await expect(query).toContainText("countries { code name }");
      await page.getByTestId("request-tab-graphql-variables").click();
      await expect(page.getByTestId("graphql-variables-editor")).toContainText(
        '"first": 5',
      );
      await expectHeader(page, GQL.headerKey, GQL.headerValue);
      // Tab-only: nothing was added to the seeded collection.
      await expect(tabs(page)).toHaveCount(1);
      await expect(
        page.getByTestId(COLLECTION_TESTID).getByTestId("request-item"),
      ).toHaveCount(0);
    },
  );

  test("[REL-KIND-02] create_websocket_request opens a websocket tab with url, headers and draft and does not connect",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, [clientTools(createWebsocket()), reply()]);

      await sendMessage(page, "Create a WebSocket request");

      await expect(tabNamed(page, WS.name)).toBeVisible();
      await expect(urlInput(page)).toHaveValue(WS.url);
      await expect(messageInput(page)).toHaveValue(WS.draft);
      await expectNotConnected(page);
      await expect(page.getByTestId("ws-log-entry")).toHaveCount(0);
      await expectHeader(page, WS.headerKey, WS.headerValue);
    },
  );

  test("[REL-KIND-03] create_socketio_request opens a socketio tab with url, eventName and draft",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, [clientTools(createSocketio()), reply()]);

      await sendMessage(page, "Create a Socket.IO request");

      await expect(tabNamed(page, SIO.name)).toBeVisible();
      await expect(urlInput(page)).toHaveValue(SIO.url);
      await expect(page.getByTestId("socketio-event-input")).toHaveValue(
        SIO.eventName,
      );
      await expect(messageInput(page)).toHaveValue(SIO.draft);
      await expectNotConnected(page);
    },
  );

  test("[REL-KIND-04] update_tab_request edits only the named field and HTTP create_request still creates an HTTP request",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      let tabId = "";
      await openWorkspace(page, [
        clientTools(createWebsocket()),
        reply(),
        {
          kind: "clientTools",
          calls: () => [
            updateTab(tabId, "websocket", { draft: WS.newDraft }),
          ],
        },
        reply(),
        clientTools({
          toolName: "create_request",
          input: {
            collectionId: COLLECTION_ID,
            folderId: null,
            name: HTTP.name,
            method: "GET",
            url: HTTP.url,
            headers: null,
            params: null,
            body: null,
            auth: null,
          },
        }),
        reply(),
      ]);
      await sendMessage(page, "Create a WebSocket request");
      await expect(messageInput(page)).toHaveValue(WS.draft);
      tabId = await persistedTabId(page, WS.name);

      await sendMessage(page, "Change only the draft");

      await expect(messageInput(page)).toHaveValue(WS.newDraft);
      await expect(urlInput(page)).toHaveValue(WS.url);
      await expect(tabNamed(page, WS.name)).toBeVisible();

      await sendMessage(page, "Create an HTTP request for orders");

      // The seeded collection starts collapsed; expand it to see the new row.
      await page
        .getByTestId(COLLECTION_TESTID)
        .getByRole("button")
        .first()
        .click();
      await expect(
        page
          .getByTestId(COLLECTION_TESTID)
          .getByTestId("request-item")
          .filter({ hasText: HTTP.name }),
      ).toBeVisible();
      // create_request only writes to the collection; opening is a user action.
      await page
        .getByTestId(COLLECTION_TESTID)
        .getByTestId("request-item")
        .filter({ hasText: HTTP.name })
        .click();
      await expect(tabNamed(page, HTTP.name)).toBeVisible();
      await expect(urlInput(page)).toHaveValue(HTTP.url);
      await expect(page.getByTestId("send-request-btn")).toBeVisible();
    },
  );

  test("[REL-KIND-05] invalid variables JSON shows a recoverable tool error and leaves the tab unchanged",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      let tabId = "";
      await openWorkspace(page, [
        clientTools(createGraphql()),
        reply(),
        {
          kind: "clientTools",
          calls: () => [
            updateTab(tabId, "graphql", { variables: BAD_VARIABLES }),
          ],
        },
        reply(),
      ]);
      await sendMessage(page, "Create a GraphQL request for countries");
      await expect(tabNamed(page, GQL.name)).toBeVisible();
      tabId = await persistedTabId(page, GQL.name);

      await sendMessage(page, "Set the variables");

      // Finished turns fold their steps behind "Worked for Ns"; open the group.
      const groups = page.getByTestId("relay-worked-group");
      await expect(groups).toHaveCount(2);
      await groups
        .last()
        .getByRole("button")
        .first()
        .click();
      const failed = toolRows(page).and(page.locator('[data-state="failed"]'));
      await expect(failed).toHaveCount(1);
      await expect(page.getByTestId("relay-tool-error")).toContainText(
        /variables/i,
      );
      await expect(page.getByTestId("relay-message-assistant").last()).toContainText(
        REPLY_TEXT,
      );
      await page.getByTestId("request-tab-graphql-variables").click();
      const variables = page.getByTestId("graphql-variables-editor");
      await expect(variables).toContainText('"first": 5');
      await expect(variables).not.toContainText(BAD_VARIABLES);
      await expect(tabs(page)).toHaveCount(1);
    },
  );

  test("[REL-KIND-06] the created WebSocket draft survives switching tabs and back",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWorkspace(page, [clientTools(createWebsocket()), reply()]);
      await sendMessage(page, "Create a WebSocket request");
      await expect(messageInput(page)).toHaveValue(WS.draft);

      const collection = page.getByTestId(COLLECTION_TESTID);
      await collection.getByRole("button").first().click();
      await collection
        .getByTestId("request-item")
        .filter({ hasText: REQ_A_NAME })
        .click();
      await expect(tabNamed(page, REQ_A_NAME)).toBeVisible();
      await expect(messageInput(page)).toHaveCount(0);

      await tabNamed(page, WS.name).click();

      await expect(messageInput(page)).toHaveValue(WS.draft);
      await expect(urlInput(page)).toHaveValue(WS.url);
    },
  );
});
