import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelayEditor, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";

const WORKSPACE_PATH = "/app";
const QUESTION = "Which environment should I use?";
const OPTIONS = [
  "Staging",
  "Production environment with a deliberately long label that has to wrap onto a second line",
  "Local",
];
const REPLY = "Using your choice.";
const EDGE_TOLERANCE_PX = 1;
const BLOCKING_IMPACTS = ["serious", "critical"];

const card = (page: Page) => page.getByTestId("relay-ask-card");
const options = (page: Page) => page.getByTestId("relay-ask-option");
const input = (page: Page) => page.getByTestId("relay-ask-input");
const sendButton = (page: Page) =>
  card(page).getByRole("button", { name: "Send answer" });

async function openAsk(page: Page) {
  const routes = await installRelayRoutes(page, [
    { kind: "askUser", question: QUESTION, options: OPTIONS },
    { kind: "text", text: REPLY },
  ]);
  await page.goto(WORKSPACE_PATH);
  await openRelayEditor(page);
  await sendMessage(page, "which env?");
  await expect(card(page)).toContainText(QUESTION);
  await expect(options(page)).toHaveCount(OPTIONS.length);
  return routes;
}

test.describe("Relay conversation polish: ask card layout and a11y", () => {
  test("[REL-CP-ASK-01] options are stacked with the same left edge and width, tops strictly increasing",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      await openAsk(page);

      const boxes = await options(page).evaluateAll((els) =>
        els.map((el) => {
          const { x, y, width } = el.getBoundingClientRect();
          return { x, y, width };
        }),
      );
      expect(boxes).toHaveLength(OPTIONS.length);
      for (const box of boxes) {
        expect(Math.abs(box.x - boxes[0].x)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
        expect(Math.abs(box.width - boxes[0].width)).toBeLessThanOrEqual(
          EDGE_TOLERANCE_PX,
        );
      }
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
      }
      // The long label wraps instead of overflowing its row.
      const long = options(page).nth(1);
      const [shortBox, longBox] = await Promise.all([
        options(page).first().boundingBox(),
        long.boundingBox(),
      ]);
      expect(longBox!.height).toBeGreaterThan(shortBox!.height);
      expect(
        await long.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await snap("01-stacked-options");
    },
  );

  test("[REL-CP-ASK-02] clicking an option submits immediately",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openAsk(page);
      expect(routes.requestBodies).toHaveLength(1);

      await options(page).first().click();

      await expect(page.getByText(REPLY)).toBeVisible();
      expect(routes.requestBodies).toHaveLength(2);
      expect(JSON.stringify(routes.requestBodies[1])).toContain(
        `"choice":"${OPTIONS[0]}"`,
      );
      await expect(options(page)).toHaveCount(0);
      await snap("02-submitted");
    },
  );

  test("[REL-CP-ASK-03] Send is icon-only named \"Send answer\" and disabled when empty",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openAsk(page);

      await expect(sendButton(page)).toBeVisible();
      await expect(sendButton(page)).toBeDisabled();
      await expect(sendButton(page)).toHaveText("");
      await expect(sendButton(page).locator("svg")).toHaveCount(1);

      await input(page).fill("Something custom");
      await expect(sendButton(page)).toBeEnabled();
      await input(page).fill("");
      await expect(sendButton(page)).toBeDisabled();
      await input(page).fill("Something custom");
      await snap("03-icon-send");
    },
  );

  test("[REL-CP-ASK-04] focus order is options, input, Send; axe reports no violations on the card",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await openAsk(page);
      await input(page).fill("typed");

      await options(page).first().focus();
      for (let i = 1; i < OPTIONS.length; i++) {
        await page.keyboard.press("Tab");
        await expect(options(page).nth(i)).toBeFocused();
      }
      await page.keyboard.press("Tab");
      await expect(input(page)).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(sendButton(page)).toBeFocused();

      const { violations, passes } = await new AxeBuilder({ page })
        .include('[data-testid="relay-ask-card"]')
        .analyze();
      expect(passes.length).toBeGreaterThan(0);
      expect(
        violations
          .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))
          .map((v) => v.id),
      ).toEqual([]);
      expect(violations.map((v) => v.id)).toEqual([]);
      await snap("04-focus-axe");
    },
  );
});
