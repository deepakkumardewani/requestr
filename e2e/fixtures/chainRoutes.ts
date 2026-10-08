import type { Page, Route } from "@playwright/test";

const MOCK_API_PREFIX = "/api";
const SLOW_DELAY_MS = 5000;
const MEDIUM_DELAY_MS = 1500;
const UNMOCKED_STATUS = 599;
/** Console message emitted for every 599 fallback — tests may allowlist this via allowExpectedConsoleError. */
export const UNMOCKED_CONSOLE_MSG_PREFIX =
  "[chainRoutes] Unmocked proxy target:";

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
      // Invalid JSON so the client records REQUEST_FAILED without a browser
      // "Failed to load resource" console error (route.abort logs one).
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "not-json",
      });
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
      case `${MOCK_API_PREFIX}/users`:
        await respondAsProxy(200, [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ]);
        return;
      case `${MOCK_API_PREFIX}/empty-list`:
        await respondAsProxy(200, []);
        return;
      case `${MOCK_API_PREFIX}/object`:
        await respondAsProxy(200, {
          key: "value",
          count: 42,
          items: [{ id: 1 }, { id: 2 }],
        });
        return;
      case `${MOCK_API_PREFIX}/list-one-fail`:
        await respondAsProxy(200, [{ id: 1 }, { id: "fail" }, { id: 3 }]);
        return;
      case `${MOCK_API_PREFIX}/text`:
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "text/plain" },
            body: "plain text response",
          }),
        });
        return;
      case `${MOCK_API_PREFIX}/status/404`:
        await respondAsProxy(404, { error: "Not Found" });
        return;
      case `${MOCK_API_PREFIX}/score`:
        await respondAsProxy(200, { score: 7, label: "seven" });
        return;
      case `${MOCK_API_PREFIX}/medium`:
        // 1.5s delay — intermediate between fast and slow
        await new Promise((resolve) => setTimeout(resolve, MEDIUM_DELAY_MS));
        await respondAsProxy(200, { id: 1, title: "Medium Response" });
        return;
      case `${MOCK_API_PREFIX}/list-mixed`:
        await respondAsProxy(200, [
          { id: 1, value: "string" },
          { id: 2, value: 42 },
          { id: 3, value: null },
        ]);
        return;
      case `${MOCK_API_PREFIX}/list-60`: {
        const items = Array.from({ length: 60 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
        }));
        await respondAsProxy(200, items);
        return;
      }
      case `${MOCK_API_PREFIX}/abort`:
        // Unparseable proxy body: the client throws a non-Error request
        // failure (REQUEST_FAILED) and the browser does not log a failed load.
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: "not-json",
        });
        return;
      case `${MOCK_API_PREFIX}/item/1`:
        await respondAsProxy(200, { id: 1, name: "Item 1" });
        return;
      case `${MOCK_API_PREFIX}/item/3`:
        await respondAsProxy(200, { id: 3, name: "Item 3" });
        return;
      case `${MOCK_API_PREFIX}/item/fail`:
        await respondAsProxy(500, { error: "Item lookup failed" });
        return;
      default:
        // Hermetic: never fall through to the live network. Fulfil with a
        // distinctive status so the test fails visibly, and log the culprit.
        console.error(`${UNMOCKED_CONSOLE_MSG_PREFIX} ${url}`);
        // Envelope, not a raw 599, so the chain records HTTP_STATUS and the
        // browser does not log a failed resource load.
        await respondAsProxy(UNMOCKED_STATUS, { error: "unmocked" });
    }
  });
}
