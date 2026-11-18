"use client";

import { ListChecksIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useRef } from "react";
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
import { useRelayStore } from "@/stores/useRelayStore";
import { CapabilitiesPanel } from "./CapabilitiesPanel";

type CapabilitiesPopoverProps = {
  /** Touch-target sizing (sheet layout). */
  style?: CSSProperties;
};

/**
 * Header button and popover for "What Relay can do" (RP-206, EMPTY-03). Open state lives
 * in the store so the `+` launcher can open it from elsewhere.
 */
export function CapabilitiesPopover({ style }: CapabilitiesPopoverProps) {
  const t = useTranslations("relay");
  const open = useRelayStore((s) => s.capabilitiesOpen);
  const setOpen = useRelayStore((s) => s.setCapabilitiesOpen);
  const setPermissionPopoverOpen = useRelayStore(
    (s) => s.setPermissionPopoverOpen,
  );
  // Another control takes focus on a hand-off, so closing must not pull it back to the button.
  const handoffRef = useRef(false);
  const label = t("header.capabilities");

  const handleChangeMode = () => {
    handoffRef.current = true;
    setOpen(false);
    setPermissionPopoverOpen(true);
  };

  const finalFocus = () => {
    const skip = handoffRef.current;
    handoffRef.current = false;
    return !skip;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              type="button"
              aria-label={label}
              data-testid="relay-header-capabilities"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              style={style}
            />
          }
        >
          <ListChecksIcon aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="bottom" data-testid="relay-header-tooltip">
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        finalFocus={finalFocus}
        aria-label={label}
        className="w-80 max-w-(--available-width) max-h-(--available-height) gap-0 p-0 shadow-lg"
        data-testid="relay-capabilities-popover"
      >
        <PopoverTitle className="sr-only">
          {t("capabilities.title")}
        </PopoverTitle>
        <CapabilitiesPanel onChangeMode={handleChangeMode} />
      </PopoverContent>
    </Popover>
  );
}
