"use client";

import { ControlButton } from "@xyflow/react";
import { Grid3x3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/stores/useUIStore";

/** Controls-panel toggle for snap-to-grid, persisted through `useUIStore`. */
export function SnapToggle() {
  const t = useTranslations("chain");
  const snapToGrid = useUIStore((s) => s.snapToGrid);
  const setSnapToGrid = useUIStore((s) => s.setSnapToGrid);

  return (
    <ControlButton
      onClick={() => setSnapToGrid(!snapToGrid)}
      aria-pressed={snapToGrid}
      aria-label={t("snapToGrid")}
      title={t("snapToGrid")}
      className={snapToGrid ? "!bg-primary/15 !text-primary" : undefined}
    >
      <Grid3x3 aria-hidden />
    </ControlButton>
  );
}
