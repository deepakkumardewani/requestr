import { HTTP_METHODS } from "@/lib/constants";

export type ProseToken =
  | { type: "text"; value: string }
  | { type: "method" | "status"; value: string };

const MIN_STATUS = 100;
const MAX_STATUS = 599;

const METHODS = HTTP_METHODS.join("|");
/** A code is 3 digits not touching other word characters, nor part of "1.200" or "1,404". */
const TOKEN_PATTERN = new RegExp(
  `\\b(${METHODS})\\b|(?<![\\w.,])(\\d{3})(?!\\w|[.,]\\d)`,
  "g",
);

/**
 * Splits prose into plain text, HTTP method words and 3-digit status codes.
 * The text is always kept: colour is added by the caller, never instead of it.
 */
export function tokenizeProse(text: string): ProseToken[] {
  const tokens: ProseToken[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const [value, method, status] = match;
    const isStatus =
      status !== undefined &&
      Number(status) >= MIN_STATUS &&
      Number(status) <= MAX_STATUS;
    if (method === undefined && !isStatus) continue;
    if (match.index > last) {
      tokens.push({ type: "text", value: text.slice(last, match.index) });
    }
    tokens.push({ type: method === undefined ? "status" : "method", value });
    last = match.index + value.length;
  }
  if (last < text.length)
    tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
const PATH_LIKE = /^(?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)+\/?$/;
const FILE_NAME_LIKE = /^[\w@-][\w@.-]*\.[A-Za-z][A-Za-z0-9]{0,7}$/;

/** True for inline code that reads as a URL, a path or a file name (FR-181). */
export function isFileLike(code: string): boolean {
  const text = code.trim();
  return (
    URL_LIKE.test(text) || PATH_LIKE.test(text) || FILE_NAME_LIKE.test(text)
  );
}
