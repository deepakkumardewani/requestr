"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { startTour, type TourTranslator } from "./startTour";
import { TOUR_ROUTE } from "./useTourAutoStart";

/** Replays the tour from anywhere: the anchors only exist on the workspace route. */
export function useReplayTour(): () => void {
  const router = useRouter();
  const t = useTranslations("common.tour");

  return useCallback(() => {
    // Read at click time so the hook needs no router-state subscription.
    if (window.location.pathname !== TOUR_ROUTE) router.push(TOUR_ROUTE);
    void startTour({ trigger: "replay", t: t as TourTranslator });
  }, [router, t]);
}
