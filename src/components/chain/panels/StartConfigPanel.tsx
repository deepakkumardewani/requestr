"use client";

import { Plus, Rocket, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { generateId } from "@/lib/utils";
import type { ChainInput, StartBlock } from "@/types/chain";
import { type DraftInput, StartInputRow } from "./StartInputRow";

type StartConfigPanelProps = {
  open: boolean;
  node: StartBlock | null;
  onClose: () => void;
  onSave: (node: StartBlock) => void | Promise<void>;
  onDelete: (nodeId: string) => void;
};

function makeInput(): DraftInput {
  return {
    rowId: generateId(),
    key: "",
    defaultValue: "",
    source: "literal",
  };
}

/** Keys that appear more than once (case-sensitive, trimmed, ignoring blanks). */
function findDuplicateKeys(inputs: DraftInput[]): Set<string> {
  const seen = new Map<string, number>();
  for (const input of inputs) {
    const key = input.key.trim();
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set(
    [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  );
}

export function StartConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
}: StartConfigPanelProps) {
  const t = useTranslations("chain");
  const [inputs, setInputs] = useState<DraftInput[]>([]);

  useEffect(() => {
    if (!node) return;
    setInputs(node.inputs.map((input) => ({ ...input, rowId: generateId() })));
  }, [node]);

  if (!node) return null;

  const duplicateKeys = findDuplicateKeys(inputs);
  const hasBlankKey = inputs.some((i) => !i.key.trim());
  const canSave = duplicateKeys.size === 0 && !hasBlankKey;

  function handleAddInput() {
    setInputs((prev) => [...prev, makeInput()]);
  }

  function handleDeleteInput(rowId: string) {
    setInputs((prev) => prev.filter((i) => i.rowId !== rowId));
  }

  function updateInput(rowId: string, patch: Partial<ChainInput>) {
    setInputs((prev) =>
      prev.map((i) => (i.rowId === rowId ? { ...i, ...patch } : i)),
    );
  }

  async function handleSave() {
    if (!node || !canSave) return;
    await onSave({
      ...node,
      inputs: inputs.map(({ rowId: _rowId, ...input }) => input),
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
            <Rocket className="h-4 w-4 text-sky-400" />
            {t("startConfigPanelTitle")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              {t("startConfigInputsLabel")}
            </Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs px-2"
              data-testid="start-config-add-input-btn"
              onClick={handleAddInput}
            >
              <Plus className="h-3 w-3" />
              {t("startConfigAddInput")}
            </Button>
          </div>

          {inputs.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic px-0.5">
              {t("startConfigNoInputsEmpty")}
            </p>
          )}

          <div className="space-y-2">
            {inputs.map((input) => (
              <StartInputRow
                key={input.rowId}
                input={input}
                isDuplicate={duplicateKeys.has(input.key.trim())}
                onChange={updateInput}
                onDelete={handleDeleteInput}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            data-testid="start-config-save-btn"
            onClick={handleSave}
            disabled={!canSave}
          >
            {t("startConfigSaveButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            data-testid="start-config-cancel-btn"
            onClick={onClose}
          >
            {t("startConfigCancelButton")}
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            data-testid="start-config-delete-btn"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {t("startConfigDeleteNodeButton")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
