import { CurlParseError, parseCurl } from "@/lib/curlParser";
import type { AuthConfig, ParsedCurl } from "@/types";

export type CurlSummary = { request: ParsedCurl } | { error: string };

/** How the request tab would label the auth it picked up from the command. */
export function authSummary(auth: AuthConfig): string {
  switch (auth.type) {
    case "bearer":
      return "Bearer token";
    case "basic":
      return `Basic · ${auth.username}`;
    case "api-key":
      return `API key · ${auth.key}`;
    default:
      return "None";
  }
}

/**
 * Parses with the app's importer. A malformed command is an expected outcome
 * while someone types, so it becomes a message; anything else is a bug.
 */
export function summarizeCurl(input: string): CurlSummary {
  try {
    return { request: parseCurl(input) };
  } catch (error) {
    if (error instanceof CurlParseError) return { error: error.message };
    throw error;
  }
}
