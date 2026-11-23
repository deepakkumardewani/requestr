import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IngestBatch } from "@/lib/analytics/events";
import { POSTHOG_TIMEOUT_MS, posthogSink } from "./posthogSink";

const TS = 1_700_000_000_000;
const ISO = new Date(TS).toISOString();

type SentBody = {
  api_key: string;
  batch: {
    event: string;
    distinct_id: string;
    properties: Record<string, unknown>;
    timestamp: string;
  }[];
};

const fetchMock = vi.fn();

function sentCall(): { url: string; init: RequestInit; body: SentBody } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) as SentBody };
}

const usage: IngestBatch = {
  id: "anon-1",
  events: [{ name: "app_opened", props: { is_first_session: true }, ts: TS }],
};

describe("posthogSink", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("POSTHOG_KEY", "phc_test");
    vi.stubEnv("POSTHOG_HOST", "https://ph.test");
    vi.stubEnv("POSTHOG_FEEDBACK_SURVEY_ID", "survey-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts mapped events to /batch with privacy flags and no IP", async () => {
    await posthogSink.send(usage);

    const { url, init, body } = sentCall();
    expect(url).toBe("https://ph.test/batch");
    expect(init.method).toBe("POST");
    expect(body.api_key).toBe("phc_test");
    expect(body.batch).toEqual([
      {
        event: "app_opened",
        distinct_id: "anon-1",
        properties: {
          is_first_session: true,
          $ip: null,
          $geoip_disable: true,
          $process_person_profile: false,
        },
        timestamp: ISO,
      },
    ]);
  });

  it("strips trailing slashes from the host and sets a timeout signal", async () => {
    vi.stubEnv("POSTHOG_HOST", "https://ph.test///");
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    await posthogSink.send(usage);
    expect(sentCall().url).toBe("https://ph.test/batch");
    expect(timeoutSpy).toHaveBeenCalledWith(POSTHOG_TIMEOUT_MS);
  });

  it.each([
    ["key", "POSTHOG_KEY"],
    ["host", "POSTHOG_HOST"],
  ])("does not call fetch when the %s is missing", async (_label, name) => {
    vi.stubEnv(name, "");
    await posthogSink.send(usage);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch for an empty batch", async () => {
    await posthogSink.send({ events: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps $exception into $exception_list with parsed frames", async () => {
    await posthogSink.send({
      id: "anon-1",
      events: [
        {
          name: "$exception",
          props: {
            message: "boom",
            type: "TypeError",
            frames: "app.js:10\nvendor.js\nweird:name",
            source: "boundary",
            app_version: "1.0.0",
          },
          ts: TS,
        },
      ],
    });

    const [event] = sentCall().body.batch;
    expect(event.event).toBe("$exception");
    expect(event.properties).toEqual({
      app_version: "1.0.0",
      $exception_list: [
        {
          type: "TypeError",
          value: "boom",
          mechanism: { handled: true, type: "boundary" },
          stacktrace: {
            type: "raw",
            frames: [
              { filename: "app.js", lineno: 10 },
              { filename: "vendor.js" },
              { filename: "weird:name" },
            ],
          },
        },
      ],
      $ip: null,
      $geoip_disable: true,
      $process_person_profile: false,
    });
  });

  it("marks non-boundary exceptions unhandled and tolerates missing frames", async () => {
    await posthogSink.send({
      id: "a",
      events: [
        {
          name: "$exception",
          props: { message: "m", type: "Error", source: "window" },
          ts: TS,
        },
      ],
    });
    const list = sentCall().body.batch[0].properties
      .$exception_list as Record<string, unknown>[];
    expect(list[0].mechanism).toEqual({ handled: false, type: "window" });
    expect(list[0].stacktrace).toEqual({ type: "raw", frames: [] });
  });

  it("maps survey_sent to 'survey sent' with survey id, responses and a shared anonymous id", async () => {
    await posthogSink.send({
      events: [
        {
          name: "survey_sent",
          props: { rating: 5, text: "great", app_version: "1.0.0" },
          ts: TS,
        },
      ],
    });

    const [event] = sentCall().body.batch;
    expect(event.event).toBe("survey sent");
    expect(event.distinct_id).toBe("anonymous-survey");
    expect(event.properties).toEqual({
      app_version: "1.0.0",
      $survey_id: "survey-1",
      $survey_response_rating: 5,
      $survey_response_text: "great",
      $ip: null,
      $geoip_disable: true,
      $process_person_profile: false,
    });
  });

  it("drops survey events when no survey id is configured, keeping the rest", async () => {
    vi.stubEnv("POSTHOG_FEEDBACK_SURVEY_ID", "");
    await posthogSink.send({
      id: "a",
      events: [
        { name: "survey_sent", props: { rating: 5 }, ts: TS },
        { name: "relay_opened", props: {}, ts: TS },
      ],
    });
    expect(sentCall().body.batch.map((e) => e.event)).toEqual(["relay_opened"]);
  });

  it("does not call fetch when only survey events arrive without a survey id", async () => {
    vi.stubEnv("POSTHOG_FEEDBACK_SURVEY_ID", "");
    await posthogSink.send({
      events: [{ name: "survey_sent", props: { rating: 1 }, ts: TS }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("warns with the status only on a non-ok upstream response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("secret body", { status: 503 }));
    await expect(posthogSink.send(usage)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "[requestly] analytics sink: upstream status",
      503,
    );
  });

  it("swallows a network failure and logs only the error name", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new TypeError("connect ECONNREFUSED 10.0.0.1 phc_test");
    fetchMock.mockRejectedValue(error);

    await expect(posthogSink.send(usage)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      "[requestly] analytics sink: upstream failed",
      "TypeError",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("phc_test");
  });

  it("logs 'unknown' when a non-Error is thrown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValue("string failure");
    await posthogSink.send(usage);
    expect(warn).toHaveBeenCalledWith(
      "[requestly] analytics sink: upstream failed",
      "unknown",
    );
  });
});
