/**
 * Untrusted-data fences. Everything a server or another user controls is
 * wrapped in one of these so the model can tell data from instructions, and
 * every fence token is stripped from the content first so it cannot forge an
 * early close.
 */

export const UNTRUSTED_BODY_OPEN = "<<<untrusted-response-body>>>";
export const UNTRUSTED_BODY_CLOSE = "<<<end-untrusted-response-body>>>";
export const ATTACHMENT_DETAIL_OPEN = "<<<untrusted-attachment-detail>>>";
export const ATTACHMENT_DETAIL_CLOSE = "<<<end-untrusted-attachment-detail>>>";

const FENCE_TOKENS = [
  UNTRUSTED_BODY_OPEN,
  UNTRUSTED_BODY_CLOSE,
  ATTACHMENT_DETAIL_OPEN,
  ATTACHMENT_DETAIL_CLOSE,
] as const;

/** Removes every fence token so content cannot open or close a fence. */
export function stripDelimiters(text: string): string {
  return FENCE_TOKENS.reduce((acc, token) => acc.split(token).join(""), text);
}

/** Wraps text in the response-body fence after stripping forged tokens. */
export function fenceUntrustedBody(text: string): string {
  return `${UNTRUSTED_BODY_OPEN}\n${stripDelimiters(text)}\n${UNTRUSTED_BODY_CLOSE}`;
}
