"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRelayStore } from "@/stores/useRelayStore";

/**
 * Stands in for the dock when its lazy chunk fails to load, so the failure is
 * contained and the toggle stays usable. Uses only the eager `relay` messages:
 * the dock's own messages travel with the chunk that just failed.
 */
export function RelayLoadError() {
  const t = useTranslations("relay");
  const open = useRelayStore((s) => s.open);

  if (!open) return null;

  return (
    <div
      role="alert"
      data-testid="relay-dock-error"
      className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2 rounded-md border bg-popover p-3 text-popover-foreground text-sm shadow-md"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p>{t("dockLoadError")}</p>
    </div>
  );
}
