import type { Page } from "@playwright/test";
import { buildSystemPrompt } from "@/lib/relay/server/systemPrompt";
import {
  enabledToolNames,
  type TurnMessage,
} from "@/lib/relay/tools/loadTools";
import { expect, test } from "../../fixtures/qa";
import {
  expandWorkedGroups,
  openList,
  openRelay,
  putThreads,
  runtimeThread,
  sendMessage,
  WORKSPACE_PATH,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { downloadCapture, dumpIdbStore } from "../../fixtures/relayV2Helpers";

const PERM_KEY = "rq_relay_permission_mode";
const CATALOG_SLUG = "checkouts";
const CATALOG_NAME = "BigCommerce (Checkouts)";
const UNKNOWN_SLUG = "qa-hh-m09-no-such-provider";
const LEGACY_THREAD_TITLE = "QA HH-M18 legacy thread";
const LEGACY_REPLY = "Removed the old request for you.";
const LOAD_TOOLS_FIRST = "load_tools_first";

// Literal expectations, deliberately not derived from the app's own grouping.
const LITERAL_CORE_TOOLS = [
  "get_workspace_summary",
  "search_workspace",
  "get_request",
  "get_collection",
  "list_environments",
  "get_environment",
  "get_active_context",
  "get_last_response",
  "get_chain",
  "get_chain_run",
  "get_tab_request",
  "list_history",
  "load_tools",
  "diff_responses",
  "generate_docs",
  "ask_user",
];
const LITERAL_TRANSFER_TOOLS = [
  "export_postman",
  "list_api_catalog",
  "import_api_catalog",
  "import_curl",
  "export_curl",
  "export_history",
];

type ToolCall ={ toolName: string; input: unknown };
type WirePart = { type?: string; output?: unknown; errorText?: string };
type WireMessage = {
  role?: string;
  metadata?: unknown;
  parts?: WirePart[];
};
type ChatBody = { messages?: WireMessage[] };

const clientTools = (...calls: ToolCall[]) =>
  // This spec scripts every load_tools call itself, so the fixture must not add one.
  ({ kind: "clientTools", calls, loadTools: false }) satisfies RelayScript;
const reply = (text: string) => ({ kind: "text", text }) satisfies RelayScript;

const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");
const approve = (page: Page) => page.getByTestId("relay-confirm-approve");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");

async function openWorkspace(
  page: Page,
  scripts: RelayScript[],
  mode: "review" | "skip" = "review",
) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PERM_KEY, mode] as const,
  );
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

/** The tool results the client sent back, as the model would read them in the latest request. */
function sentParts(bodies: unknown[], toolName: string): WirePart[] {
  const body = bodies.at(-1) as ChatBody | undefined;
  return (body?.messages ?? [])
    .flatMap((message) => message.parts ?? [])
    .filter((part) => part.type === `tool-${toolName}`);
}

const partText = (part: WirePart | undefined) =>
  JSON.stringify(part?.output ?? part?.errorText ?? null);

const collectionNames = async (page: Page) =>
  ((await dumpIdbStore(page, "collections")) as { name: string }[]).map(
    (row) => row.name,
  );

test.describe("Relay tool surface and old threads @qa", () => {
  test(
    "slash command loads only its topic: the captured chat request body has the core set plus that group (HH-M03)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWorkspace(page, [reply("One."), reply("Two.")]);

      // A plain turn first: it is the control that shows the group is not always on.
      await sendMessage(page, "Hello there");
      await expect.poll(() => routes.requestBodies.length).toBe(1);
      await expect(assistantBubbles(page).last()).toContainText("One.");

      await page.getByTestId("relay-composer").fill("/export");
      await page
        .getByTestId("relay-slash-option")
        .and(page.locator('[data-command="export"]'))
        .click();
      await expect(page.getByTestId("relay-command-pill")).toHaveAttribute(
        "data-command",
        "export",
      );
      await page.getByTestId("relay-send").click();
      await expect.poll(() => routes.requestBodies.length).toBe(2);
      await expect(assistantBubbles(page).last()).toContainText("Two.");

      const plain = (routes.requestBodies[0] as ChatBody).messages ?? [];
      const slash = (routes.requestBodies[1] as ChatBody).messages ?? [];
      const slashTurn = slash.findLast((message) => message.role === "user");
      expect(slashTurn?.metadata).toMatchObject({ slashCommand: "export" });

      // The server derives its tool list from exactly these messages.
      const plainSet = enabledToolNames(plain as TurnMessage[]);
      const slashSet = enabledToolNames(slash as TurnMessage[]);
      expect([...plainSet].sort()).toEqual([...LITERAL_CORE_TOOLS].sort());
      expect([...slashSet].sort()).toEqual(
        [...LITERAL_CORE_TOOLS, ...LITERAL_TRANSFER_TOOLS].sort(),
      );
      expect(slashSet.has("export_history")).toBe(true);
      expect(slashSet.has("create_collection")).toBe(false);
      expect(slashSet.has("delete_collection")).toBe(false);
      await snap("01-slash-export");
    },
  );

  test(
    "an old seeded thread with a removed tool name (delete_request) renders without errors (HH-M18)",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openWorkspace(page, [reply("unused")]);
      await putThreads(page, [
        runtimeThread(18, 0, {
          title: LEGACY_THREAD_TITLE,
          messages: [
            {
              id: "qa-hh-m18-user",
              role: "user",
              parts: [{ type: "text", text: "Delete the old request" }],
            },
            {
              id: "qa-hh-m18-assistant",
              role: "assistant",
              parts: [
                { type: "step-start" },
                {
                  type: "tool-delete_request",
                  toolCallId: "qa-hh-m18-call",
                  state: "output-available",
                  input: { ids: ["qa-hh-m18-gone"] },
                  output: { ok: true, data: { deleted: 1 } },
                },
                { type: "step-start" },
                { type: "text", text: LEGACY_REPLY },
              ],
            },
          ],
        }),
      ]);

      await openList(page);
      await page
        .getByTestId("relay-thread-item")
        .filter({ hasText: LEGACY_THREAD_TITLE })
        .getByTestId("relay-thread-select")
        .click();

      await expect(page.getByTestId("relay-title")).toHaveText(
        LEGACY_THREAD_TITLE,
      );
      await expect(page.getByTestId("relay-message-user")).toHaveText(
        "Delete the old request",
      );
      await expect(assistantBubbles(page).last()).toContainText(LEGACY_REPLY);
      await expandWorkedGroups(page);
      await snap("02-legacy-thread");
    },
  );

  test(
    "catalog import: list_api_catalog then import succeeds, a second import is refused, an unknown slug shows an error and no card (HH-M00, HH-M09)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const done = "Catalog steps finished.";
      const routes = await openWorkspace(page, [
        clientTools(
          { toolName: "load_tools", input: { topic: "transfer" } },
          {
            toolName: "list_api_catalog",
            input: { query: CATALOG_SLUG, offset: null, limit: null },
          },
        ),
        clientTools({
          toolName: "import_api_catalog",
          input: { slug: CATALOG_SLUG },
        }),
        clientTools({
          toolName: "import_api_catalog",
          input: { slug: CATALOG_SLUG },
        }),
        clientTools({
          toolName: "import_api_catalog",
          input: { slug: UNKNOWN_SLUG },
        }),
        reply(done),
      ]);
      await sendMessage(page, "Import the BigCommerce checkouts API");

      // 1. The listing reaches the model with the importable slug.
      await expect.poll(() => routes.requestBodies.length).toBe(2);
      const listed = partText(sentParts(routes.requestBodies, "list_api_catalog")[0]);
      expect(listed).toContain(`"slug":"${CATALOG_SLUG}"`);
      expect(listed).toContain('"imported":false');

      // 2. The import asks first and writes nothing until Approve.
      await expect(confirmCard(page)).toBeVisible();
      await expect(confirmCard(page)).toContainText(CATALOG_SLUG);
      expect(await collectionNames(page)).not.toContain(CATALOG_NAME);
      await snap("03-catalog-card");
      await approve(page).click();
      await expect.poll(() => collectionNames(page)).toContain(CATALOG_NAME);

      // 3. The second import and the unknown slug fail before any card shows.
      await expect(assistantBubbles(page).last()).toContainText(done);
      await expect(confirmCard(page)).toHaveCount(0);
      const imports = sentParts(routes.requestBodies, "import_api_catalog");
      expect(imports).toHaveLength(3);
      expect(partText(imports[0])).toMatch(/"requestCount":\d+/);
      expect(partText(imports[1])).toContain(`already imported: ${CATALOG_SLUG}`);
      expect(partText(imports[2])).toContain(
        `not a catalog provider: ${UNKNOWN_SLUG}`,
      );
      const names = await collectionNames(page);
      expect(names.filter((name) => name === CATALOG_NAME)).toHaveLength(1);
      expect(names.some((name) => name.includes(UNKNOWN_SLUG))).toBe(false);
      await expandWorkedGroups(page);
      await expect(
        page
          .getByTestId("relay-change-card")
          .filter({ hasText: CATALOG_NAME }),
      ).toHaveCount(1);
      await snap("03-catalog-refusals");
    },
  );

  test(
    "a model call to a tool outside the enabled set shows the load_tools_first result, then load_tools unlocks it (HH-M03)",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const done = "History export finished.";
      const routes = await openWorkspace(
        page,
        [
          clientTools({ toolName: "export_history", input: { format: "json" } }),
          clientTools({ toolName: "load_tools", input: { topic: "transfer" } }),
          clientTools({ toolName: "export_history", input: { format: "json" } }),
          reply(done),
        ],
        "skip",
      );

      await sendMessage(page, "Export my history");

      await expect.poll(() => routes.requestBodies.length).toBeGreaterThan(1);
      const first = sentParts([routes.requestBodies[1]], "export_history");
      expect(partText(first[0])).toContain(LOAD_TOOLS_FIRST);
      expect(partText(first[0])).toContain('load_tools with topic \\"transfer\\"');
      await snap("04-load-tools-first");

      await expect(assistantBubbles(page).last()).toContainText(done);
      const final = sentParts(routes.requestBodies, "export_history");
      expect(partText(final.at(-1))).not.toContain(LOAD_TOOLS_FIRST);
      expect(partText(final.at(-1))).toContain('"ok":true');
    },
  );

  test(
    '"export my history" is answered in scope (HH-M27)',
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const done = "Exported your history.";
      const routes = await openWorkspace(
        page,
        [
          clientTools(
            { toolName: "load_tools", input: { topic: "transfer" } },
            { toolName: "export_history", input: { format: "json" } },
          ),
          reply(done),
        ],
        "skip",
      );

      const download = await downloadCapture(page, async () => {
        await sendMessage(page, "export my history");
      });

      await expect(assistantBubbles(page).last()).toContainText(done);
      expect(download.filename).toMatch(/history/i);
      expect(Array.isArray(download.json())).toBe(true);
      expect(
        partText(sentParts(routes.requestBodies, "export_history")[0]),
      ).toContain('"ok":true');

      // The prompt the server sends names history export as in scope, and the
      // request carries the message the server judges.
      expect(buildSystemPrompt()).toContain('"export my history"');
      const body = routes.requestBodies[0] as ChatBody;
      expect(JSON.stringify(body.messages?.[0]?.parts)).toContain(
        "export my history",
      );
      await snap("05-export-history");
    },
  );
});
