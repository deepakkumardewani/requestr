import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fakeRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  set: vi.fn(),
};
const fromEnv = vi.fn(() => fakeRedis);

async function load() {
  vi.resetModules();
  vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv } }));
  return import("./redis");
}

beforeEach(() => {
  Object.values(fakeRedis).forEach((fn) => fn.mockReset());
  fromEnv.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("upstashCounter", () => {
  it("builds the client from env once and exports it", async () => {
    const { redis } = await load();
    expect(fromEnv).toHaveBeenCalledTimes(1);
    expect(redis).toBe(fakeRedis);
  });

  it("delegates incr, expire and ttl to the client", async () => {
    fakeRedis.incr.mockResolvedValue(4);
    fakeRedis.expire.mockResolvedValue(1);
    fakeRedis.ttl.mockResolvedValue(77);
    const { upstashCounter } = await load();
    expect(await upstashCounter.incr("k")).toBe(4);
    await upstashCounter.expire("k", 12);
    expect(fakeRedis.expire).toHaveBeenCalledWith("k", 12);
    expect(await upstashCounter.ttl("k")).toBe(77);
  });

  it("incrWithExpiry creates the key atomically with SET EX NX", async () => {
    fakeRedis.set.mockResolvedValue("OK");
    const { upstashCounter } = await load();
    expect(await upstashCounter.incrWithExpiry("k", 600)).toBe(1);
    expect(fakeRedis.set).toHaveBeenCalledWith("k", 1, { ex: 600, nx: true });
    expect(fakeRedis.incr).not.toHaveBeenCalled();
  });

  it("incrWithExpiry increments when the key exists (SET returns null)", async () => {
    fakeRedis.set.mockResolvedValue(null);
    fakeRedis.incr.mockResolvedValue(6);
    const { upstashCounter } = await load();
    expect(await upstashCounter.incrWithExpiry("k", 600)).toBe(6);
    expect(fakeRedis.expire).not.toHaveBeenCalled();
  });

  it("incrWithExpiry re-applies the TTL when INCR recreated the key", async () => {
    fakeRedis.set.mockResolvedValue(null);
    fakeRedis.incr.mockResolvedValue(1);
    fakeRedis.expire.mockResolvedValue(1);
    const { upstashCounter } = await load();
    await upstashCounter.incrWithExpiry("k", 600);
    expect(fakeRedis.expire).toHaveBeenCalledWith("k", 600);
  });
});
