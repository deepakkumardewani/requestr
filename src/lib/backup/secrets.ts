import { REDACTED_VALUE } from "./constants";
import type { BackupData } from "./schema";

/** Single source of truth for BAK-08: lower-cased header names whose values are secrets. */
export const SECRET_HEADER_NAMES: ReadonlySet<string> = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);

export type SecretPolicy = { includeSecrets: boolean };

type Rec = Record<string, unknown>;

const VARIABLE_REFERENCE = /^\s*\{\{[^{}]+\}\}\s*$/;
const URL_PASSWORD = /^([a-z][a-z0-9+.-]*:\/\/[^:/?#@]*):[^@/?#]*@/i;

const isRec = (value: unknown): value is Rec =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A pure `{{name}}` reference is not a secret, so it survives. */
function blank(value: unknown): unknown {
  if (typeof value === "string" && VARIABLE_REFERENCE.test(value)) return value;
  return REDACTED_VALUE;
}

/** Applies `fn` to every record in a list; anything else passes through. */
function mapRecords(list: unknown, fn: (item: Rec) => Rec): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((item) => (isRec(item) ? fn(item) : item));
}

/** Blanks `fields` on a record that has them. */
function blankFields(item: Rec, fields: string[]): Rec {
  const next = { ...item };
  for (const field of fields) {
    if (field in next) next[field] = blank(next[field]);
  }
  return next;
}

/** Headers as `KVPair[]`. */
export function redactHeaderList(headers: unknown): unknown {
  return mapRecords(headers, (pair) =>
    SECRET_HEADER_NAMES.has(String(pair.key).toLowerCase())
      ? blankFields(pair, ["value"])
      : pair,
  );
}

/** Headers as a name to value record (history responses, run steps). */
function redactHeaderRecord(headers: unknown): unknown {
  if (!isRec(headers)) return headers;
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      SECRET_HEADER_NAMES.has(name.toLowerCase()) ? blank(value) : value,
    ]),
  );
}

function redactAuth(auth: unknown): unknown {
  if (!isRec(auth)) return auth;
  if (auth.type === "bearer") return blankFields(auth, ["token"]);
  if (auth.type === "basic") return blankFields(auth, ["password"]);
  if (auth.type === "api-key") return blankFields(auth, ["value"]);
  return auth;
}

/** A request snapshot: a saved request, a history `HttpTab` or a chain history block. */
function redactRequest(request: Rec): Rec {
  const next = { ...request };
  if ("auth" in next) next.auth = redactAuth(next.auth);
  if (Array.isArray(next.headers))
    next.headers = redactHeaderList(next.headers);
  return next;
}

function redactHistoryEntry(entry: Rec): Rec {
  const next = { ...entry };
  if (isRec(next.request)) next.request = redactRequest(next.request);
  if ("response" in next) next.response = redactStepMessage(next.response);
  return next;
}

function redactStepMessage(message: unknown): unknown {
  if (!isRec(message) || !("headers" in message)) return message;
  return { ...message, headers: redactHeaderRecord(message.headers) };
}

function redactRunStep(step: Rec): Rec {
  const next = { ...step };
  if ("request" in next) next.request = redactStepMessage(next.request);
  if ("response" in next) next.response = redactStepMessage(next.response);
  return next;
}

function redactChainRun(run: Rec): Rec {
  const next = { ...run };
  withList(next, "steps", redactRunStep);
  return next;
}

function redactChain(chain: Rec): Rec {
  const next = { ...chain };
  withList(next, "blocks", redactRequest);
  return next;
}

function redactEnvironment(environment: Rec): Rec {
  const next = { ...environment };
  withList(next, "variables", (variable) =>
    variable.isSecret === true
      ? blankFields(variable, ["initialValue", "currentValue"])
      : variable,
  );
  return next;
}

export function redactProxyUrl(proxyUrl: unknown): unknown {
  if (typeof proxyUrl !== "string") return proxyUrl;
  return proxyUrl.replace(URL_PASSWORD, "$1:@");
}

function redactSettings(settings: Rec): Rec {
  const next = { ...settings };
  if ("globalHeaders" in next) {
    next.globalHeaders = redactHeaderList(next.globalHeaders);
  }
  if ("proxyUrl" in next) next.proxyUrl = redactProxyUrl(next.proxyUrl);
  return next;
}

/** Applies `fn` to a list key of `data` only when the key is present. */
function withList(data: Rec, key: string, fn: (item: Rec) => Rec): void {
  if (key in data) data[key] = mapRecords(data[key], fn);
}

/**
 * Blanks every BAK-08 field; returns a new object and never mutates `data`.
 * With `includeSecrets` the input is returned untouched.
 */
export function applySecretPolicy(
  data: BackupData,
  { includeSecrets }: SecretPolicy,
): BackupData {
  if (includeSecrets) return data;
  const next: Rec = { ...data };
  withList(next, "requests", redactRequest);
  withList(next, "environments", redactEnvironment);
  withList(next, "chains", redactChain);
  withList(next, "history", redactHistoryEntry);
  withList(next, "chainRuns", redactChainRun);
  if (isRec(next.settings)) next.settings = redactSettings(next.settings);
  return next as BackupData;
}
