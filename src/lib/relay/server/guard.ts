import {
  RELAY_DAILY_MESSAGE_CAP,
  RELAY_DAILY_REQUEST_CAP,
  RELAY_DAILY_WINDOW_SEC,
  RELAY_RATE_LIMIT_MAX,
  RELAY_RATE_LIMIT_WINDOW_SEC,
  RELAY_REQUEST_RATE_MAX,
  RELAY_USER_HEADER,
} from "@/lib/relay/constants";
import type { RelayErrorCode } from "@/lib/relay/errors";
import { isRelayEnabled } from "@/lib/relay/flag";
import { isRelayConfigured } from "./model";
import {
  boundedScope,
  consumeRateLimit,
  getDefaultCounter,
  type RateLimitCounter,
  type RateLimitWindow,
  withMemoryFallback,
} from "./rateLimit";

/**
 * The one header the client IP is read from. The platform (Vercel) sets it and
 * overwrites any client value; `x-forwarded-for` is never read because a client
 * can prepend to it. Self-hosting needs a proxy that sets this header.
 */
export const TRUSTED_IP_HEADER = "x-real-ip";

const UNKNOWN_IP = "unknown";
const SAME_ORIGIN_FETCH_SITE = "same-origin";
export const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;

export type GuardRejection = {
  ok: false;
  code: RelayErrorCode;
  status: number;
  retryAfterSeconds?: number;
};

export type GuardResult = { ok: true } | GuardRejection;

/** Which model route is asking; each has its own budget and checks. */
export type GuardRoute = "chat" | "stt" | "ai";

export type GuardInput = {
  req: Request;
  /** Defaults to `chat`. */
  route?: GuardRoute;
  /** Role of the last message; only a user message is a turn (FR-72). */
  lastMessageRole?: string;
};

export type GuardDeps = {
  counter?: RateLimitCounter;
};

/** A meter's short burst window and its day-long soft cap. */
type Meter = { burst: RateLimitWindow; daily: RateLimitWindow };

const REQUESTS_METER: Meter = {
  burst: {
    prefix: "relay:ratelimit:requests:",
    max: RELAY_REQUEST_RATE_MAX,
    windowSec: RELAY_RATE_LIMIT_WINDOW_SEC,
  },
  daily: {
    prefix: "relay:daily:requests:",
    max: RELAY_DAILY_REQUEST_CAP,
    windowSec: RELAY_DAILY_WINDOW_SEC,
  },
};

const TURNS_METER: Meter = {
  burst: {
    prefix: "relay:ratelimit:turns:",
    max: RELAY_RATE_LIMIT_MAX,
    windowSec: RELAY_RATE_LIMIT_WINDOW_SEC,
  },
  daily: {
    prefix: "relay:daily:turns:",
    max: RELAY_DAILY_MESSAGE_CAP,
    windowSec: RELAY_DAILY_WINDOW_SEC,
  },
};

/**
 * Inline AI actions meter against their own `ai:` buckets, so exhausting them
 * never limits Relay chat and the reverse (HH-H08).
 */
const AI_METER: Meter = {
  burst: {
    prefix: "ai:ratelimit:",
    max: RELAY_RATE_LIMIT_MAX,
    windowSec: RELAY_RATE_LIMIT_WINDOW_SEC,
  },
  daily: {
    prefix: "ai:daily:",
    max: RELAY_DAILY_MESSAGE_CAP,
    windowSec: RELAY_DAILY_WINDOW_SEC,
  },
};

type RouteProfile = {
  meter: Meter;
  /** Relay build flag; inline AI predates it and must keep working without it. */
  requiresFlag: boolean;
  /** The LLM key; speech-to-text uses a different provider key. */
  requiresLlmKey: boolean;
};

const ROUTE_PROFILES: Record<GuardRoute, RouteProfile> = {
  chat: { meter: REQUESTS_METER, requiresFlag: true, requiresLlmKey: true },
  stt: { meter: REQUESTS_METER, requiresFlag: true, requiresLlmKey: false },
  ai: { meter: AI_METER, requiresFlag: false, requiresLlmKey: true },
};

let warnedMissingIp = false;

function clientIp(req: Request): string {
  const ip = req.headers.get(TRUSTED_IP_HEADER)?.trim();
  if (ip) return ip;
  if (!warnedMissingIp) {
    warnedMissingIp = true;
    console.error(
      `[relay] No ${TRUSTED_IP_HEADER} header; all such requests share one rate-limit bucket.`,
    );
  }
  return UNKNOWN_IP;
}

/**
 * Rejects cross-origin browser calls. A call with no Origin is accepted only
 * when the browser vouches for it with `Sec-Fetch-Site: same-origin`.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    return req.headers.get("sec-fetch-site") === SAME_ORIGIN_FETCH_SITE;
  }
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** The build flag alone, for routes that must not apply the key or rate limits. */
export function isRelayFlagOff(): boolean {
  return !isRelayEnabled();
}

function rateLimited(retryAfterSeconds?: number): GuardRejection {
  return {
    ok: false,
    code: "rate_limited",
    status: HTTP_TOO_MANY_REQUESTS,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

/**
 * Charges `meter` once per scope. The burst limit carries a retry hint; the
 * daily cap does not, as a day-long countdown would only mislead.
 */
async function chargeMeter(
  meter: Meter,
  scopes: string[],
  counter: RateLimitCounter,
): Promise<GuardRejection | null> {
  for (const scope of scopes) {
    const burst = await consumeRateLimit(scope, counter, meter.burst);
    if (!burst.allowed) return rateLimited(burst.retryAfterSeconds);
    const daily = await consumeRateLimit(scope, counter, meter.daily);
    if (!daily.allowed) return rateLimited();
  }
  return null;
}

async function resolveCounter(deps: GuardDeps): Promise<RateLimitCounter> {
  return withMemoryFallback(deps.counter ?? (await getDefaultCounter()));
}

/**
 * Stage 1, run before the body is read: flag and key per the route's profile,
 * then one charge against the IP so a burst of junk is metered too.
 */
export async function guardRelayRequest(
  { req, route = "chat" }: GuardInput,
  deps: GuardDeps = {},
): Promise<GuardResult> {
  const profile = ROUTE_PROFILES[route];
  if (profile.requiresFlag && isRelayFlagOff()) {
    return { ok: false, code: "not_configured", status: HTTP_NOT_FOUND };
  }
  if (profile.requiresLlmKey && !isRelayConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      status: HTTP_SERVICE_UNAVAILABLE,
    };
  }
  const counter = await resolveCounter(deps);
  const rejection = await chargeMeter(
    profile.meter,
    [boundedScope("ip", clientIp(req))],
    counter,
  );
  return rejection ?? { ok: true };
}

/**
 * Stage 2, run once the body is parsed: only a user-last request is a turn.
 * The IP scope is always charged; `x-relay-user` adds a second scope and can
 * never replace it, so rotating it does not reset the IP's daily cap.
 */
export async function guardRelayTurn(
  { req, lastMessageRole }: GuardInput,
  deps: GuardDeps = {},
): Promise<GuardResult> {
  if (lastMessageRole !== "user") return { ok: true };

  const counter = await resolveCounter(deps);
  const userId = req.headers.get(RELAY_USER_HEADER)?.trim();
  const scopes = [boundedScope("ip", clientIp(req))];
  if (userId) scopes.push(boundedScope("user", userId));
  const rejection = await chargeMeter(TURNS_METER, scopes, counter);
  return rejection ?? { ok: true };
}
