"use client";

import { useEffect } from "react";
import { initAnalytics, track } from "@/lib/analytics/adapter";
import type { LANDING_CTA_IDS } from "@/lib/analytics/events";
import {
  buildLandingProps,
  landingPathEnum,
} from "@/lib/analytics/propBuilders";
import { useAnalyticsStore } from "@/stores/useAnalyticsStore";

export type LandingCtaId = (typeof LANDING_CTA_IDS)[number];

/** Fire-and-forget: a CTA click must never be delayed or blocked by analytics. */
export function trackLandingCtaClick(ctaId: LandingCtaId): void {
  track("landing_cta_clicked", {
    cta_id: ctaId,
    path: landingPathEnum(window.location.pathname),
  });
}

/** Shares the app's opt-out store and adapter gating; sends one `landing_viewed` per mount. */
export function LandingAnalytics() {
  useEffect(() => {
    useAnalyticsStore.getState().syncConsent();
    initAnalytics();
    track(
      "landing_viewed",
      buildLandingProps({
        pathname: window.location.pathname,
        referrer: document.referrer,
        ownHost: window.location.hostname,
      }),
    );
  }, []);

  return null;
}
