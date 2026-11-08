import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const DESKTOP = { width: 1440, height: 900 };
const VIDEO_URL = /\.(webm|mp4)(\?|$)/;
const POSTER_URL = /\/intro\/clip-\d\.webp(\?|$)/;
const INLINE_CLIP_ALT = /request chain with a loop/i;
const INLINE_CLIP_SRC = "/intro/clip-2";
const DEMO_CLIP_URL = /\/intro\/clip-1\.(webm|mp4)(\?|$)/;

/** Records every video / poster request the page makes from now on. */
function trackMedia(page: Page) {
  const videos: string[] = [];
  const posters: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (VIDEO_URL.test(url)) videos.push(url);
    if (POSTER_URL.test(url)) posters.push(url);
  });
  return { videos, posters };
}

function watchDemoButton(page: Page) {
  return page.getByRole("button", { name: "Watch the demo" }).first();
}

test.describe("P7 demo modal and video loading @qa", () => {
  test.use({ viewport: DESKTOP });

  test("@critical on initial load (no scrolling) no .webm/.mp4 request happens; only posters load; the modal video loads only after the Watch-demo click", async ({
    page,
    snap,
  }) => {
    const { videos, posters } = trackMedia(page);
    await page.goto("/");
    const button = watchDemoButton(page);
    await expect(button).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(videos).toEqual([]);
    expect(await page.locator("video").count()).toBe(0);
    await snap("01-initial-load-no-video");

    const clickedAt = videos.length;
    await button.click();
    const dialog = page.getByRole("dialog", { name: "Watch the demo" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("video")).toHaveCount(1);
    await expect.poll(() => videos.length).toBeGreaterThan(clickedAt);
    expect(videos.some((u) => DEMO_CLIP_URL.test(u))).toBe(true);
    // Poster is the only media that the inline (lazy) clip contributes up front.
    expect(posters.every((u) => !VIDEO_URL.test(u))).toBe(true);
    await snap("02-modal-open-video-requested");
  });

  test("@high an inline IntroClip video is requested only once it is scrolled near the viewport", async ({
    page,
    snap,
  }) => {
    const { videos } = trackMedia(page);
    await page.goto("/");
    await expect(watchDemoButton(page)).toBeVisible();
    const poster = page.getByRole("img", { name: INLINE_CLIP_ALT });
    await expect(poster).toBeAttached();
    await page.waitForLoadState("networkidle");
    expect(videos).toEqual([]);
    await expect(page.locator("video")).toHaveCount(0);

    await poster.scrollIntoViewIfNeeded();
    const clip = page.locator(`video[aria-label*="request chain" i]`);
    await expect(clip).toBeAttached();
    await expect
      .poll(() => videos.some((u) => u.includes(INLINE_CLIP_SRC)))
      .toBe(true);
    await snap("03-inline-clip-after-scroll");
  });

  test("@critical clicking opens a dialog that traps focus; Esc closes it and focus returns to the button", async ({
    page,
    snap,
  }) => {
    await page.goto("/");
    const button = watchDemoButton(page);
    await expect(button).toBeVisible();
    await button.click();

    const dialog = page.getByRole("dialog", { name: "Watch the demo" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();

    // Reopen to check the focus trap.
    await button.click();
    await expect(dialog).toBeVisible();

    // Tab past the last control more than once: focus must always return inside.
    const focusInDialog = () =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      );
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      await expect.poll(focusInDialog).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    await expect.poll(focusInDialog).toBe(true);
    await snap("04-dialog-focus-trapped");

    // Esc closes from a freshly opened dialog. (Once focus has been tabbed
    // into Chromium's native video controls the browser may consume Esc, so
    // the trap check above is last.)
    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("@high closing pauses the video", async ({ page, snap }) => {
    await page.goto("/");
    await watchDemoButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Watch the demo" });
    const video = dialog.locator("video");
    await expect(video).toHaveCount(1);

    // Keep a handle: the element unmounts on close, but its state stays readable.
    const handle = await video.elementHandle();
    expect(handle).not.toBeNull();
    await expect
      .poll(() => handle!.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThan(0);
    // Headless Chromium blocks autoplay; start playback like a user would.
    await handle!.evaluate((v: HTMLVideoElement) => v.play());
    await expect
      .poll(() => handle!.evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(false);
    await snap("05-modal-video-playing");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect
      .poll(() => handle!.evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(true);
  });

  test("@high with reduced motion inline clips show posters only", async ({
    page,
    snap,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { videos } = trackMedia(page);
    await page.goto("/");
    await expect(watchDemoButton(page)).toBeVisible();
    const poster = page.getByRole("img", { name: INLINE_CLIP_ALT });
    await poster.scrollIntoViewIfNeeded();
    await expect(poster).toBeVisible();
    await expect(poster).toHaveAttribute("src", /clip-\d\.webp$/);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("video")).toHaveCount(0);
    expect(videos).toEqual([]);
    await snap("06-reduced-motion-poster-only");
  });
});
