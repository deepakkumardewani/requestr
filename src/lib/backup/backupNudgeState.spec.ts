/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDedupeState } from "@/lib/analytics/dedupe";

const mocks = vi.hoisted(() => ({
  firstSession: false,
  data: {} as Record<string, unknown[]>,
  readError: null as Error | null,
  collect: vi.fn(),
}));

vi.mock("@/lib/prompts/sessionTracker", () => ({
  isFirstSession: () => mocks.firstSession,
}));
vi.mock("@/lib/backup/exporter", () => ({
  collectBackupData: (...args: unknown[]) => {
    mocks.collect(...args);
    return mocks.readError
      ? Promise.reject(mocks.readError)
      : Promise.resolve(mocks.data);
  },
}));

type StateModule = typeof import("./backupNudgeState");

const NOW = new Date("2026-06-10T12:00:00").getTime();
const DAY = 24 * 60 * 60 * 1000;
const LAST_EXPORT_KEY = "rq_last_backup_export";
const SNOOZED_KEY = "rq_backup_nudge_snoozed_at";

const requests = (count: number, collectionId = "c1") =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, collectionId }));

let state: StateModule;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  const dedupe = await import("@/lib/analytics/dedupe");
  dedupe.resetDedupeState();
  mocks.firstSession = false;
  mocks.readError = null;
  mocks.data = { requests: requests(5), collections: [], chains: [] };
  mocks.collect.mockClear();
  state = await import("./backupNudgeState");
});

afterEach(() => {
  vi.restoreAllMocks();
  resetDedupeState();
});

describe("shouldShowBackupNudge data thresholds", () => {
  it("shows with exactly 5 requests", async () => {
    mocks.data = { requests: requests(5), collections: [], chains: [] };
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
  });

  it("does not show with 4 requests and no chain or populated collection", async () => {
    mocks.data = {
      requests: requests(4, "orphan"),
      collections: [{ id: "c1" }],
      chains: [],
    };
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });

  it("shows with a single chain", async () => {
    mocks.data = { requests: [], collections: [], chains: [{ id: "h1" }] };
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
  });

  it("shows with one collection that holds a request", async () => {
    mocks.data = {
      requests: requests(1, "c1"),
      collections: [{ id: "c1" }],
      chains: [],
    };
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
  });

  it("does not show for an empty collection", async () => {
    mocks.data = { requests: [], collections: [{ id: "c1" }], chains: [] };
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });

  it("does not show when the data sections are missing", async () => {
    mocks.data = {};
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });

  it("reads only the collections and chains sections", async () => {
    await state.shouldShowBackupNudge(NOW);
    expect(mocks.collect).toHaveBeenCalledWith(["collections", "chains"]);
  });
});

describe("shouldShowBackupNudge timing rules", () => {
  it("does not show in the first session", async () => {
    mocks.firstSession = true;
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
    expect(mocks.collect).not.toHaveBeenCalled();
  });

  it("does not show within 30 days of an export", async () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(NOW - 30 * DAY + 1));
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });

  it("shows again once 30 days have passed since the export", async () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(NOW - 30 * DAY));
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
  });

  it("does not show within 14 days of a snooze", async () => {
    localStorage.setItem(SNOOZED_KEY, String(NOW - 14 * DAY + 1));
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });

  it("shows again once 14 days have passed since the snooze", async () => {
    localStorage.setItem(SNOOZED_KEY, String(NOW - 14 * DAY));
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
  });

  it("ignores an unparsable timestamp", async () => {
    localStorage.setItem(LAST_EXPORT_KEY, "not-a-number");
    localStorage.setItem(SNOOZED_KEY, "garbage");
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
  });

  it("ignores a future-dated timestamp so a bad clock cannot suppress forever", async () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(NOW + DAY));
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
  });

  it("re-reads storage on each call so another tab's export counts", async () => {
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
    localStorage.setItem(LAST_EXPORT_KEY, String(NOW - DAY));
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });

  it("re-reads storage on each call so another tab's dismissal counts", async () => {
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
    localStorage.setItem(SNOOZED_KEY, String(NOW - DAY));
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });

  it("uses the current time when none is passed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    localStorage.setItem(LAST_EXPORT_KEY, String(NOW - DAY));
    expect(await state.shouldShowBackupNudge()).toBe(false);
  });
});

describe("shouldShowBackupNudge failure and session handling", () => {
  it("does not show and warns when saved data cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.readError = new Error("restore in progress");
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does not show once the nudge was shown this session", async () => {
    expect(await state.shouldShowBackupNudge(NOW)).toBe(true);
    state.markBackupNudgeShown();
    expect(await state.shouldShowBackupNudge(NOW)).toBe(false);
  });
});

describe("snoozeBackupNudge and recordBackupExport", () => {
  it("snooze stores the timestamp and suppresses the nudge", async () => {
    state.snoozeBackupNudge(NOW);
    expect(localStorage.getItem(SNOOZED_KEY)).toBe(String(NOW));
    expect(await state.shouldShowBackupNudge(NOW + DAY)).toBe(false);
  });

  it("snooze defaults to the current time", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    state.snoozeBackupNudge();
    expect(localStorage.getItem(SNOOZED_KEY)).toBe(String(NOW));
  });

  it("recording an export stores the timestamp and suppresses the nudge", async () => {
    state.recordBackupExport(NOW);
    expect(localStorage.getItem(LAST_EXPORT_KEY)).toBe(String(NOW));
    expect(await state.shouldShowBackupNudge(NOW + 29 * DAY)).toBe(false);
    expect(await state.shouldShowBackupNudge(NOW + 30 * DAY)).toBe(true);
  });

  it("recording an export defaults to the current time", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    state.recordBackupExport();
    expect(localStorage.getItem(LAST_EXPORT_KEY)).toBe(String(NOW));
  });
});
