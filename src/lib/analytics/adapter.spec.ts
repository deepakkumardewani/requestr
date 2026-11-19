// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initAnalytics,
  captureError,
  resetAnalyticsForTests,
  setEnabled,
  submitSurvey,
  track,
} from "@/lib/analytics/adapter";
import { ANALYTICS_ID_STORAGE_KEY } from "@/lib/analytics/analyticsId";
import { resetDedupeState } from "@/lib/analytics/dedupe";
import { FLUSH_INTERVAL_MS } from "@/lib/analytics/httpAdapter";

const fetchMock = vi.fn();
const survey = { rating: 5, text: "ok", email: "" };

const enableEnv = () => {
  window.__RQ_ANALYTICS_E2E__ = true;
};

const NAV_KEYS = ["doNotTrack", "globalPrivacyControl"];
const setNavigator = (props: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { configurable: true, value });
  }
};

describe("adapter module", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDedupeState();
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    delete window.__RQ_ANALYTICS_E2E__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAnalyticsForTests();
    delete window.__RQ_ANALYTICS_E2E__;
    for (const key of NAV_KEYS) Reflect.deleteProperty(navigator, key);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("disabled by environment", () => {
    it("makes no network call and writes no id when analytics is off by default", async () => {
      initAnalytics();
      track("collection_created");
      captureError({ message: "m", type: "E", frames: "f", source: "window" });
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(localStorage.getItem(ANALYTICS_ID_STORAGE_KEY)).toBeNull();
    });

    it("makes no survey call when the environment gate is closed", async () => {
      submitSurvey(survey);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps the noop adapter when the flag is missing even if track is called before init", async () => {
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("enabled", () => {
    it("sends tracked events once the HTTP adapter is selected", async () => {
      enableEnv();
      initAnalytics();
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.events[0].name).toBe("collection_created");
    });

    it("sends captured errors", async () => {
      enableEnv();
      initAnalytics();
      captureError({ message: "boom", type: "E", frames: "f", source: "boundary" });
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.events[0].name).toBe("$exception");
    });

    it("ignores repeated init calls and does not create a second adapter", async () => {
      enableEnv();
      initAnalytics();
      initAnalytics();
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not re-enable on a later init after the environment changes", async () => {
      initAnalytics();
      enableEnv();
      initAnalytics();
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps the same HTTP adapter when setEnabled(true) is called again", async () => {
      enableEnv();
      initAnalytics();
      track("collection_created");
      setEnabled(true);
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("toggle", () => {
    it("drops the queue and the analytics id when disabled via setEnabled(false)", async () => {
      enableEnv();
      initAnalytics();
      track("collection_created");
      localStorage.setItem(ANALYTICS_ID_STORAGE_KEY, "abc");
      setEnabled(false);
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(localStorage.getItem(ANALYTICS_ID_STORAGE_KEY)).toBeNull();
    });

    it("clears the id even when the adapter was already noop", () => {
      localStorage.setItem(ANALYTICS_ID_STORAGE_KEY, "abc");
      setEnabled(false);
      expect(localStorage.getItem(ANALYTICS_ID_STORAGE_KEY)).toBeNull();
    });

    it("can be turned back on after being turned off", async () => {
      enableEnv();
      initAnalytics();
      setEnabled(false);
      setEnabled(true);
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("enables without a prior init when setEnabled(true) is the first call", async () => {
      enableEnv();
      setEnabled(true);
      initAnalytics();
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("user consent gates", () => {
    it.each([
      ["doNotTrack", { doNotTrack: "1" }],
      ["globalPrivacyControl", { globalPrivacyControl: true }],
    ])("stays disabled when %s is set despite the e2e override", async (_n, nav) => {
      setNavigator(nav);
      enableEnv();
      initAnalytics();
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("submitSurvey", () => {
    it("sends without an id when the environment gate is open", async () => {
      enableEnv();
      submitSurvey(survey);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.id).toBeUndefined();
      expect(body.events[0].name).toBe("survey_sent");
    });

    it("skips the user consent gates (DNT, GPC, toggle)", async () => {
      setNavigator({ doNotTrack: "1", globalPrivacyControl: true });
      enableEnv();
      initAnalytics();
      setEnabled(false);
      submitSurvey(survey);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("SSR", () => {
    it("no-ops every entry point when window is undefined", async () => {
      vi.stubGlobal("window", undefined);
      expect(() => {
        initAnalytics();
        setEnabled(true);
        track("collection_created");
        captureError({ message: "m", type: "E", frames: "f", source: "window" });
        submitSurvey(survey);
      }).not.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not mark the module initialized during SSR", async () => {
      vi.stubGlobal("window", undefined);
      initAnalytics();
      vi.unstubAllGlobals();
      vi.stubGlobal("fetch", fetchMock);
      enableEnv();
      initAnalytics();
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("recursion guard", () => {
    it("does not generate events from its own ingest request", async () => {
      enableEnv();
      initAnalytics();
      fetchMock.mockImplementation(async (url: string) => {
        // A wrapped fetch that tracks every request must not recurse on the ingest path.
        if (url !== "/api/ingest") track("request_sent" as never);
        return { status: 204 };
      });
      track("collection_created");
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
