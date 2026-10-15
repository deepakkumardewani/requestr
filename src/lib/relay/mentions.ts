/**
 * `@` mentions in the composer text. Pure string helpers so the caret logic is
 * testable without a DOM (FR-124).
 */

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
