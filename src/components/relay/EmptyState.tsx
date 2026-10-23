"use client";

import { useTranslations } from "next-intl";
import { useCapabilityStarter } from "@/hooks/useCapabilityStarter";
import { CapabilitiesPanel } from "./CapabilitiesPanel";
import { RelayLogo } from "./RelayLogo";

/** New-chat state: the same capability starters on every tab (RP-207). */
export function EmptyState() {
  const t = useTranslations("relay");
  const { runStarter } = useCapabilityStarter();

  return (
    // `my-auto` centers short content yet lets tall content scroll from its top.
    <div
      data-testid="relay-empty"
      className="my-auto flex w-full flex-col items-center gap-4 px-4 py-6 text-center"
    >
      <RelayLogo className="size-16 text-foreground" />
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">
          {t("capabilities.empty.title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("capabilities.empty.description")}
        </p>
      </div>
      <CapabilitiesPanel variant="empty" onStarter={runStarter} />
    </div>
  );
}
