import type { ResponseData, TabState } from "@/types";

/** Suggestions shown at once; the base lists in EmptyState fill up to this (FR-22). */
export const SUGGESTION_COUNT = 4;

/** First HTTP status that counts as a failed response. */
const FIRST_ERROR_STATUS = 400;

const FAILED = "whyDidThisFail";
const SUMMARIZE_REQUEST = "summarizeRequest";
const CHECK_HEADERS = "checkHeaders";

/**
 * Prompt keys (under `relay.suggestions`) for the tab the user is on and its
 * last response (FR-123, FR-195). Pure, so the empty state and the follow-up
 * chips share one source and nothing is cached across tab switches.
 */
export function deriveSuggestions(
  tab: TabState | null,
  lastResponse: ResponseData | null,
): readonly string[] {
  if (!tab) return ["createRequest"];
  const failed =
    lastResponse !== null && lastResponse.status >= FIRST_ERROR_STATUS;
  switch (tab.type) {
    case "graphql":
      return [
        ...(failed ? [FAILED] : []),
        "graphqlExplainQuery",
        "graphqlAddVariables",
        SUMMARIZE_REQUEST,
        CHECK_HEADERS,
      ];
    case "websocket":
      return [
        "websocketExplainMessages",
        "websocketSendMessage",
        SUMMARIZE_REQUEST,
        CHECK_HEADERS,
      ];
    case "socketio":
      return [
        "socketioExplainEvents",
        "socketioSendEvent",
        SUMMARIZE_REQUEST,
        CHECK_HEADERS,
      ];
    case "http":
      if (failed) return [FAILED, CHECK_HEADERS];
      return lastResponse
        ? ["addAssertions", "explainResponse"]
        : [SUMMARIZE_REQUEST, CHECK_HEADERS];
  }
}

/** Derived prompts first, then `base` until there are `SUGGESTION_COUNT`, without repeats. */
export function fillSuggestions(
  derived: readonly string[],
  base: readonly string[],
): string[] {
  const keys = [...new Set(derived)];
  for (const key of base) {
    if (keys.length >= SUGGESTION_COUNT) break;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}
