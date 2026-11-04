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
import { RELAY_ENTRY_TOUCH_CLASS } from "@/lib/relay/constants";
import { type OpenInRelayOptions, openInRelay } from "@/lib/relay/openInRelay";
import { cn } from "@/lib/utils";
import type { RelayChip } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";

type OpenInRelayButtonProps = OpenInRelayOptions & {
  /** Tab whose request is the context; defaults to the active tab. */
  tabId?: string;
  className?: string;
};

/**
 * The chip to attach for a tab: its saved request, or the tab itself while it
 * is unsaved. Read on click so the button needs no store subscription.
 */
function requestChips(tabId?: string): RelayChip[] {
  const { tabs, activeTabId } = useTabsStore.getState();
  const tab = tabs.find(
    (candidate) => candidate.tabId === (tabId ?? activeTabId),
  );
  if (!tab || tab.type !== "http") return [];
  if (!tab.requestId) return [{ kind: "tab", id: tab.tabId, label: tab.name }];
  return [{ kind: "request", id: tab.requestId, label: tab.name }];
}

/** Hands an entry point's short prompt and its context to the Relay dock; renders nothing when Relay is off (FR-80). */
export function OpenInRelayButton({
  entry,
  context,
  tabId,
  className,
}: OpenInRelayButtonProps) {
  const t = useTranslations("relay");
  const available = useRelayAvailable();

  if (!available) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("openInRelay")}
            data-testid="open-in-relay-btn"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              RELAY_ENTRY_TOUCH_CLASS,
              className,
            )}
            onClick={() =>
              openInRelay({ entry, context: context ?? requestChips(tabId) })
            }
          />
        }
      >
        <RelayLogo className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("openInRelay")}</TooltipContent>
    </Tooltip>
  );
}
