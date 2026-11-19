// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_ID_STORAGE_KEY } from "@/lib/analytics/analyticsId";
import { resetDedupeState } from "@/lib/analytics/dedupe";
import { BUCKETS, SURVEY_EVENT } from "@/lib/analytics/events";
import {
  BATCH_SIZE,
  createHttpAdapter,
  FLUSH_INTERVAL_MS,
  INGEST_PATH,
  QUEUE_CAP,
  RETRY_DELAY_MS,
  SESSION_EVENT_CAP,
  sendSurvey,
} from "@/lib/analytics/httpAdapter";

const sessionDays = vi.hoisted(() => ({ value: [] as string[] }));
vi.mock("@/lib/prompts/sessionTracker", () => ({
  getSessionDays: () => sessionDays.value,
}));

const fetchMock = vi.fn();

const setNav = (props: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { configurable: true, value });
  }
};
let onLine = true;

type Sent = { id?: string; events: { name: string; props: Record<string, unknown>; ts: number }[] };
const sentBatch = (call = 0): Sent =>
  JSON.parse(fetchMock.mock.calls[call][1].body as string);

const trackMany = (adapter: ReturnType<typeof createHttpAdapter>, n: number) => {
  for (let i = 0; i < n; i++) adapter.track("collection_created");
};

describe("httpAdapter", () => {
  let adapters: ReturnType<typeof createHttpAdapter>[];
  const make = () => {
    const a = createHttpAdapter();
    adapters.push(a);
    return a;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05Z"));
    adapters = [];
    resetDedupeState();
    localStorage.clear();
    sessionDays.value = [];
    onLine = true;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => onLine,
    });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "debug").mockImplementation(() => {});
    document.documentElement.className = "";
    document.documentElement.lang = "";
  });

  afterEach(() => {
    for (const a of adapters) a.setEnabled(false);
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "sendBeacon");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("batching", () => {
    it("sends nothing until the flush interval elapses", async () => {
      make().track("collection_created");
      expect(fetchMock).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(INGEST_PATH);
    });

    it("flushes immediately when the batch size is reached", async () => {
      trackMany(make(), BATCH_SIZE);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sentBatch().events).toHaveLength(BATCH_SIZE);
    });

    it("splits a larger backlog into batches of at most BATCH_SIZE", async () => {
      const adapter = make();
      onLine = false;
      trackMany(adapter, BATCH_SIZE * 2 + 5);
      expect(fetchMock).not.toHaveBeenCalled();
      onLine = true;
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sentBatch(0).events).toHaveLength(BATCH_SIZE);
      expect(sentBatch(1).events).toHaveLength(BATCH_SIZE);
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sentBatch(2).events).toHaveLength(5);
    });

    it("does not send when the queue is empty", async () => {
      make();
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 3);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends a POST with keepalive, JSON body and omitted credentials", async () => {
      make().track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      const init = fetchMock.mock.calls[0][1];
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(init.keepalive).toBe(true);
      expect(init.credentials).toBe("omit");
    });

    it("includes the analytics id in the batch and reuses it", async () => {
      const adapter = make();
      adapter.track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      adapter.track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      const id = sentBatch(0).id;
      expect(id).toBe(localStorage.getItem(ANALYTICS_ID_STORAGE_KEY));
      expect(sentBatch(1).id).toBe(id);
    });
  });

  describe("event shape", () => {
    it("merges common props with event props and stamps the time", async () => {
      document.documentElement.lang = "fr";
      document.documentElement.classList.add("dark");
      make().track("tour_started", { trigger: "auto" });
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      const [event] = sentBatch().events;
      expect(event.name).toBe("tour_started");
      expect(event.ts).toBe(Date.parse("2026-01-02T03:04:05Z"));
      expect(event.props).toMatchObject({
        trigger: "auto",
        locale: "fr",
        theme: "dark",
        viewport_class: expect.stringMatching(/desktop|tablet|mobile/),
        session_day_index: expect.any(String),
        app_version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      });
    });

    it("defaults locale to en and theme to light", async () => {
      make().track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(sentBatch().events[0].props).toMatchObject({
        locale: "en",
        theme: "light",
      });
    });

    it.each([
      [500, "mobile"],
      [767, "mobile"],
      [768, "tablet"],
      [1023, "tablet"],
      [1024, "desktop"],
    ])("classifies a %ipx viewport as %s", async (width, expected) => {
      vi.stubGlobal("innerWidth", width);
      make().track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(sentBatch().events[0].props.viewport_class).toBe(expected);
    });

    it.each([
      [0, 0],
      [1, 0],
      [2, 1],
      [3, 2],
      [6, 2],
      [7, 3],
    ])("buckets %i session days into bucket index %i", async (days, index) => {
      sessionDays.value = Array.from({ length: days }, (_, i) => `d${i}`);
      make().track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(sentBatch().events[0].props.session_day_index).toBe(
        BUCKETS.sessionDay[index],
      );
    });

    it("sends error records under the exception event", async () => {
      make().captureError({
        message: "boom",
        type: "TypeError",
        frames: "at x",
        source: "window",
      });
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      const [event] = sentBatch().events;
      expect(event.name).toBe("$exception");
      expect(event.props).toMatchObject({ message: "boom", source: "window" });
    });
  });

  describe("caps", () => {
    it("keeps only the newest QUEUE_CAP events while offline", async () => {
      const adapter = make();
      onLine = false;
      for (let i = 0; i < QUEUE_CAP + 10; i++) {
        adapter.track("tour_step_viewed", { step_id: "welcome" as never, index: i });
      }
      onLine = true;
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
      const events = fetchMock.mock.calls.flatMap((_, i) => sentBatch(i).events);
      expect(events).toHaveLength(QUEUE_CAP);
      expect(events[0].props.index).toBe(10);
      expect(events[events.length - 1].props.index).toBe(QUEUE_CAP + 9);
    });

    it("stops enqueueing after SESSION_EVENT_CAP events", async () => {
      const adapter = make();
      trackMany(adapter, SESSION_EVENT_CAP + 50);
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      const total = fetchMock.mock.calls.reduce(
        (sum, _c, i) => sum + sentBatch(i).events.length,
        0,
      );
      expect(total).toBe(SESSION_EVENT_CAP);
    });

    it("does not apply the session cap to surveys", async () => {
      trackMany(make(), SESSION_EVENT_CAP + 1);
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      fetchMock.mockClear();
      sendSurvey({ rating: 4, text: "", email: "" });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("offline queue", () => {
    it("holds events while offline and flushes on the online event", async () => {
      const adapter = make();
      onLine = false;
      adapter.track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
      expect(fetchMock).not.toHaveBeenCalled();
      onLine = true;
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sentBatch().events).toHaveLength(1);
    });
  });

  describe("retry", () => {
    it("retries once after the delay when the server errors, then drops", async () => {
      fetchMock.mockResolvedValue({ status: 503 });
      make().track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 5);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries once when fetch rejects and logs the failure only once", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      const adapter = make();
      adapter.track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS + RETRY_DELAY_MS);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      adapter.track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS + RETRY_DELAY_MS);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(console.debug).toHaveBeenCalledTimes(1);
    });

    it("does not retry on a client error response", async () => {
      fetchMock.mockResolvedValue({ status: 400 });
      make().track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS + RETRY_DELAY_MS * 2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("pagehide", () => {
    it("sends queued events via sendBeacon as JSON and empties the queue", async () => {
      const beacon = vi.fn().mockReturnValue(true);
      setNav({ sendBeacon: beacon });
      onLine = true;
      make();
      const adapter = adapters[0];
      adapter.track("collection_created");
      adapter.track("environment_switched");
      window.dispatchEvent(new Event("pagehide"));
      expect(beacon).toHaveBeenCalledTimes(1);
      expect(beacon.mock.calls[0][0]).toBe(INGEST_PATH);
      const blob = beacon.mock.calls[0][1] as Blob;
      expect(blob.type).toBe("application/json");
      const parsed = JSON.parse(await blob.text()) as Sent;
      expect(parsed.events.map((e) => e.name)).toEqual([
        "collection_created",
        "environment_switched",
      ]);
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does nothing on pagehide with an empty queue", () => {
      const beacon = vi.fn();
      setNav({ sendBeacon: beacon });
      onLine = true;
      make();
      window.dispatchEvent(new Event("pagehide"));
      expect(beacon).not.toHaveBeenCalled();
    });

    it("keeps events queued on pagehide while offline", () => {
      const beacon = vi.fn();
      setNav({ sendBeacon: beacon });
      onLine = false;
      make().track("collection_created");
      window.dispatchEvent(new Event("pagehide"));
      expect(beacon).not.toHaveBeenCalled();
    });

    it("does not throw when sendBeacon is unavailable", () => {
      setNav({ sendBeacon: undefined });
      onLine = true;
      make().track("collection_created");
      expect(() => window.dispatchEvent(new Event("pagehide"))).not.toThrow();
    });
  });

  describe("setEnabled(false)", () => {
    it("clears the queue, stops the timer and removes listeners", async () => {
      const beacon = vi.fn();
      setNav({ sendBeacon: beacon });
      onLine = true;
      const adapter = make();
      adapter.track("collection_created");
      adapter.setEnabled(false);
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("online"));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(beacon).not.toHaveBeenCalled();
    });

    it("keeps running when setEnabled(true) is called", async () => {
      const adapter = make();
      adapter.track("collection_created");
      adapter.setEnabled(true);
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("survey path", () => {
    it("posts immediately without an analytics id and with only app_version as context", async () => {
      sendSurvey({ rating: 5, text: "great", email: "a@b.co" });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const batch = sentBatch();
      expect(batch).not.toHaveProperty("id");
      expect(batch.events).toHaveLength(1);
      expect(batch.events[0].name).toBe(SURVEY_EVENT);
      expect(Object.keys(batch.events[0].props).sort()).toEqual(
        ["app_version", "email", "rating", "text"].sort(),
      );
      expect(batch.events[0].props.rating).toBe(5);
      expect(localStorage.getItem(ANALYTICS_ID_STORAGE_KEY)).toBeNull();
    });

    it("is exposed as the adapter's submitSurvey", async () => {
      make().submitSurvey({ rating: 3, text: "", email: "" });
      await vi.advanceTimersByTimeAsync(0);
      expect(sentBatch().events[0].name).toBe(SURVEY_EVENT);
    });
  });

  describe("privacy (R12)", () => {
    it("never writes document.cookie or injects script elements", async () => {
      const cookieSet = vi.fn();
      const original = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      Object.defineProperty(document, "cookie", {
        configurable: true,
        get: () => "",
        set: cookieSet,
      });
      const appended = vi.spyOn(Node.prototype, "appendChild");
      const inserted = vi.spyOn(Node.prototype, "insertBefore");
      try {
        const adapter = make();
        adapter.track("collection_created");
        adapter.captureError({ message: "m", type: "E", frames: "f", source: "window" });
        adapter.submitSurvey({ rating: 1, text: "", email: "" });
        await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
        window.dispatchEvent(new Event("pagehide"));
        expect(cookieSet).not.toHaveBeenCalled();
        const scripts = [...appended.mock.calls, ...inserted.mock.calls].filter(
          ([node]) => (node as Element).tagName === "SCRIPT",
        );
        expect(scripts).toHaveLength(0);
        expect(document.querySelectorAll("script")).toHaveLength(0);
      } finally {
        delete (document as { cookie?: string }).cookie;
        if (original) Object.defineProperty(Document.prototype, "cookie", original);
      }
    });
  });
});
