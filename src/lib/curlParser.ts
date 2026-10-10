import { HTTP_METHODS } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import type {
  AuthConfig,
  BodyConfig,
  HttpMethod,
  KVPair,
  ParsedCurl,
} from "@/types";

export class CurlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurlParseError";
  }
}

/** Joins continuation lines (backslash at end) into a single line */
function joinContinuations(raw: string): string {
  return raw
    .replace(/\\\s*\n\s*/g, " ")
    .replace(/\\\s*\r\n\s*/g, " ")
    .trim();
}

/** Simple tokenizer that respects quoted strings */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    // skip whitespace
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    const ch = input[i];

    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let token = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          i++;
          token += input[i];
        } else {
          token += input[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push(token);
    } else {
      let token = "";
      while (i < input.length && !/\s/.test(input[i])) {
        token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}

function parseHeader(headerStr: string): { key: string; value: string } {
  const colonIdx = headerStr.indexOf(":");
  if (colonIdx === -1) {
    throw new CurlParseError(`Invalid header format: "${headerStr}"`);
  }
  return {
    key: headerStr.slice(0, colonIdx).trim(),
    value: headerStr.slice(colonIdx + 1).trim(),
  };
}

function isHttpMethod(value: string): value is HttpMethod {
  return HTTP_METHODS.includes(value.toUpperCase() as HttpMethod);
}

// Flags that take a value we do not model. Listed so their value is never mistaken for the URL.
const IGNORED_VALUE_FLAGS = new Set([
  "-o",
  "--output",
  "-A",
  "--user-agent",
  "-e",
  "--referer",
  "-m",
  "--max-time",
  "--connect-timeout",
  "-x",
  "--proxy",
  "-c",
  "--cookie-jar",
  "-w",
  "--write-out",
  "-T",
  "--upload-file",
  "--retry",
  "--cacert",
  "--cert",
  "--key",
]);

const DATA_FLAGS = new Set(["-d", "--data", "--data-raw", "--data-binary"]);
const FORM_FLAGS = new Set(["-F", "--form"]);
const COOKIE_FLAGS = new Set(["-b", "--cookie"]);
// Short flags curl allows glued to their value (`-XPOST`).
const ATTACHED_SHORT_FLAG = /^(-[XHdFubA])(.+)$/;
const JSON_CONTENT_TYPE = "application/json";

type FlagState = {
  method: HttpMethod | null;
  url: string;
  headers: Array<{ key: string; value: string }>;
  dataParts: string[];
  urlencodedParts: string[];
  formParts: string[];
  jsonParts: string[];
  basicAuth: { username: string; password: string } | null;
  useGet: boolean;
  head: boolean;
};

/** Splits `-XPOST` and `--request=POST` into flag + value tokens. */
function normalizeTokens(tokens: string[]): string[] {
  return tokens.flatMap((token, idx) => {
    if (idx === 0 || !token.startsWith("-")) return [token];
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      return eq === -1 ? [token] : [token.slice(0, eq), token.slice(eq + 1)];
    }
    const attached = ATTACHED_SHORT_FLAG.exec(token);
    return attached ? [attached[1], attached[2]] : [token];
  });
}

function hasHeaderKey(headers: Array<{ key: string }>, name: string): boolean {
  return headers.some((h) => h.key.toLowerCase() === name.toLowerCase());
}

/** Consumes the flag at `tokens[i]` (plus its value) into `state`; returns the next index. */
function applyFlag(tokens: string[], i: number, state: FlagState): number {
  const flag = tokens[i];
  const value = tokens[i + 1];

  if (flag === "-X" || flag === "--request") {
    const m = value?.toUpperCase();
    if (!m || !isHttpMethod(m)) {
      throw new CurlParseError(`Unknown HTTP method: "${value}"`);
    }
    state.method = m;
  } else if (flag === "-H" || flag === "--header") {
    if (!value) throw new CurlParseError("Missing header value after -H");
    state.headers.push(parseHeader(value));
  } else if (DATA_FLAGS.has(flag)) {
    state.dataParts.push(value ?? "");
  } else if (flag === "--data-urlencode") {
    state.urlencodedParts.push(value ?? "");
  } else if (FORM_FLAGS.has(flag)) {
    state.formParts.push(value ?? "");
  } else if (flag === "--json") {
    state.jsonParts.push(value ?? "");
  } else if (flag === "-u" || flag === "--user") {
    const parts = (value ?? "").split(":");
    state.basicAuth = { username: parts[0] ?? "", password: parts[1] ?? "" };
  } else if (COOKIE_FLAGS.has(flag)) {
    // Without "=" curl treats the value as a cookie file to read, which we cannot do.
    if (value?.includes("=")) {
      state.headers.push({ key: "Cookie", value });
    }
  } else if (flag === "--url") {
    if (!state.url) state.url = value ?? "";
  } else if (flag === "-G" || flag === "--get") {
    state.useGet = true;
    return i + 1;
  } else if (flag === "-I" || flag === "--head") {
    state.head = true;
    return i + 1;
  } else if (IGNORED_VALUE_FLAGS.has(flag)) {
    // value is skipped below
  } else if (flag.startsWith("-")) {
    // Unknown or boolean flag: consume no value
    return i + 1;
  } else {
    // Bare URL (only the first one counts)
    if (!state.url) state.url = flag;
    return i + 1;
  }
  return i + 2;
}

function toKVPair(part: string): KVPair {
  const eqIdx = part.indexOf("=");
  const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
  const value = eqIdx === -1 ? "" : part.slice(eqIdx + 1);
  return { id: generateId(), key, value, enabled: true };
}

function encodePairs(pairs: KVPair[]): string {
  return pairs
    .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
    .join("&");
}

function appendQuery(url: string, query: string): string {
  if (!query) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function inferTextBodyType(
  content: string,
  rawHeaders: Array<{ key: string; value: string }>,
): BodyConfig {
  const contentType =
    rawHeaders.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";

  if (contentType.includes(JSON_CONTENT_TYPE) || isJsonString(content)) {
    return { type: "json", content };
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return { type: "urlencoded", content };
  }
  if (
    contentType.includes("text/xml") ||
    contentType.includes("application/xml")
  ) {
    return { type: "xml", content };
  }
  return { type: "text", content };
}

/** Builds the body from the collected flags. Precedence: --json, -F, --data-urlencode, -d. */
function buildBody(state: FlagState): BodyConfig {
  if (state.jsonParts.length > 0) {
    return { type: "json", content: state.jsonParts.join("") };
  }
  if (state.formParts.length > 0) {
    // `key=@file` stays a literal text field: the app has no file model for form-data.
    return {
      type: "form-data",
      content: "",
      formData: state.formParts.map(toKVPair),
    };
  }
  if (state.urlencodedParts.length > 0) {
    const formData = state.urlencodedParts.map(toKVPair);
    return { type: "urlencoded", content: encodePairs(formData), formData };
  }
  // curl joins repeated -d values with "&"
  const dataContent = state.dataParts.join("&");
  if (!dataContent) return { type: "none", content: "" };
  return inferTextBodyType(dataContent, state.headers);
}

function resolveMethod(state: FlagState, hasBody: boolean): HttpMethod {
  if (state.method) return state.method;
  if (state.head) return "HEAD";
  if (state.useGet) return "GET";
  return hasBody ? "POST" : "GET";
}

/** --json implies JSON Content-Type/Accept unless the user already set them. */
function addJsonHeaders(state: FlagState): void {
  for (const name of ["Content-Type", "Accept"]) {
    if (!hasHeaderKey(state.headers, name)) {
      state.headers.push({ key: name, value: JSON_CONTENT_TYPE });
    }
  }
}

export function parseCurl(input: string): ParsedCurl {
  const joined = joinContinuations(input.trim());
  const tokens = normalizeTokens(tokenize(joined));

  if (tokens[0]?.toLowerCase() !== "curl") {
    throw new CurlParseError('Input must start with "curl"');
  }

  const state: FlagState = {
    method: null,
    url: "",
    headers: [],
    dataParts: [],
    urlencodedParts: [],
    formParts: [],
    jsonParts: [],
    basicAuth: null,
    useGet: false,
    head: false,
  };

  let i = 1;
  while (i < tokens.length) {
    i = applyFlag(tokens, i, state);
  }

  if (!state.url) {
    throw new CurlParseError("No URL found in cURL command");
  }

  if (state.jsonParts.length > 0) addJsonHeaders(state);

  let body = state.head
    ? ({ type: "none", content: "" } as BodyConfig)
    : buildBody(state);
  let url = state.url;

  // -G sends the data in the query string instead of the body
  if (state.useGet && !state.head) {
    const queryParts = [
      ...state.dataParts,
      ...(state.urlencodedParts.length > 0
        ? [encodePairs(state.urlencodedParts.map(toKVPair))]
        : []),
    ];
    url = appendQuery(url, queryParts.join("&"));
    body = { type: "none", content: "" };
  }

  const method = resolveMethod(state, body.type !== "none");

  const headers: KVPair[] = state.headers.map((h) => ({
    id: generateId(),
    key: h.key,
    value: h.value,
    enabled: true,
  }));

  let auth: AuthConfig = { type: "none" };
  if (state.basicAuth) {
    auth = { type: "basic", ...state.basicAuth };
  } else {
    const authHeader = state.headers.find(
      (h) => h.key.toLowerCase() === "authorization",
    );
    if (authHeader?.value.startsWith("Bearer ")) {
      auth = { type: "bearer", token: authHeader.value.slice(7) };
    }
  }

  return { method, url, headers, body, auth };
}

function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
