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
  /(password|passwd|secret|apikey|privatekey|accesstoken|refreshtoken)/;
/** Names that are only sensitive as a query parameter. */
const SENSITIVE_QUERY_NAMES = new Set(["key", "sig", "auth", "sid"]);

const TOKEN_PATTERNS: readonly RegExp[] = [
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
];
const BEARER = /\b(Bearer)\s+(?!\[redacted\]|\{\{)[A-Za-z0-9._~+/=-]{6,}/gi;
const BASIC = /\b(Basic)\s+(?!\[redacted\]|\{\{)[A-Za-z0-9+/=]{8,}/g;
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
    .replace(BASIC, `$1 ${REDACTED}`)
    .replace(
      URL_USERINFO,
      (match, slashes: string, user: string, password: string) =>
        password === REDACTED || VAR_REF.test(password)
          ? match
          : `${slashes}${user}:${REDACTED}@`,
    );
  return redactNamedValues(withoutSchemes);
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
  /** Only present for non-secret variables while `shareValues` is on. */
  value?: string;
};

export type RedactedEnvironment = {
  id: string;
  name: string;
  variables: RedactedVariable[];
};

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
      ...(context.shareValues && !variable.isSecret
        ? { value: redactValue(variable.currentValue, context) }
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
