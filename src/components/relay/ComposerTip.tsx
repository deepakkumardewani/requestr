"use client";

import { cloneElement, type ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ComposerTipProps = {
  label: string;
  /** The control that gets the tooltip; extra props (from a popover trigger) are forwarded to it. */
  children: ReactElement<Record<string, unknown>>;
};

/** Tooltip that opens on hover and on keyboard focus, for the icon-only composer controls (RP-103). */
export function ComposerTip({
  label,
  children,
  ...forwarded
}: ComposerTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={cloneElement(children, forwarded)} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
