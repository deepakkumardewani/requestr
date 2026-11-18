import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_DAILY_MESSAGE_CAP,
  RELAY_RATE_LIMIT_MAX,
  RELAY_REQUEST_RATE_MAX,
  RELAY_USER_HEADER,
} from "@/lib/relay/constants";
import {
  guardRelayRequest,
  guardRelayTurn,
  isRelayFlagOff,
  isSameOrigin,
} from "./guard";
import { getRelayApiKey, relayProviderOptions, RELAY_MODEL_ID } from "./model";
import { createMemoryCounter, type RateLimitCounter } from "./rateLimit";

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/relay/chat", {
    method: "POST",
    headers,
  });
}

function configured() {
  vi.stubEnv("RELAY_API_KEY", "test-key");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("guardRelayRequest (before the body is read)", () => {
  it("returns 404 when the feature flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    configured();
    expect(await guardRelayRequest({ req: request() })).toEqual({
      ok: false,
      code: "not_configured",
      status: 404,
    });
  });

  it("returns not_configured without naming any env var when the key is missing", async () => {
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const result = await guardRelayRequest({ req: request() });
    expect(result).toEqual({ ok: false, code: "not_configured", status: 503 });
    expect(JSON.stringify(result)).not.toMatch(/KEY|DEEPSEEK|RELAY_/);
  });

  it("accepts the legacy key name server-side", () => {
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "legacy");
    expect(getRelayApiKey()).toBe("legacy");
  });

  it("refuses the request after RELAY_REQUEST_RATE_MAX in one window", async () => {
    configured();
    const counter = createMemoryCounter();
    const call = () =>
      guardRelayRequest({ req: request({ "x-real-ip": "9.9.9.9" }) }, { counter });
    for (let i = 0; i < RELAY_REQUEST_RATE_MAX; i += 1) {
      expect(await call()).toEqual({ ok: true });
    }
    const refused = await call();
    expect(refused).toMatchObject({ ok: false, code: "rate_limited", status: 429 });
    expect(refused.ok === false && refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("ignores a spoofed x-forwarded-for and buckets by x-real-ip", async () => {
    configured();
    const counter = createMemoryCounter();
    const call = (spoof: string) =>
      guardRelayRequest(
        { req: request({ "x-real-ip": "9.9.9.9", "x-forwarded-for": spoof }) },
        { counter },
      );
    for (let i = 0; i < RELAY_REQUEST_RATE_MAX; i += 1) await call(`10.0.0.${i}`);
    expect(await call("10.9.9.9")).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("falls back to the memory counter when Redis throws", async () => {
    configured();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom = vi.fn().mockRejectedValue(new Error("redis down"));
    const counter: RateLimitCounter = {
      incr: boom,
      expire: boom,
      ttl: boom,
      incrWithExpiry: boom,
    };
    expect(await guardRelayRequest({ req: request() }, { counter })).toEqual({
      ok: true,
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("rate-limit counter failed"),
      expect.objectContaining({ op: "incrWithExpiry" }),
    );
  });

  it("truncates a long header value in the counter key", async () => {
    configured();
    const counter = createMemoryCounter();
    const spy = vi.spyOn(counter, "incrWithExpiry");
    await guardRelayRequest({ req: request({ "x-real-ip": "a".repeat(1024) }) }, { counter });
    const key = spy.mock.calls[0]?.[0] ?? "";
    expect(key.length).toBeLessThan(200);
  });
});

describe("guardRelayTurn (after the body is parsed)", () => {
  it("allows a user turn under the limits", async () => {
    expect(
      await guardRelayTurn(
        { req: request({ [RELAY_USER_HEADER]: "u1" }), lastMessageRole: "user" },
        { counter: createMemoryCounter() },
      ),
    ).toEqual({ ok: true });
  });

  it("trips the per-user limit independently of the IP", async () => {
    const counter = createMemoryCounter();
    const call = (ip: string) =>
      guardRelayTurn(
        {
          req: request({ [RELAY_USER_HEADER]: "u1", "x-real-ip": ip }),
          lastMessageRole: "user",
        },
        { counter },
      );
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) {
      expect((await call(`10.0.0.${i}`)).ok).toBe(true);
    }
    const tripped = await call("10.9.9.9");
    expect(tripped).toMatchObject({ ok: false, code: "rate_limited", status: 429 });
    expect(tripped.ok === false && tripped.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("trips the per-IP limit however the user header is rotated", async () => {
    const counter = createMemoryCounter();
    const call = (user: string) =>
      guardRelayTurn(
        {
          req: request({ [RELAY_USER_HEADER]: user, "x-real-ip": "1.2.3.4" }),
          lastMessageRole: "user",
        },
        { counter },
      );
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) {
      expect((await call(`u${i}`)).ok).toBe(true);
    }
    expect(await call("fresh-user")).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("limits by IP alone when the user header is absent", async () => {
    const counter = createMemoryCounter();
    const input = { req: request({ "x-real-ip": "9.9.9.9" }), lastMessageRole: "user" };
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) await guardRelayTurn(input, { counter });
    expect(await guardRelayTurn(input, { counter })).toMatchObject({
      ok: false,
      code: "rate_limited",
    });
  });

  it("does not charge a tool-continuation request as a turn", async () => {
    const counter = createMemoryCounter();
    const spy = vi.spyOn(counter, "incrWithExpiry");
    expect(
      await guardRelayTurn({ req: request(), lastMessageRole: "assistant" }, { counter }),
    ).toEqual({ ok: true });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("daily soft cap", () => {
  const PROVIDER_WORDS = /deepseek|openai|anthropic|claude|gpt/i;

  it("trips after the cap with a mapped code, no retry hint and no provider text", async () => {
    const counts = new Map<string, number>();
    const counter: RateLimitCounter = {
      incr: async () => 1,
      expire: async () => undefined,
      ttl: async () => -1,
      // Burst keys never trip here; only the day-long key reaches the cap.
      incrWithExpiry: async (key) => {
        if (!key.startsWith("relay:daily:turns:")) return 1;
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return next;
      },
    };
    const input = { req: request({ "x-real-ip": "5.5.5.5" }), lastMessageRole: "user" };
    for (let i = 0; i < RELAY_DAILY_MESSAGE_CAP; i += 1) {
      expect(await guardRelayTurn(input, { counter })).toEqual({ ok: true });
    }
    const rejected = await guardRelayTurn(input, { counter });
    expect(rejected).toEqual({ ok: false, code: "rate_limited", status: 429 });
    expect(JSON.stringify(rejected)).not.toMatch(PROVIDER_WORDS);
  });

  it("is not reset by rotating x-relay-user", async () => {
    const counter = createMemoryCounter();
    const call = (user: string) =>
      guardRelayTurn(
        {
          req: request({ [RELAY_USER_HEADER]: user, "x-real-ip": "6.6.6.6" }),
          lastMessageRole: "user",
        },
        { counter },
      );
    // Each rotated user stays under the burst cap, so only the IP daily cap can trip.
    let rejected = false;
    for (let i = 0; i <= RELAY_DAILY_MESSAGE_CAP && !rejected; i += 1) {
      rejected = !(await call(`u${i}`)).ok;
    }
    expect(rejected).toBe(true);
  });
});

describe("isSameOrigin", () => {
  it("accepts a matching Origin host", () => {
    expect(
      isSameOrigin(request({ origin: "http://localhost", host: "localhost" })),
    ).toBe(true);
  });

  it("accepts a missing Origin only with Sec-Fetch-Site same-origin", () => {
    expect(isSameOrigin(request({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(request())).toBe(false);
    expect(isSameOrigin(request({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});

describe("model", () => {
  it("disables thinking mode explicitly (FR-24)", () => {
    expect(relayProviderOptions).toEqual({
      deepseek: { thinking: { type: "disabled" } },
    });
    expect(RELAY_MODEL_ID).toBe("deepseek-flash");
  });
});

describe("isSameOrigin edge cases", () => {
  it("rejects a different Origin host and an unparsable Origin", () => {
    expect(isSameOrigin(request({ origin: "http://evil.test", host: "localhost" }))).toBe(false);
    expect(isSameOrigin(request({ origin: "not a url", host: "localhost" }))).toBe(false);
  });

  it("rejects a cross-site Origin even when Sec-Fetch-Site claims same-origin", () => {
    expect(
      isSameOrigin(
        request({
          origin: "http://evil.test",
          host: "localhost",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(false);
  });
});

describe("isRelayFlagOff", () => {
  it("tracks the build flag", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    expect(isRelayFlagOff()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "true");
    expect(isRelayFlagOff()).toBe(false);
  });
});

describe("request limit boundary", () => {
  it("allows the 360th request and rejects the 361st with a retry hint", async () => {
    configured();
    const counter = createMemoryCounter();
    const call = () =>
      guardRelayRequest({ req: request({ "x-real-ip": "7.7.7.7" }) }, { counter });
    for (let i = 0; i < 360; i += 1) {
      expect(await call()).toEqual({ ok: true });
    }
    expect(await call()).toEqual({
      ok: false,
      code: "rate_limited",
      status: 429,
      retryAfterSeconds: 600,
    });
  });
});

describe("IPv6 clients", () => {
  it("buckets each IPv6 address separately and keeps the full address", async () => {
    configured();
    const counter = createMemoryCounter();
    const spy = vi.spyOn(counter, "incrWithExpiry");
    const a = "2001:db8::1";
    const b = "2001:db8::2";
    for (let i = 0; i < 360; i += 1) {
      await guardRelayRequest({ req: request({ "x-real-ip": a }) }, { counter });
    }
    expect(
      await guardRelayRequest({ req: request({ "x-real-ip": a }) }, { counter }),
    ).toMatchObject({ ok: false, code: "rate_limited" });
    expect(
      await guardRelayRequest({ req: request({ "x-real-ip": b }) }, { counter }),
    ).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledWith(`relay:ratelimit:requests:ip:${a}`, 600);
  });
});

describe("missing trusted IP header", () => {
  it("shares one bucket and logs the problem exactly once", async () => {
    vi.resetModules();
    configured();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fresh = await import("./guard");
    const rate = await import("./rateLimit");
    const counter = rate.createMemoryCounter();
    const spy = vi.spyOn(counter, "incrWithExpiry");
    await fresh.guardRelayRequest({ req: request() }, { counter });
    await fresh.guardRelayRequest({ req: request({ "x-real-ip": "  " }) }, { counter });
    await fresh.guardRelayTurn(
      { req: request(), lastMessageRole: "user" },
      { counter },
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("x-real-ip");
    expect(spy).toHaveBeenCalledWith("relay:ratelimit:requests:ip:unknown", 600);
    expect(spy).toHaveBeenCalledWith("relay:ratelimit:turns:ip:unknown", 600);
    errorSpy.mockRestore();
  });
});

describe("route profiles", () => {
  it("stt works without the LLM key but not with the flag off", async () => {
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const counter = createMemoryCounter();
    expect(
      await guardRelayRequest({ req: request({ "x-real-ip": "1.1.1.1" }), route: "stt" }, { counter }),
    ).toEqual({ ok: true });
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    expect(
      await guardRelayRequest({ req: request({ "x-real-ip": "1.1.1.1" }), route: "stt" }, { counter }),
    ).toEqual({ ok: false, code: "not_configured", status: 404 });
  });

  it("ai works with the Relay flag off but needs the LLM key", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    configured();
    const counter = createMemoryCounter();
    const req = () => request({ "x-real-ip": "2.2.2.2" });
    expect(await guardRelayRequest({ req: req(), route: "ai" }, { counter })).toEqual({
      ok: true,
    });
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(await guardRelayRequest({ req: req(), route: "ai" }, { counter })).toEqual({
      ok: false,
      code: "not_configured",
      status: 503,
    });
  });

  it("ai and chat budgets are independent in both directions", async () => {
    configured();
    const counter = createMemoryCounter();
    const headers = { "x-real-ip": "3.3.3.3" };
    const chat = () => guardRelayRequest({ req: request(headers) }, { counter });
    const ai = () => guardRelayRequest({ req: request(headers), route: "ai" }, { counter });

    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) await ai();
    expect(await ai()).toMatchObject({ ok: false, code: "rate_limited" });
    expect(await chat()).toEqual({ ok: true });

    const other = { "x-real-ip": "4.4.4.4" };
    for (let i = 0; i < RELAY_REQUEST_RATE_MAX; i += 1) {
      await guardRelayRequest({ req: request(other) }, { counter });
    }
    expect(
      await guardRelayRequest({ req: request(other) }, { counter }),
    ).toMatchObject({ ok: false, code: "rate_limited" });
    expect(
      await guardRelayRequest({ req: request(other), route: "ai" }, { counter }),
    ).toEqual({ ok: true });
  });
});

describe("guardRelayTurn role gating", () => {
  it.each([undefined, "assistant", "tool", "system"])(
    "does not charge a %s-last request",
    async (role) => {
      const counter = createMemoryCounter();
      const spy = vi.spyOn(counter, "incrWithExpiry");
      expect(await guardRelayTurn({ req: request(), lastMessageRole: role }, { counter })).toEqual({
        ok: true,
      });
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it("charges the user scope on top of the IP scope", async () => {
    const counter = createMemoryCounter();
    const spy = vi.spyOn(counter, "incrWithExpiry");
    await guardRelayTurn(
      {
        req: request({ "x-real-ip": "8.8.8.8", [RELAY_USER_HEADER]: " alice " }),
        lastMessageRole: "user",
      },
      { counter },
    );
    const keys = spy.mock.calls.map(([key]) => key);
    expect(keys).toContain("relay:ratelimit:turns:ip:8.8.8.8");
    expect(keys).toContain("relay:ratelimit:turns:user:alice");
  });
});
