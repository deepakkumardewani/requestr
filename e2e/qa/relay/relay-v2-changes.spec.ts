import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";

const WORKSPACE_PATH = "/app";
const ANSWER = "Created everything you asked for.";
const ROW_COUNT = 4;

const summary = (page: Page) => page.getByTestId("relay-changes-summary");
const rows = (page: Page) => page.getByTestId("relay-changes-row");
const changeCards = (page: Page) => page.getByTestId("relay-change-card");
const workedGroup = (page: Page) => page.getByTestId("relay-worked-group");
const rowFor = (page: Page, label: string) =>
  rows(page).filter({ hasText: label });
const openButton = (row: ReturnType<typeof rowFor>) =>
  row.getByRole("button", { name: "Open" });

type Names = {
  collection: string;
  request: string;
  chain: string;
  environment: string;
};

function uniqueNames(): Names {
  const stamp = Date.now();
  return {
    collection: `Changes col ${stamp}`,
    request: `Changes req ${stamp}`,
    chain: `Changes chain ${stamp}`,
    environment: `Changes env ${stamp}`,
  };
}

/** The first string `field` found in the latest `toolName` output the client sent back. */
function outputField(bodies: unknown[], toolName: string, field: string) {
  const body = bodies.at(-1) as { messages?: unknown[] };
  const parts = (body.messages ?? []).flatMap(
    (message) => (message as { parts?: unknown[] }).parts ?? [],
  ) as { type?: string; output?: unknown }[];
  const output = parts.filter((p) => p.type === `tool-${toolName}`).at(-1)
    ?.output;
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

/** Opens the app, scripts one turn that creates all four entities, and sends it. */
async function runChangesTurn(page: Page, names: Names) {
  await installRelayRoutes(page, [
    {
      kind: "clientTools",
      calls: [
        {
          toolName: "create_collection",
          input: { name: names.collection, parentId: null },
        },
        {
          toolName: "create_chain",
          input: { name: names.chain, collectionId: null },
        },
        {
          toolName: "create_environment",
          input: { name: names.environment, variables: null },
        },
      ],
    },
    {
      kind: "clientTools",
      calls: (bodies) => [
        {
          toolName: "create_request",
          input: {
            collectionId: outputField(bodies, "create_collection", "collectionId"),
            folderId: null,
            name: names.request,
            method: "GET",
            url: "https://api.example.com/changes",
            headers: null,
            params: null,
            body: null,
            auth: null,
          },
        },
      ],
    },
    { kind: "text", text: ANSWER },
  ]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, "Create a request, chain, collection and environment");
  await expect(summary(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(ROW_COUNT);
}

test.describe("Relay v2 changes summary @qa", () => {
  test("[REL-V2-CHANGES-01] a mocked agent creates a request, chain, collection and environment; the summary shows one row per entity with an Open button",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const names = uniqueNames();
      await runChangesTurn(page, names);

      await expect(page.getByText(ANSWER)).toBeVisible();
      await expect(page.getByTestId("relay-changes-headline")).toHaveText(
        "Created 1 request, 1 chain, 1 collection, 1 environment",
      );
      for (const label of Object.values(names)) {
        const row = rowFor(page, label);
        await expect(row).toHaveCount(1);
        await expect(row).toHaveAttribute("data-op", "created");
        await expect(openButton(row)).toBeEnabled();
      }
      await expect(summary(page).getByRole("button", { name: "Undo all" })).toBeVisible();
      await snap("01-summary-four-rows");
    },
  );

  test("[REL-V2-CHANGES-02] each Open navigates to the right route",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const names = uniqueNames();
      await runChangesTurn(page, names);

      await openButton(rowFor(page, names.request)).click();
      await expect(
        page.getByTestId("tab").filter({ hasText: names.request }),
      ).toBeVisible();

      // /environments is a server redirect to /app, so the URL only passes
      // through it; the request is the stable proof that Open targeted it.
      const environmentsRequest = page.waitForRequest((request) =>
        /\/environments\/?(\?|$)/.test(request.url()),
      );
      await openButton(rowFor(page, names.environment)).click();
      await environmentsRequest;
      await expect(page).toHaveURL(/\/app\/?$/);
      await snap("02-opened-environment");

      await openButton(rowFor(page, names.collection)).click();
      await expect(page).toHaveURL(/\/app\/?$/);

      await openButton(rowFor(page, names.chain)).click();
      await expect(page).toHaveURL(/\/chain\/[^/]+$/);
    },
  );

  test("[REL-V2-CHANGES-03] Undo all reverts them and the summary shows them as undone with Open disabled and a tooltip",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const names = uniqueNames();
      await runChangesTurn(page, names);

      await summary(page).getByRole("button", { name: "Undo all" }).click();

      await expect(rows(page)).toHaveCount(ROW_COUNT);
      for (let index = 0; index < ROW_COUNT; index += 1) {
        const row = rows(page).nth(index);
        await expect(openButton(row)).toBeDisabled();
        await expect(row.getByTestId("relay-changes-reason")).toHaveText("Undone");
        await expect(openButton(row)).toHaveAccessibleDescription("Undone");
      }
      await expect(summary(page).getByRole("button", { name: "Undo all" })).toHaveCount(0);
      await snap("03-undone");
    },
  );

  test("[REL-V2-CHANGES-04] a deleted entity shows a disabled Open with the Deleted reason",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const names = uniqueNames();
      await runChangesTurn(page, names);

      await page
        .getByTestId("collection-item")
        .filter({ hasText: names.collection })
        .or(page.locator('[data-testid^="collection-item-"]').filter({ hasText: names.collection }))
        .first()
        .click();
      const item = page.getByTestId("request-item").filter({ hasText: names.request });
      await item.hover();
      await item.getByTestId("request-item-more-btn").click();
      await page.getByTestId("request-delete-btn").click();
      await page.getByRole("alertdialog").getByRole("button", { name: /delete/i }).click();

      // No reload: the summary must react live to the sidebar deletion.
      await expect(item).toHaveCount(0);
      await expect(summary(page)).toBeVisible();
      const row = rowFor(page, names.request);
      await expect(row).toHaveCount(1);
      await expect(row.getByTestId("relay-changes-reason")).toHaveText("Deleted");
      await expect(openButton(row)).toBeDisabled();
      await expect(openButton(rowFor(page, names.chain))).toBeEnabled();
      await snap("04-deleted-open-disabled");
    },
  );

  test("[REL-V2-CHANGES-05] per-change cards appear only inside the expanded Worked group",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      const names = uniqueNames();
      await runChangesTurn(page, names);

      await expect(workedGroup(page)).toBeVisible();
      await expect(changeCards(page)).toHaveCount(0);

      await workedGroup(page).getByRole("button").first().click();
      const body = page.getByTestId("relay-worked-group-body");
      await expect(body.getByTestId("relay-change-card")).toHaveCount(ROW_COUNT);
      await expect(changeCards(page)).toHaveCount(ROW_COUNT);
      await snap("05-cards-in-worked-group");

      await workedGroup(page).getByRole("button").first().click();
      await expect(changeCards(page)).toHaveCount(0);
      await expect(rows(page)).toHaveCount(ROW_COUNT);
    },
  );
});
