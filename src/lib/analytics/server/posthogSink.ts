import {
  EXCEPTION_EVENT,
  type IngestBatch,
  SURVEY_EVENT,
  type WireEvent,
} from "@/lib/analytics/events";

/** Backend-neutral sink (R11); this file is the only one that knows PostHog's wire format. */
export interface AnalyticsSink {
  send(batch: IngestBatch): Promise<void>;
}

export const POSTHOG_TIMEOUT_MS = 5000;
const SURVEY_EVENT_NAME = "survey sent";
const SURVEY_DISTINCT_ID = "anonymous-survey";
const SURVEY_RESPONSE_PREFIX = "$survey_response_";
const FRAME_SEPARATOR = "\n";

type PostHogEvent = {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
};

/** Frames arrive as `file:line` lines; anything unparseable keeps just the filename. */
function parseFrames(frames: unknown): { filename: string; lineno?: number }[] {
  if (typeof frames !== "string" || frames === "") return [];
  return frames.split(FRAME_SEPARATOR).map((line) => {
    const split = line.lastIndexOf(":");
    const lineno = Number(line.slice(split + 1));
    if (split < 0 || !Number.isInteger(lineno)) return { filename: line };
    return { filename: line.slice(0, split), lineno };
  });
}

function mapException(props: Record<string, unknown>) {
  const { message, type, frames, source, ...rest } = props;
  return {
    ...rest,
    $exception_list: [
      {
        type,
        value: message,
        mechanism: { handled: source === "boundary", type: source },
        stacktrace: { type: "raw", frames: parseFrames(frames) },
      },
    ],
  };
}

function mapSurvey(props: Record<string, unknown>, surveyId: string) {
  const { app_version, ...answers } = props;
  const responses = Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [
      `${SURVEY_RESPONSE_PREFIX}${key}`,
      value,
    ]),
  );
  return { app_version, $survey_id: surveyId, ...responses };
}

function toPostHogEvent(
  event: WireEvent,
  distinctId: string,
  surveyId: string | undefined,
): PostHogEvent | null {
  let name = event.name;
  let properties: Record<string, unknown> = event.props;
  if (event.name === EXCEPTION_EVENT) {
    properties = mapException(event.props);
  } else if (event.name === SURVEY_EVENT) {
    if (!surveyId) return null;
    name = SURVEY_EVENT_NAME;
    properties = mapSurvey(event.props, surveyId);
  }
  return {
    event: name,
    distinct_id: distinctId,
    properties: {
      ...properties,
      $ip: null,
      $geoip_disable: true,
      $process_person_profile: false,
    },
    timestamp: new Date(event.ts).toISOString(),
  };
}

export const posthogSink: AnalyticsSink = {
  async send(batch) {
    const key = process.env.POSTHOG_KEY;
    const host = process.env.POSTHOG_HOST;
    if (!key || !host) return;
    const surveyId = process.env.POSTHOG_FEEDBACK_SURVEY_ID;
    const distinctId = batch.id ?? SURVEY_DISTINCT_ID;
    const mapped = batch.events.flatMap((event) => {
      const converted = toPostHogEvent(event, distinctId, surveyId);
      return converted ? [converted] : [];
    });
    if (mapped.length === 0) return;
    try {
      const response = await fetch(`${host.replace(/\/+$/, "")}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, batch: mapped }),
        signal: AbortSignal.timeout(POSTHOG_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.warn(
          "[requestly] analytics sink: upstream status",
          response.status,
        );
      }
    } catch (error) {
      // Name only: the message or cause could echo request details.
      const name = error instanceof Error ? error.name : "unknown";
      console.warn("[requestly] analytics sink: upstream failed", name);
    }
  },
};
