import type { Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import { type ChainClipboardEntry, useUIStore } from "@/stores/useUIStore";
import type { ChainBlock, ChainEdge } from "@/types/chain";
import { remapPastedBlock } from "../pasteRemap";

/** Canvas-space distance each paste of the same clipboard shifts the copies, so they never hide the originals. */
export const PASTE_OFFSET = 40;

/**
 * Block kinds that live entirely in `Chain.blocks` and can be reproduced with
 * fresh ids in any chain. API request nodes reference a `requestId` owned by
 * the request store, and Start/Merge/Loop/Collect/Sub-chain blocks depend on
 * chain-level structure (single Start, Loop<->Collect pairing, cross-chain
 * references), so copying them is out of scope.
 */
const CLIPBOARD_BLOCK_TYPES: ReadonlySet<ChainBlock["type"]> = new Set([
  "delay",
  "condition",
  "display",
  "evaluate",
  "validate",
]);

type Position = { x: number; y: number };
const ORIGIN: Position = { x: 0, y: 0 };

type UseCanvasClipboardParams = {
  chainId: string;
  nodes: Node[];
  blocks: ChainBlock[];
  chainEdges: ChainEdge[];
  nodePositions: Record<string, Position>;
};

/** Re-creates `entry` in the chain under fresh ids as one undo step. */
function pasteEntry(
  chainId: string,
  entry: ChainClipboardEntry,
  offset: number,
) {
  const idMap = new Map(entry.blocks.map((b) => [b.id, generateId()]));
  const store = useChainStore.getState();
  store.pauseHistory(chainId);
  for (const block of entry.blocks) {
    const newId = idMap.get(block.id);
    if (!newId) continue;
    store.upsertBlock(chainId, remapPastedBlock(block, newId, idMap));
    const pos = entry.positions[block.id] ?? ORIGIN;
    store.updateNodePosition(chainId, newId, {
      x: pos.x + offset,
      y: pos.y + offset,
    });
  }
  for (const edge of entry.edges) {
    const sourceRequestId = idMap.get(edge.sourceRequestId);
    const targetRequestId = idMap.get(edge.targetRequestId);
    if (!sourceRequestId || !targetRequestId) continue;
    store.upsertEdge(chainId, {
      ...edge,
      id: generateId(),
      sourceRequestId,
      targetRequestId,
    });
  }
  store.resumeHistory(chainId);
}

/** Copy/paste of the selected blocks through the shared `useUIStore` clipboard. */
export function useCanvasClipboard({
  chainId,
  nodes,
  blocks,
  chainEdges,
  nodePositions,
}: UseCanvasClipboardParams) {
  const t = useTranslations("chain");
  const clipboard = useUIStore((s) => s.chainClipboard);
  const setClipboard = useUIStore((s) => s.setChainClipboard);
  const pasteRun = useRef<{ entry: ChainClipboardEntry | null; count: number }>(
    { entry: null, count: 0 },
  );

  const copySelection = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((n) => n.selected).map((n) => n.id),
    );
    const copied = blocks.filter(
      (b) => selectedIds.has(b.id) && CLIPBOARD_BLOCK_TYPES.has(b.type),
    );
    const skippedCount = selectedIds.size - copied.length;
    // Silent no-ops read as a broken shortcut, so say why blocks were left out.
    if (skippedCount > 0)
      toast.info(t("clipboardSkipped", { count: skippedCount }));
    if (copied.length === 0) return;
    const copiedIds = new Set(copied.map((b) => b.id));
    setClipboard({
      blocks: copied,
      // Only edges between copied blocks: a dangling edge would point at a block that was not copied.
      edges: chainEdges.filter(
        (e) =>
          copiedIds.has(e.sourceRequestId) && copiedIds.has(e.targetRequestId),
      ),
      positions: Object.fromEntries(
        copied.map((b) => [b.id, nodePositions[b.id] ?? ORIGIN]),
      ),
    });
  }, [nodes, blocks, chainEdges, nodePositions, setClipboard, t]);

  const pasteSelection = useCallback(() => {
    if (!clipboard || clipboard.blocks.length === 0) return;
    if (pasteRun.current.entry !== clipboard) {
      pasteRun.current = { entry: clipboard, count: 0 };
    }
    pasteRun.current.count += 1;
    pasteEntry(chainId, clipboard, PASTE_OFFSET * pasteRun.current.count);
  }, [clipboard, chainId]);

  return {
    copySelection,
    pasteSelection,
    hasClipboard: Boolean(clipboard?.blocks.length),
  };
}
