"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isRelayEnabled } from "@/lib/relay/flag";
import { useRelayStore } from "@/stores/useRelayStore";

export function RelayToggleButton() {
  const t = useTranslations("relay");
  const open = useRelayStore((s) => s.open);
  const toggle = useRelayStore((s) => s.toggle);

  if (!isRelayEnabled()) return null;

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
        <Sparkles className="h-4 w-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("toggleLabel")}</TooltipContent>
    </Tooltip>
  );
}
