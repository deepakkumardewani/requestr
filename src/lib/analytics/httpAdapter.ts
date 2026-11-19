import type { AnalyticsAdapter } from "@/lib/analytics/adapter";
import { getAnalyticsId } from "@/lib/analytics/analyticsId";
import { withinSessionCap } from "@/lib/analytics/dedupe";
import {
  BUCKETS,
  type CommonProps,
  type ErrorRecord,
  type EventMap,
  type EventName,
  EXCEPTION_EVENT,
  type IngestBatch,
  SURVEY_EVENT,
  type SurveyResponse,
  type WireEvent,
} from "@/lib/analytics/events";
import { getSessionDays } from "@/lib/prompts/sessionTracker";
import { version as APP_VERSION } from "../../../package.json";

export const INGEST_PATH = "/api/ingest";
export const FLUSH_INTERVAL_MS = 5000;
export const BATCH_SIZE = 20;
export const QUEUE_CAP = 200;
export const SESSION_EVENT_CAP = 500;
export const RETRY_DELAY_MS = 2000;
const SESSION_CAP_KEY = "events";
const TABLET_MIN_WIDTH = 768;
const DESKTOP_MIN_WIDTH = 1024;
const FIRST_SESSION_DAYS = 1;
const SECOND_SESSION_DAYS = 2;
const EARLY_SESSION_DAYS_MAX = 6;

let failureLogged = false;

/** Logged once at debug level; the payload is never logged. */
function logFailureOnce(error: unknown): void {
  if (failureLogged) return;
  failureLogged = true;
  console.debug("[requestly] analytics: ingest unreachable", error);
}

function sessionDayBucket(): CommonProps["session_day_index"] {
  const days = Math.max(getSessionDays().length, FIRST_SESSION_DAYS);
  if (days === FIRST_SESSION_DAYS) return BUCKETS.sessionDay[0];
  if (days === SECOND_SESSION_DAYS) return BUCKETS.sessionDay[1];
  return days <= EARLY_SESSION_DAYS_MAX
    ? BUCKETS.sessionDay[2]
    : BUCKETS.sessionDay[3];
}

function viewportClass(): CommonProps["viewport_class"] {
  if (window.innerWidth < TABLET_MIN_WIDTH) return "mobile";
  return window.innerWidth < DESKTOP_MIN_WIDTH ? "tablet" : "desktop";
}

function commonProps(): CommonProps {
  const root = document.documentElement;
  return {
    app_version: APP_VERSION,
    locale: root.lang || "en",
    viewport_class: viewportClass(),
    session_day_index: sessionDayBucket(),
    theme: root.classList.contains("dark") ? "dark" : "light",
  };
}

async function postBatch(batch: IngestBatch): Promise<boolean> {
  try {
    const response = await fetch(INGEST_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      keepalive: true,
      credentials: "omit",
    });
    return response.status < 500;
  } catch (error) {
    logFailureOnce(error);
    return false;
  }
}

/** Retries a failed batch once after a delay, then drops it. */
async function sendWithRetry(batch: IngestBatch): Promise<void> {
  if (await postBatch(batch)) return;
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  await postBatch(batch);
}

/** Survey path: no analytics id, only `app_version`, no queueing and no session cap. */
export function sendSurvey(response: SurveyResponse): void {
  const event: WireEvent = {
    name: SURVEY_EVENT,
    props: { ...response, app_version: APP_VERSION },
    ts: Date.now(),
  };
  void postBatch({ events: [event] });
}

export function createHttpAdapter(): AnalyticsAdapter {
  let queue: WireEvent[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;

  const isOnline = (): boolean => navigator.onLine !== false;

  const toBatch = (events: WireEvent[]): IngestBatch => ({
    id: getAnalyticsId(),
    events,
  });

  function flush(): void {
    if (queue.length === 0 || !isOnline()) return;
    const events = queue.splice(0, BATCH_SIZE);
    void sendWithRetry(toBatch(events));
    if (queue.length >= BATCH_SIZE) flush();
  }

  /** `sendBeacon` survives unload; it cannot retry, so it drops on refusal. */
  function flushOnPageHide(): void {
    if (queue.length === 0 || !isOnline()) return;
    const events = queue.splice(0, queue.length);
    const body = new Blob([JSON.stringify(toBatch(events))], {
      type: "application/json",
    });
    navigator.sendBeacon?.(INGEST_PATH, body);
  }

  function enqueue(name: string, props: Record<string, unknown>): void {
    if (!withinSessionCap(SESSION_CAP_KEY, SESSION_EVENT_CAP)) return;
    queue.push({ name, props: { ...commonProps(), ...props }, ts: Date.now() });
    if (queue.length > QUEUE_CAP) queue = queue.slice(-QUEUE_CAP);
    if (queue.length >= BATCH_SIZE) flush();
  }

  const start = (): void => {
    timer = setInterval(flush, FLUSH_INTERVAL_MS);
    window.addEventListener("pagehide", flushOnPageHide);
    window.addEventListener("online", flush);
  };

  const stop = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    window.removeEventListener("pagehide", flushOnPageHide);
    window.removeEventListener("online", flush);
    queue = [];
  };

  start();

  return {
    track<E extends EventName>(name: E, props?: EventMap[E]): void {
      enqueue(name, { ...props });
    },
    captureError(record: ErrorRecord): void {
      enqueue(EXCEPTION_EVENT, { ...record });
    },
    submitSurvey: sendSurvey,
    setEnabled(enabled: boolean): void {
      if (!enabled) stop();
    },
  };
}
