import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { WORKSPACE_PATH } from "../../fixtures/relayE2eHelpers";
import { installProxyRoutes, installRelayRoutes } from "../../fixtures/relayRoutes";
import { openTab } from "../../fixtures/qaHelpers";

const SAMPLE_REQUEST = "QA E2E Relay - Sample request";
const SAMPLE_COLLECTION_TESTID = "collection-item-qa-collection-1";
const TRANSFORM_PATH = "/transform";
const OPEN_IN_RELAY_LABEL = "Open in Relay";
const MAX_PROMPT_CHARS = 80;
const INTERNAL_MARKERS = [
  "IMPORTANT:",
  "Requirements:",
  "Build an HTTP request from this description",
];
const OK_BODY = '{"users":[{"id":1,"name":"Ada"}]}';
const FAILING_BODY = '{"error":"client_closed"}';
const FAILING_STATUS_TEXT = "Client Closed Request";
const SETTINGS_PATH = /\/settings$/;

const openInRelay = (page: Page) => page.getByTestId("open-in-relay-btn");
const tooltip = (page: Page) => page.locator('[data-slot="tooltip-content"]');
const composer = (page: Page) => page.getByTestId("relay-composer");
const tabpanelWith = (page: Page, inner: Locator) =>
  page.getByRole("tabpanel").filter({ has: inner });

type Entry = {
  id: string;
  prompt: string;
  /** Proxied response the entry needs before it is reachable. */
  response: "ok" | "failing" | "none";
  /** Navigates to the entry's surface and returns the container holding its button. */
  reach: (page: Page) => Promise<Locator>;
};

async function openSampleRequest(page: Page) {
  await page.goto(WORKSPACE_PATH);
  const item = page
    .getByTestId("request-item")
    .filter({ hasText: SAMPLE_REQUEST });
  if (!(await item.isVisible())) {
    await page.getByTestId(SAMPLE_COLLECTION_TESTID).click();
  }
  await item.click();
  await expect(page.getByTestId("url-input").first()).toBeVisible();
}

async function sendAndAwait(page: Page, statusText: string) {
  await page.getByTestId("send-request-btn").click();
  await expect(page.getByTestId("response-status-text")).toHaveText(statusText);
}

async function openResponseMore(page: Page, itemTestId: string) {
  await page.getByTestId("response-tab-more").click();
  await page.getByTestId(itemTestId).click();
}

const ENTRIES: Entry[] = [
  {
    id: "suggestHeaders",
    prompt: "Suggest missing headers for this request",
    response: "none",
    reach: async (page) => {
      await page.getByTestId("request-tab-headers").click();
      return tabpanelWith(page, page.getByRole("button", { name: "Suggest headers" }));
    },
  },
  {
    id: "generateBody",
    prompt: "Generate a body for this request",
    response: "none",
    reach: async (page) => {
      await page.getByTestId("request-tab-body").click();
      await page.getByTestId("body-type-selector").click();
      await page.getByTestId("body-type-json").click();
      return tabpanelWith(page, page.getByTestId("generate-body-btn"));
    },
  },
  {
    id: "writeScript",
    prompt: "Write a script for this request",
    response: "none",
    reach: async (page) => {
      await page.getByTestId("request-tab-scripts").click();
      return tabpanelWith(page, page.getByTestId("ask-ai-btn"));
    },
  },
  {
    id: "suggestAssertions",
    prompt: "Suggest assertions for this response",
    response: "ok",
    reach: async (page) => {
      await openResponseMore(page, "response-more-tests");
      return tabpanelWith(page, page.getByTestId("suggest-assertions-btn"));
    },
  },
  {
    id: "summarizeResponse",
    prompt: "Summarize this response",
    response: "ok",
    reach: async (page) => page.getByTestId("response-meta"),
  },
  {
    id: "explainError",
    prompt: "Explain this error response",
    response: "failing",
    reach: async (page) => page.getByTestId("error-explainer"),
  },
  {
    id: "responseJsonpath",
    prompt: "Write a JSONPath for this response",
    response: "ok",
    reach: async (page) => {
      await openResponseMore(page, "response-more-transform");
      return page.getByTestId("transform-playground");
    },
  },
  {
    id: "transformJsonpath",
    prompt: "Write a JSONPath for this data",
    response: "none",
    reach: async (page) => {
      await page.goto(TRANSFORM_PATH);
      const input = page.getByTestId("code-editor").first().getByRole("textbox");
      await input.click();
      await page.keyboard.insertText(OK_BODY);
      await expect(page.getByTestId("jsonpath-ai-btn")).toBeVisible();
      return page.getByTestId("jsonpath-ai-btn").locator("..");
    },
  },
];

const FAILING_REPLY = {
  status: 499,
  statusText: FAILING_STATUS_TEXT,
  body: FAILING_BODY,
};
const OK_REPLY = {
  status: 200,
  statusText: "OK",
  body: OK_BODY,
  contentType: "application/json",
};

/** Opens the workspace on the sample request, with Relay mocked, and sends it when the entry needs a response. */
async function arrive(page: Page, entry: Entry) {
  const reply = { current: entry.response === "failing" ? FAILING_REPLY : OK_REPLY };
  await installRelayRoutes(page, { kind: "text", text: "Looked." });
  await installProxyRoutes(page, () => reply.current);
  await openSampleRequest(page);
  if (entry.response === "failing") await sendAndAwait(page, FAILING_STATUS_TEXT);
  if (entry.response === "ok") await sendAndAwait(page, "OK");
  return reply;
}

/** The composer's typed text with the context pills removed. */
function composerPrompt(page: Page): Promise<string> {
  return composer(page).evaluate((element) => {
    const clone = element.cloneNode(true) as HTMLElement;
    for (const pill of clone.querySelectorAll('[data-testid="relay-composer-pill"]')) {
      pill.remove();
    }
    return (clone.textContent ?? "").trim();
  });
}

test.describe("Open in Relay entry points @qa", () => {
  test("URL bar has no Open-in-Relay button", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
    snap,
  }) => {
    await installRelayRoutes(page, { kind: "text", text: "Ready." });
    await page.goto(WORKSPACE_PATH);
    await openTab(page);
    await expect(page.getByTestId("url-input").first()).toBeVisible();
    // Relay is on (its toggle renders), so the absence below is not a disabled-Relay artefact.
    await expect(page.getByTestId("relay-toggle")).toBeVisible();
    await expect(page.getByTestId("send-request-btn")).toBeVisible();
    await expect(openInRelay(page)).toHaveCount(0);
    await snap("01-url-bar-no-button");
  });

  for (const [index, entry] of ENTRIES.entries()) {
    test(`each of the 8 entry points opens Relay with a short human prompt and its context: ${entry.id}`, {
      tag: ["@qa", "@critical"],
    }, async ({ seededPage: page, snap }) => {
      await arrive(page, entry);
      const surface = await entry.reach(page);
      await expect(surface).toBeVisible();
      const button = surface.getByTestId("open-in-relay-btn");
      await expect(button).toHaveCount(1);
      await button.click();

      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await expect(composer(page)).toContainText(entry.prompt);
      const prompt = await composerPrompt(page);
      expect(prompt).toBe(entry.prompt);
      expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
      for (const marker of INTERNAL_MARKERS) expect(prompt).not.toContain(marker);
      // The Transform page's input is page-local, so it carries no chip and must not borrow the active request's.
      await expect(composer(page).getByTestId("relay-composer-pill")).toHaveCount(
        entry.id === "transformJsonpath" ? 0 : 1,
      );
      await snap(`${String(index + 2).padStart(2, "0")}-${entry.id}`);
    });
  }

  for (const entry of ENTRIES) {
    test(`each button is icon-only with an accessible name and a tooltip: ${entry.id}`, {
      tag: ["@qa", "@high"],
    }, async ({ seededPage: page, snap }) => {
      await arrive(page, entry);
      const surface = await entry.reach(page);
      const button = surface.getByRole("button", { name: OPEN_IN_RELAY_LABEL });
      await expect(button).toHaveCount(1);
      await expect(button).toBeVisible();
      await expect(button).toHaveText("");

      await button.hover();
      await expect(tooltip(page)).toHaveText(OPEN_IN_RELAY_LABEL);
      await page.mouse.move(0, 0);
      await expect(tooltip(page)).toHaveCount(0);

      // A key press first, so the focus counts as keyboard focus (focus-visible) and opens the tooltip.
      await page.keyboard.press("Shift");
      await button.focus();
      await expect(tooltip(page)).toHaveText(OPEN_IN_RELAY_LABEL);
      if (entry.id === "summarizeResponse") await snap("10-tooltip");
    });
  }

  test("with Relay disabled, none of the buttons render", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
    snap,
  }) => {
    const reply = await arrive(page, ENTRIES[0]);
    await page.getByTestId("sidebar-settings-btn").click();
    await expect(page).toHaveURL(SETTINGS_PATH);
    await page.getByTestId("nav-relay").click();
    const enableSwitch = page.getByTestId("relay-enabled-switch");
    await enableSwitch.click();
    await expect(enableSwitch).toHaveAttribute("aria-checked", "false");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${WORKSPACE_PATH}$`));
    await expect(page.getByTestId("relay-toggle")).toHaveCount(0);

    for (const entry of ENTRIES.filter((e) => e.id !== "transformJsonpath")) {
      if (entry.response !== "none") {
        reply.current = entry.response === "failing" ? FAILING_REPLY : OK_REPLY;
        await sendAndAwait(page, entry.response === "failing" ? FAILING_STATUS_TEXT : "OK");
      }
      const surface = await entry.reach(page);
      await expect(surface).toBeVisible();
      await expect(surface.getByTestId("open-in-relay-btn")).toHaveCount(0);
    }
    await snap("11-disabled-no-buttons");

    // The Transform page persists the setting across a full navigation.
    const transform = ENTRIES[ENTRIES.length - 1];
    await page.goto(TRANSFORM_PATH);
    const input = page.getByTestId("code-editor").first().getByRole("textbox");
    await input.click();
    await page.keyboard.insertText(OK_BODY);
    await expect(page.getByTestId("jsonpath-ai-btn")).toBeVisible();
    await expect(openInRelay(page)).toHaveCount(0);
    expect(transform.id).toBe("transformJsonpath");
  });
});
