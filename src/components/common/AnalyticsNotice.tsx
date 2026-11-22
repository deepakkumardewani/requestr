"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readConsentEnv, resolveConsent } from "@/lib/analytics/consent";
import { safeStorage } from "@/lib/analytics/dedupe";
import { useAutoPromptGate } from "@/lib/prompts/useAutoPromptGate";
import { useAnalyticsStore } from "@/stores/useAnalyticsStore";
import { usePromptStore } from "@/stores/usePromptStore";

/** Shared by the app and landing routes so dismissing in one hides it in both (R20). */
export const ANALYTICS_NOTICE_DISMISSED_KEY = "rq_analytics_notice_dismissed";

const LANDING_ROUTE = "/";
const PRIVACY_ROUTE = "/privacy";
const SETTINGS_ROUTE = "/settings";
const DISMISSED_VALUE = "1";

export function AnalyticsNotice() {
  const t = useTranslations("common.analyticsNotice");
  const pathname = usePathname();
  const toggleEnabled = useAnalyticsStore((s) => s.enabled);
  // The notice is the one auto prompt allowed in session one (R44).
  const appGate = useAutoPromptGate({ allowFirstSession: true });
  const active = usePromptStore((s) => s.active === "analytics-notice");
  // Resolved after mount: DNT, GPC and the dismissed flag are browser-only.
  const [eligible, setEligible] = useState(false);

  const onLanding = pathname === LANDING_ROUTE;
  const routeAllowed = onLanding || appGate;

  useEffect(() => {
    const dismissed =
      safeStorage.get(ANALYTICS_NOTICE_DISMISSED_KEY) === DISMISSED_VALUE;
    const consent = resolveConsent(readConsentEnv(toggleEnabled));
    setEligible(!dismissed && consent.enabled);
  }, [toggleEnabled]);

  const wantsSlot = eligible && routeAllowed;
  useEffect(() => {
    if (!wantsSlot) return;
    usePromptStore.getState().request("analytics-notice", { auto: true });
    return () => usePromptStore.getState().release("analytics-notice");
  }, [wantsSlot]);

  if (!wantsSlot || !active) return null;

  const dismiss = () => {
    safeStorage.set(ANALYTICS_NOTICE_DISMISSED_KEY, DISMISSED_VALUE);
    setEligible(false);
  };

  return (
    <div
      role="status"
      data-testid="analytics-notice"
      className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] sm:w-auto -translate-x-1/2 items-center gap-2 rounded-lg bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-md ring-1 ring-foreground/10"
    >
      <span>
        {t("message")}{" "}
        <Link
          href={PRIVACY_ROUTE}
          className="underline underline-offset-2 hover:text-foreground rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("privacy")}
        </Link>
        {" · "}
        <Link
          href={SETTINGS_ROUTE}
          className="underline underline-offset-2 hover:text-foreground rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("settings")}
        </Link>
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("dismiss")}
        onClick={dismiss}
      >
        <X />
      </Button>
    </div>
  );
}
