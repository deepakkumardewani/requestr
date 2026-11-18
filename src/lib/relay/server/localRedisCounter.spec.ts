import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeClient = {
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  ttl: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

function makeClient(): FakeClient {
  return {
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    incr: vi.fn().mockResolvedValue(2),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(55),
    set: vi.fn().mockResolvedValue("OK"),
  };
}

let clients: FakeClient[];
const createClient = vi.fn();

async function load() {
  vi.resetModules();
  vi.doMock("redis", () => ({ createClient }));
  return import("./localRedisCounter");
}

beforeEach(() => {
  clients = [];
  createClient.mockReset();
  createClient.mockImplementation(() => {
    const client = makeClient();
    clients.push(client);
    return client;
  });
  vi.stubEnv("REDIS_URL", " redis://127.0.0.1:6379 ");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getLocalRedisCounter", () => {
  it("returns one process-local singleton", async () => {
    const { getLocalRedisCounter } = await load();
    expect(getLocalRedisCounter()).toBe(getLocalRedisCounter());
  });

  it("creates one client with the trimmed URL and shares it across operations", async () => {
    const { getLocalRedisCounter } = await load();
    const counter = getLocalRedisCounter();
    expect(await counter.incr("k")).toBe(2);
    expect(await counter.ttl("k")).toBe(55);
    await counter.expire("k", 30);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith({ url: "redis://127.0.0.1:6379" });
    expect(clients[0].expire).toHaveBeenCalledWith("k", 30);
  });

  it("logs client errors with context", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getLocalRedisCounter } = await load();
    await getLocalRedisCounter().incr("k");
    const handler = clients[0].on.mock.calls.find(([name]) => name === "error")?.[1];
    const failure = new Error("socket closed");
    handler(failure);
    expect(errorSpy).toHaveBeenCalledWith("[relay] Redis client error:", failure);
  });

  it("incrWithExpiry starts the window with SET EX NX and does not INCR", async () => {
    const { getLocalRedisCounter } = await load();
    expect(await getLocalRedisCounter().incrWithExpiry("k", 600)).toBe(1);
    expect(clients[0].set).toHaveBeenCalledWith("k", "1", { EX: 600, NX: true });
    expect(clients[0].incr).not.toHaveBeenCalled();
  });

  it("incrWithExpiry increments when the key already exists", async () => {
    const { getLocalRedisCounter } = await load();
    const counter = getLocalRedisCounter();
    await counter.incr("warm");
    clients[0].set.mockResolvedValue(null);
    clients[0].incr.mockResolvedValue(9);
    expect(await counter.incrWithExpiry("k", 600)).toBe(9);
    expect(clients[0].expire).not.toHaveBeenCalled();
  });

  it("incrWithExpiry restores the TTL when INCR recreated an expired key", async () => {
    const { getLocalRedisCounter } = await load();
    const counter = getLocalRedisCounter();
    await counter.incr("warm");
    clients[0].set.mockResolvedValue(null);
    clients[0].incr.mockResolvedValue(1);
    await counter.incrWithExpiry("k", 600);
    expect(clients[0].expire).toHaveBeenCalledWith("k", 600);
  });

  it("rejects when REDIS_URL is blank, without creating a client", async () => {
    vi.stubEnv("REDIS_URL", "  ");
    const { getLocalRedisCounter } = await load();
    await expect(getLocalRedisCounter().incr("k")).rejects.toThrow(
      "REDIS_URL is not set",
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("retries a rejected connect on the next call, then reuses the client", async () => {
    createClient.mockImplementationOnce(() => {
      const client = makeClient();
      client.connect.mockRejectedValue(new Error("ECONNREFUSED"));
      clients.push(client);
      return client;
    });
    const { getLocalRedisCounter } = await load();
    const counter = getLocalRedisCounter();
    await expect(counter.incr("k")).rejects.toThrow("ECONNREFUSED");
    expect(await counter.incr("k")).toBe(2);
    expect(await counter.incr("k")).toBe(2);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(clients[1].incr).toHaveBeenCalledTimes(2);
  });

  it("propagates an incr, expire or ttl failure to the caller", async () => {
    const { getLocalRedisCounter } = await load();
    const counter = getLocalRedisCounter();
    await counter.incr("warm");
    clients[0].incr.mockRejectedValue(new Error("incr failed"));
    clients[0].expire.mockRejectedValue(new Error("expire failed"));
    clients[0].ttl.mockRejectedValue(new Error("ttl failed"));
    await expect(counter.incr("k")).rejects.toThrow("incr failed");
    await expect(counter.expire("k", 1)).rejects.toThrow("expire failed");
    await expect(counter.ttl("k")).rejects.toThrow("ttl failed");
  });
});
