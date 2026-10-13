import { afterEach, describe, expect, it, vi } from "vitest";
import { RELAY_DAILY_MESSAGE_CAP, RELAY_USER_HEADER } from "@/lib/relay/constants";
import { guardRelayRequest } from "./guard";
import { getRelayApiKey, relayProviderOptions, RELAY_MODEL_ID } from "./model";
import {
  createMemoryCounter,
  RELAY_RATE_LIMIT_MAX,
  type RateLimitCounter,
} from "./rateLimit";

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
});

describe("guardRelayRequest", () => {
  it("returns 404 when the feature flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    configured();
    expect(
      await guardRelayRequest({ req: request(), lastMessageRole: "user" }),
    ).toEqual({ ok: false, code: "not_configured", status: 404 });
  });

  it("returns not_configured without naming any env var when the key is missing", async () => {
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const result = await guardRelayRequest({
      req: request(),
      lastMessageRole: "user",
    });
    expect(result).toEqual({ ok: false, code: "not_configured", status: 503 });
    const text = JSON.stringify(result);
    expect(text).not.toMatch(/KEY|DEEPSEEK|RELAY_/);
  });

  it("accepts the legacy key name server-side", () => {
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "legacy");
    expect(getRelayApiKey()).toBe("legacy");
  });

  it("allows a configured request under the limits", async () => {
    configured();
    expect(
      await guardRelayRequest(
        { req: request({ [RELAY_USER_HEADER]: "u1" }), lastMessageRole: "user" },
        { counter: createMemoryCounter() },
      ),
    ).toEqual({ ok: true });
  });

  it("trips the per-user limit independently of the IP", async () => {
    configured();
    const counter = createMemoryCounter();
    const call = (ip: string) =>
      guardRelayRequest(
        {
          req: request({ [RELAY_USER_HEADER]: "u1", "x-forwarded-for": ip }),
          lastMessageRole: "user",
        },
        { counter },
      );
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) {
      expect((await call(`10.0.0.${i}`)).ok).toBe(true);
    }
    const tripped = await call("10.9.9.9");
    expect(tripped).toMatchObject({
      ok: false,
      code: "rate_limited",
      status: 429,
    });
    expect(tripped.ok === false && tripped.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("trips the per-IP limit independently of the user", async () => {
    configured();
    const counter = createMemoryCounter();
    const call = (user: string) =>
      guardRelayRequest(
        {
          req: request({ [RELAY_USER_HEADER]: user, "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
          lastMessageRole: "user",
        },
        { counter },
      );
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) {
      expect((await call(`u${i}`)).ok).toBe(true);
    }
    expect(await call("fresh-user")).toMatchObject({
      ok: false,
      code: "rate_limited",
    });
  });

  it("limits by IP alone when the user header is absent", async () => {
    configured();
    const counter = createMemoryCounter();
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) {
      await guardRelayRequest(
        { req: request({ "x-real-ip": "9.9.9.9" }), lastMessageRole: "user" },
        { counter },
      );
    }
    expect(
      await guardRelayRequest(
        { req: request({ "x-real-ip": "9.9.9.9" }), lastMessageRole: "user" },
        { counter },
      ),
    ).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("does not consume quota for tool-continuation requests", async () => {
    configured();
    const counter: RateLimitCounter = {
      incr: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
    };
    const result = await guardRelayRequest(
      { req: request({ [RELAY_USER_HEADER]: "u1" }), lastMessageRole: "assistant" },
      { counter },
    );
    expect(result).toEqual({ ok: true });
    expect(counter.incr).not.toHaveBeenCalled();
  });
});

describe("daily soft cap", () => {
  const PROVIDER_WORDS = /deepseek|openai|anthropic|claude|gpt/i;

  it("trips after the cap with a mapped code, no retry hint and no provider text", async () => {
    configured();
    const counts = new Map<string, number>();
    const counter: RateLimitCounter = {
      // Burst keys never trip here; only the day-long key reaches the cap.
      incr: async (key) => {
        if (!key.startsWith("relay:daily:")) return 1;
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return next;
      },
      expire: async () => undefined,
      ttl: async () => -1,
    };
    const input = {
      req: request({ [RELAY_USER_HEADER]: "u-daily" }),
      lastMessageRole: "user",
    };
    for (let i = 0; i < RELAY_DAILY_MESSAGE_CAP; i += 1) {
      expect(await guardRelayRequest(input, { counter })).toEqual({ ok: true });
    }
    const rejected = await guardRelayRequest(input, { counter });
    expect(rejected).toEqual({ ok: false, code: "rate_limited", status: 429 });
    expect(JSON.stringify(rejected)).not.toMatch(PROVIDER_WORDS);
  });

  it("does not count tool-continuation requests", async () => {
    configured();
    const counter = createMemoryCounter();
    const spy = vi.spyOn(counter, "incr");
    await guardRelayRequest({ req: request(), lastMessageRole: "assistant" }, { counter });
    expect(spy).not.toHaveBeenCalled();
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
