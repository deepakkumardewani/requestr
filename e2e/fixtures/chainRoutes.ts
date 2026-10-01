import type { Page, Route } from "@playwright/test";

const MOCK_API_PREFIX = "/api";
const SLOW_DELAY_MS = 5000;
const UNMOCKED_STATUS = 599;

/**
 * Installs hermetic route handlers for chain testing.
 * Intercepts /api/proxy requests and returns deterministic responses
 * with scripted delays, preventing external network calls.
 *
 * Routes mocked (matched by exact pathname under /api):
 * - /slow: 5000ms delay, deterministic JSON body
 * - /fast: 0ms delay, deterministic JSON body
 * - /fail: 500 HTTP error status
 * - /list: 3-item array for Loop testing
 * - /token, /echo: deterministic edge-injection fixtures
 * - Any other target: fulfilled with status 599 (never hits the network)
 */
export async function installChainRoutes(page: Page) {
  await page.route("/api/proxy", async (route: Route) => {
    const request = route.request();
    let payload: Record<string, unknown>;

    try {
      const bodyText = request.postData();
      if (!bodyText) {
        await route.abort("failed");
        return;
      }
      payload = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      await route.abort("failed");
      return;
    }

    const url = payload.url as string | undefined;
    if (!url) {
      await route.abort("failed");
      return;
    }

    // The real /api/proxy route always answers with HTTP 200 and wraps the
    // downstream response (status/statusText/headers/body) in its JSON body —
    // see ProxyResponse in src/lib/requestRunner.ts. The fixture must mirror
    // that envelope so a simulated target-side error (e.g. /fail) is surfaced
    // as a failed *chain node*, not as a proxy-transport error.
    const respondAsProxy = (targetStatus: number, targetBody: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: targetStatus,
          statusText:
            targetStatus >= 200 && targetStatus < 300
              ? "OK"
              : "Internal Server Error",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(targetBody),
        }),
      });

    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      throw new Error(
        `[chainRoutes] Invalid target URL in proxy payload: ${url}`,
      );
    }

    // Exact pathname match (not substring) so e.g. "/api/fastest" can't be
    // swallowed by the "/api/fast" mock.
    switch (pathname) {
      case `${MOCK_API_PREFIX}/slow`:
        // Simulate 5s delay then return deterministic JSON
        await new Promise((resolve) => setTimeout(resolve, SLOW_DELAY_MS));
        await respondAsProxy(200, {
          id: 1,
          title: "Slow Response",
          price: 100,
          timestamp: Date.now(),
        });
        return;
      case `${MOCK_API_PREFIX}/fast`:
        await respondAsProxy(200, {
          id: 1,
          title: "Fast Response",
          price: 50,
          timestamp: Date.now(),
        });
        return;
      case `${MOCK_API_PREFIX}/fail`:
        await respondAsProxy(500, { error: "Internal server error" });
        return;
      case `${MOCK_API_PREFIX}/list`:
        // 3-item array for Loop testing
        await respondAsProxy(200, [
          { id: 1, title: "Item 1" },
          { id: 2, title: "Item 2" },
          { id: 3, title: "Item 3" },
        ]);
        return;
      case `${MOCK_API_PREFIX}/token`:
        // Deterministic nested token field for edge-injection scenarios
        await respondAsProxy(200, {
          data: { token: "secret-token-abc" },
        });
        return;
      case `${MOCK_API_PREFIX}/echo`:
        // Echo the incoming request's headers back so a test can assert an
        // injected header/query value made it through to the target request.
        await respondAsProxy(200, {
          receivedHeaders: payload.headers ?? {},
          receivedUrl: url,
        });
        return;
      default:
        // Hermetic: never fall through to the live network. Fulfil with a
        // distinctive status so the test fails visibly, and log the culprit.
        console.error(`[chainRoutes] Unmocked proxy target: ${url}`);
        await route.fulfill({
          status: UNMOCKED_STATUS,
          contentType: "text/plain",
          body: `chainRoutes: no mock for ${url}`,
        });
    }
  });
}
