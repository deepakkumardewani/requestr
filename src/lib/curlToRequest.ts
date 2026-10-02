import { CurlParseError, parseCurl } from "@/lib/curlParser";
import type { HttpTab } from "@/types";

export const CURL_ERROR_REASONS = [
  "empty",
  "notCurl",
  "missingUrl",
  "unknownMethod",
  "invalidHeader",
  "unknown",
] as const;

export type CurlErrorReason = (typeof CURL_ERROR_REASONS)[number];

/** Typed error whose `reason` maps to an i18n key (pickerCurlReason<Reason>). */
export class CurlToRequestError extends Error {
  readonly reason: CurlErrorReason;

  constructor(reason: CurlErrorReason, message: string) {
    super(message);
    this.name = "CurlToRequestError";
    this.reason = reason;
  }
}

export type CurlRequestDraft = HttpTab;

const CURL_PREFIX = /^curl(\s|$)/i;
const HTTP_URL_PREFIX = /^https?:\/\//i;
const WHITESPACE = /\s/;
const DEFAULT_SCHEME = "https://";
const ROOT_PATH = "/";

// curlParser only exposes free-text messages, so reasons are keyed by prefix.
const PARSER_MESSAGE_REASONS: ReadonlyArray<[string, CurlErrorReason]> = [
  ["No URL found", "missingUrl"],
  ['Input must start with "curl"', "notCurl"],
  ["Unknown HTTP method", "unknownMethod"],
  ["Missing header value", "invalidHeader"],
  ["Invalid header format", "invalidHeader"],
];

function reasonFromParserError(error: CurlParseError): CurlErrorReason {
  const match = PARSER_MESSAGE_REASONS.find(([prefix]) =>
    error.message.startsWith(prefix),
  );
  return match ? match[1] : "unknown";
}

/** `POST /orders`; falls back to the raw URL when it is not parseable. */
export function deriveRequestName(method: string, url: string): string {
  try {
    const { pathname } = new URL(url);
    return `${method} ${pathname || ROOT_PATH}`;
  } catch {
    return `${method} ${url}`;
  }
}

function buildDraft(parts: Pick<HttpTab, "method" | "url"> & Partial<HttpTab>) {
  const draft: CurlRequestDraft = {
    tabId: "",
    requestId: null,
    name: deriveRequestName(parts.method, parts.url),
    isDirty: false,
    type: "http",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    ...parts,
  };
  return draft;
}

function isBareUrl(input: string): boolean {
  return !WHITESPACE.test(input) && !CURL_PREFIX.test(input);
}

/**
 * Converts pasted cURL text, an http(s) URL or a bare host into an HttpTab draft.
 * @throws CurlToRequestError with an enumerated `reason`.
 */
export function curlToRequest(input: string): CurlRequestDraft {
  const trimmed = input.trim();
  if (!trimmed) throw new CurlToRequestError("empty", "Input is empty");

  if (isBareUrl(trimmed)) {
    const url = HTTP_URL_PREFIX.test(trimmed)
      ? trimmed
      : `${DEFAULT_SCHEME}${trimmed}`;
    return buildDraft({ method: "GET", url });
  }

  try {
    const parsed = parseCurl(trimmed);
    return buildDraft(parsed);
  } catch (error) {
    if (error instanceof CurlParseError) {
      throw new CurlToRequestError(reasonFromParserError(error), error.message);
    }
    throw error;
  }
}
