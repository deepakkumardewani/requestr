// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initAnalytics,
  captureError,
  captureScrubbedError,
  installErrorCapture,
  resetAnalyticsForTests,
  SESSION_ERROR_CAP,
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

describe("error capture", () => {
  const ingestedErrors = (): string[] =>
    fetchMock.mock.calls.flatMap(
      (call) =>
        (
          JSON.parse(call[1].body as string) as {
            events: { name: string }[];
          }
        ).events,
    ).filter((e) => e.name === "$exception").map((e) => JSON.stringify(e));

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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const flush = () => vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

  it("reports the same error fingerprint only once per session", async () => {
    enableEnv();
    initAnalytics();
    const record = { message: "same", type: "E", frames: "a.ts:1", source: "window" } as const;
    captureError(record);
    captureError({ ...record });
    await flush();
    expect(ingestedErrors()).toHaveLength(1);
  });

  it("reports errors that differ in message, type or frames separately", async () => {
    enableEnv();
    initAnalytics();
    captureError({ message: "a", type: "E", frames: "f:1", source: "window" });
    captureError({ message: "b", type: "E", frames: "f:1", source: "window" });
    captureError({ message: "a", type: "F", frames: "f:1", source: "window" });
    captureError({ message: "a", type: "E", frames: "f:2", source: "window" });
    await flush();
    expect(ingestedErrors()).toHaveLength(4);
  });

  it("caps distinct errors at SESSION_ERROR_CAP per session", async () => {
    enableEnv();
    initAnalytics();
    for (let i = 0; i < SESSION_ERROR_CAP + 5; i += 1) {
      captureError({ message: `m${i}`, type: "E", frames: "", source: "window" });
    }
    await flush();
    expect(SESSION_ERROR_CAP).toBe(10);
    expect(ingestedErrors()).toHaveLength(10);
  });

  it("captures nothing when the toggle is off", async () => {
    enableEnv();
    initAnalytics();
    setEnabled(false);
    captureScrubbedError(new Error("x"), "window");
    captureError({ message: "y", type: "E", frames: "", source: "window" });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("captures nothing under DNT", async () => {
    setNavigator({ doNotTrack: "1" });
    enableEnv();
    initAnalytics();
    captureScrubbedError(new Error("x"), "boundary");
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "doNotTrack");
  });

  it("does not spend the dedupe slot while opted out", async () => {
    enableEnv();
    initAnalytics();
    setEnabled(false);
    captureScrubbedError(new Error("again"), "window");
    setEnabled(true);
    captureScrubbedError(new Error("again"), "window");
    await flush();
    expect(ingestedErrors()).toHaveLength(1);
  });

  it("scrubs the error before it is sent", async () => {
    enableEnv();
    initAnalytics();
    captureScrubbedError(
      new Error("failed https://api.private-host.com/v1?token=abc"),
      "boundary",
    );
    await flush();
    const [entry] = ingestedErrors();
    expect(entry).toContain("[message withheld]");
    expect(entry).not.toContain("private-host");
    expect(entry).not.toContain("token=abc");
  });

  it("does not capture during SSR", () => {
    vi.stubGlobal("window", undefined);
    expect(() => {
      captureScrubbedError(new Error("x"), "window");
    }).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs and survives a scrub failure without capturing it", async () => {
    enableEnv();
    initAnalytics();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hostile = {
      get message(): string {
        throw new Error("getter");
      },
    };
    Object.setPrototypeOf(hostile, Error.prototype);
    captureScrubbedError(hostile, "window");
    await flush();
    expect(warn).toHaveBeenCalledWith(
      "[requestly] analytics: error scrub failed",
      expect.any(Error),
    );
    expect(ingestedErrors()).toHaveLength(0);
  });

  it("never re-captures an error raised inside the analytics module", async () => {
    vi.resetModules();
    const sent: string[] = [];
    let fresh: typeof import("@/lib/analytics/adapter");
    vi.doMock("@/lib/analytics/httpAdapter", () => ({
      createHttpAdapter: () => ({
        track: vi.fn(),
        setEnabled: vi.fn(),
        submitSurvey: vi.fn(),
        captureError: (record: { message: string }) => {
          sent.push(record.message);
          // A failure inside the analytics module tries to report itself.
          fresh.captureScrubbedError(new Error("nested one"), "window");
          fresh.captureError({
            message: "nested two",
            type: "E",
            frames: "",
            source: "window",
          });
          throw new Error("adapter failed");
        },
      }),
      sendSurvey: vi.fn(),
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    enableEnv();
    fresh = await import("@/lib/analytics/adapter");
    fresh.initAnalytics();
    fresh.captureError({ message: "outer", type: "E", frames: "", source: "window" });
    vi.doUnmock("@/lib/analytics/httpAdapter");
    expect(sent).toEqual(["outer"]);
    expect(warn).toHaveBeenCalledWith(
      "[requestly] analytics: error capture failed",
      expect.any(Error),
    );
    // The guard is released afterwards, so later distinct errors flow again.
    fresh.captureError({ message: "later", type: "E", frames: "", source: "window" });
    expect(sent).toEqual(["outer", "later"]);
    fresh.resetAnalyticsForTests();
  });

  describe("installErrorCapture", () => {
    it("captures one window error event as a window-source exception", async () => {
      enableEnv();
      initAnalytics();
      const cleanup = installErrorCapture();
      window.dispatchEvent(
        new ErrorEvent("error", { error: new TypeError("Failed to fetch") }),
      );
      await flush();
      cleanup();
      const entries = ingestedErrors();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toContain("Failed to fetch");
      expect(entries[0]).toContain("window");
    });

    it("falls back to the event message when there is no error object", async () => {
      enableEnv();
      initAnalytics();
      const cleanup = installErrorCapture();
      window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
      await flush();
      cleanup();
      expect(ingestedErrors()[0]).toContain("Script error.");
    });

    it("captures one unhandled rejection as a promise-source exception", async () => {
      enableEnv();
      initAnalytics();
      const cleanup = installErrorCapture();
      const event = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(event, "reason", { value: new Error("Load failed") });
      window.dispatchEvent(event);
      await flush();
      cleanup();
      const entries = ingestedErrors();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toContain("Load failed");
      expect(entries[0]).toContain("promise");
    });

    it("sends nothing when opted out", async () => {
      enableEnv();
      initAnalytics();
      setEnabled(false);
      const cleanup = installErrorCapture();
      window.dispatchEvent(new ErrorEvent("error", { error: new Error("x") }));
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
      cleanup();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("stops capturing after cleanup", async () => {
      enableEnv();
      initAnalytics();
      installErrorCapture()();
      window.dispatchEvent(new ErrorEvent("error", { error: new Error("x") }));
      await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns a no-op cleanup during SSR", () => {
      vi.stubGlobal("window", undefined);
      const cleanup = installErrorCapture();
      expect(cleanup).toBeTypeOf("function");
      expect(() => cleanup()).not.toThrow();
    });
  });
});
