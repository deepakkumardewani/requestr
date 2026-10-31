import {
  RELAY_DAILY_MESSAGE_CAP,
  RELAY_DAILY_WINDOW_SEC,
  RELAY_USER_HEADER,
} from "@/lib/relay/constants";
import type { RelayErrorCode } from "@/lib/relay/errors";
import { isRelayEnabled } from "@/lib/relay/flag";
import { isRelayConfigured } from "./model";
import {
  consumeRateLimit,
  getDefaultCounter,
  type RateLimitCounter,
} from "./rateLimit";

const UNKNOWN_IP = "unknown";
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

export type GuardInput = {
  req: Request;
  /** Role of the last message; only a user message consumes quota (FR-72). */
  lastMessageRole: string | undefined;
};

export type GuardDeps = {
  counter?: RateLimitCounter;
};

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || UNKNOWN_IP;
}

/** Rejects cross-origin browser calls; non-browser callers send no Origin. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
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

const DAILY_KEY_PREFIX = "relay:daily:";

/**
 * Per-session soft cap, counted per user (or IP when anonymous). Unlike the
 * burst limit it carries no retry hint: the window is a day, so a countdown
 * would only mislead.
 */
async function isOverDailyCap(
  scope: string,
  counter: RateLimitCounter,
): Promise<boolean> {
  const key = `${DAILY_KEY_PREFIX}${scope}`;
  const count = await counter.incr(key);
  if (count === 1) await counter.expire(key, RELAY_DAILY_WINDOW_SEC);
  return count > RELAY_DAILY_MESSAGE_CAP;
}

/** Checks the flag, key and rate limits; the first failing check wins. */
export async function guardRelayRequest(
  { req, lastMessageRole }: GuardInput,
  deps: GuardDeps = {},
): Promise<GuardResult> {
  if (isRelayFlagOff()) {
    return { ok: false, code: "not_configured", status: HTTP_NOT_FOUND };
  }
  if (!isRelayConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      status: HTTP_SERVICE_UNAVAILABLE,
    };
  }
  if (lastMessageRole !== "user") return { ok: true };

  const counter = deps.counter ?? (await getDefaultCounter());
  const userId = req.headers.get(RELAY_USER_HEADER)?.trim();
  // A user's own limit and the shared IP limit are tracked independently so
  // clearing local storage never resets the IP quota.
  const scopes = [userId ? `user:${userId}` : null, `ip:${clientIp(req)}`];
  for (const scope of scopes) {
    if (!scope) continue;
    const outcome = await consumeRateLimit(scope, counter);
    if (!outcome.allowed) {
      return {
        ok: false,
        code: "rate_limited",
        status: HTTP_TOO_MANY_REQUESTS,
        retryAfterSeconds: outcome.retryAfterSeconds,
      };
    }
  }
  const dailyScope = userId ? `user:${userId}` : `ip:${clientIp(req)}`;
  if (await isOverDailyCap(dailyScope, counter)) {
    return { ok: false, code: "rate_limited", status: HTTP_TOO_MANY_REQUESTS };
  }
  return { ok: true };
}
