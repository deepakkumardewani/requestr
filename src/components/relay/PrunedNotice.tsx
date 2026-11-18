"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RELAY_MAX_THREADS } from "@/lib/relay/constants";
import { useRelayStore } from "@/stores/useRelayStore";

/** Tells the user once that the oldest conversation was dropped to stay within the cap (FR-14). */
export function PrunedNotice() {
  const t = useTranslations("relay");
  const visible = useRelayStore((state) => state.prunedNotice);
  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="relay-pruned-notice"
      className="flex items-start justify-between gap-2 border-b bg-muted px-3 py-2 text-xs text-muted-foreground"
    >
      <p>{t("threads.prunedNotice", { max: RELAY_MAX_THREADS })}</p>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("threads.dismissNotice")}
        data-testid="relay-pruned-notice-dismiss"
        onClick={() => useRelayStore.getState().dismissPrunedNotice()}
      >
        <XIcon />
      </Button>
    </div>
  );
}
