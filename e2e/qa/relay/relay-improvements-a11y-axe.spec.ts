import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const REPLY_TEXT = "Here is a short reply.";
const BLOCKING_IMPACTS = ["serious", "critical"];

async function openWithConversation(page: Page) {
  await installRelayRoutes(page, { kind: "text", text: REPLY_TEXT });
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, "hello");
  await expect(page.getByTestId("relay-message-assistant")).toContainText(
    REPLY_TEXT,
  );
}

async function scanDock(page: Page) {
  const { violations, passes } = await new AxeBuilder({ page })
    .include('[data-testid="relay-dock"]')
    .analyze();
  // Guards against a vacuous scan (selector matched nothing).
  expect(passes.length).toBeGreaterThan(0);
  return violations
    .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")),
    }));
}

test.describe("Relay axe scan", () => {
  test("[REL-IA11Y-03] the Relay panel has no serious or critical axe violations",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page }) => {
      await openWithConversation(page);
      expect(await scanDock(page)).toEqual([]);
    },
  );

  test("[REL-IA11Y-07] the same check passes in the dark theme",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page }) => {
      await openWithConversation(page);
      await page.evaluate(() => {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      });
      await expect(page.locator("html")).toHaveClass(/dark/);
      expect(await scanDock(page)).toEqual([]);
    },
  );
});
