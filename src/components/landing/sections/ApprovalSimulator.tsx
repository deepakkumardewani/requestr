"use client";

import {
  CheckIcon,
  HandIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import type { RelayPermissionMode } from "@/lib/relay/permission";
import { cn } from "@/lib/utils";
import type { ApprovalOutcome, ApprovalRow } from "../data/approvals";
import {
  APPROVAL_MODE_BADGES,
  APPROVAL_OUTCOME_LABELS,
  APPROVAL_PICKER_HINT,
  APPROVAL_PICKER_TITLE,
  type ApprovalMode,
} from "../data/copy";

const RADIO_NAME = "landing-approval-mode";
const DEFAULT_MODE: RelayPermissionMode = "review";

type IconComponent = ComponentType<{ className?: string }>;

/** Same shields as the mode picker in the app. */
const MODE_ICONS: Record<string, IconComponent> = {
  "always-ask": ShieldQuestionIcon,
  review: ShieldCheckIcon,
  skip: ShieldAlertIcon,
};

const OUTCOME_STYLES: Record<
  ApprovalOutcome,
  { icon: IconComponent; className: string }
> = {
  asks: {
    icon: HandIcon,
    className:
      "border-[var(--method-post)]/40 bg-[var(--method-post)]/10 text-[var(--method-post)]",
  },
  runs: {
    icon: CheckIcon,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

interface ModeOptionProps {
  mode: ApprovalMode;
  checked: boolean;
  onSelect: () => void;
}

function ModeOption({ mode, checked, onSelect }: ModeOptionProps) {
  const Icon = MODE_ICONS[mode.id] ?? ShieldCheckIcon;
  const badge = APPROVAL_MODE_BADGES[mode.id];
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked
          ? "border-[var(--landing-accent)]/60 bg-[var(--landing-accent)]/[0.07]"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/40",
      )}
    >
      <input
        type="radio"
        name={RADIO_NAME}
        value={mode.id}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          checked ? "text-[var(--landing-accent)]" : "text-muted-foreground",
        )}
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-foreground">
            {mode.label}
          </span>
          {badge ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
          {mode.description}
        </span>
      </span>
    </label>
  );
}

function OutcomeRow({
  label,
  outcome,
}: {
  label: string;
  outcome: ApprovalOutcome;
}) {
  const { icon: Icon, className } = OUTCOME_STYLES[outcome];
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition-colors duration-200",
          className,
        )}
      >
        <Icon aria-hidden="true" className="size-3" />
        {APPROVAL_OUTCOME_LABELS[outcome]}
      </span>
    </li>
  );
}

interface ApprovalSimulatorProps {
  modes: readonly ApprovalMode[];
  /** Computed on the server with the app's own approval rules. */
  rows: readonly ApprovalRow[];
}

/** Pick an approval mode and see which sample actions Relay would stop for. */
export function ApprovalSimulator({ modes, rows }: ApprovalSimulatorProps) {
  const [mode, setMode] = useState<RelayPermissionMode>(DEFAULT_MODE);
  const askCount = rows.filter((row) => row.outcomes[mode] === "asks").length;

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(0,22rem)_1fr]">
      <fieldset className="space-y-2 border-b border-border p-5 sm:p-6 lg:border-r lg:border-b-0">
        <legend className="float-left mb-1 w-full font-display text-base font-semibold text-foreground">
          {APPROVAL_PICKER_TITLE}
        </legend>
        <p className="clear-both pb-2 text-sm text-muted-foreground">
          {APPROVAL_PICKER_HINT}
        </p>
        {modes.map((option) => (
          <ModeOption
            key={option.id}
            mode={option}
            checked={option.id === mode}
            onSelect={() => setMode(option.id as RelayPermissionMode)}
          />
        ))}
      </fieldset>
      <div className="p-5 sm:p-6">
        <p
          aria-live="polite"
          className="font-mono text-xs text-muted-foreground"
        >
          Relay stops for{" "}
          <span className="text-[var(--method-post)]">
            {askCount} of {rows.length}
          </span>{" "}
          of these
        </p>
        <ul className="mt-2 divide-y divide-border">
          {rows.map((row) => (
            <OutcomeRow
              key={row.id}
              label={row.label}
              outcome={row.outcomes[mode]}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
