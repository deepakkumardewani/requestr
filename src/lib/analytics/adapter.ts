import { clearAnalyticsId } from "@/lib/analytics/analyticsId";
import { readConsentEnv, resolveConsent } from "@/lib/analytics/consent";
import type {
  ErrorRecord,
  EventMap,
  EventName,
  SurveyResponse,
} from "@/lib/analytics/events";
import { createHttpAdapter, sendSurvey } from "@/lib/analytics/httpAdapter";
import { noopAdapter } from "@/lib/analytics/noopAdapter";

/** Backend-neutral client surface (R11); product code only ever uses the module functions below. */
export interface AnalyticsAdapter {
  track<E extends EventName>(name: E, props?: EventMap[E]): void;
  captureError(record: ErrorRecord): void;
  submitSurvey(response: SurveyResponse): void;
  /** `false` clears the queue and stops timers and listeners. */
  setEnabled(enabled: boolean): void;
}

let adapter: AnalyticsAdapter = noopAdapter;
let initialized = false;
let toggleEnabled = true;

const hasWindow = (): boolean => typeof window !== "undefined";

function applyConsent(): void {
  const { enabled } = resolveConsent(readConsentEnv(toggleEnabled));
  if (enabled) {
    if (adapter === noopAdapter) adapter = createHttpAdapter();
    return;
  }
  if (adapter === noopAdapter) return;
  adapter.setEnabled(false);
  adapter = noopAdapter;
  clearAnalyticsId();
}

/** Picks the noop or HTTP adapter once; later calls are ignored. SSR-safe. */
export function initAnalytics(): void {
  if (!hasWindow() || initialized) return;
  initialized = true;
  applyConsent();
}

/** Applies the Settings toggle immediately; turning it off drops the queue and the analytics id. */
export function setEnabled(enabled: boolean): void {
  if (!hasWindow()) return;
  initialized = true;
  toggleEnabled = enabled;
  applyConsent();
  if (!enabled) clearAnalyticsId();
}

export function track<E extends EventName>(name: E, props?: EventMap[E]): void {
  if (!hasWindow()) return;
  adapter.track(name, props);
}

export function captureError(record: ErrorRecord): void {
  if (!hasWindow()) return;
  adapter.captureError(record);
}

/**
 * Feedback is an explicit user action, so it skips the user-consent gates
 * (toggle, DNT, GPC) but still honours the environment gate.
 */
export function submitSurvey(response: SurveyResponse): void {
  if (!hasWindow()) return;
  const env = {
    ...readConsentEnv(true),
    doNotTrack: false,
    gpc: false,
  };
  if (!resolveConsent(env).enabled) return;
  sendSurvey(response);
}

/** Test seam: restores module state. */
export function resetAnalyticsForTests(): void {
  adapter.setEnabled(false);
  adapter = noopAdapter;
  initialized = false;
  toggleEnabled = true;
}
