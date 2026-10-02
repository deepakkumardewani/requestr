import type { HttpMethod } from "@/types";

/** Half-open `[start, end)` character range into the original (non-lowercased) text. */
export type HighlightRange = readonly [start: number, end: number];

export type SearchableItem = {
  name: string;
  method?: HttpMethod;
  url?: string;
  /** Nearest folder or collection name; searchable but never highlighted. */
  groupName?: string;
};

export type SearchMatch = {
  score: number;
  nameRanges: HighlightRange[];
  urlRanges: HighlightRange[];
};

export type SearchResult<T extends SearchableItem> = {
  item: T;
  match: SearchMatch;
};

type MatchTier = "exact" | "prefix" | "substring" | "subsequence";

type TextMatch = { tier: MatchTier; ranges: HighlightRange[] };

type FieldKey = "name" | "url" | "method" | "group";

export const TIER_SCORE: Record<MatchTier, number> = {
  exact: 1000,
  prefix: 800,
  substring: 600,
  subsequence: 400,
};

/** Name beats URL path beats method/group so the most recognisable field ranks first. */
export const FIELD_BONUS: Record<FieldKey, number> = {
  name: 300,
  url: 150,
  method: 50,
  group: 0,
};

export const EMPTY_MATCH: SearchMatch = {
  score: 0,
  nameRanges: [],
  urlRanges: [],
};

const WHITESPACE = /\s+/;
const CURL_PREFIX = /^\s*curl(\s|$)/i;
const URL_PREFIX = /^\s*https?:\/\/\S+/i;

export function tokenize(query: string): string[] {
  return query.trim().toLowerCase().split(WHITESPACE).filter(Boolean);
}

/** Greedy in-order character match; adjacent hits are merged into one range. */
function subsequenceRanges(
  token: string,
  text: string,
): HighlightRange[] | null {
  const ranges: [number, number][] = [];
  let cursor = 0;
  for (const char of token) {
    const at = text.indexOf(char, cursor);
    if (at === -1) return null;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === at) last[1] = at + 1;
    else ranges.push([at, at + 1]);
    cursor = at + 1;
  }
  return ranges;
}

/** `token` must already be lowercase; `text` is lowercased here. */
export function matchText(token: string, text: string): TextMatch | null {
  const lower = text.toLowerCase();
  if (lower === token) return { tier: "exact", ranges: [[0, token.length]] };
  const at = lower.indexOf(token);
  if (at === 0) return { tier: "prefix", ranges: [[0, token.length]] };
  if (at > 0) return { tier: "substring", ranges: [[at, at + token.length]] };
  const ranges = subsequenceRanges(token, lower);
  return ranges ? { tier: "subsequence", ranges } : null;
}

type FieldMatch = { field: FieldKey; score: number; ranges: HighlightRange[] };

function bestFieldMatch(
  token: string,
  item: SearchableItem,
): FieldMatch | null {
  const fields: [FieldKey, string | undefined][] = [
    ["name", item.name],
    ["url", item.url],
    ["method", item.method],
    ["group", item.groupName],
  ];
  let best: FieldMatch | null = null;
  for (const [field, text] of fields) {
    if (!text) continue;
    const found = matchText(token, text);
    if (!found) continue;
    const score = TIER_SCORE[found.tier] + FIELD_BONUS[field];
    if (!best || score > best.score)
      best = { field, score, ranges: found.ranges };
  }
  return best;
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Returns null when any whitespace token fails to match; empty query matches everything with score 0. */
export function scoreItem(
  query: string,
  item: SearchableItem,
): SearchMatch | null {
  const tokens = tokenize(query);
  if (tokens.length === 0) return EMPTY_MATCH;
  let score = 0;
  const nameRanges: HighlightRange[] = [];
  const urlRanges: HighlightRange[] = [];
  for (const token of tokens) {
    const hit = bestFieldMatch(token, item);
    if (!hit) return null;
    score += hit.score;
    if (hit.field === "name") nameRanges.push(...hit.ranges);
    if (hit.field === "url") urlRanges.push(...hit.ranges);
  }
  return {
    score,
    nameRanges: mergeRanges(nameRanges),
    urlRanges: mergeRanges(urlRanges),
  };
}

/** Ranked best-first; ties keep input order (Array.sort is stable). */
export function searchItems<T extends SearchableItem>(
  query: string,
  items: readonly T[],
): SearchResult<T>[] {
  const results: SearchResult<T>[] = [];
  for (const item of items) {
    const match = scoreItem(query, item);
    if (match) results.push({ item, match });
  }
  return results.sort((a, b) => b.match.score - a.match.score);
}

export function looksLikeCurl(input: string): boolean {
  return CURL_PREFIX.test(input);
}

export function looksLikeUrl(input: string): boolean {
  return URL_PREFIX.test(input);
}
