import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const request = (headers: Record<string, string> = {}) =>
  new Request("https://app.test/api/relay/stt/status", { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/relay/stt/status", () => {
  it("[success] reports configured true without exposing the key", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-secret-key");
    const res = GET(request());
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ configured: true });
    expect(text).not.toContain("xai-secret-key");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("[success] reports configured false when the key is missing or empty", async () => {
    vi.stubEnv("XAI_API_KEY", "");
    expect(await GET(request()).json()).toEqual({ configured: false });
  });

  it("[invalid] rejects a cross-origin caller with 403", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-secret-key");
    const res = GET(request({ origin: "https://evil.test", host: "app.test" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "relay_unavailable" });
  });

  it("[success] accepts a same-origin browser call", async () => {
    vi.stubEnv("XAI_API_KEY", "k");
    const res = GET(request({ origin: "https://app.test", host: "app.test" }));
    expect(res.status).toBe(200);
  });

  it("[invalid] returns 404 when the Relay flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    vi.stubEnv("XAI_API_KEY", "xai-secret-key");
    const res = GET(request());
    const text = await res.text();
    expect(res.status).toBe(404);
    expect(JSON.parse(text)).toEqual({ error: "not_configured" });
    expect(text).not.toContain("xai-secret-key");
  });
});
