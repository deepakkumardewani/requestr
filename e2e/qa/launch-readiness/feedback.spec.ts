import type { Page, Request } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const INGEST_GLOB = "**/api/ingest";
const SURVEY_EVENT = "survey_sent";
const SIDEBAR_FEEDBACK_TESTID = "sidebar-feedback-btn";
const DIALOG_TESTID = "feedback-dialog";
const FEEDBACK_LABEL = "Send feedback";
const SUBMIT_ERROR = /Couldn't send your feedback/;
const EMAIL_ERROR = "Enter a valid email address.";

type WireEvent = { name: string; props: Record<string, unknown> };
type Wire = { id?: string; events: WireEvent[] };

const wireOf = (req: Request): Wire =>
  JSON.parse(req.postData() ?? "{}") as Wire;

async function enableOverride(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__RQ_ANALYTICS_E2E__ = true;
  });
}

async function sendDoNotTrack(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", { get: () => "1" });
  });
}

/** Stubs ingest and records every request so nothing leaves the machine. */
async function stubIngest(page: Page): Promise<Request[]> {
  const hits: Request[] = [];
  await page.route(INGEST_GLOB, (route) => {
    hits.push(route.request());
    return route.fulfill({ status: 204 });
  });
  return hits;
}

const surveysOf = (hits: Request[]): Wire[] =>
  hits.map(wireOf).filter((w) => w.events.some((e) => e.name === SURVEY_EVENT));

async function openApp(page: Page): Promise<void> {
  await page.goto("/app");
  await expect(page.getByTestId(SIDEBAR_FEEDBACK_TESTID)).toBeVisible();
}

const dialog = (page: Page) => page.getByTestId(DIALOG_TESTID);

async function openFromSidebar(page: Page): Promise<void> {
  await page.getByTestId(SIDEBAR_FEEDBACK_TESTID).click();
  await expect(dialog(page)).toBeVisible();
}

test.describe("Feedback @qa", () => {
  test("@critical the sidebar Feedback item opens the dialog and a 4-star submit posts a survey payload to /api/ingest (override enabled)", async ({
    page,
    snap,
  }) => {
    const hits = await stubIngest(page);
    await enableOverride(page);
    await openApp(page);
    await openFromSidebar(page);

    const note = `Great tool ${Date.now()}`;
    await dialog(page).getByTestId("feedback-rating-4").click();
    await dialog(page)
      .getByLabel(/Anything to add/)
      .fill(note);
    await snap("01-dialog-filled");

    const request = page.waitForRequest(
      (req) =>
        new URL(req.url()).pathname === "/api/ingest" &&
        req.postData()?.includes(SURVEY_EVENT) === true
    );
    await dialog(page).getByRole("button", { name: FEEDBACK_LABEL }).click();
    const wire = wireOf(await request);

    expect(wire.events).toHaveLength(1);
    expect(wire.events[0].name).toBe(SURVEY_EVENT);
    expect(wire.events[0].props).toMatchObject({ rating: 4, text: note });
    await expect(dialog(page)).toHaveCount(0);
    expect(surveysOf(hits)).toHaveLength(1);
    await snap("02-submitted-dialog-closed");
  });

  test("@critical with the override and DNT=1, a user-initiated submit still posts, with no analytics id and only app_version among common props (SC3 exception)", async ({
    page,
    snap,
  }) => {
    const hits = await stubIngest(page);
    await enableOverride(page);
    await sendDoNotTrack(page);
    await openApp(page);
    expect(await page.evaluate(() => navigator.doNotTrack)).toBe("1");
    await openFromSidebar(page);

    await dialog(page).getByTestId("feedback-rating-5").click();
    const request = page.waitForRequest(
      (req) =>
        new URL(req.url()).pathname === "/api/ingest" &&
        req.postData()?.includes(SURVEY_EVENT) === true
    );
    await dialog(page).getByRole("button", { name: FEEDBACK_LABEL }).click();
    const wire = wireOf(await request);

    expect(wire.id).toBeUndefined();
    expect(wire.events).toHaveLength(1);
    const props = wire.events[0].props;
    expect(props.rating).toBe(5);
    expect(props.app_version).toEqual(expect.any(String));
    for (const common of [
      "locale",
      "viewport_class",
      "session_day_index",
      "theme",
    ]) {
      expect(props, `common prop ${common}`).not.toHaveProperty(common);
    }
    expect(
      await page.evaluate(() => localStorage.getItem("rq_analytics_id"))
    ).toBeNull();
    // DNT suppresses all passive traffic: the survey is the only request.
    expect(hits).toHaveLength(1);
    await snap("01-dnt-survey-posted");
  });

  test("@high with the override, a failed submit (/api/ingest routed to fail) shows an inline error and keeps the text", async ({
    page,
    snap,
  }) => {
    await enableOverride(page);
    await sendDoNotTrack(page);
    // A rejected fetch is the unreachable-network path; routing to abort/500 makes the
    // browser itself log a console error, which the suite's guard must keep rejecting.
    await page.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, init) =>
        String(input).includes("/api/ingest")
          ? Promise.reject(new TypeError("Failed to fetch"))
          : realFetch(input, init);
    });
    await openApp(page);
    await openFromSidebar(page);

    const note = `Keep me ${Date.now()}`;
    await dialog(page).getByTestId("feedback-rating-3").click();
    const textbox = dialog(page).getByLabel(/Anything to add/);
    await textbox.fill(note);
    await dialog(page).getByRole("button", { name: FEEDBACK_LABEL }).click();

    await expect(dialog(page).getByRole("alert")).toHaveText(SUBMIT_ERROR);
    await expect(dialog(page)).toBeVisible();
    await expect(textbox).toHaveValue(note);
    await expect(dialog(page).getByTestId("feedback-rating-3")).toBeChecked();
    await snap("01-submit-error-inline");
  });

  test("@high an invalid email is blocked inline", async ({ page, snap }) => {
    const hits = await stubIngest(page);
    await enableOverride(page);
    await sendDoNotTrack(page);
    await openApp(page);
    await openFromSidebar(page);

    await dialog(page).getByTestId("feedback-rating-4").click();
    await dialog(page)
      .getByLabel(/Email, if you want a reply/)
      .fill("not-an-email");
    await dialog(page).getByRole("button", { name: FEEDBACK_LABEL }).click();

    await expect(dialog(page).getByRole("alert")).toHaveText(EMAIL_ERROR);
    await expect(dialog(page)).toBeVisible();
    expect(surveysOf(hits)).toHaveLength(0);
    await snap("01-invalid-email-blocked");
  });

  test("@high the command palette item opens the dialog", async ({
    page,
    snap,
  }) => {
    await stubIngest(page);
    await enableOverride(page);
    await openApp(page);
    await expect(dialog(page)).toHaveCount(0);

    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: FEEDBACK_LABEL }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(
      dialog(page).getByRole("heading", { name: FEEDBACK_LABEL })
    ).toBeVisible();
    await snap("01-opened-from-palette");
  });
});
