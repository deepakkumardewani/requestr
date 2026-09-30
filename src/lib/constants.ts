import type { HttpMethod } from "@/types";

export const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export const METHOD_PALETTE: Record<
  HttpMethod,
  { r: number; g: number; b: number }
> = {
  GET: { r: 52, g: 211, b: 153 },
  POST: { r: 96, g: 165, b: 250 },
  PUT: { r: 251, g: 191, b: 36 },
  PATCH: { r: 192, g: 132, b: 252 },
  DELETE: { r: 248, g: 113, b: 113 },
  HEAD: { r: 34, g: 211, b: 238 },
  OPTIONS: { r: 244, g: 114, b: 182 },
};

export const METHOD_BADGE_CLASSES: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/20 text-emerald-400",
  POST: "bg-blue-500/20 text-blue-400",
  PUT: "bg-amber-500/20 text-amber-400",
  PATCH: "bg-purple-500/20 text-purple-400",
  DELETE: "bg-red-500/20 text-red-400",
  HEAD: "bg-cyan-500/20 text-cyan-400",
  OPTIONS: "bg-pink-500/20 text-pink-400",
};

export const MAX_HISTORY_ENTRIES = 200;
export const MAX_RESPONSE_DISPLAY_BYTES = 10_485_760; // 10MB
export const MAX_PROXY_RESPONSE_BYTES = 52_428_800; // 50MB

/** Default HTTP request timeout when `timeoutMs` is unset on the tab/request. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Header names (case-insensitive) defaulting to masked value in the headers editor. */
export const SENSITIVE_HEADER_KEY_LOWERCASE = [
  "authorization",
  "x-api-key",
  "x-auth-token",
] as const;

export function isSensitiveHeaderKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  return (SENSITIVE_HEADER_KEY_LOWERCASE as readonly string[]).includes(k);
}

export const IDB_DB_NAME = "requestly";

export const STANDARD_HEADERS = [
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "Content-Length",
  "Cookie",
  "Host",
  "If-Match",
  "If-None-Match",
  "Origin",
  "Referer",
  "User-Agent",
  "X-API-Key",
  "X-Auth-Token",
  "X-Forwarded-For",
  "X-Request-ID",
];

export const CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  xml: "application/xml",
  text: "text/plain",
  html: "text/html",
  urlencoded: "application/x-www-form-urlencoded",
};

/** Values align with `TabType` in `@/types`. */
export const TAB_TYPES = {
  HTTP: "http",
  GRAPHQL: "graphql",
  WEBSOCKET: "websocket",
  SOCKETIO: "socketio",
} as const;

export const MAX_WS_LOG_ENTRIES = 1000;

export const ACCENT_COLORS: {
  label: string;
  r: number;
  g: number;
  b: number;
}[] = [
  { label: "Emerald", r: 52, g: 211, b: 153 },
  { label: "Blue", r: 96, g: 165, b: 250 },
  { label: "Amber", r: 251, g: 191, b: 36 },
  { label: "Purple", r: 192, g: 132, b: 252 },
  { label: "Red", r: 248, g: 113, b: 113 },
  { label: "Cyan", r: 34, g: 211, b: 238 },
  { label: "Pink", r: 244, g: 114, b: 182 },
];
