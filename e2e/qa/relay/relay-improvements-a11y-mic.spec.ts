import { openRelay } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import { installSpeechStub, speechActive } from "../../fixtures/speechStub";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
// Dictation never sends, so this scripted reply must stay unused.
const UNUSED_REPLY = "unused";

test.describe("Relay mic accessibility", () => {
  test("[REL-IA11Y-02] the mic is reachable by keyboard and aria-pressed toggles with the speech stub",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page }) => {
      await installSpeechStub(page);
      await installRelayRoutes(page, [{ kind: "text", text: UNUSED_REPLY }]);
      await page.goto(WORKSPACE_PATH);
      await openRelay(page);

      const mic = page.getByTestId("relay-mic");
      await page.getByTestId("relay-composer").focus();
      await page.keyboard.press("Tab");
      await expect(mic).toBeFocused();
      await expect(mic).toHaveAttribute("aria-pressed", "false");

      await page.keyboard.press("Enter");
      await expect(mic).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => speechActive(page)).toBe(true);
      await expect(mic).toBeFocused();

      await page.keyboard.press("Space");
      await expect(mic).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => speechActive(page)).toBe(false);
    }
  );
});
