"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { EnvPromotion } from "@/types/chain";

type PromoteToEnvPopoverProps = {
  edgeId: string;
  /** Auto-suggested variable name derived from the source JSONPath. */
  suggestedVarName: string;
  extractedValue: string | null;
  existingPromotion?: EnvPromotion;
  onSave: (promotion: EnvPromotion) => void;
  onRemove: (edgeId: string) => void;
};

export function PromoteToEnvPopover({
  edgeId,
  suggestedVarName,
  extractedValue,
  existingPromotion,
  onSave,
  onRemove,
}: PromoteToEnvPopoverProps) {
  const tCommon = useTranslations("common");
  const { environments } = useEnvironmentsStore();
  const [open, setOpen] = useState(false);
  const [envId, setEnvId] = useState(
    existingPromotion?.envId ?? environments[0]?.id ?? "",
  );
  const [varName, setVarName] = useState(
    existingPromotion?.envVarName ?? suggestedVarName,
  );

  const hasPromotion = !!existingPromotion;
  const isValid = envId !== "" && varName.trim() !== "";

  // Re-sync state when the popover opens so stale defaults are corrected
  function handleOpenChange(next: boolean) {
    if (next) {
      setEnvId(existingPromotion?.envId ?? environments[0]?.id ?? "");
      setVarName(existingPromotion?.envVarName ?? suggestedVarName);
    }
    setOpen(next);
  }

  function handleSave() {
    if (!isValid) return;
    onSave({ edgeId, envId, envVarName: varName.trim() });
    setOpen(false);
  }

  function handleRemove() {
    onRemove(edgeId);
    setOpen(false);
  }

  const selectedEnvName = environments.find((e) => e.id === envId)?.name;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger>
        <button
          type="button"
          className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            hasPromotion
              ? "border border-violet-500/30 bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
              : "border border-border/50 bg-muted/40 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
          title={
            hasPromotion
              ? `Writes to ${existingPromotion.envVarName} in environment`
              : "Promote to environment variable"
          }
        >
          → ENV
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="left"
        align="start"
        className="w-72 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-foreground">
            Promote to environment variable
          </p>

          {extractedValue !== null && extractedValue !== undefined && (
            <p className="truncate rounded bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              Value: <span className="text-emerald-400">{extractedValue}</span>
            </p>
          )}

          {environments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Create an environment first to use this feature.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Environment
                </Label>
                <Select
                  value={envId}
                  onValueChange={(val) => setEnvId(val || "")}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem
                        key={env.id}
                        value={env.id}
                        className="text-xs"
                      >
                        {env.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Variable name
                </Label>
                <Input
                  value={varName}
                  onChange={(e) => setVarName(e.target.value)}
                  className="h-7 font-mono text-xs"
                  placeholder="auth_token"
                />
              </div>

              {hasPromotion && (
                <p className="text-[10px] text-violet-400/80">
                  Currently writes to{" "}
                  <span className="font-mono">
                    {existingPromotion.envVarName}
                  </span>{" "}
                  in{" "}
                  <span className="font-mono">
                    {selectedEnvName ?? existingPromotion.envId}
                  </span>
                </p>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  disabled={!isValid}
                  onClick={handleSave}
                >
                  {hasPromotion ? tCommon("update") : tCommon("save")}
                </Button>
                {hasPromotion && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                    onClick={handleRemove}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
