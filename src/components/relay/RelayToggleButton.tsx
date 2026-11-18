"use client";

import { useTranslations } from "next-intl";
import { getRelayToggleShortcut } from "@/app/settings/constants";
import { RelayLogo } from "@/components/relay/RelayLogo";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRelayAvailable } from "@/hooks/useRelayAvailable";
import { formatShortcut } from "@/lib/formatShortcut";
import { isMac } from "@/lib/platform";
import { useRelayStore } from "@/stores/useRelayStore";

export function RelayToggleButton() {
  const t = useTranslations("relay");
  const open = useRelayStore((s) => s.open);
  const toggle = useRelayStore((s) => s.toggle);
  const available = useRelayAvailable();

  if (!available) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("toggleLabel")}
            aria-expanded={open}
            data-testid="relay-toggle"
            onClick={toggle}
          />
        }
      >
        <RelayLogo />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t("toggleTooltip")}{" "}
        <Kbd>{formatShortcut(getRelayToggleShortcut(isMac()))}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
