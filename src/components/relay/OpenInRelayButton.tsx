"use client";

import { useTranslations } from "next-intl";
import { RelayLogo } from "@/components/relay/RelayLogo";
import { Button } from "@/components/ui/button";
import { RELAY_ENTRY_TOUCH_CLASS } from "@/lib/relay/constants";
import { isRelayEnabled } from "@/lib/relay/flag";
import { type OpenInRelayOptions, openInRelay } from "@/lib/relay/openInRelay";
import { cn } from "@/lib/utils";
import { type RelayChip, useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";

type OpenInRelayButtonProps = OpenInRelayOptions & {
  /** Tab whose request is the context; defaults to the active tab. */
  tabId?: string;
  className?: string;
};

/**
 * The saved request behind a tab, as the chip to attach for it. Read on click
 * so the button needs no store subscription. Unsaved tabs have no request id
 * and so no chip.
 */
function requestChips(tabId?: string): RelayChip[] {
  const { tabs, activeTabId } = useTabsStore.getState();
  const tab = tabs.find(
    (candidate) => candidate.tabId === (tabId ?? activeTabId),
  );
  if (!tab || tab.type !== "http" || !tab.requestId) return [];
  return [{ kind: "request", id: tab.requestId, label: tab.name }];
}

/** Hands a prompt and its context to the Relay dock; renders nothing when Relay is off (FR-80). */
export function OpenInRelayButton({
  prompt,
  context,
  tabId,
  className,
}: OpenInRelayButtonProps) {
  const t = useTranslations("relay");
  const enabled = useRelayStore((s) => s.enabled);

  if (!isRelayEnabled() || !enabled) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t("openInRelay")}
      data-testid="open-in-relay-btn"
      className={cn(
        "h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground",
        RELAY_ENTRY_TOUCH_CLASS,
        className,
      )}
      onClick={() =>
        openInRelay({ prompt, context: context ?? requestChips(tabId) })
      }
    >
      <RelayLogo className="size-3" />
      {t("openInRelay")}
    </Button>
  );
}
