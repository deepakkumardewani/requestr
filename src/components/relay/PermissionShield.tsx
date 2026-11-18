"use client";

import {
  CheckIcon,
  type LucideIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RELAY_TOUCH_TARGET_STYLE } from "@/lib/relay/constants";
import {
  getPermissionOption,
  isRadioNavKey,
  nextRadioIndex,
  RELAY_PERMISSION_OPTIONS,
  type RelayPermissionIcon,
  type RelayPermissionMode,
  type RelayPermissionOption,
} from "@/lib/relay/permission";
import { cn } from "@/lib/utils";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";

const ICONS: Record<RelayPermissionIcon, LucideIcon> = {
  "shield-question": ShieldQuestionIcon,
  "shield-check": ShieldCheckIcon,
  "shield-alert": ShieldAlertIcon,
};

const TRIGGER_CLASS = "size-9 shrink-0";

type PermissionShieldProps = { touchTargets?: boolean };

/** Shield button after `+`: shows the approval mode and opens the three-way choice. */
export function PermissionShield({
  touchTargets = false,
}: PermissionShieldProps) {
  const t = useTranslations("relay");
  const mode = useRelayPermissionStore((s) => s.mode);
  const setMode = useRelayPermissionStore((s) => s.setMode);
  const open = useRelayStore((s) => s.permissionPopoverOpen);
  const setOpen = useRelayStore((s) => s.setPermissionPopoverOpen);
  const current = getPermissionOption(mode);
  const Icon = ICONS[current.icon];
  const name = t(current.labelKey);
  const tooltip = t("permission.triggerTooltip", { name });

  function choose(next: RelayPermissionMode) {
    setMode(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              type="button"
              aria-label={tooltip}
              data-mode={mode}
              data-testid="relay-permission-trigger"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                TRIGGER_CLASS,
                current.tone === "caution" && "text-warning hover:text-warning",
              )}
              style={touchTargets ? RELAY_TOUCH_TARGET_STYLE : undefined}
            />
          }
        >
          <Icon aria-hidden />
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 max-w-(--available-width) gap-2"
        data-testid="relay-permission-popover"
      >
        <PopoverTitle className="px-1 text-sm">
          {t("permission.title")}
        </PopoverTitle>
        <PermissionRadioGroup mode={mode} open={open} onChoose={choose} />
      </PopoverContent>
    </Popover>
  );
}

type RadioGroupProps = {
  mode: RelayPermissionMode;
  open: boolean;
  onChoose: (mode: RelayPermissionMode) => void;
};

/** Hand-built radiogroup: roving tabindex, arrows and Home/End move focus, Space/Enter choose. */
function PermissionRadioGroup({ mode, open, onChoose }: RadioGroupProps) {
  const t = useTranslations("relay");
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedMode, setFocusedMode] = useState(mode);

  // Each opening starts the tab stop on the chosen row.
  useEffect(() => {
    if (open) setFocusedMode(mode);
  }, [open, mode]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const index = RELAY_PERMISSION_OPTIONS.findIndex(
      (option) => option.mode === focusedMode,
    );
    const next = nextRadioIndex(
      event.key,
      index,
      RELAY_PERMISSION_OPTIONS.length,
    );
    setFocusedMode(RELAY_PERMISSION_OPTIONS[next].mode);
    rowRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("permission.groupLabel")}
      data-testid="relay-permission-group"
      className="flex flex-col gap-1"
      onKeyDown={handleKeyDown}
    >
      {RELAY_PERMISSION_OPTIONS.map((option, index) => (
        <PermissionRow
          key={option.mode}
          ref={(node) => {
            rowRefs.current[index] = node;
          }}
          option={option}
          checked={option.mode === mode}
          tabStop={option.mode === focusedMode}
          onChoose={onChoose}
        />
      ))}
    </div>
  );
}

type RowProps = {
  option: RelayPermissionOption;
  checked: boolean;
  tabStop: boolean;
  onChoose: (mode: RelayPermissionMode) => void;
  ref: (node: HTMLButtonElement | null) => void;
};

function PermissionRow({ option, checked, tabStop, onChoose, ref }: RowProps) {
  const t = useTranslations("relay");
  const Icon = ICONS[option.icon];
  const caution = option.tone === "caution";
  const badge =
    option.tone === "recommended"
      ? t("permission.badge.recommended")
      : caution
        ? t("permission.badge.caution")
        : null;
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={tabStop ? 0 : -1}
      data-testid={`relay-permission-option-${option.mode}`}
      className={cn(
        "flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        checked && "border-border bg-accent/60",
        caution && checked && "border-warning/50 bg-warning/10",
      )}
      onClick={() => onChoose(option.mode)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onChoose(option.mode);
        }
      }}
    >
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", caution && "text-warning")}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
          {t(option.labelKey)}
          {badge ? (
            <span
              className={cn(
                "text-xs font-normal",
                caution ? "text-warning" : "text-muted-foreground",
              )}
            >
              {badge}
            </span>
          ) : null}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t(option.descriptionKey)}
        </span>
      </span>
      <CheckIcon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", !checked && "invisible")}
      />
    </button>
  );
}
