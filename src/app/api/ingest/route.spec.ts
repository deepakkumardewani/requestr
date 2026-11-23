import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BATCH_SIZE } from "@/lib/analytics/httpAdapter";
import { POST } from "./route";

const HOST = "app.test";
const ORIGIN = `https://${HOST}`;
const RATE_LIMIT_MAX = 60;
const MAX_BODY_BYTES = 64 * 1024;

let ipCounter = 0;
/** Each request gets a fresh IP so the in-memory rate-limit counter never leaks across tests. */
const freshIp = () => `203.0.113.${++ipCounter}`;

type Overrides = {
  headers?: Record<string, string>;
  body?: BodyInit;
};

function ingestRequest(payload: unknown, overrides: Overrides = {}): Request {
  return new Request(`${ORIGIN}/api/ingest`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      host: HOST,
      "x-real-ip": freshIp(),
      "user-agent": "Mozilla/5.0 (X11; Linux) Firefox/130",
      "content-type": "application/json",
      ...overrides.headers,
    },
    body: overrides.body ?? JSON.stringify(payload),
  });
}

const event = (name = "app_opened", props: Record<string, unknown> = {}) => ({
  name,
  props,
  ts: 1_700_000_000_000,
});

const fetchMock = vi.fn();

function forwardedEvents(): { event: string; properties: unknown }[] {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return (JSON.parse(init.body as string) as { batch: [] }).batch;
}

function enableAnalytics() {
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
  vi.stubEnv("POSTHOG_KEY", "phc_test");
  vi.stubEnv("POSTHOG_HOST", "https://ph.test");
}

describe("POST /api/ingest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    enableAnalytics();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forwards an allowlisted event to PostHog /batch and returns 204", async () => {
    const res = await POST(
      ingestRequest({
        id: "anon-1",
        events: [event("app_opened", { is_first_session: true })],
      }),
    );

    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://ph.test/batch");
    const [forwarded] = forwardedEvents();
    expect(forwarded.event).toBe("app_opened");
    expect(forwarded.properties).toMatchObject({
      $geoip_disable: true,
      $ip: null,
    });
  });

  it("never forwards the client IP or User-Agent", async () => {
    await POST(
      ingestRequest(
        { id: "a", events: [event()] },
        { headers: { "x-real-ip": "198.51.100.77" } },
      ),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const serialized = `${init.body as string}${JSON.stringify(init.headers)}`;
    expect(serialized).not.toContain("198.51.100.77");
    expect(serialized).not.toContain("Firefox");
  });

  it("drops unknown events and props before forwarding", async () => {
    await POST(
      ingestRequest({
        id: "a",
        events: [
          event("evil_event"),
          event("relay_opened", { url: "https://secret.test" }),
        ],
      }),
    );
    const forwarded = forwardedEvents();
    expect(forwarded.map((e) => e.event)).toEqual(["relay_opened"]);
    expect(JSON.stringify(forwarded)).not.toContain("secret.test");
  });

  it("returns 204 without fetch when no event survives validation", async () => {
    const res = await POST(ingestRequest({ events: [event("evil_event")] }));
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without calling fetch", async () => {
    const res = await POST(ingestRequest(null, { body: "{not json" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps a batch at the client batch size", async () => {
    const events = Array.from({ length: BATCH_SIZE + 5 }, () => event());
    await POST(ingestRequest({ id: "a", events }));
    expect(forwardedEvents()).toHaveLength(BATCH_SIZE);
  });

  describe("disabled states never call fetch and return 204", () => {
    it.each([
      ["flag missing", "NEXT_PUBLIC_ANALYTICS_ENABLED", ""],
      ["flag not 'true'", "NEXT_PUBLIC_ANALYTICS_ENABLED", "false"],
      ["POSTHOG_KEY missing", "POSTHOG_KEY", ""],
      ["POSTHOG_HOST missing", "POSTHOG_HOST", ""],
    ])("%s", async (_label, name, value) => {
      vi.stubEnv(name, value);
      const res = await POST(ingestRequest({ id: "a", events: [event()] }));
      expect(res.status).toBe(204);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ignores a client-side e2e override marker when the server flag is off", async () => {
      vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
      const res = await POST(
        ingestRequest(
          { id: "a", events: [event()], e2e: true },
          {
            headers: {
              "x-analytics-e2e": "1",
              "x-e2e-analytics": "true",
              cookie: "rq_analytics_e2e=1",
            },
          },
        ),
      );
      expect(res.status).toBe(204);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ignores the override marker when key and host are missing", async () => {
      vi.stubEnv("POSTHOG_KEY", "");
      vi.stubEnv("POSTHOG_HOST", "");
      const res = await POST(
        ingestRequest(
          { id: "a", events: [event()] },
          { headers: { "x-analytics-e2e": "1" } },
        ),
      );
      expect(res.status).toBe(204);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("accepts silently without forwarding a cross-origin request", async () => {
    const res = await POST(
      ingestRequest(
        { id: "a", events: [event()] },
        { headers: { origin: "https://evil.test" } },
      ),
    );
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a same-origin request that has no Origin header via Sec-Fetch-Site", async () => {
    const req = new Request(`${ORIGIN}/api/ingest`, {
      method: "POST",
      headers: {
        host: HOST,
        "sec-fetch-site": "same-origin",
        "x-real-ip": freshIp(),
      },
      body: JSON.stringify({ id: "a", events: [event()] }),
    });
    await POST(req);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops a request with neither Origin nor same-origin Sec-Fetch-Site", async () => {
    const req = new Request(`${ORIGIN}/api/ingest`, {
      method: "POST",
      headers: { host: HOST, "x-real-ip": freshIp() },
      body: JSON.stringify({ id: "a", events: [event()] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "Googlebot/2.1",
    "Mozilla/5.0 HeadlessChrome/120",
    "Chrome-Lighthouse",
    "Slackbot-LinkExpanding",
  ])("drops bot user agent %s", async (ua) => {
    const res = await POST(
      ingestRequest(
        { id: "a", events: [event()] },
        { headers: { "user-agent": ua } },
      ),
    );
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a missing User-Agent as non-bot", async () => {
    await POST(
      ingestRequest(
        { id: "a", events: [event()] },
        { headers: { "user-agent": "" } },
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops a body over the byte cap by Content-Length", async () => {
    const res = await POST(
      ingestRequest(
        { id: "a", events: [event()] },
        { headers: { "content-length": String(MAX_BODY_BYTES + 1) } },
      ),
    );
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops a streamed body over the byte cap", async () => {
    const big = JSON.stringify({
      id: "a",
      events: [event("whats_new_shown", { version: "v" })],
      pad: "x".repeat(MAX_BODY_BYTES),
    });
    const res = await POST(ingestRequest(null, { body: big }));
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate limits one IP after the window max and still returns 204", async () => {
    const ip = freshIp();
    const send = () =>
      POST(
        ingestRequest(
          { id: "a", events: [event()] },
          { headers: { "x-real-ip": ip } },
        ),
      );
    for (let i = 0; i < RATE_LIMIT_MAX; i++) await send();
    expect(fetchMock).toHaveBeenCalledTimes(RATE_LIMIT_MAX);

    const res = await send();
    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(RATE_LIMIT_MAX);

    await POST(ingestRequest({ id: "a", events: [event()] }));
    expect(fetchMock).toHaveBeenCalledTimes(RATE_LIMIT_MAX + 1);
  });

  it("still serves requests with no trusted IP header", async () => {
    const req = new Request(`${ORIGIN}/api/ingest`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST },
      body: JSON.stringify({ id: "a", events: [event()] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("returns 204 when the upstream fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("down"));
    const res = await POST(ingestRequest({ id: "a", events: [event()] }));
    expect(res.status).toBe(204);
  });

  it("never logs the IP or User-Agent, even on upstream failure", async () => {
    const spies = [
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
    ];
    fetchMock.mockRejectedValue(new Error("down 198.51.100.9 Firefox"));
    await POST(
      ingestRequest(
        { id: "a", events: [event()] },
        { headers: { "x-real-ip": "198.51.100.9" } },
      ),
    );
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain("198.51.100.9");
    expect(logged).not.toContain("Firefox");
  });

  it("maps $exception and survey_sent into PostHog shapes end to end", async () => {
    await POST(
      ingestRequest({
        events: [
          {
            ...event("$exception", {
              message: "boom",
              type: "Error",
              frames: "a.js:3",
              source: "window",
            }),
          },
          event("survey_sent", { rating: 4 }),
        ],
      }),
    );
    vi.stubEnv("POSTHOG_FEEDBACK_SURVEY_ID", "s1");
    const first = forwardedEvents();
    expect(first.map((e) => e.event)).toEqual(["$exception"]);

    fetchMock.mockClear();
    await POST(ingestRequest({ events: [event("survey_sent", { rating: 4 })] }));
    expect(forwardedEvents()[0]).toMatchObject({
      event: "survey sent",
      properties: { $survey_id: "s1", $survey_response_rating: 4 },
    });
  });
});
