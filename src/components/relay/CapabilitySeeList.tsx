"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRelayStore } from "@/stores/useRelayStore";

/** What reaches the model, and what never does (EMPTY-03). */
export function CapabilitySeeList() {
  const t = useTranslations("relay");
  const shareValues = useRelayStore((s) => s.shareValues);

  return (
    <section
      data-testid="relay-capability-see-list"
      aria-labelledby="relay-capability-see-title"
      className="flex flex-col gap-1.5 border-t bg-muted/30 p-3"
    >
      <h4 id="relay-capability-see-title" className="text-xs font-medium">
        {t("capabilities.footer.title")}
      </h4>
      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        <li>{t("capabilities.footer.attached")}</li>
        <li>{t("capabilities.footer.index")}</li>
        <li data-testid="relay-capability-see-values">
          {t(
            shareValues
              ? "capabilities.footer.valuesOn"
              : "capabilities.footer.valuesOff",
          )}
        </li>
        <li>{t("capabilities.footer.secrets")}</li>
      </ul>
      <Link
        href="/settings"
        data-testid="relay-capability-settings-link"
        className="w-fit text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("capabilities.footer.settingsLink")}
      </Link>
    </section>
  );
}
