"use client";

import { useFormatter } from "next-intl";
import { memo } from "react";
import { useRelativeNowValue } from "@/components/chain/RelativeNowProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RelativeTimeProps = {
  /** Epoch milliseconds. */
  timestamp: number;
  /**
   * Explicit tick from `useRelativeNow`. Omit to read the tick from the
   * nearest `RelativeNowProvider`, so a memoized parent (e.g. a row) never
   * re-renders on time changes.
   */
  now?: number;
  className?: string;
};

const ABSOLUTE_FORMAT = {
  dateStyle: "medium",
  timeStyle: "medium",
} as const satisfies Intl.DateTimeFormatOptions;

type RelativeTimeViewProps = RelativeTimeProps & { now: number };

function RelativeTimeView({
  timestamp,
  now,
  className,
}: RelativeTimeViewProps) {
  const format = useFormatter();
  if (!Number.isFinite(timestamp)) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={new Date(timestamp).toISOString()}
            className={className}
          />
        }
      >
        {format.relativeTime(timestamp, now)}
      </TooltipTrigger>
      <TooltipContent>
        {format.dateTime(timestamp, ABSOLUTE_FORMAT)}
      </TooltipContent>
    </Tooltip>
  );
}

function ContextRelativeTime(props: RelativeTimeProps) {
  const now = useRelativeNowValue();
  return <RelativeTimeView {...props} now={now} />;
}

function RelativeTimeInner({ now, ...rest }: RelativeTimeProps) {
  if (now === undefined) return <ContextRelativeTime {...rest} />;
  return <RelativeTimeView {...rest} now={now} />;
}

export const RelativeTime = memo(RelativeTimeInner);
