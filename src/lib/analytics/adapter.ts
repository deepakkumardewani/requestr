import { clearAnalyticsId } from "@/lib/analytics/analyticsId";
import { readConsentEnv, resolveConsent } from "@/lib/analytics/consent";
import {
  shouldSendOncePerSession,
  withinSessionCap,
} from "@/lib/analytics/dedupe";
import type {
  ErrorRecord,
  EventMap,
  EventName,
  SurveyResponse,
} from "@/lib/analytics/events";
import { createHttpAdapter, sendSurvey } from "@/lib/analytics/httpAdapter";
import { noopAdapter } from "@/lib/analytics/noopAdapter";
import { type ErrorSource, scrubError } from "@/lib/analytics/scrub";

/** Bounds error reports per page session so an error loop cannot flood the pipeline. */
export const SESSION_ERROR_CAP = 10;
const ERROR_CAP_KEY = "errors";
const ERROR_FINGERPRINT_PREFIX = "error:";

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

const fingerprintOf = (record: ErrorRecord): string =>
  `${ERROR_FINGERPRINT_PREFIX}${record.type}|${record.message}|${record.frames}`;

/** True while the analytics module itself is handling an error, so its own failures are never captured. */
let capturing = false;

export function captureError(record: ErrorRecord): void {
  if (!hasWindow() || adapter === noopAdapter || capturing) return;
  if (!shouldSendOncePerSession(fingerprintOf(record))) return;
  if (!withinSessionCap(ERROR_CAP_KEY, SESSION_ERROR_CAP)) return;
  capturing = true;
  try {
    adapter.captureError(record);
  } catch (error) {
    console.warn("[requestly] analytics: error capture failed", error);
  } finally {
    capturing = false;
  }
}

/** Scrubs `error` (R26) and reports it; the single entry point for every capture source. */
export function captureScrubbedError(
  error: unknown,
  source: ErrorSource,
): void {
  if (!hasWindow() || adapter === noopAdapter || capturing) return;
  try {
    captureError(scrubError(error, source));
  } catch (scrubFailure) {
    console.warn("[requestly] analytics: error scrub failed", scrubFailure);
  }
}

/** Registers the global handlers once per mount; returns the cleanup. */
export function installErrorCapture(): () => void {
  if (!hasWindow()) return () => {};
  const onError = (event: ErrorEvent): void =>
    captureScrubbedError(event.error ?? event.message, "window");
  const onRejection = (event: PromiseRejectionEvent): void =>
    captureScrubbedError(event.reason, "promise");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
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
  capturing = false;
}
