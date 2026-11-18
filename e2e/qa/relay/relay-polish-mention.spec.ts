import type { Page } from "@playwright/test";
import {
  dragDockToWidth,
  openRelayEditor,
  typeAndSend,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";
import { openTab } from "../../fixtures/qaHelpers";

const WORKSPACE_PATH = "/app";
const DOCK = "relay-dock";
const COMPOSER_BOX = "relay-composer-box";
const GET_USERS = "Get Users";
const GET_USERS_ID = "qa-e2e-mention-get-users";
const MENTION_COLLECTION = "Mention Test Collection";
const RECENTS_KEY = "rq_relay_recent";
const MAX_DOM_ROWS = 30;

const composer = (page: Page) => page.getByTestId("relay-composer");
const mentionMenu = (page: Page) => page.getByTestId("relay-mention-menu");
const mentionRows = (page: Page) => page.getByTestId("relay-mention-option");
const pills = (page: Page) => page.getByTestId("relay-composer-pill");

async function openWithRoutes(
  page: Page,
  ...args: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R
    : never
) {
  const routes = await installRelayRoutes(page, ...args);
  await page.goto(WORKSPACE_PATH);
  await openRelayEditor(page);
  return routes;
}

async function selectGetUsersWithKeyboard(page: Page): Promise<void> {
  await composer(page).pressSequentially("@get-users");
  await expect(mentionMenu(page)).toBeVisible();
  await expect(
    mentionRows(page).filter({ hasText: GET_USERS }).first(),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  // The token becomes an inline pill in the editor, not "@Name " text.
  await expect(pills(page)).toHaveCount(1);
  await expect(composer(page)).toContainText(GET_USERS);
  await expect(mentionMenu(page)).not.toBeVisible();
}

test.describe("Relay Polish: Mention Menu @qa", () => {
  test("[REL-POL-MENTION-01] @ at the start and after a space opens the menu; mid-word a@b does not @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    await composer(page).fill("@");
    await expect(mentionMenu(page)).toBeVisible();
    await snap("01-start");

    await composer(page).clear();
    await composer(page).fill("hello @");
    await expect(mentionMenu(page)).toBeVisible();
    await snap("01-after-space");

    await composer(page).clear();
    await composer(page).fill("a@b");
    await expect(mentionMenu(page)).not.toBeVisible();
    await snap("01-mid-word-no-menu");
  });

  test('[REL-POL-MENTION-02] Current tab is first with the tab name and breadcrumb; with no tab open it is disabled with "No tab open" @critical', async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    await openRelayEditor(page);
    await composer(page).fill("@");
    await expect(mentionMenu(page)).toBeVisible();
    await expect(page.getByText("No tab open")).toBeVisible();
    await snap("02-no-tab");

    await page.getByRole("button", { name: MENTION_COLLECTION }).click();
    await page.getByTestId("request-item").filter({ hasText: GET_USERS }).click();
    await expect(page.getByTestId("url-input")).toBeVisible();
    const toggle = page.getByTestId("relay-toggle");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click();
    }
    await expect(page.getByTestId(DOCK)).toBeVisible();
    await composer(page).click();
    await composer(page).fill("@");
    await expect(mentionMenu(page)).toBeVisible();
    const tabRow = page.locator(
      '[data-testid="relay-mention-option"][data-kind="tab"]',
    );
    await expect(tabRow).toContainText(GET_USERS);
    await expect(tabRow).toContainText(MENTION_COLLECTION);
    await snap("02-with-tab");
  });

  test('[REL-POL-MENTION-03] typing "get" narrows rows; Arrow keys plus Enter or Tab select @critical', async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await composer(page).clear();
    await composer(page).pressSequentially("@get");
    await expect(mentionMenu(page)).toBeVisible();
    const filtered = mentionRows(page).filter({ hasText: /get/i });
    expect(await filtered.count()).toBeGreaterThan(0);
    expect(await mentionRows(page).count()).toBeLessThan(20);
    await snap("03-filtered");

    await composer(page).clear();
    await composer(page).pressSequentially("@get-users");
    await expect(mentionMenu(page)).toBeVisible();
    await expect(
      mentionRows(page).filter({ hasText: GET_USERS }).first(),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(mentionMenu(page)).not.toBeVisible();
    await expect(pills(page)).toHaveCount(1);
    await expect(composer(page)).toContainText(GET_USERS);
    await expect(composer(page)).not.toContainText("@get-users");
    await snap("03-selected");
  });

  test("[REL-POL-MENTION-04] Esc closes the menu and leaves the typed text @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await composer(page).fill("hello @get");
    await expect(mentionMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mentionMenu(page)).not.toBeVisible();
    await expect(composer(page)).toHaveText("hello @get");
    await snap("04-esc-closes");
  });

  test("[REL-POL-MENTION-05] selecting a request inserts '@Name ' and one pill; selecting it again adds no second pill @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await selectGetUsersWithKeyboard(page);
    await expect(pills(page)).toHaveCount(1);
    await expect(pills(page)).toContainText(GET_USERS);
    await snap("05-first-select");

    await composer(page).pressSequentially(" @get-users");
    await page.keyboard.press("Enter");
    await expect(pills(page)).toHaveCount(1);
    await snap("05-dedupe");
  });

  test("[REL-POL-MENTION-06] after Send the /api/relay/chat body contains that request's description @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openWithRoutes(page, { kind: "text", text: "OK" });
    await selectGetUsersWithKeyboard(page);
    await typeAndSend(page, "summarize this request");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
    const body = routes.requestBodies[0] as {
      context: { chips: unknown[] };
      messages: Array<{
        role: string;
        metadata?: {
          attachments?: Array<{ kind: string; id: string; label: string }>;
        };
      }>;
    };
    // Attachments travel with the user message that carried them, never in the shared context (BUG-01).
    expect(body.context.chips).toEqual([]);
    const lastUser = body.messages.filter((m) => m.role === "user").at(-1);
    expect(lastUser?.metadata?.attachments).toEqual([
      expect.objectContaining({
        kind: "request",
        id: GET_USERS_ID,
        label: GET_USERS,
      }),
    ]);
    await snap("06-payload");
  });

  test("[REL-POL-MENTION-07] typing around an inline pill does not detach it; Backspace on the pill removes it @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await selectGetUsersWithKeyboard(page);
    await expect(pills(page)).toHaveCount(1);
    const draft = "draft only";
    await composer(page).pressSequentially(draft);
    await expect(composer(page)).toContainText(draft);
    await expect(pills(page)).toHaveCount(1);
    await snap("07-token-removed-pill-stays");

    // Selecting leaves one trailing space after the pill; erase it and the draft, the pill stays.
    for (let i = 0; i < draft.length + 1; i++) await page.keyboard.press("Backspace");
    await expect(composer(page)).not.toContainText(draft);
    await expect(pills(page)).toHaveCount(1);
    // One more Backspace deletes the pill itself and its attachment.
    await page.keyboard.press("Backspace");
    await expect(pills(page)).toHaveCount(0);
    await expect(composer(page)).not.toContainText(GET_USERS);
    await snap("07-x-strips");
  });

  test("[REL-POL-MENTION-08] the menu is as wide as the composer box at 320, 400 and 480px and never overflows the viewport @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    for (const { viewport, dock } of [
      { viewport: 900, dock: 320 },
      { viewport: 1200, dock: 400 },
      { viewport: 1440, dock: 480 },
    ] as const) {
      await page.setViewportSize({ width: viewport, height: 900 });
      await page.evaluate(() => localStorage.removeItem("rq_relay_width"));
      await page.reload();
      await page.waitForLoadState("load");
      const toggle = page.getByTestId("relay-toggle");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") {
        await toggle.click();
      }
      await expect(page.getByTestId(DOCK)).toBeVisible();
      await dragDockToWidth(page, dock);
      await composer(page).click();
      await composer(page).fill("@");
      await expect(mentionMenu(page)).toBeVisible();
      const menuBox = await mentionMenu(page).boundingBox();
      const box = await page.getByTestId(COMPOSER_BOX).boundingBox();
      expect(menuBox).toBeTruthy();
      expect(box).toBeTruthy();
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport + 2);
      expect(Math.abs(menuBox!.width - box!.width)).toBeLessThan(8);
      await composer(page).clear();
    }
    await snap("08-menu-widths");
  });

  test("[REL-POL-MENTION-09] opening, typing, filtering and selecting produce zero /api/relay/* or other-host requests until Send @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(WORKSPACE_PATH);
    const blocked: string[] = [];
    const appOrigin = new URL(page.url()).origin;
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (
        url.pathname.startsWith("/api/relay/") ||
        url.origin !== appOrigin
      ) {
        blocked.push(req.url());
      }
    });
    await openRelayEditor(page);
    await selectGetUsersWithKeyboard(page);
    expect(blocked).toHaveLength(0);
    await snap("09-no-network-before-send");

    await typeAndSend(page, "go");
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();
    expect(blocked.some((u) => u.includes("/api/relay/chat"))).toBe(true);
    await snap("09-after-send");
  });

  test("[REL-POL-MENTION-10] opening the slash menu closes the mention menu and the reverse @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await composer(page).fill("@");
    await expect(mentionMenu(page)).toBeVisible();
    await composer(page).fill("/");
    await expect(mentionMenu(page)).not.toBeVisible();
    await expect(page.getByTestId("relay-slash-menu")).toBeVisible();
    await snap("10-slash-closes-mention");

    await composer(page).fill("@");
    await expect(mentionMenu(page)).toBeVisible();
    await expect(page.getByTestId("relay-slash-menu")).not.toBeVisible();
    await snap("10-mention-closes-slash");
  });

  test('[REL-POL-MENTION-11] with 200 seeded requests only a window of rows is in the DOM and the list scrolls through them with no truncation footer @medium', async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await composer(page).fill("@");
    await expect(mentionMenu(page)).toBeVisible();
    expect(await mentionRows(page).count()).toBeLessThan(MAX_DOM_ROWS);
    // The footer hint is gone: the list scrolls and virtualizes instead of truncating.
    await expect(page.getByTestId("relay-mention-truncated")).toHaveCount(0);
    const firstLabel = await mentionRows(page).nth(1).innerText();
    await mentionRows(page).nth(1).hover();
    await page.mouse.wheel(0, 4000);
    await expect
      .poll(async () => mentionRows(page).nth(1).innerText())
      .not.toBe(firstLabel);
    expect(await mentionRows(page).count()).toBeLessThan(MAX_DOM_ROWS);
    await snap("11-virtualized");
  });

  test("[REL-POL-MENTION-12] a query with no match shows the no-results row @medium", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await composer(page).fill("@xyzno-match-xyz");
    await expect(mentionMenu(page)).toBeVisible();
    await expect(page.getByTestId("relay-mention-empty")).toBeVisible();
    await snap("12-no-results");
  });

  test("[REL-POL-MENTION-13] the menu is role=listbox, the textarea keeps focus and aria-activedescendant follows the active row @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await composer(page).pressSequentially("@get");
    await expect(mentionMenu(page)).toBeVisible();
    await expect(mentionMenu(page)).toHaveAttribute("role", "listbox");
    await expect(composer(page)).toBeFocused();

    const initialId = await composer(page).getAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(() => composer(page).getAttribute("aria-activedescendant"))
      .not.toBe(initialId);
    const activeId = await composer(page).getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    const activeSelected = await page.evaluate((id) => {
      const el = document.getElementById(id);
      return el?.getAttribute("aria-selected") === "true";
    }, activeId!);
    expect(activeSelected).toBe(true);
    await snap("13-activedescendant");
  });

  test("[REL-POL-MENTION-14] attaching writes names and ids only to rq_relay_recent and survives a reload @medium", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await selectGetUsersWithKeyboard(page);
    const stored = await page.evaluate((key) => localStorage.getItem(key), RECENTS_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!) as Array<Record<string, unknown>>;
    expect(parsed[0]).toEqual({
      kind: "request",
      id: GET_USERS_ID,
      name: GET_USERS,
    });
    for (const item of parsed) {
      expect(Object.keys(item).sort()).toEqual(["id", "kind", "name"]);
    }
    await snap("14-recents");

    await page.reload();
    await page.waitForLoadState("load");
    const after = await page.evaluate((key) => localStorage.getItem(key), RECENTS_KEY);
    expect(after).toBe(stored);
    await snap("14-after-reload");
  });
});
