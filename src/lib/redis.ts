import { Redis } from "@upstash/redis";
import { createCounter } from "@/lib/relay/server/rateLimit";

/**
 * Singleton Upstash REST client. Reads `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` (see `.env.local.example`). Use from server-side
 * code (e.g. Route Handlers) only.
 */
export const redis: Redis = Redis.fromEnv();

/** The same client as a Relay rate-limit counter. */
export const upstashCounter = createCounter({
  incr: (key) => redis.incr(key),
  expire: (key, seconds) => redis.expire(key, seconds),
  ttl: (key) => redis.ttl(key),
  setIfAbsent: async (key, seconds) =>
    (await redis.set(key, 1, { ex: seconds, nx: true })) === "OK",
});
