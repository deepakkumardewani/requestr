import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";

const WORKSPACE_PATH = "/app";
const PERM_KEY = "rq_relay_permission_mode";
const PERMISSION_MODES = ["always-ask", "review", "skip"] as const;
const COLLECTION_ID = "qa-v2nav-col";
const OUTER_FOLDER_ID = "qa-v2nav-folder-outer";
const INNER_FOLDER_ID = "qa-v2nav-folder-inner";
const DEEP_REQUEST_NAME = "TOOLNAV Deep request";

/** open_page targets and the route each one lands on. */
const PAGE_ROUTES = [
  { page: "settings", url: /\/settings\/?$/ },
  { page: "import", url: /\/import\/?$/ },
  // /environments is a server redirect to /app, so the URL may be either while it settles.
  { page: "environments", url: /\/(environments|app)\/?$/ },
  { page: "json-compare", url: /\/json-compare\/?$/ },
  { page: "json-visualize", url: /\/json-visualize\/?$/ },
  { page: "transform", url: /\/transform\/?$/ },
] as const;

const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");
const sidebarTab = (page: Page, name: RegExp) =>
  page.getByRole("tab", { name });

/** One scripted turn: the client runs `toolName`, then the model answers with `done`. */
function turn(toolName: string, input: unknown, done: string): RelayScript[] {
  return [
    { kind: "clientTools", calls: [{ toolName, input }] },
    { kind: "text", text: done },
  ];
}

async function openWorkspace(
  page: Page,
  scripts: RelayScript[],
  mode?: string,
) {
  if (mode) {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [PERM_KEY, mode] as const,
    );
  }
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

/** The `href` each open_page call returned, read from the tool results the client sent back. */
function openPageHrefs(bodies: unknown[]): string[] {
  const parts = (bodies.at(-1) as { messages?: { parts?: unknown[] }[] }).messages
    ?.flatMap((message) => message.parts ?? []) as
    | { type?: string; output?: { data?: { href?: string } } }[]
    | undefined;
  return (parts ?? [])
    .filter((part) => part.type === "tool-open_page")
    .map((part) => part.output?.data?.href ?? "");
}

async function askAndAwait(page: Page, prompt: string, done: string) {
  await sendMessage(page, prompt);
  await expect(page.getByText(done, { exact: true })).toBeVisible();
}

test.describe("Relay v2 navigation tools @qa", () => {
  test("[REL-V2-TOOLNAV-01] open_page navigates to each of /settings, /import, /environments, /json-compare, /json-visualize and /transform",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const scripts = PAGE_ROUTES.flatMap(({ page: target }) =>
        turn("open_page", { page: target, section: null }, `Opened ${target}.`),
      );
      const routes = await openWorkspace(page, scripts);

      for (const { page: target, url } of PAGE_ROUTES) {
        await askAndAwait(page, `Take me to ${target}`, `Opened ${target}.`);
        await expect(page).toHaveURL(url);
      }
      // Each tool result is sent back before the reply, so the last request carries all six.
      expect(openPageHrefs(routes.requestBodies)).toEqual(
        PAGE_ROUTES.map(({ page: target }) => `/${target}`),
      );
      await snap("01-last-page-transform");
    },
  );

  test("[REL-V2-TOOLNAV-02] open_page with the workspace home target lands on /app",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openWorkspace(page, [
        ...turn("open_page", { page: "import", section: null }, "At import."),
        ...turn("open_page", { page: "app", section: null }, "Back home."),
      ]);

      await askAndAwait(page, "Go to import", "At import.");
      await expect(page).toHaveURL(/\/import\/?$/);
      await askAndAwait(page, "Go home", "Back home.");
      await expect(page).toHaveURL(/\/app\/?$/);
      await expect(page.getByTestId("sidebar-tab-collections")).toBeVisible();
      await snap("02-workspace-home");
    },
  );

  test("[REL-V2-TOOLNAV-03] show_sidebar_tab switches to collections, history and hub",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const tabs = [
        { tab: "history", name: /history/i },
        { tab: "hub", name: /hub/i },
        { tab: "collections", name: /collections/i },
      ] as const;
      await openWorkspace(
        page,
        tabs.flatMap(({ tab }) => turn("show_sidebar_tab", { tab }, `Showing ${tab}.`)),
      );
      await expect(sidebarTab(page, /collections/i)).toHaveAttribute(
        "aria-selected",
        "true",
      );

      for (const { tab, name } of tabs) {
        await askAndAwait(page, `Show ${tab}`, `Showing ${tab}.`);
        await expect(sidebarTab(page, name)).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await snap(`03-tab-${tab}`);
      }
    },
  );

  test("[REL-V2-TOOLNAV-04] open_item opens a folder's collection and expands it",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openWorkspace(
        page,
        turn("open_item", { kind: "folder", id: INNER_FOLDER_ID }, "Opened the folder."),
      );
      const collection = page.getByTestId(`collection-item-${COLLECTION_ID}`);
      await expect(collection).toBeVisible();
      await expect(page.getByText(DEEP_REQUEST_NAME)).toHaveCount(0);
      await expect(page.getByTestId(`folder-item-${OUTER_FOLDER_ID}`)).toHaveCount(0);

      await askAndAwait(page, "Open the inner folder", "Opened the folder.");

      await expect(page).toHaveURL(/\/app\/?$/);
      await expect(page.getByTestId(`folder-item-${OUTER_FOLDER_ID}`)).toBeVisible();
      await expect(page.getByTestId(`folder-item-${INNER_FOLDER_ID}`)).toBeVisible();
      await expect(page.getByText(DEEP_REQUEST_NAME)).toBeVisible();
      await snap("04-folder-expanded");
    },
  );

  test("[REL-V2-TOOLNAV-05] navigation tools run without an approval card in every permission mode",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      const scripts = PERMISSION_MODES.flatMap((mode) => [
        ...turn("show_sidebar_tab", { tab: "history" }, `History in ${mode}.`),
        ...turn("open_page", { page: "import", section: null }, `Import in ${mode}.`),
        ...turn("open_page", { page: "app", section: null }, `Home in ${mode}.`),
      ]);
      await openWorkspace(page, scripts);

      for (const mode of PERMISSION_MODES) {
        await page.getByTestId("relay-permission-trigger").click();
        await page.getByTestId(`relay-permission-option-${mode}`).click();
        await expect
          .poll(() => page.evaluate((key) => localStorage.getItem(key), PERM_KEY))
          .toBe(mode);

        await askAndAwait(page, `Show history ${mode}`, `History in ${mode}.`);
        await expect(sidebarTab(page, /history/i)).toHaveAttribute("aria-selected", "true");
        await expect(confirmCard(page)).toHaveCount(0);

        await askAndAwait(page, `Open import ${mode}`, `Import in ${mode}.`);
        await expect(page).toHaveURL(/\/import\/?$/);
        await expect(confirmCard(page)).toHaveCount(0);
        await snap(`05-no-approval-${mode}`);

        await askAndAwait(page, `Go home ${mode}`, `Home in ${mode}.`);
        await expect(page).toHaveURL(/\/app\/?$/);
      }
    },
  );
});
