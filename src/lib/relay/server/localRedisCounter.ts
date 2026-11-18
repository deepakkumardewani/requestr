import { createClient, type RedisClientType } from "redis";
import { createCounter, type RateLimitCounter } from "./rateLimit";

let clientPromise: Promise<RedisClientType> | null = null;
let counter: RateLimitCounter | null = null;

async function getClient(): Promise<RedisClientType> {
  if (!clientPromise) {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      throw new Error("REDIS_URL is not set");
    }
    const client = createClient({ url });
    client.on("error", (err) => {
      console.error("[relay] Redis client error:", err);
    });
    // Forget a failed connect so the next call retries instead of replaying it.
    clientPromise = client.connect().then(
      () => client,
      (error: unknown) => {
        clientPromise = null;
        throw error;
      },
    );
  }
  return clientPromise;
}

/** Process-local singleton counter backed by a TCP Redis client (`REDIS_URL`). */
export function getLocalRedisCounter(): RateLimitCounter {
  if (!counter) {
    counter = createCounter({
      async incr(key) {
        const client = await getClient();
        return client.incr(key);
      },
      async expire(key, seconds) {
        const client = await getClient();
        return client.expire(key, seconds);
      },
      async ttl(key) {
        const client = await getClient();
        return client.ttl(key);
      },
      async setIfAbsent(key, seconds) {
        const client = await getClient();
        return (await client.set(key, "1", { EX: seconds, NX: true })) === "OK";
      },
    });
  }
  return counter;
}
