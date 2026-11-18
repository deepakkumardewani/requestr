"use client";

import { useTranslations } from "next-intl";
import { BLOCK_REGISTRY, type GhostBlockType } from "../blockRegistry";

type GhostNodeProps = {
  type: GhostBlockType;
  cursorPos: { x: number; y: number };
};

/** Border colour per block, matching the real node's icon accent. */
const GHOST_BORDER: Record<GhostBlockType, string> = {
  delay: "border-amber-400",
  condition: "border-violet-400",
  display: "border-violet-400",
  evaluate: "border-sky-400",
  validate: "border-emerald-400",
  merge: "border-violet-400",
  loop: "border-amber-400",
  collect: "border-blue-400",
  subchain: "border-indigo-400",
};

export function GhostNode({ type, cursorPos }: GhostNodeProps) {
  const t = useTranslations("chain");

  return (
    <div
      className="pointer-events-none fixed z-50 flex flex-col items-start gap-1.5 opacity-60"
      style={{ left: cursorPos.x + 12, top: cursorPos.y + 12 }}
    >
      <span className="rounded bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md">
        {t("ghostPlacementHint")}
      </span>
      <div
        className={`min-w-[180px] rounded-lg border-2 ${GHOST_BORDER[type]} bg-card px-3 py-2 shadow-lg`}
      >
        <span className="text-xs font-semibold text-foreground">
          {t(BLOCK_REGISTRY[type].labelKey)}
        </span>
      </div>
    </div>
  );
}
