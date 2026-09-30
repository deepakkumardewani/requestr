"use client";

import { ListChecks } from "lucide-react";
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
import type { ChainInput } from "@/types/chain";

/** Builds the default override map (one entry per input, seeded with its `defaultValue`). */
function buildDefaultOverrides(inputs: ChainInput[]): Record<string, string> {
  return Object.fromEntries(
    inputs.map((input) => [input.key, input.defaultValue]),
  );
}

type RunWithInputsPopoverProps = {
  /** The chain's Start block inputs. An empty array still renders the popover with a "no inputs" message. */
  inputs: ChainInput[];
  disabled?: boolean;
  /** Called with the effective override map (one entry per input) when the user confirms the run. */
  onRun: (overrides: Record<string, string>) => void;
};

export function RunWithInputsPopover({
  inputs,
  disabled,
  onRun,
}: RunWithInputsPopoverProps) {
  const t = useTranslations("chain");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildDefaultOverrides(inputs),
  );

  function handleOpenChange(next: boolean) {
    if (next) setValues(buildDefaultOverrides(inputs));
    setOpen(next);
  }

  function handleValueChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleRun() {
    onRun(values);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        data-testid="run-with-inputs-btn"
        disabled={disabled}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <ListChecks className="h-3 w-3" />
        {t("runWithInputsButton")}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-4"
        data-testid="run-with-inputs-popover"
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">
              {t("runWithInputsTitle")}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {t("runWithInputsDescription")}
            </p>
          </div>

          {inputs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("runWithInputsNoInputs")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {inputs.map((input) => (
                <div key={input.key} className="flex flex-col gap-1">
                  <Label className="font-mono text-xs text-muted-foreground">
                    {input.key}
                  </Label>
                  <Input
                    value={values[input.key] ?? ""}
                    onChange={(e) =>
                      handleValueChange(input.key, e.target.value)
                    }
                    className="h-7 text-xs"
                    aria-label={input.key}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={handleRun}
            >
              {t("runWithInputsRunButton")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
