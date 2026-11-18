"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import { formatDuration } from "@/lib/relay/duration";
import type { ReadSegment } from "@/lib/relay/stepSummary";
import type { TurnLabel, TurnLabelKind } from "@/lib/relay/timing";

/** Steps shorter than this show no duration, except thinking (CONV-03). */
export const MIN_STEP_SECONDS_SHOWN = 1;

const LABEL_KEYS: Record<TurnLabelKind, string> = {
  worked: "turn.worked",
  stopped: "turn.stopped",
  failed: "turn.failed",
  interrupted: "turn.interrupted",
  legacy: "turn.workedLegacy",
};

const capitalizeFirst = (text: string): string =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1);

function StepDuration({ seconds }: { seconds?: number }) {
  if (seconds === undefined) return null;
  return (
    <span data-testid="relay-step-duration" className="tabular-nums">
      {formatDuration(seconds)}
    </span>
  );
}

/** One line for a run of consecutive reads, e.g. "Read 3 requests, searched 2 times". */
export function ReadsLine({
  segments,
  seconds,
}: {
  segments: ReadSegment[];
  seconds?: number;
}) {
  const t = useTranslations("relay");
  const text = segments.map(({ key, count }) => t(key, { count })).join(", ");
  return (
    <p
      data-testid="relay-reads-line"
      className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span>{capitalizeFirst(text)}</span>
      <StepDuration seconds={seconds} />
    </p>
  );
}

/** A reasoning step; it is always timed, however short. */
export function ThoughtLine({ seconds }: { seconds: number }) {
  const t = useTranslations("relay");
  return (
    <p
      data-testid="relay-thought-line"
      className="my-1 text-xs text-muted-foreground"
    >
      {t("turn.thought", { duration: formatDuration(seconds) })}
    </p>
  );
}

type WorkedGroupProps = { label: TurnLabel; children: ReactNode };

/**
 * A finished turn's steps folded behind one row: "Worked for Ns" (or the
 * Stopped, Failed, Interrupted and legacy variants). Collapsed by default;
 * the chevron points right closed and down open.
 */
export function WorkedGroup({ label, children }: WorkedGroupProps) {
  const t = useTranslations("relay");
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;
  const text = t(LABEL_KEYS[label.kind], {
    duration: formatDuration(label.seconds ?? 0),
  });

  return (
    <div data-testid="relay-worked-group" data-label={label.kind}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${RELAY_COARSE_TOUCH_CLASS}`}
      >
        <Chevron aria-hidden className="size-3.5 shrink-0" />
        <span>{text}</span>
      </button>
      {open ? (
        <div
          id={bodyId}
          data-testid="relay-worked-group-body"
          className="mt-1 flex min-w-0 flex-col gap-2 border-l pl-3"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
