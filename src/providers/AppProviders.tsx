"use client";

import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";
import { AnalyticsNotice } from "@/components/common/AnalyticsNotice";
import { RelayRoot } from "@/components/relay/RelayRoot";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useThemeAccent } from "@/hooks/useThemeAccent";
import { MESSAGES } from "@/i18n/messages";
import { initAnalytics, installErrorCapture } from "@/lib/analytics/adapter";
import { recordSession } from "@/lib/prompts/sessionTracker";
import {
  relayTelemetryToTrack,
  setRelayTelemetrySink,
} from "@/lib/relay/telemetry";
import { ChainDevProvider } from "@/providers/ChainDevProvider";
import { useAnalyticsStore } from "@/stores/useAnalyticsStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";

const FeedbackSurveyContext = createContext(false);

/** Whether the feedback survey can receive submissions in this build (R29). */
export function useFeedbackSurveyConfigured(): boolean {
  return useContext(FeedbackSurveyContext);
}

/** Resolved after mount: the e2e override lives on `window`, so server and client markup must agree first. */
function FeedbackSurveyProvider({ children }: { children: React.ReactNode }) {
  const buildConfigured =
    process.env.NEXT_PUBLIC_FEEDBACK_SURVEY_CONFIGURED === "true";
  const [overridden, setOverridden] = useState(false);
  useEffect(() => {
    setOverridden(
      process.env.NODE_ENV !== "production" &&
        window.__RQ_ANALYTICS_E2E__ === true,
    );
  }, []);
  return (
    <FeedbackSurveyContext.Provider value={buildConfigured || overridden}>
      {children}
    </FeedbackSurveyContext.Provider>
  );
}

function LocaleWrapper({ children }: { children: React.ReactNode }) {
  const locale = useSettingsStore((s) => s.locale);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}

function StoreHydrator() {
  useEffect(() => {
    useSettingsStore.getState().hydrate();
    useTabsStore.getState().hydrate();
    useCollectionsStore.getState().hydrate();
    useEnvironmentsStore.getState().hydrate();
    useHistoryStore.getState().hydrate();
    useRelayStore.getState().hydrate();
  }, []);

  return null;
}

function ThemeAccentApplier() {
  useThemeAccent();
  return null;
}

/** Mirrors the Reduce motion setting onto <html> app-wide, not only where a consumer mounts. */
function ReducedMotionApplier() {
  useReducedMotion();
  return null;
}

/** Session day first, then consent and the adapter, so `session_day_index` is right on the first event. */
function AnalyticsInitializer() {
  useEffect(() => {
    recordSession();
    // Applies a persisted opt-out before the adapter can pick the HTTP client.
    useAnalyticsStore.getState().syncConsent();
    initAnalytics();
    setRelayTelemetrySink(relayTelemetryToTrack);
    const removeErrorCapture = installErrorCapture();
    return () => {
      removeErrorCapture();
      setRelayTelemetrySink(null);
    };
  }, []);

  return null;
}

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider delay={300}>
        <LocaleWrapper>
          <AnalyticsInitializer />
          <StoreHydrator />
          <ThemeAccentApplier />
          <ReducedMotionApplier />
          <FeedbackSurveyProvider>
            <ChainDevProvider>
              <Toaster richColors position="bottom-right" />
              {children}
              <AnalyticsNotice />
              <RelayRoot />
            </ChainDevProvider>
          </FeedbackSurveyProvider>
        </LocaleWrapper>
      </TooltipProvider>
    </ThemeProvider>
  );
}
