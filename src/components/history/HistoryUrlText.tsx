"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsTruncated } from "@/hooks/useIsTruncated";

type HistoryUrlTextProps = {
  url: string;
  "data-testid": string;
};

/** Single-line URL that shows the full value in a tooltip only when clipped. */
export function HistoryUrlText({
  url,
  "data-testid": testId,
}: HistoryUrlTextProps) {
  const { ref, isTruncated } = useIsTruncated<HTMLParagraphElement>(url);

  return (
    <Tooltip disabled={!isTruncated}>
      <TooltipTrigger
        render={
          <p ref={ref} className="truncate text-xs" data-testid={testId} />
        }
      >
        {url}
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-all">{url}</TooltipContent>
    </Tooltip>
  );
}
