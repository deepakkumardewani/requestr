import {
  bucketCount,
  bucketDuration,
  type EventMap,
  HTTP_METHODS,
  LANDING_PATHS,
  type PROTOCOLS,
  type REQUEST_SOURCES,
} from "@/lib/analytics/events";

/**
 * One pure builder per instrumented event. Each takes domain values and returns
 * only allowlisted enum/bucket props, so raw URLs, hosts, names or bodies can
 * never reach `track()` by construction.
 */

type HttpMethod = (typeof HTTP_METHODS)[number];
type LandingPath = (typeof LANDING_PATHS)[number];
type Protocol = (typeof PROTOCOLS)[number];
type RequestSource = (typeof REQUEST_SOURCES)[number];
type StatusClass = NonNullable<EventMap["request_sent"]["status_class"]>;

const REFERRER_DIRECT = "direct";
const REFERRER_OTHER = "other";
const LOCALHOST = "localhost";
const WWW_PREFIX = "www.";
const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;
const HTTP_STATUS_CLASS_DIVISOR = 100;
const STATUS_CLASS_BY_HUNDRED: Readonly<Record<number, StatusClass>> = {
  2: "2xx",
  3: "3xx",
  4: "4xx",
  5: "5xx",
};

const METHOD_SET: ReadonlySet<string> = new Set(HTTP_METHODS);
const LANDING_PATH_SET: ReadonlySet<string> = new Set(LANDING_PATHS);

export function methodEnum(method: string): HttpMethod {
  const upper = method.toUpperCase();
  return METHOD_SET.has(upper) && upper !== "other"
    ? (upper as HttpMethod)
    : "other";
}

/** A missing or non-2xx-5xx status (network failure, abort, 1xx) is `error`. */
export function statusClass(status: number | undefined): StatusClass {
  if (status === undefined) return "error";
  return (
    STATUS_CLASS_BY_HUNDRED[Math.floor(status / HTTP_STATUS_CLASS_DIVISOR)] ??
    "error"
  );
}

/** Known marketing paths pass through; anything else (including query/hash) becomes `other`. */
export function landingPathEnum(pathname: string): LandingPath {
  const path = pathname.split(/[?#]/)[0] ?? "";
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return LANDING_PATH_SET.has(trimmed) ? (trimmed as LandingPath) : "other";
}

function hostnameOf(referrer: string): string | null {
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const stripWww = (host: string): string =>
  host.startsWith(WWW_PREFIX) ? host.slice(WWW_PREFIX.length) : host;

/**
 * Hostname only, lowercased. Empty, invalid or same-site referrers are `direct`;
 * IP literals and localhost are `other` so internal hosts are never recorded.
 */
export function referrerDomain(referrer: string, ownHost?: string): string {
  if (!referrer) return REFERRER_DIRECT;
  const host = hostnameOf(referrer);
  if (!host) return REFERRER_DIRECT;
  if (ownHost && stripWww(host) === stripWww(ownHost.toLowerCase())) {
    return REFERRER_DIRECT;
  }
  if (host === LOCALHOST || host.endsWith(`.${LOCALHOST}`)) {
    return REFERRER_OTHER;
  }
  if (IPV4_LITERAL.test(host) || host.includes(":") || host.startsWith("[")) {
    return REFERRER_OTHER;
  }
  return host;
}

export type RequestSentInput = {
  method: string;
  protocol: Protocol;
  status?: number;
  durationMs: number;
  source: RequestSource;
};

export function buildRequestSentProps(
  input: RequestSentInput,
): EventMap["request_sent"] {
  return {
    method: methodEnum(input.method),
    protocol: input.protocol,
    status_class: statusClass(input.status),
    duration_bucket: bucketDuration(input.durationMs),
    source: input.source,
  };
}

export type ChainRunInput = {
  status: "passed" | "failed" | "stopped";
  nodeCount: number;
  durationMs: number;
  blockTypes: readonly string[];
};

export function buildChainRunProps(
  input: ChainRunInput,
): EventMap["chain_run"] {
  return {
    status: input.status === "passed" ? "success" : input.status,
    node_count_bucket: bucketCount(input.nodeCount),
    duration_bucket: bucketDuration(input.durationMs),
    has_loop: input.blockTypes.includes("loop"),
    has_subchain: input.blockTypes.includes("subchain"),
  };
}

export type LandingInput = {
  pathname: string;
  referrer: string;
  ownHost?: string;
};

export function buildLandingProps(
  input: LandingInput,
): EventMap["landing_viewed"] {
  return {
    path: landingPathEnum(input.pathname),
    referrer_domain: referrerDomain(input.referrer, input.ownHost),
  };
}
