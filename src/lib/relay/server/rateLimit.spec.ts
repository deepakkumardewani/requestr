import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_RATE_LIMIT_MAX,
  RELAY_RATE_LIMIT_WINDOW_SEC,
} from "@/lib/relay/constants";
import {
  boundedScope,
  consumeRateLimit,
  createCounter,
  createMemoryCounter,
  getDefaultCounter,
  type RateLimitCounter,
  type RateLimitWindow,
  withMemoryFallback,
} from "./rateLimit";

const BURST: RateLimitWindow = {
  prefix: "relay:ratelimit:",
  max: RELAY_RATE_LIMIT_MAX,
  windowSec: RELAY_RATE_LIMIT_WINDOW_SEC,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("consumeRateLimit", () => {
  it("allows up to the cap then returns the remaining window as Retry-After", async () => {
    let nowMs = 0;
    const counter = createMemoryCounter(() => nowMs);
    for (let i = 0; i < RELAY_RATE_LIMIT_MAX; i += 1) {
      expect(await consumeRateLimit("user:a", counter, BURST)).toEqual({
        allowed: true,
      });
    }
    nowMs = 100_000;
    expect(await consumeRateLimit("user:a", counter, BURST)).toEqual({
      allowed: false,
      retryAfterSeconds: RELAY_RATE_LIMIT_WINDOW_SEC - 100,
    });
  });

  it("keeps scopes independent", async () => {
    const counter = createMemoryCounter();
    for (let i = 0; i <= RELAY_RATE_LIMIT_MAX; i += 1) {
      await consumeRateLimit("user:a", counter, BURST);
    }
    expect(await consumeRateLimit("user:b", counter, BURST)).toEqual({ allowed: true });
  });

  it("starts a new window once the old one expires", async () => {
    let nowMs = 0;
    const counter = createMemoryCounter(() => nowMs);
    for (let i = 0; i <= RELAY_RATE_LIMIT_MAX; i += 1) {
      await consumeRateLimit("ip:1", counter, BURST);
    }
    nowMs = RELAY_RATE_LIMIT_WINDOW_SEC * 1000 + 1;
    expect(await consumeRateLimit("ip:1", counter, BURST)).toEqual({ allowed: true });
  });

  it("opens the window with a single atomic call", async () => {
    const counter: RateLimitCounter = {
      incr: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      incrWithExpiry: vi.fn().mockResolvedValue(1),
    };
    await consumeRateLimit("user:a", counter, BURST);
    expect(counter.incrWithExpiry).toHaveBeenCalledWith(
      "relay:ratelimit:user:a",
      RELAY_RATE_LIMIT_WINDOW_SEC,
    );
    expect(counter.incr).not.toHaveBeenCalled();
  });

  it("restarts the window of a blocked key that has no TTL", async () => {
    const counter: RateLimitCounter = {
      incr: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn().mockResolvedValue(-1),
      incrWithExpiry: vi.fn().mockResolvedValue(RELAY_RATE_LIMIT_MAX + 1),
    };
    expect(await consumeRateLimit("user:a", counter, BURST)).toEqual({
      allowed: false,
      retryAfterSeconds: RELAY_RATE_LIMIT_WINDOW_SEC,
    });
    expect(counter.expire).toHaveBeenCalledWith(
      "relay:ratelimit:user:a",
      RELAY_RATE_LIMIT_WINDOW_SEC,
    );
  });
});

function fakeCounter(): RateLimitCounter {
  return {
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    incrWithExpiry: vi.fn(),
  };
}

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
    const fakeLocal = fakeCounter();
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
    const fakeLocal = fakeCounter();
    vi.doMock("./localRedisCounter", () => ({
      getLocalRedisCounter: () => fakeLocal,
    }));
    vi.doMock("@/lib/redis", () => ({
      upstashCounter: fakeCounter(),
    }));
    const { getDefaultCounter: fresh } = await import("./rateLimit");
    expect(await fresh()).toBe(fakeLocal);
  });

  it("uses Upstash when REDIS_URL is unset and both Upstash env vars are set", async () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const fakeRedis = fakeCounter();
    vi.doMock("@/lib/redis", () => ({ upstashCounter: fakeRedis }));
    const { getDefaultCounter: fresh } = await import("./rateLimit");
    expect(await fresh()).toBe(fakeRedis);
  });
});

describe("createCounter", () => {
  function fakeOps(setResult: boolean, incrResult: number) {
    return {
      incr: vi.fn().mockResolvedValue(incrResult),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(-1),
      setIfAbsent: vi.fn().mockResolvedValue(setResult),
    };
  }

  it("creates the key with its TTL in one SET and never calls INCR", async () => {
    const ops = fakeOps(true, 99);
    const counter = createCounter(ops);
    expect(await counter.incrWithExpiry("k", 60)).toBe(1);
    expect(ops.setIfAbsent).toHaveBeenCalledWith("k", 60);
    expect(ops.incr).not.toHaveBeenCalled();
    expect(ops.expire).not.toHaveBeenCalled();
  });

  it("increments an existing key without touching a live TTL", async () => {
    const ops = fakeOps(false, 7);
    ops.ttl.mockResolvedValue(30);
    const counter = createCounter(ops);
    expect(await counter.incrWithExpiry("k", 60)).toBe(7);
    expect(ops.expire).not.toHaveBeenCalled();
  });

  it("repairs a TTL-less key left by an earlier failed expire", async () => {
    const ops = fakeOps(false, 7);
    ops.ttl.mockResolvedValue(-1);
    const counter = createCounter(ops);
    expect(await counter.incrWithExpiry("k", 60)).toBe(7);
    expect(ops.expire).toHaveBeenCalledWith("k", 60);
  });

  it("surfaces a failed expire after a bare INCR so the caller can fall back", async () => {
    const ops = fakeOps(false, 1);
    ops.expire.mockRejectedValue(new Error("expire failed"));
    const counter = createCounter(ops);
    await expect(counter.incrWithExpiry("k", 60)).rejects.toThrow("expire failed");
  });

  it("re-applies the TTL when INCR recreated an expired key bare", async () => {
    const ops = fakeOps(false, 1);
    const counter = createCounter(ops);
    expect(await counter.incrWithExpiry("k", 60)).toBe(1);
    expect(ops.expire).toHaveBeenCalledWith("k", 60);
  });

  it("passes incr, expire and ttl straight through", async () => {
    const ops = fakeOps(false, 5);
    ops.ttl.mockResolvedValue(42);
    const counter = createCounter(ops);
    expect(await counter.incr("k")).toBe(5);
    expect(await counter.ttl("k")).toBe(42);
    await counter.expire("k", 9);
    expect(ops.expire).toHaveBeenCalledWith("k", 9);
  });
});

describe("createMemoryCounter", () => {
  it("incr creates a key with no TTL, then expire gives it one", async () => {
    let nowMs = 0;
    const counter = createMemoryCounter(() => nowMs);
    expect(await counter.incr("k")).toBe(1);
    expect(await counter.incr("k")).toBe(2);
    expect(await counter.ttl("k")).toBe(-1);
    await counter.expire("k", 30);
    expect(await counter.ttl("k")).toBe(30);
    nowMs = 10_500;
    expect(await counter.ttl("k")).toBe(20);
    nowMs = 30_000;
    expect(await counter.ttl("k")).toBe(-1);
    expect(await counter.incr("k")).toBe(1);
  });

  it("expire on a missing key does nothing", async () => {
    const counter = createMemoryCounter(() => 0);
    await counter.expire("ghost", 30);
    expect(await counter.ttl("ghost")).toBe(-1);
    expect(await counter.incrWithExpiry("ghost", 30)).toBe(1);
  });

  it("incrWithExpiry counts up inside the window", async () => {
    const counter = createMemoryCounter(() => 0);
    expect(await counter.incrWithExpiry("k", 60)).toBe(1);
    expect(await counter.incrWithExpiry("k", 60)).toBe(2);
    expect(await counter.ttl("k")).toBe(60);
  });

  it("never holds more than maxKeys when 20,000 distinct keys arrive", async () => {
    const counter = createMemoryCounter(() => 0, 10_000);
    for (let i = 0; i < 20_000; i += 1) {
      await counter.incrWithExpiry(`ip:${i}`, 600);
    }
    // The oldest 10,000 were evicted, the newest 10,000 remain.
    expect(await counter.ttl("ip:0")).toBe(-1);
    expect(await counter.ttl("ip:9999")).toBe(-1);
    expect(await counter.ttl("ip:10000")).toBe(600);
    expect(await counter.ttl("ip:19999")).toBe(600);
    expect(await counter.incrWithExpiry("ip:19999", 600)).toBe(2);
  });

  it("evicts the oldest insert when full of live keys", async () => {
    const counter = createMemoryCounter(() => 0, 3);
    await counter.incrWithExpiry("a", 600);
    await counter.incrWithExpiry("b", 600);
    await counter.incrWithExpiry("c", 600);
    await counter.incrWithExpiry("d", 600);
    expect(await counter.incrWithExpiry("a", 600)).toBe(1);
    expect(await counter.incrWithExpiry("c", 600)).toBe(2);
  });

  it("sweeps expired keys first and keeps live ones without re-reading them", async () => {
    let nowMs = 0;
    const counter = createMemoryCounter(() => nowMs, 3);
    await counter.incrWithExpiry("old1", 10);
    await counter.incrWithExpiry("old2", 10);
    await counter.incrWithExpiry("live", 1000);
    nowMs = 20_000;
    await counter.incrWithExpiry("fresh", 10);
    // `live` survived the sweep, so no live key was evicted for room.
    expect(await counter.incrWithExpiry("live", 1000)).toBe(2);
    expect(await counter.incrWithExpiry("fresh", 10)).toBe(2);
  });
});

describe("withMemoryFallback", () => {
  const ops = ["incr", "expire", "ttl", "incrWithExpiry"] as const;

  function throwingCounter(): RateLimitCounter {
    const boom = () => Promise.reject(new Error("redis down"));
    return { incr: boom, expire: boom, ttl: boom, incrWithExpiry: boom };
  }

  it.each(ops)("serves %s from the fallback and logs context when the primary throws", async (op) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fallback = fakeCounter();
    vi.mocked(fallback[op]).mockResolvedValue(11 as never);
    const guarded = withMemoryFallback(throwingCounter(), fallback);
    const result = await (guarded[op] as (...a: unknown[]) => Promise<unknown>)("k", 5);
    expect(result).toBe(11);
    expect(fallback[op]).toHaveBeenCalledWith("k", 5);
    expect(errorSpy).toHaveBeenCalledWith(
      "[relay] rate-limit counter failed, using memory",
      { op, error: "redis down" },
    );
    errorSpy.mockRestore();
  });

  it("stringifies a non-Error rejection", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const primary = fakeCounter();
    vi.mocked(primary.incr).mockRejectedValue("nope");
    const fallback = fakeCounter();
    vi.mocked(fallback.incr).mockResolvedValue(1);
    await withMemoryFallback(primary, fallback).incr("k");
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), {
      op: "incr",
      error: "nope",
    });
    errorSpy.mockRestore();
  });

  it("returns the primary result and skips the fallback when it works", async () => {
    const primary = fakeCounter();
    vi.mocked(primary.incrWithExpiry).mockResolvedValue(3);
    const fallback = fakeCounter();
    expect(await withMemoryFallback(primary, fallback).incrWithExpiry("k", 5)).toBe(3);
    expect(fallback.incrWithExpiry).not.toHaveBeenCalled();
  });

  it("recovers: uses the primary again after an outage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const primary = fakeCounter();
    vi.mocked(primary.incr)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(4);
    const fallback = fakeCounter();
    vi.mocked(fallback.incr).mockResolvedValue(1);
    const guarded = withMemoryFallback(primary, fallback);
    expect(await guarded.incr("k")).toBe(1);
    expect(await guarded.incr("k")).toBe(4);
    vi.restoreAllMocks();
  });

  it("defaults to a bounded memory fallback that keeps counting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const guarded = withMemoryFallback(throwingCounter());
    const key = `default-fallback-${Math.random()}`;
    expect(await guarded.incrWithExpiry(key, 60)).toBe(1);
    expect(await guarded.incrWithExpiry(key, 60)).toBe(2);
    vi.restoreAllMocks();
  });
});

describe("boundedScope", () => {
  it("prefixes the kind and truncates the value to RELAY_MAX_SCOPE_CHARS", () => {
    const scope = boundedScope("ip", "x".repeat(1024));
    expect(scope).toBe(`ip:${"x".repeat(128)}`);
  });

  it("keeps a short value whole", () => {
    expect(boundedScope("user", "abc")).toBe("user:abc");
  });
});

describe("no shared counter warning", () => {
  it("logs once in production and never in development", async () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubEnv("NODE_ENV", "development");
    const dev = await import("./rateLimit");
    await dev.getDefaultCounter();
    expect(errorSpy).not.toHaveBeenCalled();

    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    const prod = await import("./rateLimit");
    await prod.getDefaultCounter();
    await prod.getDefaultCounter();
    await prod.getDefaultCounter();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("No shared rate-limit counter");
    errorSpy.mockRestore();
  });
});

describe("consumeRateLimit failure paths", () => {
  it("leaves the cap check to the counter: a count at max is still allowed", async () => {
    const counter = fakeCounter();
    vi.mocked(counter.incrWithExpiry).mockResolvedValue(RELAY_RATE_LIMIT_MAX);
    expect(await consumeRateLimit("a", counter, BURST)).toEqual({ allowed: true });
    expect(counter.ttl).not.toHaveBeenCalled();
  });

  it("reports the live TTL when blocked and does not reset the window", async () => {
    const counter = fakeCounter();
    vi.mocked(counter.incrWithExpiry).mockResolvedValue(RELAY_RATE_LIMIT_MAX + 1);
    vi.mocked(counter.ttl).mockResolvedValue(123);
    expect(await consumeRateLimit("a", counter, BURST)).toEqual({
      allowed: false,
      retryAfterSeconds: 123,
    });
    expect(counter.expire).not.toHaveBeenCalled();
  });
});
