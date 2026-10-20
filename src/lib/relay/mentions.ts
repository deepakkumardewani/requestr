/**
 * `@` mentions in the composer text. Pure string helpers so the caret logic is
 * testable without a DOM (FR-124).
 */

import { findSlashQuery } from "@/lib/relay/slashCommands";

const MENTION_TRIGGER = "@";

export type ActiveMention = {
  /** Index of the `@` character. */
  start: number;
  /** Index just past the typed query; equals the caret. */
  end: number;
  /** Text typed after the `@`. */
  query: string;
};

const isWhitespace = (char: string): boolean => /\s/.test(char);

/**
 * The `@query` the caret is sitting in, or null. An `@` only counts at the
 * start of the text or after whitespace, so an email address never triggers.
 */
export function findActiveMention(
  text: string,
  caret: number,
): ActiveMention | null {
  for (let index = caret - 1; index >= 0; index--) {
    const char = text[index];
    if (isWhitespace(char)) return null;
    if (char !== MENTION_TRIGGER) continue;
    const before = text[index - 1];
    if (before !== undefined && !isWhitespace(before)) return null;
    return { start: index, end: caret, query: text.slice(index + 1, caret) };
  }
  return null;
}

/** Swaps the active mention for `@label ` and reports where the caret goes. */
export function replaceMention(
  text: string,
  mention: ActiveMention,
  label: string,
): { text: string; caret: number } {
  const token = `${MENTION_TRIGGER}${label} `;
  return {
    text: text.slice(0, mention.start) + token + text.slice(mention.end),
    caret: mention.start + token.length,
  };
}

/**
 * The mention menu stays closed while the slash menu owns the draft, so the two
 * never show together (RP-211). The caret is accepted so callers can pass the
 * same pair they give `findActiveMention`.
 */
export function isMentionMenuAllowed(text: string, _caret?: number): boolean {
  return findSlashQuery(text) === null;
}

/**
 * Removes one `@name ` token (and its single trailing space) and leaves the
 * surrounding text alone. The token must start the text or follow whitespace
 * and end at a space or the end of the text, so `@Get` never eats `@Get users`.
 */
export function stripMentionToken(text: string, name: string): string {
  const token = `${MENTION_TRIGGER}${name}`;
  let from = text.indexOf(token);
  while (from !== -1) {
    const before = text[from - 1];
    const end = from + token.length;
    const after = text[end];
    const startsToken = before === undefined || isWhitespace(before);
    const endsToken = after === undefined || after === " ";
    if (startsToken && endsToken) {
      return text.slice(0, from) + text.slice(after === " " ? end + 1 : end);
    }
    from = text.indexOf(token, from + 1);
  }
  return text;
}
