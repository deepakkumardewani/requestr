import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const HISTORY_STORE = "history";
const REQUEST_ID = "qa-e2e-relayimp-req-a";
const REQUEST_URL = "https://example.com/api/request-a";
const NEWEST_TIMESTAMP = 1_800_000_000_000;
const OLDER_TIMESTAMP = 1_700_000_000_000;

type StoredResponse = { status: number; body: unknown };

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");

const diffResponses = (): RelayScript => ({
  kind: "readTool",
  toolName: "diff_responses",
  input: { requestId: REQUEST_ID, a: 0, b: 1 },
});

function historyEntry(
  id: string,
  timestamp: number,
  { status, body }: StoredResponse
) {
  return {
    id,
    method: "GET",
    url: REQUEST_URL,
    status,
    duration: 12,
    size: 64,
    timestamp,
    request: { requestId: REQUEST_ID },
    response: {
      status,
      statusText: "",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      duration: 12,
      size: 64,
      url: REQUEST_URL,
      method: "GET",
      timestamp,
    },
  };
}

/** Stores two responses (newest first) for the seeded request, then reloads so the app hydrates them. */
async function openWithStoredResponses(
  page: Page,
  newest: StoredResponse,
  older: StoredResponse,
  scripts: RelayScript[]
) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await page.evaluate(
    ({ dbName, store, entries }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(store, "readwrite");
          entries.forEach((entry) => tx.objectStore(store).put(entry));
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    {
      dbName: IDB_DB_NAME,
      store: HISTORY_STORE,
      entries: [
        historyEntry("qa-e2e-smartdiff-new", NEWEST_TIMESTAMP, newest),
        historyEntry("qa-e2e-smartdiff-old", OLDER_TIMESTAMP, older),
      ],
    }
  );
  await page.reload();
  await openRelay(page);
  return routes;
}

test.describe("Relay smart tools: response diff", () => {
  test("[REL-SMART-03] diff_responses reports the differing status and a changed body field",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWithStoredResponses(
        page,
        { status: 500, body: { ok: false, count: 3 } },
        { status: 200, body: { ok: true, count: 3 } },
        [diffResponses(), { kind: "text", text: "Status and ok differ." }]
      );

      await sendMessage(page, "what changed between the last two runs?");

      await expect(assistantBubbles(page)).toContainText(
        "Status and ok differ."
      );
      await expect(page.getByTestId("relay-tool-row")).toHaveAttribute(
        "data-state",
        "done"
      );
      await snap("03-diff-reported");

      expect(routes.requestBodies).toHaveLength(2);
      const followUp = JSON.stringify(routes.requestBodies[1]);
      expect(followUp).toMatch(/identical\\*":false/);
      expect(followUp).toMatch(/status\\*":\{\\*"a\\*":500,\\*"b\\*":200\}/);
      expect(followUp).toContain("$.ok");
      expect(followUp).not.toContain("$.count");
    }
  );

  test("[REL-SMART-07] two identical responses report no differences",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const same: StoredResponse = { status: 200, body: { ok: true } };
      const routes = await openWithStoredResponses(page, same, same, [
        diffResponses(),
        { kind: "text", text: "The two responses are identical." },
      ]);

      await sendMessage(page, "compare the last two runs");

      await expect(assistantBubbles(page)).toContainText(
        "The two responses are identical."
      );
      await expect(page.getByTestId("relay-tool-row")).toHaveAttribute(
        "data-state",
        "done"
      );
      await snap("07-identical");

      expect(routes.requestBodies).toHaveLength(2);
      expect(JSON.stringify(routes.requestBodies[1])).toMatch(
        /identical\\*":true/
      );
    }
  );
});
