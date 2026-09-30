"use client";

import { useTranslations } from "next-intl";

type GhostNodeProps = {
  type:
    | "delay"
    | "condition"
    | "display"
    | "evaluate"
    | "validate"
    | "merge"
    | "loop"
    | "collect"
    | "subchain";
  cursorPos: { x: number; y: number };
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
      {type === "delay" ? (
        <div className="flex min-w-[160px] items-center gap-2 rounded-lg border-2 border-amber-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs text-muted-foreground">Wait</span>
          <span className="text-xs font-semibold text-foreground">1000</span>
          <span className="text-xs text-muted-foreground">ms</span>
        </div>
      ) : type === "condition" ? (
        <div className="min-w-[180px] rounded-lg border-2 border-violet-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">
            Condition
          </span>
        </div>
      ) : type === "display" ? (
        <div className="min-w-[180px] rounded-lg border-2 border-violet-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">Display</span>
        </div>
      ) : type === "evaluate" ? (
        <div className="min-w-[180px] rounded-lg border-2 border-sky-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">
            Evaluate
          </span>
        </div>
      ) : type === "validate" ? (
        <div className="min-w-[180px] rounded-lg border-2 border-emerald-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">
            Validate
          </span>
        </div>
      ) : type === "merge" ? (
        <div className="min-w-[180px] rounded-lg border-2 border-violet-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">Merge</span>
        </div>
      ) : type === "loop" ? (
        <div className="min-w-[180px] rounded-lg border-2 border-amber-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">Loop</span>
        </div>
      ) : type === "collect" ? (
        <div className="min-w-[180px] rounded-lg border-2 border-blue-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">Collect</span>
        </div>
      ) : (
        <div className="min-w-[180px] rounded-lg border-2 border-indigo-400 bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-semibold text-foreground">
            Sub-chain
          </span>
        </div>
      )}
    </div>
  );
}
