"use client";

import { GitBranch, Plus, Trash2 } from "lucide-react";
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
import { detectAliasCollisions } from "@/lib/chainControlFlow";
import { edgeCollisionsToSources } from "@/lib/chainValueNamespace";
import { generateId } from "@/lib/utils";
import type {
  ChainEdge,
  ConditionBranch,
  ConditionNodeConfig,
} from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";
import { AliasCollisionWarning } from "./AliasCollisionWarning";

const MIN_BRANCHES = 1;
const SUPPORTED_EXPRESSIONS =
  "== 'val', != 'val', == num, > num, < num, contains 'val'";
// Passed as ICU arguments because literal `{{` would be parsed as message syntax.
const EDGE_ALIAS_PLACEHOLDER = "{{edgeId:alias}}";
const EDGE_ALIAS_EXAMPLE = "{{e1:Authorization}}";

type ConditionConfigPanelProps = {
  open: boolean;
  node: ConditionNodeConfig | null;
  onClose: () => void;
  onSave: (node: ConditionNodeConfig) => void;
  onDelete: (nodeId: string) => void;
  incomingEdges?: ChainEdge[];
};

function makeBranch(label = "", expression = ""): ConditionBranch {
  return { id: generateId(), label, expression };
}

export function ConditionConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
  incomingEdges = [],
}: ConditionConfigPanelProps) {
  const t = useTranslations("chain");
  const [variable, setVariable] = useState("");
  const [branches, setBranches] = useState<ConditionBranch[]>([]);

  // Detect alias collisions in incoming edges
  const aliasCollisions = edgeCollisionsToSources(
    detectAliasCollisions(incomingEdges),
  );

  // Build a list of available variables from incoming edges
  const availableVariables = incomingEdges
    .filter((e) => !e.branchId) // exclude routing edges
    .flatMap((edge) =>
      (edge.injections ?? []).map((inj) => ({
        edgeId: edge.id,
        alias: inj.targetKey,
        path: inj.sourceJsonPath,
        fullKey: `${edge.id}:${inj.targetKey}`,
      })),
    );

  // Sync local state when the node changes
  useEffect(() => {
    if (!node) return;
    setVariable(node.variable);
    setBranches(
      node.branches.length > 0
        ? node.branches
        : [makeBranch("", ""), makeBranch(CHAIN_HANDLE_IDS.ELSE, "")],
    );
  }, [node]);

  if (!node) return null;

  function handleSave() {
    if (!node) return;
    onSave({ ...node, variable, branches });
    onClose();
  }

  function handleAddBranch() {
    setBranches((prev) => [...prev, makeBranch("", "")]);
  }

  function handleDeleteBranch(id: string) {
    setBranches((prev) => {
      if (prev.length <= MIN_BRANCHES) return prev;
      return prev.filter((b) => b.id !== id);
    });
  }

  function updateBranch(
    id: string,
    field: keyof ConditionBranch,
    value: string,
  ) {
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
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
            <GitBranch className="h-4 w-4 text-violet-400" />
            {t("conditionConfigTitle")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <AliasCollisionWarning collisions={aliasCollisions} />

          {/* Variable */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("conditionConfigVariableLabel")}
            </Label>
            <Input
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              placeholder={t("conditionConfigVariablePlaceholder", {
                placeholder: EDGE_ALIAS_PLACEHOLDER,
              })}
              className="h-8 text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground leading-snug">
              {t.rich("conditionConfigVariableHint", {
                placeholder: EDGE_ALIAS_PLACEHOLDER,
                example: EDGE_ALIAS_EXAMPLE,
                code: (chunks) => <span className="font-mono">{chunks}</span>,
              })}
            </p>
            {availableVariables.length > 0 && (
              <div className="mt-2 p-2 rounded bg-muted/30 border border-border">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                  {t("conditionConfigAvailableVariables")}
                </p>
                <div className="space-y-1">
                  {availableVariables.map((v) => (
                    <div
                      key={v.fullKey}
                      className="text-[9px] font-mono text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => setVariable(`{{${v.fullKey}}}`)}
                      title={t("conditionConfigInsertVariableTitle", {
                        placeholder: `{{${v.fullKey}}}`,
                      })}
                    >
                      <span className="text-foreground font-semibold">
                        {v.alias}
                      </span>
                      {" → "}
                      <span className="text-muted-foreground">{v.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Branches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                {t("conditionConfigBranchesLabel")}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs px-2"
                onClick={handleAddBranch}
              >
                <Plus className="h-3 w-3" />
                {t("conditionConfigAddBranch")}
              </Button>
            </div>

            <div className="space-y-2">
              {branches.map((branch, idx) => {
                const isElse =
                  !branch.expression.trim() && idx === branches.length - 1;
                return (
                  <div
                    key={branch.id}
                    className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2"
                  >
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <Input
                        value={branch.label}
                        onChange={(e) =>
                          updateBranch(branch.id, "label", e.target.value)
                        }
                        placeholder={
                          isElse
                            ? t("conditionConfigElsePlaceholder")
                            : t("conditionConfigLabelPlaceholder")
                        }
                        className="h-7 text-xs"
                      />
                      {!isElse && (
                        <Input
                          value={branch.expression}
                          onChange={(e) =>
                            updateBranch(
                              branch.id,
                              "expression",
                              e.target.value,
                            )
                          }
                          placeholder={t(
                            "conditionConfigExpressionPlaceholder",
                          )}
                          className="h-7 text-xs font-mono"
                        />
                      )}
                      {isElse && (
                        <p className="text-[10px] text-muted-foreground italic px-0.5">
                          {t("conditionConfigElseHint")}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteBranch(branch.id)}
                      disabled={branches.length <= MIN_BRANCHES}
                      className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30 transition-colors"
                      title={t("conditionConfigDeleteBranchTitle")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-muted-foreground leading-snug">
              {t.rich("conditionConfigExpressionsHint", {
                expressions: SUPPORTED_EXPRESSIONS,
                code: (chunks) => <span className="font-mono">{chunks}</span>,
                em: (chunks) => <span className="italic">{chunks}</span>,
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            {t("configPanelSaveButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
          >
            {t("configPanelCancelButton")}
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
            {t("configPanelDeleteNodeButton")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
