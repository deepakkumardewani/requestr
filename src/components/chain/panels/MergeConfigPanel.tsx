"use client";

import { GitMerge, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MergeBlock } from "@/types/chain";

const MERGE_MODES: MergeBlock["mode"][] = ["all", "any"];

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
  const [mode, setMode] = useState<MergeBlock["mode"]>("all");

  useEffect(() => {
    if (!node) return;
    setMode(node.mode);
  }, [node]);

  if (!node) return null;

  function handleSave() {
    if (!node) return;
    onSave({ ...node, mode });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="w-[440px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <GitMerge className="h-4 w-4 text-violet-400" />
            Configure Merge
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <div className="flex gap-1.5">
              {MERGE_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  aria-label={`Set mode to ${m}`}
                  onClick={() => setMode(m)}
                  data-testid={`merge-config-mode-${m}-btn`}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    mode === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              {mode === "all"
                ? "Waits for every incoming branch to pass before continuing."
                : "Continues as soon as the first incoming branch passes."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
          >
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete node
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
