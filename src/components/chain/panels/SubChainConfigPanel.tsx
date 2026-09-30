"use client";

import { AlertCircle, Trash2, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ChainEdge, ChainInput, SubChainBlock } from "@/types/chain";

type SubChainConfigPanelProps = {
  open: boolean;
  node: SubChainBlock | null;
  /** Inputs declared by the referenced chain's Start block — empty when the reference is deleted or unresolved. */
  referencedChainInputs: ChainInput[];
  /** Display name of the referenced chain, for the panel subtitle. */
  referencedChainName?: string;
  incomingEdges?: ChainEdge[];
  onClose: () => void;
  onSave: (node: SubChainBlock) => void;
  onDelete: (nodeId: string) => void;
};

/** An input has no fallback to rely on when unbound — literal inputs need a default, env inputs need an env var key. */
function isRequiredUnbound(input: ChainInput, binding: string): boolean {
  if (binding.trim().length > 0) return false;
  if (input.source === "literal") return input.defaultValue.trim().length === 0;
  return !input.envVarKey?.trim();
}

export function SubChainConfigPanel({
  open,
  node,
  referencedChainInputs,
  referencedChainName,
  incomingEdges = [],
  onClose,
  onSave,
  onDelete,
}: SubChainConfigPanelProps) {
  const t = useTranslations("chain");
  const [bindings, setBindings] = useState<Record<string, string>>({});

  const availableAliases = incomingEdges
    .filter((e) => !e.branchId)
    .flatMap((edge) => (edge.injections ?? []).map((inj) => inj.targetKey));

  useEffect(() => {
    if (!node) return;
    setBindings(node.inputBindings);
  }, [node]);

  if (!node) return null;

  function handleSave() {
    if (!node) return;
    onSave({ ...node, inputBindings: bindings });
    onClose();
  }

  function updateBinding(key: string, value: string) {
    setBindings((prev) => ({ ...prev, [key]: value }));
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
            <Workflow className="h-4 w-4 text-cyan-400" />
            {t("subChainConfigPanelTitle")}
          </SheetTitle>
          {referencedChainName && (
            <p className="text-[11px] text-muted-foreground truncate">
              {referencedChainName}
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Label className="text-xs text-muted-foreground">
            {t("subChainConfigBindingsLabel")}
          </Label>

          {referencedChainInputs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic px-0.5">
              {t("subChainConfigNoInputsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {referencedChainInputs.map((input) => {
                const binding = bindings[input.key] ?? "";
                const flagged = isRequiredUnbound(input, binding);
                return (
                  <div
                    key={input.key}
                    className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2"
                  >
                    <span className="text-[11px] font-mono font-semibold text-foreground">
                      {input.key}
                    </span>
                    <Input
                      value={binding}
                      onChange={(e) => updateBinding(input.key, e.target.value)}
                      placeholder={t("subChainConfigBindingPlaceholder")}
                      aria-label={`Binding for ${input.key}`}
                      aria-invalid={flagged}
                      data-testid={`subchain-config-binding-${input.key}`}
                      className="h-7 text-xs font-mono"
                    />
                    {flagged && (
                      <p className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {t("subChainConfigRequiredUnbound")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {availableAliases.length > 0 && (
            <div className="p-2 rounded bg-muted/30 border border-border">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                {t("subChainConfigAvailableAliasesLabel")}
              </p>
              <div className="flex flex-wrap gap-1">
                {availableAliases.map((alias) => (
                  <span
                    key={alias}
                    className="text-[9px] font-mono text-muted-foreground"
                  >
                    {`{{${alias}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground leading-snug">
            {t("subChainConfigBindingHint")}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            {t("startConfigSaveButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
          >
            {t("startConfigCancelButton")}
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
            {t("startConfigDeleteNodeButton")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
