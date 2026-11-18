import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "@/lib/idbSchema";
import {
  SLASH_COMMANDS,
  SLASH_GROUP_ORDER,
} from "@/lib/relay/slashCommands";
import {
  attachFromPicker,
  dragDockToWidth,
  openRelayEditor,
  typeAndSend,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes, lastUserText } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";
const WORKSPACE_PATH = "/app";
const DOCK = "relay-dock";
const GET_USERS = "Get Users";
const MENTION_COLLECTION = "Mention Test Collection";

const composer = (page: Page) => page.getByTestId("relay-composer");
const slashMenu = (page: Page) => page.getByTestId("relay-slash-menu");
const slashOptions = (page: Page) => page.getByTestId("relay-slash-option");
const mentionMenu = (page: Page) => page.getByTestId("relay-mention-menu");
const pills = (page: Page) => page.getByTestId("relay-composer-pill");
const commandPills = (page: Page) => page.getByTestId("relay-command-pill");

const GROUP_LABELS_EN: Record<(typeof SLASH_GROUP_ORDER)[number], string> = {
  understand: "Understand",
  build: "Build",
  test: "Test",
  run: "Run",
  share: "Share",
  chat: "Chat",
};

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

async function setAppLocale(
  page: Page,
  locale: "en" | "fr" | "ja",
): Promise<void> {
  await page.evaluate(
    async ({ dbName, locale: nextLocale }) => {
      const openDb = (): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const db = await openDb();
      const existing = await new Promise<Record<string, unknown> | undefined>(
        (resolve) => {
          const tx = db.transaction("settings", "readonly");
          const getReq = tx.objectStore("settings").get("app");
          getReq.onsuccess = () =>
            resolve(getReq.result as Record<string, unknown> | undefined);
        },
      );
      db.close();
      const writeDb = await openDb();
      const writeTx = writeDb.transaction("settings", "readwrite");
      writeTx.objectStore("settings").put({ ...existing, locale: nextLocale }, "app");
      await new Promise<void>((resolve, reject) => {
        writeTx.oncomplete = () => resolve();
        writeTx.onerror = () => reject(writeTx.error);
      });
      writeDb.close();
    },
    { dbName: IDB_DB_NAME, locale },
  );
  await page.reload();
  await page.waitForLoadState("load");
  const toggle = page.getByTestId("relay-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId(DOCK)).toBeVisible();
}

async function openGetUsersTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: MENTION_COLLECTION }).click();
  await page.getByTestId("request-item").filter({ hasText: GET_USERS }).click();
  await expect(page.getByTestId("url-input")).toBeVisible();
  const toggle = page.getByTestId("relay-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId(DOCK)).toBeVisible();
  await composer(page).click();
}

async function selectSlash(page: Page, typed: string): Promise<void> {
  await composer(page).fill(typed.startsWith("/") ? typed : `/${typed}`);
  await page.keyboard.press("Enter");
}

test.describe("Relay Polish: Slash actions @qa", () => {
  test("[REL-POL-SLASH-01] typing / lists 15 commands in the six groups Understand, Build, Test, Run, Share, Chat in order @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await composer(page).fill("/");
    await expect(slashMenu(page)).toBeVisible();

    const groups = page.getByTestId("relay-slash-group");
    await expect(groups).toHaveCount(SLASH_GROUP_ORDER.length);
    for (let i = 0; i < SLASH_GROUP_ORDER.length; i++) {
      await expect(groups.nth(i)).toHaveAttribute(
        "data-group",
        SLASH_GROUP_ORDER[i],
      );
      await expect(groups.nth(i)).toContainText(
        GROUP_LABELS_EN[SLASH_GROUP_ORDER[i]],
      );
    }

    const options = slashOptions(page);
    await expect(options).toHaveCount(SLASH_COMMANDS.length);
    for (let i = 0; i < SLASH_COMMANDS.length; i++) {
      await expect(options.nth(i)).toContainText(SLASH_COMMANDS[i].name);
    }
    await snap("01-all-commands");
  });

  test("[REL-POL-SLASH-02] typing /ru shows only /run; typing a word from a description also filters @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    await composer(page).fill("/ru");
    await expect(slashOptions(page)).toHaveCount(1);
    await expect(slashOptions(page)).toContainText("/run");

    await composer(page).fill("/assertions");
    await expect(slashOptions(page)).toHaveCount(1);
    await expect(slashOptions(page)).toContainText("/assert");
    await snap("02-filter-prefix-and-description");
  });

  test('[REL-POL-SLASH-03] /run with nothing attached opens the mention menu with the hint "Pick a request to run" and Current tab pinned @critical', async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await selectSlash(page, "/run");
    await expect(mentionMenu(page)).toBeVisible();
    await expect(mentionMenu(page)).toContainText("Pick a request to run");
    await expect(page.getByText("Current tab", { exact: true })).toBeVisible();
    await snap("03-run-mention-hint");
  });

  test("[REL-POL-SLASH-04] picking Current tab attaches a pill, leaves /run ready, and sends nothing @critical", async ({
    seededPage: page,
    snap,
  }) => {
    let chatPosts = 0;
    await page.route("**/api/relay/chat", (route) => {
      if (route.request().method() === "POST") chatPosts += 1;
    });
    const routes = await installRelayRoutes(page, {
      kind: "text",
      text: "should-not-send",
    });
    await page.goto(WORKSPACE_PATH);
    await openGetUsersTab(page);
    await selectSlash(page, "/run");
    await expect(mentionMenu(page)).toBeVisible();

    const tabRow = page.locator(
      '[data-testid="relay-mention-option"][data-kind="tab"]',
    );
    await tabRow.click();
    await expect(mentionMenu(page)).not.toBeVisible();
    await expect(pills(page)).toHaveCount(1);
    // /run stays as an inline command pill ready to send, next to the request pill.
    await expect(commandPills(page)).toHaveCount(1);
    await expect(commandPills(page)).toHaveAttribute("data-command", "run");
    await expect(pills(page)).toContainText(GET_USERS);
    expect(chatPosts).toBe(0);
    expect(routes.requestBodies).toHaveLength(0);
    await snap("04-run-tab-pill-no-send");
  });

  test("[REL-POL-SLASH-05] /run with a request already attached inserts the command pill without opening the menu @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await attachFromPicker(page, "request", GET_USERS);
    await expect(pills(page)).toContainText(GET_USERS);
    // Type after the pill: fill() would replace the whole document and drop the attachment.
    await composer(page).focus();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("/run");
    await page.keyboard.press("Enter");
    await expect(mentionMenu(page)).not.toBeVisible();
    // The command is an inline pill; its prompt text is built on send.
    await expect(commandPills(page)).toHaveCount(1);
    await expect(commandPills(page)).toHaveAttribute("data-command", "run");
    // The attachment stays a pill; it is never appended to the draft text (BUG-01).
    await expect(composer(page)).not.toContainText("Attached:");
    await expect(pills(page)).toHaveCount(1);
    await expect(pills(page)).toContainText(GET_USERS);
    await snap("05-run-prompt-with-attachment");
  });

  test("[REL-POL-SLASH-06] /clear and /import never open the mention menu @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });

    await selectSlash(page, "/import");
    await expect(mentionMenu(page)).not.toBeVisible();
    await expect(commandPills(page)).toHaveAttribute("data-command", "import");
    await composer(page).clear();
    await expect(commandPills(page)).toHaveCount(0);

    await selectSlash(page, "/clear");
    await expect(mentionMenu(page)).not.toBeVisible();
    await snap("06-clear-import-no-mention");
  });

  test("[REL-POL-SLASH-07] /clear on a non-empty chat shows the confirm and clearing resets the thread @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "assistant reply" });
    await typeAndSend(page, "hello thread");
    await expect(page.getByTestId("relay-message-user")).toBeVisible();
    await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

    await selectSlash(page, "/clear");
    await expect(page.getByTestId("relay-clear-confirm")).toBeVisible();
    await expect(page.getByTestId("relay-message-user")).toBeVisible();
    await page.getByTestId("relay-clear-confirm-button").click();
    await expect(page.getByTestId("relay-clear-confirm")).toBeHidden();
    await expect(page.getByTestId("relay-message-user")).toHaveCount(0);
    await expect(page.getByTestId("relay-message-assistant")).toHaveCount(0);
    await snap("07-clear-confirmed");
  });

  test("[REL-POL-SLASH-08] the grouped menu has no horizontal scroll at 320px and keyboard navigation keeps focus in the textarea @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, { kind: "text", text: "init" });
    await page.setViewportSize({ width: 900, height: 900 });
    await page.evaluate(() => localStorage.removeItem("rq_relay_width"));
    await page.reload();
    await page.waitForLoadState("load");
    const toggle = page.getByTestId("relay-toggle");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click();
    }
    await expect(page.getByTestId(DOCK)).toBeVisible();
    await dragDockToWidth(page, 320);
    await composer(page).click();
    await composer(page).fill("/");
    await expect(slashMenu(page)).toBeVisible();

    const overflows = await slashMenu(page).evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    );
    expect(overflows).toBe(false);

    await composer(page).press("ArrowDown");
    await expect(composer(page)).toBeFocused();
    await composer(page).press("ArrowDown");
    await expect(composer(page)).toBeFocused();
    await snap("08-320-keyboard-focus");
  });

  test("[REL-POL-SLASH-09] selecting /new inserts a command pill whose promptKey text is sent and a scripted ask_user reply asks which collection @medium", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openWithRoutes(page, {
      kind: "readTool",
      toolName: "ask_user",
      input: {
        question: "Which collection should this request live in?",
        options: [MENTION_COLLECTION, "Other"],
      },
    });

    await selectSlash(page, "/new");
    await expect(commandPills(page)).toHaveAttribute("data-command", "new");
    await expect(page.getByTestId("relay-send")).toBeEnabled();
    await page.getByTestId("relay-send").click();
    const askCard = page.getByTestId("relay-ask-card");
    await expect(askCard).toBeVisible();
    expect(lastUserText(routes.requestBodies)).toContain(
      "Help me create a new request in my workspace",
    );
    await expect(askCard).toContainText(/collection/i);
    await snap("09-new-ask-user-collection");
  });

  test("[REL-POL-SLASH-10] slash descriptions and prompts render in fr and ja @medium", async ({
    seededPage: page,
    snap,
  }) => {
    const routes = await openWithRoutes(page, { kind: "text", text: "init" });

    await setAppLocale(page, "fr");
    await composer(page).fill("/");
    await expect(slashMenu(page)).toBeVisible();
    await expect(slashOptions(page).filter({ hasText: "/run" })).toContainText(
      "Exécuter une requête ou une chaîne",
    );
    await selectSlash(page, "/new");
    await expect(commandPills(page)).toHaveAttribute("data-command", "new");
    await page.getByTestId("relay-send").click();
    await expect.poll(() => routes.requestBodies.length).toBe(1);
    expect(lastUserText(routes.requestBodies)).toContain(
      "Aide-moi à créer une nouvelle requête",
    );

    await setAppLocale(page, "ja");
    await composer(page).fill("/");
    await expect(slashMenu(page)).toBeVisible();
    await expect(slashOptions(page).filter({ hasText: "/run" })).toContainText(
      "リクエストまたはチェーンを実行",
    );
    await selectSlash(page, "/new");
    await expect(commandPills(page)).toHaveAttribute("data-command", "new");
    await page.getByTestId("relay-send").click();
    await expect.poll(() => routes.requestBodies.length).toBe(2);
    expect(lastUserText(routes.requestBodies)).toContain(
      "ワークスペースに新しいリクエストを作成",
    );
    await snap("10-locale-fr-ja");
  });
});
