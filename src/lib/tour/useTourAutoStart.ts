"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { safeStorage } from "@/lib/analytics/dedupe";
import {
  endActiveTour,
  isTourRunning,
  ONBOARDING_COMPLETE_KEY,
  startTour,
  type TourTranslator,
} from "./startTour";
import { TOUR_ROUTE } from "./tourApplicability";

export const TOUR_MIN_VIEWPORT_PX = 768;

type TourE2EWindow = Window & { __RQ_TOUR_E2E__?: boolean };

/** Browser automation suppresses auto-start unless a spec opts in (keeps other suites overlay-free). */
function suppressedByAutomation(): boolean {
  return (
    navigator.webdriver === true &&
    (window as TourE2EWindow).__RQ_TOUR_E2E__ !== true
  );
}

export function shouldAutoStartTour(): boolean {
  if (window.innerWidth < TOUR_MIN_VIEWPORT_PX) return false;
  if (safeStorage.get(ONBOARDING_COMPLETE_KEY)) return false;
  return !suppressedByAutomation();
}

/** Starts the tour once per visit to `/app` for first-time desktop users; ends it on route change. */
export function useTourAutoStart(): void {
  const pathname = usePathname();
  const t = useTranslations("common.tour");
  const translate = useRef<TourTranslator>(t as TourTranslator);
  translate.current = t as TourTranslator;

  // Any running tour (auto or replay) is anchored to /app, so leaving it ends the tour.
  useEffect(() => {
    if (pathname !== TOUR_ROUTE) endActiveTour();
  }, [pathname]);

  useEffect(() => {
    // A replay started from another route may already be waiting on this route's anchors.
    if (pathname !== TOUR_ROUTE || isTourRunning() || !shouldAutoStartTour())
      return;
    void startTour({
      trigger: "auto",
      t: (key, values) => translate.current(key, values),
    });
    return endActiveTour;
  }, [pathname]);
}
