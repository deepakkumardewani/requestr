import { RELAY_MODEL_ID } from "./model";

/**
 * Words that must never reach Relay-owned client surfaces (FR-62, FR-63).
 * Single source of truth for the unit brand guard and the e2e audit. Lives
 * under `server/` because it necessarily spells the words out.
 */
export const BANNED_TOKENS: readonly string[] = [
  "deepseek",
  "openai",
  "anthropic",
  "claude",
  "gpt",
  RELAY_MODEL_ID,
];

/** Returns the banned tokens found in `text`, case-insensitively. */
export function findBannedTokens(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_TOKENS.filter((token) => lower.includes(token.toLowerCase()));
}
