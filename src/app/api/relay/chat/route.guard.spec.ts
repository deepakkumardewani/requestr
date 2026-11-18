/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_REQUEST_RATE_MAX } from "@/lib/relay/constants";
import { guardRelayRequest } from "@/lib/relay/server/guard";
import { POST } from "./route";

const JUNK_BODY = "{not json";

function junkRequest(ip: string, body: BodyInit = JUNK_BODY): Request {
  return new Request("http://localhost/api/relay/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      "x-real-ip": ip,
    },
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("RELAY_API_KEY", "test-key");
  vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/relay/chat guard failures return coded errors", () => {
  it("returns not_configured (404) before reading the body when the flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    const req = junkRequest("198.51.100.1");
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(req.bodyUsed).toBe(false);
  });

  it("returns not_configured (503) before reading the body when the key is missing", async () => {
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const req = junkRequest("198.51.100.2");
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(req.bodyUsed).toBe(false);
  });
});

describe("POST /api/relay/chat meters before parsing (HH-M30)", () => {
  it("charges junk bodies, then rejects with rate_limited without reading the next body", async () => {
    const ip = "198.51.100.10";
    for (let i = 0; i < RELAY_REQUEST_RATE_MAX; i += 1) {
      const res = await POST(junkRequest(ip));
      expect(res.status).toBe(400);
    }

    const req = junkRequest(ip);
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "rate_limited" });
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(req.bodyUsed).toBe(false);
  });

  it("meters per client IP, so one IP spending its budget leaves another untouched", async () => {
    const spent = "198.51.100.11";
    for (let i = 0; i <= RELAY_REQUEST_RATE_MAX; i += 1) {
      await POST(junkRequest(spent));
    }
    const other = await POST(junkRequest("198.51.100.12"));
    expect(other.status).toBe(400);
  });
});

describe("chat and inline AI budgets are independent (HH-H08)", () => {
  it("spending chat's request budget leaves inline AI's budget for the same IP", async () => {
    const ip = "198.51.100.20";
    for (let i = 0; i <= RELAY_REQUEST_RATE_MAX; i += 1) {
      await POST(junkRequest(ip));
    }
    const chat = await POST(junkRequest(ip));
    expect(chat.status).toBe(429);

    const ai = await guardRelayRequest({
      route: "ai",
      req: new Request("http://localhost/api/ai", {
        headers: { "x-real-ip": ip },
      }),
    });
    expect(ai.ok).toBe(true);
  });
});
