"use client";

import { useTranslations } from "next-intl";
import { RelayLogo } from "@/components/relay/RelayLogo";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRelayAvailable } from "@/hooks/useRelayAvailable";
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
      <TooltipContent side="bottom">{t("toggleLabel")}</TooltipContent>
    </Tooltip>
  );
}
