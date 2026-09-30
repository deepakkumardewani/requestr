"use client";

import { Inbox, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CollectBlock, LoopBlock } from "@/types/chain";

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
  const [loopId, setLoopId] = useState("");

  const canSave = loopId.trim().length > 0;

  // Sync local state when the node changes
  useEffect(() => {
    if (!node) return;
    setLoopId(node.loopId);
  }, [node]);

  if (!node) return null;

  function handleSave() {
    if (!canSave || !node) return;
    onSave({
      ...node,
      loopId,
    });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="w-[400px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Inbox className="h-4 w-4 text-blue-400" />
            Configure Collect
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Bind to Loop */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Collect from Loop
            </Label>
            <Select
              value={loopId}
              onValueChange={(value) => value && setLoopId(value)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select a Loop block..." />
              </SelectTrigger>
              <SelectContent>
                {loopBlocks.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">
                    No Loop blocks available
                  </div>
                ) : (
                  loopBlocks.map((loop) => (
                    <SelectItem key={loop.id} value={loop.id}>
                      Loop ({loop.itemAlias})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Select which Loop block's outputs to collect. This Collect will
              gather results from each iteration into an array.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={!canSave}
          >
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
