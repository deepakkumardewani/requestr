"use client";

import { useCallback, useEffect, useState } from "react";

const ONBOARDING_KEY = "rq_onboarding_complete";

export function useFirstTimeUser() {
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setIsFirstTime(true);
  }, []);

  const markComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsFirstTime(false);
  }, []);

  const restartTour = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setIsFirstTime(true);
  }, []);

  return { isFirstTime, markComplete, restartTour };
}
