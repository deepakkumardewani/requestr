"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CanvasBanner,
  type CanvasBannerType,
} from "@/components/chain/canvas/CanvasBanner";
import type { ChainBlock } from "@/types/chain";
import type { ChainStructureValidation } from "./useChainStructureValidation";

type ChainValidationBannersProps = {
  validation: ChainStructureValidation;
  blocks: ChainBlock[];
};

type BannerEntry = {
  type: CanvasBannerType;
  /** Offending block ids; the banner is hidden when empty. */
  ids: string[];
  nodeNames: string[];
};

/** "Loop 2" style names, numbered by the block's position among blocks of its type. */
function nameBlocks(
  ids: string[],
  blocks: ChainBlock[],
  blockType: ChainBlock["type"],
  label: string,
): string[] {
  const ofType = blocks.filter((b) => b.type === blockType);
  return ids.map(
    (id) => `${label} ${ofType.findIndex((b) => b.id === id) + 1}`,
  );
}

/**
 * Loop / Collect / Sub-chain validation banners. A dismissal is remembered
 * against the offending id set, so a banner reappears when that set changes.
 */
export function ChainValidationBanners({
  validation,
  blocks,
}: ChainValidationBannersProps) {
  const t = useTranslations("chain");
  const [dismissed, setDismissed] = useState<
    Partial<Record<CanvasBannerType, string>>
  >({});

  const loopIds = blocks.filter((b) => b.type === "loop").map((b) => b.id);
  const entries: BannerEntry[] = [
    {
      type: "loop-unpaired",
      ids: validation.unpairedLoopIds,
      nodeNames: nameBlocks(
        validation.unpairedLoopIds,
        blocks,
        "loop",
        t("blockMenuLoopName"),
      ),
    },
    {
      type: "collect-unresolved",
      ids: validation.unresolvedCollectIds,
      nodeNames: nameBlocks(
        validation.unresolvedCollectIds,
        blocks,
        "collect",
        t("blockMenuCollectName"),
      ),
    },
    {
      type: "loop-nesting-depth",
      ids: validation.hasLoopNesting ? loopIds : [],
      nodeNames: [],
    },
    {
      type: "loop-body-unconnected",
      ids: validation.loopsWithUnconnectedBodyIds,
      nodeNames: nameBlocks(
        validation.loopsWithUnconnectedBodyIds,
        blocks,
        "loop",
        t("blockMenuLoopName"),
      ),
    },
    {
      type: "loop-body-misses-collect",
      ids: validation.loopsWhoseBodyMissesCollectIds,
      nodeNames: nameBlocks(
        validation.loopsWhoseBodyMissesCollectIds,
        blocks,
        "loop",
        t("blockMenuLoopName"),
      ),
    },
    {
      type: "subchain-invalid",
      ids: validation.invalidSubChainIds,
      nodeNames: nameBlocks(
        validation.invalidSubChainIds,
        blocks,
        "subchain",
        t("subChainNodeLabel"),
      ),
    },
  ];

  return (
    <>
      {entries.map(({ type, ids, nodeNames }) => {
        const signature = ids.join(",");
        if (ids.length === 0 || dismissed[type] === signature) return null;
        return (
          <CanvasBanner
            key={type}
            type={type}
            nodeNames={nodeNames}
            onDismiss={() => setDismissed((d) => ({ ...d, [type]: signature }))}
          />
        );
      })}
    </>
  );
}
