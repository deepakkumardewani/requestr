import type { EnvironmentModel, KVPair } from "@/types";

/**
 * Redaction layer (FR-60, FR-61). It runs at two choke points: the context
 * builder and the tool result serializer. Every function is pure and
 * idempotent: redacting already redacted data changes nothing, which is what
 * lets the server reuse `hasUnredactedSecret` as a defensive check.
 */

export const REDACTED = "[redacted]";

/** Secrets shorter than this cannot be scrubbed from text without wrecking it. */
const MIN_SCRUB_VALUE_LENGTH = 3;
const MAX_DEPTH = 24;

const VAR_REF = /\{\{\s*[\w.-]+\s*\}\}/;
const VAR_REFS = /\{\{\s*[\w.-]+\s*\}\}/g;
const SCHEME_WORD = /^(bearer|basic|token|digest)?$/i;

const SENSITIVE_NAMES = new Set([
  "password",
  "passwd",
  "pwd",
  "secret",
  "clientsecret",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "apikey",
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "privatekey",
  "credentials",
  "sessionid",
  "signature",
  "bearer",
  "jwt",
]);
const SENSITIVE_NAME_FRAGMENTS =
  /(password|passwd|secret|apikey|accesskey|privatekey|accesstoken|refreshtoken)/;
/** Names that are only sensitive as a query parameter. */
const SENSITIVE_QUERY_NAMES = new Set(["key", "sig", "auth", "sid"]);

const TOKEN_PATTERNS: readonly RegExp[] = [
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\b[sr]k_(?:test|live)_[A-Za-z0-9]{8,}/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
];
const BEARER = /\b(Bearer)\s+(?!\[redacted\]|\{\{)[A-Za-z0-9._~+/=-]{6,}/gi;
/** Capitalised only: lowercase "token" is common prose and code. */
const TOKEN_SCHEME = /\b(Token)\s+(?!\[redacted\]|\{\{)[A-Za-z0-9._~+/=-]{6,}/g;
/** Any case of `basic`; `redactBasic` skips lowercase prose such as "basic authentication". */
const BASIC = /\b(basic)\s+(?!\[redacted\]|\{\{)([A-Za-z0-9+/=]{8,})/gi;
const BASE64_MARKERS = /[A-Z0-9+/=]/;
/** `?key=` and `&access_key=` in free text, where no URL parser runs. */
const QUERY_KEY =
  /([?&](?:key|access[_-]?key)=)(?!\[redacted\]|\{\{)[^&\s"'#]+/gi;
const URL_USERINFO = /(\/\/)([^/\s:@]+):([^/\s@]+)@/g;
const NAMED_VALUE =
  /(["']?)([\w.-]+)\1(\s*[:=]\s*)(["']?)((?:\{\{[^}]*\}\}|[^"'\s&,;}])+)\4/g;

export type SecretValue = { name: string; value: string };

export type RedactContext = {
  /** Lets non-secret environment values reach the model (FR-61). */
  shareValues: boolean;
  /** Resolved secret values to scrub from any text, replaced by `{{name}}`. */
  secrets: readonly SecretValue[];
};

export const DEFAULT_REDACT_CONTEXT: RedactContext = {
  shareValues: false,
  secrets: [],
};

/** Collects every secret-typed variable value so it can be scrubbed from text. */
export function buildRedactContext(
  environments: readonly EnvironmentModel[],
  shareValues = false,
): RedactContext {
  const secrets = environments
    .flatMap((env) => env.variables)
    .filter((variable) => variable.isSecret)
    .flatMap((variable) =>
      [variable.currentValue, variable.initialValue]
        .filter((value) => value.length >= MIN_SCRUB_VALUE_LENGTH)
        .map((value) => ({ name: variable.key, value })),
    )
    .sort((a, b) => b.value.length - a.value.length);
  return { shareValues, secrets };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, "");
}

export function isSensitiveName(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    SENSITIVE_NAMES.has(normalized) ||
    SENSITIVE_NAME_FRAGMENTS.test(normalized) ||
    normalized.endsWith("token") ||
    normalized.endsWith("authorization") ||
    normalized.endsWith("cookie")
  );
}

/** A literal that belongs to a secret slot: variable references survive, anything else does not. */
export function redactSecretLiteral(value: string): string {
  if (value === "" || value === REDACTED) return value;
  const remainder = value.replace(VAR_REFS, "").trim();
  if (VAR_REF.test(value) && SCHEME_WORD.test(remainder)) return value;
  return REDACTED;
}

function scrubKnownSecrets(text: string, secrets: readonly SecretValue[]) {
  return secrets.reduce(
    (current, { name, value }) => current.split(value).join(`{{${name}}}`),
    text,
  );
}

function redactNamedValues(text: string): string {
  return text.replace(
    NAMED_VALUE,
    (match, quote: string, name: string, sep: string, valueQuote, value) => {
      if (!isSensitiveName(name) || SCHEME_WORD.test(value)) return match;
      const next = redactSecretLiteral(value);
      return `${quote}${name}${quote}${sep}${valueQuote}${next}${valueQuote}`;
    },
  );
}

function redactBasic(match: string, scheme: string, credentials: string) {
  const isCapitalized = scheme[0] === scheme[0].toUpperCase();
  return isCapitalized || BASE64_MARKERS.test(credentials)
    ? `${scheme} ${REDACTED}`
    : match;
}

/** Pattern-based redaction of free text: tokens, auth schemes, userinfo and `secret=value` pairs. */
export function redactValue(
  value: string,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): string {
  const scrubbed = scrubKnownSecrets(value, context.secrets);
  const withoutTokens = TOKEN_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, REDACTED),
    scrubbed,
  );
  const withoutSchemes = withoutTokens
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(TOKEN_SCHEME, `$1 ${REDACTED}`)
    .replace(BASIC, redactBasic)
    .replace(QUERY_KEY, `$1${REDACTED}`)
    .replace(
      URL_USERINFO,
      (match, slashes: string, user: string, password: string) =>
        password === REDACTED || VAR_REF.test(password)
          ? match
          : `${slashes}${user}:${REDACTED}@`,
    );
  return redactNamedValues(withoutSchemes);
}

const SECRET_LITERAL_PATTERNS: readonly RegExp[] = [
  ...TOKEN_PATTERNS,
  BEARER,
  TOKEN_SCHEME,
  QUERY_KEY,
];

/**
 * True when free text holds a token-shaped literal (a JWT, a provider key, a
 * Bearer/Basic credential). Unlike `redactValue` it ignores `name = value`
 * pairs, so code such as `const token = pm.get("t")` is not flagged.
 */
export function containsSecretLiteral(text: string): boolean {
  const matched = SECRET_LITERAL_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
  return matched || containsBasicCredential(text);
}

/** Same prose guard as `redactBasic`: "basic authentication" is not a credential. */
function containsBasicCredential(text: string): boolean {
  return [...text.matchAll(BASIC)].some(
    ([, scheme, credentials]) => redactBasic("", scheme, credentials) !== "",
  );
}

function redactHeaderValue(
  name: string,
  value: string,
  context: RedactContext,
): string {
  return isSensitiveName(name)
    ? redactSecretLiteral(value)
    : redactValue(value, context);
}

export function redactHeaders(
  headers: readonly KVPair[],
  context?: RedactContext,
): KVPair[];
export function redactHeaders(
  headers: Record<string, string>,
  context?: RedactContext,
): Record<string, string>;
export function redactHeaders(
  headers: readonly KVPair[] | Record<string, string>,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): KVPair[] | Record<string, string> {
  if (Array.isArray(headers)) {
    return headers.map((header: KVPair) => ({
      ...header,
      value: redactHeaderValue(header.key, header.value, context),
    }));
  }
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      redactHeaderValue(name, value as string, context),
    ]),
  );
}

function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function redactQueryPair(pair: string, context: RedactContext): string {
  const separator = pair.indexOf("=");
  if (separator < 0) return redactValue(pair, context);
  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  const decoded = decodeName(name);
  const sensitive =
    isSensitiveName(decoded) ||
    SENSITIVE_QUERY_NAMES.has(normalizeName(decoded));
  const next = sensitive
    ? redactSecretLiteral(value)
    : redactValue(value, context);
  return `${name}=${next}`;
}

/** URLs may hold `{{base}}` templates, so they are split by hand rather than parsed. */
export function redactUrl(
  url: string,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): string {
  const hashAt = url.indexOf("#");
  const fragment = hashAt < 0 ? "" : url.slice(hashAt);
  const withoutFragment = hashAt < 0 ? url : url.slice(0, hashAt);
  const queryAt = withoutFragment.indexOf("?");
  const base =
    queryAt < 0 ? withoutFragment : withoutFragment.slice(0, queryAt);
  const query = queryAt < 0 ? null : withoutFragment.slice(queryAt + 1);
  const redactedQuery =
    query === null
      ? ""
      : `?${query
          .split("&")
          .map((pair) => redactQueryPair(pair, context))
          .join("&")}`;
  return `${redactValue(base, context)}${redactedQuery}${redactValue(fragment, context)}`;
}

function isKeyValuePair(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { key: string; value: string } {
  return typeof value.key === "string" && typeof value.value === "string";
}

function redactEntries(
  entries: Record<string, unknown>,
  context: RedactContext,
  depth: number,
): Record<string, unknown> {
  const pairSensitive = isKeyValuePair(entries) && isSensitiveName(entries.key);
  return Object.fromEntries(
    Object.entries(entries).map(([name, value]) => {
      if (
        typeof value === "string" &&
        (isSensitiveName(name) || (pairSensitive && name === "value"))
      ) {
        return [name, redactSecretLiteral(value)];
      }
      return [name, redactDeep(value, context, depth + 1)];
    }),
  );
}

/** Redacts any JSON-like value: strings by pattern, secret-named fields and secret key/value pairs outright. */
export function redactDeep<T>(
  value: T,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
  depth = 0,
): T {
  if (depth > MAX_DEPTH) return REDACTED as unknown as T;
  if (typeof value === "string") return redactValue(value, context) as T;
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, context, depth + 1)) as T;
  }
  if (value && typeof value === "object") {
    return redactEntries(value as Record<string, unknown>, context, depth) as T;
  }
  return value;
}

/** JSON bodies are redacted structurally; anything else falls back to text patterns. */
export function redactBody(
  body: string,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      return JSON.stringify(redactDeep(parsed, context), null, 2);
    }
  } catch {
    // Not JSON: the text patterns below still apply.
  }
  return redactValue(body, context);
}

export type RedactedVariable = {
  key: string;
  isSecret: boolean;
  hasValue: boolean;
  /** Only present while `shareValues` is on; a secret's value is always `[redacted]`. */
  value?: string;
};

export type RedactedEnvironment = {
  id: string;
  name: string;
  variables: RedactedVariable[];
};

/**
 * The one environment shape the model ever sees: names and whether each has a
 * value. Values appear only with `shareValues` (FR-126, NFR-1).
 */
export function redactEnvironment(
  env: EnvironmentModel,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): RedactedEnvironment {
  return {
    id: env.id,
    name: env.name,
    variables: env.variables.map((variable) => ({
      key: variable.key,
      isSecret: variable.isSecret,
      hasValue: variable.currentValue.trim() !== "",
      ...(context.shareValues
        ? {
            value: variable.isSecret
              ? REDACTED
              : redactValue(variable.currentValue, context),
          }
        : {}),
    })),
  };
}

/** True when redacting would still change `value`: it holds a secret that slipped through. */
export function hasUnredactedSecret(
  value: unknown,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): boolean {
  return JSON.stringify(redactDeep(value, context)) !== JSON.stringify(value);
}

/** Tool part fields that carry data; everything else in a message is structure the model API needs intact. */
const HISTORY_CONTENT_FIELDS = ["input", "output", "errorText"] as const;

type HistoryMessage = { parts: Array<{ type: string }> };

function redactHistoryPart<P extends { type: string }>(
  part: P,
  context: RedactContext,
): P {
  const redacted: Record<string, unknown> = { ...part };
  for (const field of HISTORY_CONTENT_FIELDS) {
    if (field in redacted) {
      redacted[field] = redactDeep(redacted[field], context);
    }
  }
  return redacted as P;
}

/**
 * Redacts replayed tool data (RP-203) without touching ids, roles, part types
 * or states: scrubbing those would corrupt the conversation. User and
 * assistant text is left alone; FR-60 covers tool results and context chips.
 */
export function redactHistory<M extends HistoryMessage>(
  messages: readonly M[],
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): M[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => redactHistoryPart(part, context)),
  }));
}

/** True when redacting history would still change it. */
export function hasUnredactedHistorySecret(
  messages: readonly HistoryMessage[],
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): boolean {
  return (
    JSON.stringify(redactHistory(messages, context)) !==
    JSON.stringify(messages)
  );
}
