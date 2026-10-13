import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeRateLimit,
  createMemoryCounter,
  getDefaultCounter,
  RELAY_RATE_LIMIT_MAX,
  RELAY_RATE_LIMIT_WINDOW_SEC,
  type RateLimitCounter,
} from "./rateLimit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("consumeRateLimit", () => {
  it("allows up to the cap then returns the remaining window as Retry-After", async () => {
    let nowMs = 0;
    const counter = createMemoryCounter(() => nowMs);
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) {
      expect(await consumeRateLimit("user:a", counter)).toEqual({
        allowed: true,
      });
    }
    nowMs = 100_000;
    expect(await consumeRateLimit("user:a", counter)).toEqual({
      allowed: false,
      retryAfterSeconds: RELAY_RATE_LIMIT_WINDOW_SEC - 100,
    });
  });

  it("keeps scopes independent", async () => {
    const counter = createMemoryCounter();
    for (let i = 0; i <= RELAY_RATE_LIMIT_MAX; i += 1) {
      await consumeRateLimit("user:a", counter);
    }
    expect(await consumeRateLimit("user:b", counter)).toEqual({ allowed: true });
  });

  it("starts a new window once the old one expires", async () => {
    let nowMs = 0;
    const counter = createMemoryCounter(() => nowMs);
    for (let i = 0; i <= RELAY_RATE_LIMIT_MAX; i += 1) {
      await consumeRateLimit("ip:1", counter);
    }
    nowMs = RELAY_RATE_LIMIT_WINDOW_SEC * 1000 + 1;
    expect(await consumeRateLimit("ip:1", counter)).toEqual({ allowed: true });
  });

  it("sets the expiry only on the first increment", async () => {
    const counter: RateLimitCounter = {
      incr: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn(),
    };
    await consumeRateLimit("user:a", counter);
    await consumeRateLimit("user:a", counter);
    expect(counter.expire).toHaveBeenCalledTimes(1);
    expect(counter.expire).toHaveBeenCalledWith(
      "relay:ratelimit:user:a",
      RELAY_RATE_LIMIT_WINDOW_SEC,
    );
  });

  it("falls back to the full window when the key has no TTL", async () => {
    const counter: RateLimitCounter = {
      incr: vi.fn().mockResolvedValue(RELAY_RATE_LIMIT_MAX + 1),
      expire: vi.fn(),
      ttl: vi.fn().mockResolvedValue(-1),
    };
    expect(await consumeRateLimit("user:a", counter)).toEqual({
      allowed: false,
      retryAfterSeconds: RELAY_RATE_LIMIT_WINDOW_SEC,
    });
  });
});

describe("getDefaultCounter", () => {
  it("uses the shared in-memory counter when Redis is not configured", async () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(await getDefaultCounter()).toBe(await getDefaultCounter());
  });

  it("uses local Redis when REDIS_URL is set", async () => {
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const fakeLocal = { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() };
    vi.doMock("./localRedisCounter", () => ({
      getLocalRedisCounter: () => fakeLocal,
    }));
    const { getDefaultCounter: fresh } = await import("./rateLimit");
    expect(await fresh()).toBe(fakeLocal);
  });

  it("prefers REDIS_URL over Upstash when both are set", async () => {
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const fakeLocal = { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() };
    vi.doMock("./localRedisCounter", () => ({
      getLocalRedisCounter: () => fakeLocal,
    }));
    vi.doMock("@/lib/redis", () => ({
      redis: { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() },
    }));
    const { getDefaultCounter: fresh } = await import("./rateLimit");
    expect(await fresh()).toBe(fakeLocal);
  });

  it("uses Upstash when REDIS_URL is unset and both Upstash env vars are set", async () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const fakeRedis = { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() };
    vi.doMock("@/lib/redis", () => ({ redis: fakeRedis }));
    const { getDefaultCounter: fresh } = await import("./rateLimit");
    expect(await fresh()).toBe(fakeRedis);
  });
});
