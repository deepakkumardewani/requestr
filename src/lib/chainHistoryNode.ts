import { generateId } from "@/lib/utils";
import type { HistoryEntry, HttpTab } from "@/types";
import type { ChainHistoryNode } from "@/types/chain";

type HistoryNodeSource = Pick<
  ChainHistoryNode,
  "name" | "method" | "url" | "params" | "headers" | "auth" | "body"
>;

function buildHistoryNode(
  historyEntryId: string,
  source: HistoryNodeSource,
): ChainHistoryNode {
  return {
    id: generateId(),
    historyEntryId,
    name: source.name,
    method: source.method,
    url: source.url,
    params: source.params,
    headers: source.headers,
    auth: source.auth,
    body: source.body,
  };
}

function nameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? url;
  } catch {
    return url;
  }
}

/** Snapshots a history entry as an unsaved chain node. */
export function historyEntryToChainNode(entry: HistoryEntry): ChainHistoryNode {
  return buildHistoryNode(entry.id, {
    ...entry.request,
    name: nameFromUrl(entry.url),
    method: entry.method,
  });
}

/** Wraps an unsaved draft as an ad hoc chain node (no backing history entry). */
export function draftToChainNode(draft: HttpTab): ChainHistoryNode {
  return buildHistoryNode("", draft);
}
