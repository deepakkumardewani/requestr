import {
  RELAY_MAX_RATE_KEYS,
  RELAY_MAX_SCOPE_CHARS,
} from "@/lib/relay/constants";

const MS_PER_SEC = 1000;

/** Minimal counter surface shared by Redis and the in-memory fallback. */
export type RateLimitCounter = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  ttl: (key: string) => Promise<number>;
  /**
   * Increments, starting a fresh window of `seconds` when the key is new. The
   * key never exists without a TTL, unlike a separate `incr` then `expire`.
   */
  incrWithExpiry: (key: string, seconds: number) => Promise<number>;
};

/** What a backend must provide; `createCounter` derives `incrWithExpiry`. */
export type CounterOps = Pick<RateLimitCounter, "incr" | "expire" | "ttl"> & {
  /** `SET key 1 EX seconds NX`; resolves true when the key was created. */
  setIfAbsent: (key: string, seconds: number) => Promise<boolean>;
};

export type RateLimitWindow = {
  /** Key namespace, so each meter and window keeps its own counts. */
  prefix: string;
  max: number;
  windowSec: number;
};

export type RateLimitOutcome =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Builds a counter whose `incrWithExpiry` is `SET ... EX NX`, then `INCR` (no Lua). */
export function createCounter({
  setIfAbsent,
  ...ops
}: CounterOps): RateLimitCounter {
  return {
    ...ops,
    async incrWithExpiry(key, seconds) {
      if (await setIfAbsent(key, seconds)) return 1;
      const count = await ops.incr(key);
      // INCR may have recreated an expired key bare, or an earlier expire may
      // have failed: repair on every hit so a bare key cannot outlive a window.
      if (count === 1 || (await ops.ttl(key)) < 0) {
        await ops.expire(key, seconds);
      }
      return count;
    },
  };
}

type MemoryEntry = { count: number; expiresAtMs: number };

export function createMemoryCounter(
  now: () => number = Date.now,
  maxKeys: number = RELAY_MAX_RATE_KEYS,
): RateLimitCounter {
  // A Map iterates in insertion order, so its first key is the oldest insert.
  const entries = new Map<string, MemoryEntry>();

  const live = (key: string): MemoryEntry | undefined => {
    const entry = entries.get(key);
    if (entry && entry.expiresAtMs <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  const sweepExpired = () => {
    const current = now();
    for (const [key, entry] of entries) {
      if (entry.expiresAtMs <= current) entries.delete(key);
    }
  };

  const insert = (key: string, entry: MemoryEntry) => {
    if (entries.size >= maxKeys) {
      sweepExpired();
      if (entries.size >= maxKeys) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
    }
    entries.set(key, entry);
  };

  const bump = (key: string, expiresAtMs: number): number => {
    const existing = live(key);
    if (existing) {
      existing.count += 1;
      return existing.count;
    }
    insert(key, { count: 1, expiresAtMs });
    return 1;
  };

  return {
    async incr(key) {
      return bump(key, Infinity);
    },
    async incrWithExpiry(key, seconds) {
      return bump(key, now() + seconds * MS_PER_SEC);
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

let warnedNoSharedCounter = false;

/** Per-instance counts do not add up across serverless instances, so say so once. */
function warnNoSharedCounterOnce(): void {
  if (warnedNoSharedCounter || process.env.NODE_ENV !== "production") return;
  warnedNoSharedCounter = true;
  console.error(
    "[relay] No shared rate-limit counter (set REDIS_URL or UPSTASH_REDIS_REST_*); using a bounded per-instance in-memory limit.",
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
    const { upstashCounter } = await import("@/lib/redis");
    return upstashCounter;
  }
  warnNoSharedCounterOnce();
  return memoryCounter;
}

type CounterOp = keyof RateLimitCounter;

/**
 * A Redis outage must degrade the limit, not fail the request: any counter
 * error is logged with its context and served from the bounded memory counter.
 */
export function withMemoryFallback(
  primary: RateLimitCounter,
  fallback: RateLimitCounter = memoryCounter,
): RateLimitCounter {
  const guarded = <Op extends CounterOp>(op: Op): RateLimitCounter[Op] =>
    (async (...args: Parameters<RateLimitCounter[Op]>) => {
      try {
        return await (primary[op] as (...a: unknown[]) => unknown)(...args);
      } catch (error) {
        console.error("[relay] rate-limit counter failed, using memory", {
          op,
          error: error instanceof Error ? error.message : String(error),
        });
        return (fallback[op] as (...a: unknown[]) => unknown)(...args);
      }
    }) as RateLimitCounter[Op];

  return {
    incr: guarded("incr"),
    expire: guarded("expire"),
    ttl: guarded("ttl"),
    incrWithExpiry: guarded("incrWithExpiry"),
  };
}

/** A client-supplied value (header) kept short so it cannot bloat a key. */
export function boundedScope(kind: string, value: string): string {
  return `${kind}:${value.slice(0, RELAY_MAX_SCOPE_CHARS)}`;
}

/**
 * Fixed-window counter: the first hit starts the window atomically. Returns
 * seconds until the window ends when the cap is exceeded.
 */
export async function consumeRateLimit(
  scopeKey: string,
  counter: RateLimitCounter,
  { prefix, max, windowSec }: RateLimitWindow,
): Promise<RateLimitOutcome> {
  const key = `${prefix}${scopeKey}`;
  const count = await counter.incrWithExpiry(key, windowSec);
  if (count <= max) return { allowed: true };

  const ttl = await counter.ttl(key);
  if (ttl > 0) return { allowed: false, retryAfterSeconds: ttl };
  // A key with no TTL would block this scope forever; restart its window.
  await counter.expire(key, windowSec);
  return { allowed: false, retryAfterSeconds: windowSec };
}
