import { useCallback } from "react";
import { historyEntryToChainNode } from "@/lib/chainHistoryNode";
import {
  getPlacementBounds,
  PLACEMENT_FALLBACK_CENTER,
  resolvePlacementOrigin,
  stackPositions,
} from "@/lib/nodePlacement";
import { historyItemName } from "@/lib/pickerHistory";
import { useChainStore } from "@/stores/useChainStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { AddApiIntent, Chain } from "@/types/chain";

export type PickerAddResult = {
  /** Ids actually placed on the canvas, in selection order. */
  added: string[];
  /** Ids that were already in the chain by the time the user confirmed. */
  skipped: string[];
};

type UsePickerAddOptions = {
  chainId: string;
  /** Open intent of this dialog session; its pending connection is consumed by the first added node. */
  intent?: AddApiIntent;
  onClose: () => void;
  /** Called after a successful add so the canvas can fit the new nodes into view. */
  onNodesAdded?: (nodeIds: string[]) => void;
};

/** Where a confirmed add lands: after the anchor node, at the intent position, or right of the existing nodes. */
export function resolveOrigin(chain: Chain | undefined, intent?: AddApiIntent) {
  const positions = chain?.nodePositions ?? {};
  const anchorPosition = intent?.anchorNodeId
    ? positions[intent.anchorNodeId]
    : undefined;
  return resolvePlacementOrigin(
    { anchorPosition, position: intent?.position },
    getPlacementBounds(Object.values(positions)),
    PLACEMENT_FALLBACK_CENTER,
  );
}

/** History entries not yet on the chain, as unsaved nodes named like their picker row. */
function freshHistoryBlocks(chain: Chain | undefined, entryIds: string[]) {
  const onChain = new Set(
    (chain?.blocks ?? []).flatMap((block) =>
      block.type === "history" ? [block.historyEntryId] : [],
    ),
  );
  const byId = new Map(
    useHistoryStore.getState().entries.map((entry) => [entry.id, entry]),
  );
  return entryIds.flatMap((id) => {
    const entry = byId.get(id);
    if (!entry || onChain.has(id)) return [];
    const node = historyEntryToChainNode(entry);
    return [
      { ...node, name: historyItemName(entry.url), type: "history" as const },
    ];
  });
}

/**
 * Confirm-time add for the picker: nothing touches the chain until this runs, so dismissing the
 * dialog adds nothing and the intent's pending connection is simply discarded with it. Ids may be
 * collection request ids and/or history entry ids (selection survives a tab switch). The whole add
 * is ONE undo entry, then the dialog closes.
 */
export function usePickerAdd({
  chainId,
  intent,
  onClose,
  onNodesAdded,
}: UsePickerAddOptions) {
  return useCallback(
    (selectedIds: readonly string[]): PickerAddResult => {
      const store = useChainStore.getState();
      const chain = store.chains[chainId];
      const origin = resolveOrigin(chain, intent);
      const historyIds = new Set(
        useHistoryStore.getState().entries.map((entry) => entry.id),
      );
      const requestIds = selectedIds.filter((id) => !historyIds.has(id));
      const historyBlocks = freshHistoryBlocks(
        chain,
        selectedIds.filter((id) => historyIds.has(id)),
      );
      // addRequestNodes is already a single mutation; only a mixed/multi history add needs batching.
      const batched = historyBlocks.length > 0 && selectedIds.length > 1;

      if (batched) store.pauseHistory(chainId);
      const addedRequests = store.addRequestNodes(
        chainId,
        requestIds.map((id) => ({ id })),
        origin,
        intent?.pendingConnection,
      );
      const positions = stackPositions(
        origin,
        addedRequests.length + historyBlocks.length,
      ).slice(addedRequests.length);
      for (const [index, block] of historyBlocks.entries()) {
        store.addBlockWithEdge(chainId, block, {
          position: positions[index],
          connectFrom:
            index === 0 && addedRequests.length === 0
              ? intent?.pendingConnection
              : undefined,
        });
      }
      if (batched) store.resumeHistory(chainId);

      const added = [...addedRequests, ...historyBlocks.map((b) => b.id)];
      const handled = new Set([
        ...addedRequests,
        ...historyBlocks.map((b) => b.historyEntryId),
      ]);
      const skipped = selectedIds.filter((id) => !handled.has(id));
      if (added.length > 0) onNodesAdded?.(added);
      onClose();
      return { added, skipped };
    },
    [chainId, intent, onClose, onNodesAdded],
  );
}
