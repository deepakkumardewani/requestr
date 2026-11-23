"use client";

import { useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { track } from "@/lib/analytics/adapter";
import { shouldSendOncePerSession } from "@/lib/analytics/dedupe";
import type { EventMap } from "@/lib/analytics/events";
import { getSessionDays, isFirstSession } from "@/lib/prompts/sessionTracker";

const APP_OPENED_DEDUPE_KEY = "app_opened";
const MS_PER_DAY = 86_400_000;
const DAYS_YESTERDAY = 1;
const DAYS_MONTH_MIN = 30;
const DAYS_WEEK_MAX = 6;

type DaysSinceLast = EventMap["app_opened"]["days_since_last_bucket"];

function parseLocalDay(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).getTime();
}

function bucketDaysSinceLast(days: number): DaysSinceLast {
  if (days < DAYS_YESTERDAY) return "0";
  if (days === DAYS_YESTERDAY) return "1";
  if (days <= DAYS_WEEK_MAX) return "2-6";
  if (days < DAYS_MONTH_MIN) return "7-29";
  return "30+";
}

/** Days since the latest earlier session day; today itself is ignored so the record order does not matter. */
function daysSinceLastSession(now: Date): DaysSinceLast {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const previous = getSessionDays(now)
    .map(parseLocalDay)
    .filter((day) => day < today.getTime())
    .at(-1);
  if (previous === undefined) return "0";
  return bucketDaysSinceLast(
    Math.round((today.getTime() - previous) / MS_PER_DAY),
  );
}

export default function AppPage() {
  useEffect(() => {
    if (!shouldSendOncePerSession(APP_OPENED_DEDUPE_KEY)) return;
    const now = new Date();
    track("app_opened", {
      is_first_session: isFirstSession(now),
      days_since_last_bucket: daysSinceLastSession(now),
    });
  }, []);

  return <MainLayout />;
}
