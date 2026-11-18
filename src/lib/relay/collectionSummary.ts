import { RELAY_COLLECTION_ITEM_CAP } from "./constants";

type SummarizableRequest = { name: string; method: string; url: string };

export type CollectionSummary = {
  total: number;
  items: SummarizableRequest[];
  /** Present only when items were dropped, so the model knows to search for the rest. */
  more?: string;
};

/**
 * Names, methods and URLs for at most `cap` requests plus a tail naming how
 * many were left out (FR-127). Callers redact URLs before the text leaves the
 * app. Shared by the context builder and `generate_docs`.
 */
export function summarizeCollection(
  requests: readonly SummarizableRequest[],
  cap: number = RELAY_COLLECTION_ITEM_CAP,
): CollectionSummary {
  const items = requests
    .slice(0, cap)
    .map(({ name, method, url }) => ({ name, method, url }));
  const omitted = requests.length - items.length;
  return {
    total: requests.length,
    items,
    ...(omitted > 0 ? { more: `…and ${omitted} more — use search` } : {}),
  };
}
