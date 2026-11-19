import { createHash } from "node:crypto";
import { BATCH_SIZE } from "@/lib/analytics/httpAdapter";
import { posthogSink } from "@/lib/analytics/server/posthogSink";
import { validateBatch } from "@/lib/analytics/server/validate";
import { readBodyWithLimit } from "@/lib/relay/server/bodyLimit";
import { isSameOrigin, TRUSTED_IP_HEADER } from "@/lib/relay/server/guard";
import {
  boundedScope,
  consumeRateLimit,
  getDefaultCounter,
  type RateLimitWindow,
  withMemoryFallback,
} from "@/lib/relay/server/rateLimit";

const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
/** A full batch of the largest allowed events stays well under this. */
const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS_PER_BATCH = BATCH_SIZE;
const INGEST_RATE_LIMIT: RateLimitWindow = {
  prefix: "ingest:ratelimit:",
  max: 60,
  windowSec: 60,
};
const IP_HASH_CHARS = 32;
const UNKNOWN_IP = "unknown";
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

const accepted = (): Response =>
  new Response(null, { status: HTTP_NO_CONTENT });

function isDisabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true" ||
    !process.env.POSTHOG_KEY ||
    !process.env.POSTHOG_HOST
  );
}

/** Checked and discarded: the User-Agent is never stored or forwarded. */
function isBot(req: Request): boolean {
  return BOT_UA_PATTERN.test(req.headers.get("user-agent") ?? "");
}

/** The IP only ever exists as a truncated hash inside an expiring counter key. */
async function isRateLimited(req: Request): Promise<boolean> {
  const ip = req.headers.get(TRUSTED_IP_HEADER)?.trim() || UNKNOWN_IP;
  const hash = createHash("sha256").update(ip).digest("hex");
  const counter = withMemoryFallback(await getDefaultCounter());
  const outcome = await consumeRateLimit(
    boundedScope("ip", hash.slice(0, IP_HASH_CHARS)),
    counter,
    INGEST_RATE_LIMIT,
  );
  return !outcome.allowed;
}

export async function POST(req: Request): Promise<Response> {
  if (isDisabled() || !isSameOrigin(req) || isBot(req)) return accepted();
  if (await isRateLimited(req)) return accepted();

  const body = await readBodyWithLimit(req, MAX_BODY_BYTES);
  if (!body.ok) return accepted();

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return new Response(null, { status: HTTP_BAD_REQUEST });
  }

  const batch = validateBatch(parsed);
  batch.events = batch.events.slice(0, MAX_EVENTS_PER_BATCH);
  if (batch.events.length > 0) await posthogSink.send(batch);
  return accepted();
}
