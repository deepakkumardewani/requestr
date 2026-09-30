import type { Page, Route } from "@playwright/test";

/**
 * Installs hermetic route handlers for chain testing.
 * Intercepts /api/proxy requests and returns deterministic responses
 * with scripted delays, preventing external network calls.
 *
 * Routes mocked:
 * - /slow: 5000ms delay, deterministic JSON body
 * - /fast: 0ms delay, deterministic JSON body
 * - /fail: 500 HTTP error status
 * - /list: 3-item array for Loop testing
 * - Other endpoints: passed through to live service (unchanged)
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

    // Check the requested URL for test endpoints
    if (url.includes("/slow")) {
      // Simulate 5s delay then return deterministic JSON
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await respondAsProxy(200, {
        id: 1,
        title: "Slow Response",
        price: 100,
        timestamp: Date.now(),
      });
      return;
    }

    if (url.includes("/fast")) {
      // Return immediately with deterministic JSON
      await respondAsProxy(200, {
        id: 1,
        title: "Fast Response",
        price: 50,
        timestamp: Date.now(),
      });
      return;
    }

    if (url.includes("/fail")) {
      // Return error status
      await respondAsProxy(500, { error: "Internal server error" });
      return;
    }

    if (url.includes("/list")) {
      // Return 3-item array for Loop testing
      await respondAsProxy(200, [
        { id: 1, title: "Item 1" },
        { id: 2, title: "Item 2" },
        { id: 3, title: "Item 3" },
      ]);
      return;
    }

    if (url.includes("/token")) {
      // Deterministic nested token field for edge-injection scenarios
      await respondAsProxy(200, {
        data: { token: "secret-token-abc" },
      });
      return;
    }

    if (url.includes("/echo")) {
      // Echo the incoming request's headers back so a test can assert an
      // injected header/query value made it through to the target request.
      await respondAsProxy(200, {
        receivedHeaders: payload.headers ?? {},
        receivedUrl: url,
      });
      return;
    }

    // Pass through all other requests (live endpoints like dummyjson.com)
    await route.continue();
  });
}
