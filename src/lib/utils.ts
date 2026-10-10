import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { KVPair } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function interpolateVariables(
  template: string,
  env: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => env[key] ?? match);
}

export function parsePathParams(url: string): string[] {
  // Only look in the path portion (before ?)
  // Match :word but not :// (port/protocol colons are excluded since digits and / don't match [A-Za-z_])
  const pathPart = url.split("?")[0];
  return (pathPart.match(/:([A-Za-z_][A-Za-z0-9_]*)/g) ?? []).map((m) =>
    m.slice(1),
  );
}

export function parseQueryString(
  url: string,
): Array<{ key: string; value: string }> {
  try {
    const u = new URL(
      url.includes("://") ? url : `https://placeholder.com/${url}`,
    );
    return Array.from(u.searchParams.entries()).map(([key, value]) => ({
      key,
      value,
    }));
  } catch {
    return [];
  }
}

function decodeQueryToken(token: string): string {
  const spaced = token.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

/**
 * The URL bar and the params table mirror each other (see syncParamsFromUrl), so a pair
 * typed in the URL is also a table row. Drop one URL pair per matching row so it is sent once.
 */
function removeMirroredPairs(
  query: string | undefined,
  rows: Array<{ key: string; value: string }>,
): string {
  if (!query) return "";
  const unmatched = [...rows];
  return query
    .split("&")
    .filter((segment) => {
      if (!segment) return false;
      const [rawKey, ...rest] = segment.split("=");
      const key = decodeQueryToken(rawKey);
      const value = decodeQueryToken(rest.join("="));
      const idx = unmatched.findIndex(
        (r) => r.key === key && r.value === value,
      );
      if (idx === -1) return true;
      unmatched.splice(idx, 1);
      return false;
    })
    .join("&");
}

/**
 * Builds the final URL for sending/curl by substituting path params and appending query params.
 * Path params replace :paramName in the URL path; query params are appended after ?.
 */
export function buildFinalUrl(
  url: string,
  params: Array<{
    key: string;
    value: string;
    enabled: boolean;
    type?: "query" | "path";
  }>,
): string {
  const enabled = params.filter((p) => p.enabled && p.key);
  const pathParams = enabled.filter((p) => p.type === "path");
  const queryParams = enabled.filter((p) => p.type !== "path");

  const [pathPart, existingQuery] = url.split("?");
  let finalUrl = pathPart ?? url;

  for (const p of pathParams) {
    finalUrl = finalUrl.replace(`:${p.key}`, encodeURIComponent(p.value));
  }

  const queryParts: string[] = [];
  const urlOnlyQuery = removeMirroredPairs(existingQuery, queryParams);
  if (urlOnlyQuery) queryParts.push(urlOnlyQuery);
  if (queryParams.length > 0) {
    queryParts.push(
      queryParams
        .map(
          (p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`,
        )
        .join("&"),
    );
  }
  if (queryParts.length > 0) finalUrl = `${finalUrl}?${queryParts.join("&")}`;

  return finalUrl;
}

/** True when the URL is blank or has no `scheme:` — will combine with Settings → Global base URL on send. */
export function isRelativeOrPathOnlyUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(u);
}

/** Prepends workspace base URL when the request URL has no scheme (e.g. `/users` or `users`). */
export function prependGlobalBaseUrl(url: string, baseRaw: string): string {
  const base = baseRaw.trim().replace(/\/+$/, "");
  const u = url.trim();
  if (!base) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${base}${path}`;
}

/**
 * Merge enabled header rows: `overlay` wins on case-insensitive key collision.
 */
export function mergeKvHeaders(base: KVPair[], overlay: KVPair[]): KVPair[] {
  const map = new Map<string, KVPair>();
  for (const h of base) {
    if (!h.enabled || !h.key.trim()) continue;
    map.set(h.key.trim().toLowerCase(), { ...h });
  }
  for (const h of overlay) {
    if (!h.enabled || !h.key.trim()) continue;
    map.set(h.key.trim().toLowerCase(), { ...h });
  }
  return [...map.values()];
}

export function buildUrlWithParams(
  baseUrl: string,
  params: Array<{ key: string; value: string; enabled: boolean }>,
): string {
  const enabledParams = params.filter((p) => p.enabled && p.key);
  if (enabledParams.length === 0) return baseUrl.split("?")[0];

  try {
    const urlWithoutQuery = baseUrl.split("?")[0];
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    return `${urlWithoutQuery}?${queryString}`;
  } catch {
    return baseUrl;
  }
}

/**
 * Given a URL and existing params, derive updated path and query param arrays.
 * - Path params: keys extracted from :param patterns, existing values preserved by key.
 * - Query params: replaced from URL query string; kept unchanged when URL has no query string.
 */
export function syncParamsFromUrl(
  url: string,
  existingParams: KVPair[],
): { pathParams: KVPair[]; queryParams: KVPair[] } {
  const existingPathParams = existingParams.filter((p) => p.type === "path");
  const existingQueryParams = existingParams.filter((p) => p.type !== "path");

  const pathParams = parsePathParams(url).map((key) => {
    const found = existingPathParams.find((p) => p.key === key);
    return (
      found ?? {
        id: generateId(),
        key,
        value: "",
        enabled: true,
        type: "path" as const,
      }
    );
  });

  const parsed = parseQueryString(url);
  // When URL has a query string, replace rows (no accumulation of partial keys).
  // When URL has no query string, preserve existing rows typed into the table.
  const queryParams =
    parsed.length > 0
      ? parsed.map((p) => {
          const found = existingQueryParams.find((r) => r.key === p.key);
          return found
            ? { ...found, value: p.value }
            : { id: generateId(), key: p.key, value: p.value, enabled: true };
        })
      : existingQueryParams;

  return { pathParams, queryParams };
}

export function truncateUrl(url: string, maxLength = 60): string {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength)}…`;
}

export function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
