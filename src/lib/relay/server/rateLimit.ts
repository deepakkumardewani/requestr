/** Turns allowed per key within one window (FR-72). */
export const RELAY_RATE_LIMIT_MAX = 30;
export const RELAY_RATE_LIMIT_WINDOW_SEC = 600;

const KEY_PREFIX = "relay:ratelimit:";
const MS_PER_SEC = 1000;

/** Minimal counter surface shared by Redis and the in-memory dev fallback. */
export type RateLimitCounter = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  ttl: (key: string) => Promise<number>;
};

export type RateLimitOutcome =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type MemoryEntry = { count: number; expiresAtMs: number };

export function createMemoryCounter(
  now: () => number = Date.now,
): RateLimitCounter {
  const entries = new Map<string, MemoryEntry>();

  const live = (key: string): MemoryEntry | undefined => {
    const entry = entries.get(key);
    if (entry && entry.expiresAtMs <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    async incr(key) {
      const entry = live(key) ?? { count: 0, expiresAtMs: Infinity };
      entry.count += 1;
      entries.set(key, entry);
      return entry.count;
    },
    async expire(key, seconds) {
      const entry = live(key);
      if (entry) entry.expiresAtMs = now() + seconds * MS_PER_SEC;
    },
    async ttl(key) {
      const entry = live(key);
      if (!entry || entry.expiresAtMs === Infinity) return -1;
      return Math.ceil((entry.expiresAtMs - now()) / MS_PER_SEC);
    },
  };
}

const memoryCounter = createMemoryCounter();

function isLocalRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

function isUpstashRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

/**
 * Counter priority: `REDIS_URL` (local TCP) → Upstash REST → in-memory (dev).
 */
export async function getDefaultCounter(): Promise<RateLimitCounter> {
  if (isLocalRedisConfigured()) {
    const { getLocalRedisCounter } = await import("./localRedisCounter");
    return getLocalRedisCounter();
  }
  if (isUpstashRedisConfigured()) {
    const { redis } = await import("@/lib/redis");
    return redis;
  }
  return memoryCounter;
}

/**
 * Fixed-window counter: atomic incr, expire only on the first hit (same
 * pattern as `enforceShareRateLimit`). Returns seconds until the window ends
 * when the cap is exceeded.
 */
export async function consumeRateLimit(
  scopeKey: string,
  counter: RateLimitCounter,
): Promise<RateLimitOutcome> {
  const key = `${KEY_PREFIX}${scopeKey}`;
  const count = await counter.incr(key);
  if (count === 1) {
    await counter.expire(key, RELAY_RATE_LIMIT_WINDOW_SEC);
  }
  if (count <= RELAY_RATE_LIMIT_MAX) return { allowed: true };

  const ttl = await counter.ttl(key);
  return {
    allowed: false,
    retryAfterSeconds: ttl > 0 ? ttl : RELAY_RATE_LIMIT_WINDOW_SEC,
  };
}
