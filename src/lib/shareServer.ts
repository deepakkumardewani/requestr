import { z } from "zod";

/** Max successful share creates per `userId` per rolling window (21st in same hour → 429). */
export const SHARE_RATE_LIMIT_MAX = 20;
export const SHARE_RATE_LIMIT_TTL_SEC = 3600;

/** Shared request payloads auto-expire 24h after creation. */
export const SHARE_PAYLOAD_TTL_SEC = 86_400;

export const SharePostBodySchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  userId: z.string().min(1),
});

export type SharePostBody = z.infer<typeof SharePostBodySchema>;

/** What we persist under `share:{id}` (ciphertext only, no key). */
export const ShareStoredRecordSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
});

export type ShareStoredRecord = z.infer<typeof ShareStoredRecordSchema>;

/**
 * Restores a stored share record from Redis. Accepts a JSON string (what we
 * set) or a plain object if the client returns a decoded value.
 * Parameter is `unknown` because the Redis client types GET as such.
 */
export function parseStoredShareRecord(raw: unknown): ShareStoredRecord | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    let parsed: ReturnType<typeof JSON.parse>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const r = ShareStoredRecordSchema.safeParse(parsed);
    return r.success ? r.data : null;
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const r = ShareStoredRecordSchema.safeParse(raw);
    return r.success ? r.data : null;
  }

  return null;
}

export function shareStorageKey(shareId: string): string {
  return `share:${shareId}`;
}

export function rateLimitKeyForUser(userId: string): string {
  return `ratelimit:${userId}`;
}

type ShareRateLimitRedis = {
  get: (key: string) => Promise<string | number | null>;
  incr: (key: string) => Promise<number>;
  decr: (key: string) => Promise<number>;
  expire: (key: string, sec: number) => Promise<0 | 1 | boolean>;
};

function parseIntFromRedisGet(raw: string | number | null): number | null {
  if (raw === null) {
    return null;
  }
  const s = String(raw);
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * If the per-user key already shows **at least** the max allowed count, the
 * request is rejected **without** `INCR` / `DECR` so at-cap 429s do not touch
 * Redis. Otherwise we `INCR` (atomic) and, only when that single increment
 * goes over the cap, we `DECR` once to keep the stored value at the limit.
 */
export async function enforceShareRateLimit(
  client: ShareRateLimitRedis,
  userId: string,
): Promise<"ok" | "rate_limited"> {
  const key = rateLimitKeyForUser(userId);
  const existing = await client.get(key);
  const n0 = parseIntFromRedisGet(existing);
  if (n0 !== null && n0 >= SHARE_RATE_LIMIT_MAX) {
    return "rate_limited";
  }
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, SHARE_RATE_LIMIT_TTL_SEC);
  }
  if (count > SHARE_RATE_LIMIT_MAX) {
    await client.decr(key);
    return "rate_limited";
  }
  return "ok";
}

/**
 * `Date` (ms) when the rate-limit key expires, or `null` if unknown (no TTL / missing key).
 */
export async function getRateLimitResetAtMs(
  client: { pttl: (key: string) => Promise<number> },
  userId: string,
): Promise<number | null> {
  const pttl = await client.pttl(rateLimitKeyForUser(userId));
  if (pttl <= 0) {
    return null;
  }
  return Date.now() + pttl;
}
