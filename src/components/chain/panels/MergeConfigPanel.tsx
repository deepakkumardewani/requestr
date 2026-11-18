"use client";

import { GitMerge } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import type { MergeBlock } from "@/types/chain";
import { ConfigPanelShell } from "./ConfigPanelShell";
import { useSyncOnNode } from "./useSyncOnNode";

const MERGE_MODES: MergeBlock["mode"][] = ["all", "any"];
const MERGE_MODE_LABEL_KEYS = {
  all: "mergeConfigModeAll",
  any: "mergeConfigModeAny",
} as const;
const MERGE_MODE_HINT_KEYS = {
  all: "mergeConfigModeAllHint",
  any: "mergeConfigModeAnyHint",
} as const;

type MergeConfigPanelProps = {
  open: boolean;
  node: MergeBlock | null;
  onClose: () => void;
  onSave: (node: MergeBlock) => void;
  onDelete: (nodeId: string) => void;
};

export function MergeConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
}: MergeConfigPanelProps) {
  const t = useTranslations("chain");
  const [mode, setMode] = useState<MergeBlock["mode"]>("all");

  useSyncOnNode(node, (n) => setMode(n.mode));

  if (!node) return null;

  function handleSave() {
    if (!node) return;
    onSave({ ...node, mode });
  }

  return (
    <ConfigPanelShell
      open={open}
      title={t("mergeConfigTitle")}
      icon={GitMerge}
      iconClassName="text-violet-400"
      onSave={handleSave}
      onDelete={() => onDelete(node.id)}
      onClose={onClose}
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("mergeConfigModeLabel")}
        </Label>
        <div className="flex gap-1.5">
          {MERGE_MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              aria-label={t("mergeConfigSetModeAriaLabel", {
                mode: t(MERGE_MODE_LABEL_KEYS[m]),
              })}
              onClick={() => setMode(m)}
              data-testid={`merge-config-mode-${m}-btn`}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                mode === m
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              {t(MERGE_MODE_LABEL_KEYS[m])}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t(MERGE_MODE_HINT_KEYS[mode])}
        </p>
      </div>
    </ConfigPanelShell>
  );
}
