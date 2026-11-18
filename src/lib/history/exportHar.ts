import type { HistoryEntry, KVPair, TabType } from "@/types";

const HAR_VERSION = "1.2";
const CREATOR = { name: "requestr", version: "1.0" } as const;
/** HAR uses -1 for timings and sizes that were not measured. */
const NOT_MEASURED = -1;
const HTTP_VERSION = "HTTP/1.1";
/** Request types HAR can describe; anything else (WebSocket, Socket.IO) is counted, not exported. */
const HAR_TYPES: ReadonlySet<TabType> = new Set(["http", "graphql"]);

type HarNameValue = { name: string; value: string };

export type HarEntry = {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    cookies: never[];
    headers: HarNameValue[];
    queryString: HarNameValue[];
    postData?: { mimeType: string; text: string };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    cookies: never[];
    headers: HarNameValue[];
    content: { size: number; mimeType: string; text: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: Record<string, never>;
  timings: {
    blocked: number;
    dns: number;
    connect: number;
    send: number;
    wait: number;
    receive: number;
    ssl: number;
  };
};

export type Har = {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
};

const BODY_MIME: Record<string, string> = {
  json: "application/json",
  xml: "application/xml",
  text: "text/plain",
  html: "text/html",
  urlencoded: "application/x-www-form-urlencoded",
  "form-data": "multipart/form-data",
};

const enabledPairs = (pairs: KVPair[]): HarNameValue[] =>
  pairs
    .filter((pair) => pair.enabled && pair.key !== "")
    .map(({ key, value }) => ({ name: key, value }));

function queryOf(url: string): HarNameValue[] {
  try {
    return [...new URL(url).searchParams].map(([name, value]) => ({
      name,
      value,
    }));
  } catch {
    // A relative or templated URL has no parseable query; HAR allows none.
    return [];
  }
}

function postDataOf(entry: HistoryEntry): HarEntry["request"]["postData"] {
  const { body } = entry.request;
  if (body.type === "none") return undefined;
  const text =
    body.type === "form-data" || body.type === "urlencoded"
      ? (body.formData ?? [])
          .filter((pair) => pair.enabled)
          .map(
            ({ key, value }) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join("&") || body.content
      : body.content;
  return { mimeType: BODY_MIME[body.type] ?? "text/plain", text };
}

function toHarEntry(entry: HistoryEntry): HarEntry {
  const { response } = entry;
  const postData = postDataOf(entry);
  const contentType =
    Object.entries(response.headers).find(
      ([name]) => name.toLowerCase() === "content-type",
    )?.[1] ?? "";
  return {
    startedDateTime: new Date(entry.timestamp).toISOString(),
    time: entry.duration,
    request: {
      method: entry.method,
      url: entry.url,
      httpVersion: HTTP_VERSION,
      cookies: [],
      headers: enabledPairs(entry.request.headers),
      queryString: queryOf(entry.url),
      ...(postData ? { postData } : {}),
      headersSize: NOT_MEASURED,
      bodySize: postData ? postData.text.length : 0,
    },
    response: {
      status: entry.status,
      statusText: response.statusText,
      httpVersion: HTTP_VERSION,
      cookies: [],
      headers: Object.entries(response.headers).map(([name, value]) => ({
        name,
        value,
      })),
      content: { size: entry.size, mimeType: contentType, text: response.body },
      redirectURL: "",
      headersSize: NOT_MEASURED,
      bodySize: entry.size,
    },
    cache: {},
    timings: {
      blocked: NOT_MEASURED,
      dns: NOT_MEASURED,
      connect: NOT_MEASURED,
      send: 0,
      wait: entry.duration,
      receive: 0,
      ssl: NOT_MEASURED,
    },
  };
}

/** Builds a HAR 1.2 document from HTTP/GraphQL entries and counts the entries it had to leave out. */
export function buildHar(entries: readonly HistoryEntry[]): {
  har: Har;
  excludedCount: number;
} {
  const included = entries.filter((entry) => HAR_TYPES.has(entry.request.type));
  return {
    har: {
      log: {
        version: HAR_VERSION,
        creator: CREATOR,
        entries: included.map(toHarEntry),
      },
    },
    excludedCount: entries.length - included.length,
  };
}
