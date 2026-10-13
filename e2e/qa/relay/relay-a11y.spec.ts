import type { Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import {
  RELAY_MAX_STEPS,
  RELAY_STEP_INDICATOR_AFTER,
  RELAY_VIRTUALIZE_THRESHOLD,
} from "../../../src/lib/relay/constants";
import { findBannedTokens } from "../../../src/lib/relay/server/bannedTokens";
import {
  closeRelay,
  openRelay,
  pressRelayShortcut,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes, type RelayScript } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const THREADS_STORE = "relay_threads";
const LOCAL_WORKSPACE = "local";
const DOOMED_REQUEST_ID = "qa-e2e-relay-doomed-req-1";
const LONG_THREAD_ID = "qa-e2e-relay-thread-long";
const LONG_THREAD_MESSAGES = 200;
/** Far above the unit-tested 200ms so CI load cannot flake it; catches a non-virtualized freeze. */
const OPEN_BUDGET_MS = 1_500;
const PENDING_DELAY_MS = 600;
const MAX_TAB_STOPS = 40;
const COLOR_SCHEMES = ["light", "dark"] as const;
const TOOL_ROUNDS = RELAY_STEP_INDICATOR_AFTER + 1;
/** Rendered rows stay well under the thread length once windowed. */
const MAX_RENDERED_ROWS = 100;

const composer = (page: Page) => page.getByTestId("relay-composer");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const confirmCard = (page: Page) => page.getByTestId("relay-confirm-card");

const calls = (...items: { toolName: string; input: unknown }[]) =>
  ({ kind: "clientTools", calls: items }) satisfies RelayScript;
const deleteDoomedRequest = () =>
  calls({ toolName: "delete_request", input: { ids: [DOOMED_REQUEST_ID] } });
const reply = (text: string) => ({ kind: "text", text }) satisfies RelayScript;

async function openWithRoutes(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

/** Tabs backwards from the composer until `testId` has focus; cards sit above it. */
async function shiftTabTo(page: Page, testId: string) {
  const target = page.getByTestId(testId);
  for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Shift+Tab");
  }
  throw new Error(`[relay-a11y] ${testId} is not reachable by Shift+Tab`);
}

/** True when the focused element draws an outline or a ring. */
function hasFocusIndicator(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    const outlined =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    return outlined || style.boxShadow !== "none";
  });
}

function longThread() {
  const messages = Array.from({ length: LONG_THREAD_MESSAGES }, (_, index) => ({
    id: `qa-e2e-relay-long-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    parts: [{ type: "text", text: `Message ${index}` }],
  }));
  const stamp = Date.now() + 60_000;
  return {
    id: LONG_THREAD_ID,
    title: "QA long thread",
    workspaceId: LOCAL_WORKSPACE,
    createdAt: stamp,
    updatedAt: stamp,
    messages,
    interruptedMessageId: null,
  };
}

async function putThread(page: Page, thread: ReturnType<typeof longThread>) {
  await page.evaluate(
    ({ dbName, store, row }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(row);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, store: THREADS_STORE, row: thread },
  );
}

test.describe("Relay accessibility and limits @qa", () => {
  test("[REL-A11Y-01] Status changes are announced in live regions (AC-22)", async ({
    seededPage: page,
  }) => {
    await openWithRoutes(page, [
      { kind: "text", text: "Hello from Relay", delayMs: PENDING_DELAY_MS },
      deleteDoomedRequest(),
    ]);
    const announcer = page.getByTestId("relay-announcer");
    const log = page.getByTestId("relay-messages");
    await expect(log).toHaveAttribute("aria-live", "polite");
    await expect(log).toHaveAttribute("aria-label", /.+/);

    await sendMessage(page, "hello");
    await expect(announcer).toHaveAttribute("role", "status");
    await expect(announcer).toHaveText("Relay is typing");
    await expect(assistantBubbles(page)).toContainText("Hello from Relay");
    await expect(announcer).toHaveText("");

    await sendMessage(page, "delete it");
    await expect(confirmCard(page)).toBeVisible();
    await expect(confirmCard(page).getByRole("status")).toHaveText(
      "Confirmation needed",
    );
  });

  test("[REL-A11Y-02] The whole flow works from the keyboard with visible focus in both themes (US8, AC-22)", async ({
    seededPage: page,
  }) => {
    await installRelayRoutes(page, [
      reply("Hello from Relay"),
      deleteDoomedRequest(),
      reply("Deleted."),
    ]);
    await page.goto(WORKSPACE_PATH);
    await pressRelayShortcut(page);
    await expect(composer(page)).toBeFocused();

    await page.keyboard.type("hello");
    await page.keyboard.press("Enter");
    await expect(assistantBubbles(page)).toContainText("Hello from Relay");

    await composer(page).focus();
    await page.keyboard.type("delete it");
    await page.keyboard.press("Enter");
    await expect(confirmCard(page)).toBeVisible();
    await shiftTabTo(page, "relay-confirm-approve");
    await page.keyboard.press("Enter");
    await expect(confirmCard(page)).toHaveCount(0);
    await expect(assistantBubbles(page).last()).toContainText("Deleted.");

    for (const scheme of COLOR_SCHEMES) {
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        scheme === "dark",
      );
      await composer(page).focus();
      await page.keyboard.press("Shift+Tab");
      expect(await hasFocusIndicator(page), `${scheme} focus ring`).toBe(true);
    }
  });

  test("[REL-A11Y-03] Reduced motion stops the animated caret (AC-22, NFR-6)", async ({
    seededPage: page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWithRoutes(page, [{ kind: "hang" }]);
    await sendMessage(page, "hello");
    const caret = page.getByTestId("relay-pending").getByTestId("relay-caret");
    await expect(caret).toBeVisible();
    const animationName = () =>
      caret.evaluate((el) => getComputedStyle(el).animationName);

    expect(await animationName()).toBe("none");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(animationName).not.toBe("none");
  });

  test("[REL-A11Y-04] A 200-message thread opens fast and stays usable (NFR-1)", async ({
    seededPage: page,
  }) => {
    await openWithRoutes(page, [reply("Still fast")]);
    await closeRelay(page);
    await putThread(page, longThread());
    await page.reload();
    expect(LONG_THREAD_MESSAGES).toBeGreaterThan(RELAY_VIRTUALIZE_THRESHOLD);

    const started = Date.now();
    await page.getByTestId("relay-toggle").click();
    await expect(
      page.getByText(`Message ${LONG_THREAD_MESSAGES - 1}`, { exact: true }),
    ).toBeVisible({ timeout: OPEN_BUDGET_MS });
    expect(Date.now() - started).toBeLessThan(OPEN_BUDGET_MS);

    await expect(page.getByTestId("relay-virtual-messages")).toBeVisible();
    const rendered = await page
      .locator(
        '[data-testid="relay-message-user"], [data-testid="relay-message-assistant"]',
      )
      .count();
    expect(rendered).toBeLessThan(MAX_RENDERED_ROWS);

    await sendMessage(page, "still there?");
    await expect(assistantBubbles(page).last()).toContainText("Still fast");
  });

  test("[REL-A11Y-05] A long turn shows a step indicator after step 6 (FR-21)", async ({
    seededPage: page,
  }) => {
    const rounds = Array.from({ length: TOOL_ROUNDS }, () =>
      calls({ toolName: "get_workspace_summary", input: {} }),
    );
    await openWithRoutes(page, [...rounds, reply("Done after many steps.")]);

    await sendMessage(page, "dig deep");
    await expect(assistantBubbles(page).last()).toContainText(
      "Done after many steps.",
    );

    const indicator = page.getByTestId("relay-step-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText(
      new RegExp(`^Step \\d+ of ${RELAY_MAX_STEPS}$`),
    );
  });

  test("[REL-A11Y-06] Hitting the daily cap shows a neutral message (NFR-4)", async ({
    seededPage: page,
  }) => {
    await openWithRoutes(page, [{ kind: "rateLimited" }]);

    await sendMessage(page, "one more");

    const banner = page.getByTestId("relay-banner");
    await expect(banner).toHaveAttribute("data-error-code", "rate_limited");
    await expect(banner).toContainText("message limit");
    expect(findBannedTokens((await banner.textContent()) ?? "")).toEqual([]);
  });
});
