import type { AuthConfig, BodyConfig, HttpMethod, KVPair } from "@/types";
import {
  DEFAULT_REDACT_CONTEXT,
  isSensitiveName,
  REDACTED,
  type RedactContext,
  redactBody,
  redactHeaders,
  redactSecretLiteral,
  redactUrl,
} from "./redact";

/**
 * curl import and export (FR-194). Both directions are pure. Export routes
 * every header, auth field, URL and body through the redaction layer, so a
 * secret can never leave in the text Relay shows (NFR-1).
 */

export type CurlHeader = { key: string; value: string };

export type CurlBody = { type: BodyConfig["type"]; content: string };

export type CurlDraft = {
  method: HttpMethod;
  url: string;
  headers: CurlHeader[];
  body: CurlBody | null;
  /** From `-u user:password`. */
  basicAuth: { username: string; password: string } | null;
};

export type CurlParseResult =
  | { ok: true; draft: CurlDraft }
  | { ok: false; error: string };

export const CURL_MAX_CHARS = 100_000;

const METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
const LINE_CONTINUATION = /\\\r?\n/g;
const CURL_COMMAND = /^curl$/i;
const HTTP_URL = /^(?:https?|wss?):\/\/|^\{\{/i;
const COOKIE_HEADER = "Cookie";
const USER_AGENT_HEADER = "User-Agent";
const CONTENT_TYPE_HEADER = "content-type";
const SCHEME_PREFIX = /^(bearer|basic|token|digest)\s+/i;

/* ---------------------------------- parsing --------------------------------- */

/** Splits a shell command into words, honouring quotes and backslash escapes. */
function tokenize(text: string): string[] | null {
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
    } else if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "\\" && i + 1 < text.length) {
        i += 1;
        current += text[i];
      } else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === "\\" && i + 1 < text.length) {
      i += 1;
      current += text[i];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (quote) return null;
  if (started) tokens.push(current);
  return tokens;
}

const DATA_FLAGS = new Set([
  "-d",
  "--data",
  "--data-raw",
  "--data-binary",
  "--data-ascii",
  "--data-urlencode",
]);
const VALUE_FLAGS_IGNORED = new Set([
  "-o",
  "--output",
  "-m",
  "--max-time",
  "--connect-timeout",
  "-e",
  "--referer",
  "-x",
  "--proxy",
  "--cacert",
  "--cert",
  "--key",
  "-w",
  "--write-out",
  "--retry",
]);

type Accumulator = {
  method: HttpMethod | null;
  url: string | null;
  headers: CurlHeader[];
  data: string[];
  basic: string | null;
  head: boolean;
};

function splitHeader(raw: string): CurlHeader | null {
  const colon = raw.indexOf(":");
  if (colon <= 0) return null;
  const key = raw.slice(0, colon).trim();
  return key ? { key, value: raw.slice(colon + 1).trim() } : null;
}

function normalizeMethod(raw: string): HttpMethod | null {
  const upper = raw.toUpperCase() as HttpMethod;
  return METHODS.includes(upper) ? upper : null;
}

type FlagResult = string | null;

/** Applies one flag that takes a value; returns an error message or null. */
function applyValueFlag(
  flag: string,
  value: string,
  acc: Accumulator,
): FlagResult {
  if (flag === "-X" || flag === "--request") {
    const method = normalizeMethod(value);
    if (!method) return `unsupported method: ${value}`;
    acc.method = method;
  } else if (flag === "-H" || flag === "--header") {
    const header = splitHeader(value);
    if (!header) return `malformed header: ${value}`;
    acc.headers.push(header);
  } else if (DATA_FLAGS.has(flag)) {
    acc.data.push(value);
  } else if (flag === "-u" || flag === "--user") {
    acc.basic = value;
  } else if (flag === "--url") {
    acc.url = value;
  } else if (flag === "-b" || flag === "--cookie") {
    acc.headers.push({ key: COOKIE_HEADER, value });
  } else if (flag === "-A" || flag === "--user-agent") {
    acc.headers.push({ key: USER_AGENT_HEADER, value });
  }
  return null;
}

function expectsValue(flag: string): boolean {
  return (
    [
      "-X",
      "--request",
      "-H",
      "--header",
      "-u",
      "--user",
      "--url",
      "-b",
      "--cookie",
      "-A",
      "--user-agent",
    ].includes(flag) ||
    DATA_FLAGS.has(flag) ||
    VALUE_FLAGS_IGNORED.has(flag)
  );
}

/** Attached forms such as `-XPOST` and `--request=POST`. */
function splitAttached(token: string): [string, string | null] {
  if (token.startsWith("--")) {
    const equals = token.indexOf("=");
    return equals < 0
      ? [token, null]
      : [token.slice(0, equals), token.slice(equals + 1)];
  }
  if (token.startsWith("-") && token.length > 2) {
    return [token.slice(0, 2), token.slice(2)];
  }
  return [token, null];
}

function readTokens(tokens: string[]): Accumulator | string {
  const acc: Accumulator = {
    method: null,
    url: null,
    headers: [],
    data: [],
    basic: null,
    head: false,
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const [flag, attached] = splitAttached(tokens[i]);
    if (!tokens[i].startsWith("-")) {
      if (acc.url === null) acc.url = tokens[i];
      continue;
    }
    if (flag === "-I" || flag === "--head") {
      acc.head = true;
      continue;
    }
    if (!expectsValue(flag)) continue;
    const value = attached ?? tokens[++i];
    if (value === undefined) return `missing value for ${flag}`;
    const error = applyValueFlag(flag, value, acc);
    if (error) return error;
  }
  return acc;
}

function inferBody(content: string, headers: CurlHeader[]): CurlBody {
  const contentType =
    headers.find((h) => h.key.toLowerCase() === CONTENT_TYPE_HEADER)?.value ??
    "";
  if (/x-www-form-urlencoded/i.test(contentType)) {
    return { type: "urlencoded", content };
  }
  if (/json/i.test(contentType)) return { type: "json", content };
  try {
    JSON.parse(content);
    return { type: "json", content };
  } catch {
    return { type: "text", content };
  }
}

function parseBasic(raw: string | null): CurlDraft["basicAuth"] {
  if (raw === null) return null;
  const colon = raw.indexOf(":");
  return colon < 0
    ? { username: raw, password: "" }
    : { username: raw.slice(0, colon), password: raw.slice(colon + 1) };
}

/** Reads a curl command into a request draft, or explains why it cannot. */
export function parseCurl(text: string): CurlParseResult {
  if (text.length > CURL_MAX_CHARS) {
    return { ok: false, error: "the curl command is too long" };
  }
  const tokens = tokenize(text.replace(LINE_CONTINUATION, " ").trim());
  if (!tokens) return { ok: false, error: "unbalanced quotes in the command" };
  if (!tokens.length || !CURL_COMMAND.test(tokens[0])) {
    return { ok: false, error: "the command must start with curl" };
  }
  const acc = readTokens(tokens.slice(1));
  if (typeof acc === "string") return { ok: false, error: acc };
  if (!acc.url) return { ok: false, error: "no URL found in the command" };
  if (!HTTP_URL.test(acc.url)) {
    return { ok: false, error: `unsupported URL: ${acc.url}` };
  }
  const content = acc.data.join("&");
  const hasBody = acc.data.length > 0;
  const method = acc.method ?? (acc.head ? "HEAD" : hasBody ? "POST" : "GET");
  return {
    ok: true,
    draft: {
      method,
      url: acc.url,
      headers: acc.headers,
      body: hasBody ? inferBody(content, acc.headers) : null,
      basicAuth: parseBasic(acc.basic),
    },
  };
}

/* ------------------------------ secret templating --------------------------- */

export type TemplatedDraft = {
  draft: CurlDraft;
  /** Variable names the user must define, because a literal secret was replaced. */
  needsValue: string[];
};

const toVariableName = (label: string) =>
  label.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "secret";

/**
 * Replaces literal secrets with `{{variable}}` references, which is what the
 * write tools require; the user then fills the variable in themselves.
 */
export function templateSecrets(draft: CurlDraft): TemplatedDraft {
  const needsValue: string[] = [];
  const reference = (label: string) => {
    const name = toVariableName(label);
    if (!needsValue.includes(name)) needsValue.push(name);
    return `{{${name}}}`;
  };
  const headers = draft.headers.map((header) => {
    if (!isSensitiveName(header.key)) return header;
    if (redactSecretLiteral(header.value) === header.value) return header;
    const scheme = SCHEME_PREFIX.exec(header.value)?.[0] ?? "";
    return { ...header, value: `${scheme}${reference(header.key)}` };
  });
  const basicAuth = draft.basicAuth
    ? {
        username: draft.basicAuth.username,
        password: draft.basicAuth.password ? reference("basic_password") : "",
      }
    : null;
  return {
    draft: {
      ...draft,
      headers,
      basicAuth,
      url: templateUrl(draft.url, reference),
    },
    needsValue,
  };
}

function templateUrl(url: string, reference: (label: string) => string) {
  const queryAt = url.indexOf("?");
  if (queryAt < 0) return url;
  const query = url
    .slice(queryAt + 1)
    .split("&")
    .map((pair) => {
      const equals = pair.indexOf("=");
      if (equals < 0) return pair;
      const name = pair.slice(0, equals);
      const value = pair.slice(equals + 1);
      const sensitive = isSensitiveName(name) || name.toLowerCase() === "key";
      return sensitive && redactSecretLiteral(value) !== value
        ? `${name}=${reference(name)}`
        : pair;
    })
    .join("&");
  return `${url.slice(0, queryAt)}?${query}`;
}

/* ---------------------------------- export ---------------------------------- */

export type CurlSource = {
  method: HttpMethod;
  url: string;
  headers: readonly KVPair[];
  body: BodyConfig;
  auth: AuthConfig;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

function authParts(auth: AuthConfig): string[] {
  switch (auth.type) {
    case "bearer":
      return ["-H", shellQuote(`Authorization: Bearer ${REDACTED}`)];
    case "basic":
      return ["-u", shellQuote(`${auth.username}:${REDACTED}`)];
    case "api-key":
      return auth.addTo === "header"
        ? ["-H", shellQuote(`${auth.key}: ${REDACTED}`)]
        : [];
    default:
      return [];
  }
}

/** A curl command for the request in which every secret reads `[redacted]`. */
export function buildCurl(
  request: CurlSource,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): string {
  const parts = ["curl", "-X", request.method];
  const url =
    request.auth.type === "api-key" && request.auth.addTo === "query"
      ? `${request.url}${request.url.includes("?") ? "&" : "?"}${request.auth.key}=${REDACTED}`
      : request.url;
  parts.push(shellQuote(redactUrl(url, context)));
  for (const header of redactHeaders(
    request.headers.filter((h) => h.enabled),
    context,
  )) {
    parts.push("-H", shellQuote(`${header.key}: ${header.value}`));
  }
  parts.push(...authParts(request.auth));
  if (request.body.type !== "none" && request.body.content) {
    parts.push(
      "--data-raw",
      shellQuote(redactBody(request.body.content, context)),
    );
  }
  return parts.join(" ");
}
