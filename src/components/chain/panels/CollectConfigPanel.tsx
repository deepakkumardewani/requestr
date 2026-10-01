"use client";

import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CollectBlock, LoopBlock } from "@/types/chain";
import { ConfigPanelShell } from "./ConfigPanelShell";
import { useSyncOnNode } from "./useSyncOnNode";

type CollectConfigPanelProps = {
  open: boolean;
  node: CollectBlock | null;
  loopBlocks: LoopBlock[];
  onClose: () => void;
  onSave: (node: CollectBlock) => void;
  onDelete: (nodeId: string) => void;
};

export function CollectConfigPanel({
  open,
  node,
  loopBlocks,
  onClose,
  onSave,
  onDelete,
}: CollectConfigPanelProps) {
  const t = useTranslations("chain");
  const [loopId, setLoopId] = useState("");

  const canSave = loopId.trim().length > 0;

  useSyncOnNode(node, (n) => setLoopId(n.loopId));

  if (!node) return null;

  function handleSave() {
    if (!canSave || !node) return;
    onSave({
      ...node,
      loopId,
    });
  }

  return (
    <ConfigPanelShell
      open={open}
      title={t("collectConfigTitle")}
      icon={Inbox}
      iconClassName="text-blue-400"
      canSave={canSave}
      onSave={handleSave}
      onDelete={() => onDelete(node.id)}
      onClose={onClose}
    >
      {/* Bind to Loop */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("collectConfigLoopLabel")}
        </Label>
        <Select
          value={loopId}
          onValueChange={(value) => value && setLoopId(value)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={t("collectConfigLoopPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {loopBlocks.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">
                {t("collectConfigNoLoops")}
              </div>
            ) : (
              loopBlocks.map((loop) => (
                <SelectItem key={loop.id} value={loop.id}>
                  {t("collectConfigLoopOption", { alias: loop.itemAlias })}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t("collectConfigLoopHint")}
        </p>
      </div>
    </ConfigPanelShell>
  );
}
