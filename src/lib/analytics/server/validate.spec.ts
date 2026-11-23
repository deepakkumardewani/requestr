import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateBatch } from "./validate";

const TS = 1_700_000_000_000;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("validateBatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([null, undefined, "str", 42, [], {}, { events: "nope" }])(
    "returns no events for non-batch input %j",
    (input) => {
      expect(validateBatch(input)).toEqual({ events: [] });
    },
  );

  it("keeps an allowlisted event with valid props and its timestamp", () => {
    const result = validateBatch({
      id: "abc",
      events: [
        {
          name: "app_opened",
          props: { is_first_session: true, days_since_last_bucket: "7-29" },
          ts: TS,
        },
      ],
    });
    expect(result).toEqual({
      id: "abc",
      events: [
        {
          name: "app_opened",
          props: { is_first_session: true, days_since_last_bucket: "7-29" },
          ts: TS,
        },
      ],
    });
  });

  it("drops events whose name is not allowlisted, including prototype keys", () => {
    const result = validateBatch({
      events: [
        { name: "unknown_event", props: {}, ts: TS },
        { name: "constructor", props: {}, ts: TS },
        { name: "__proto__", props: {}, ts: TS },
        { name: 5, props: {}, ts: TS },
        "junk",
        null,
      ],
    });
    expect(result.events).toEqual([]);
  });

  it("drops unknown props and prototype-key props", () => {
    const result = validateBatch({
      events: [
        {
          name: "relay_opened",
          props: { url: "https://x.test", constructor: "x", email: "a@b.c" },
          ts: TS,
        },
      ],
    });
    expect(result.events[0].props).toEqual({});
  });

  it("drops props whose value has the wrong type or is out of the enum", () => {
    const result = validateBatch({
      events: [
        {
          name: "app_opened",
          props: { is_first_session: "yes", days_since_last_bucket: "99" },
          ts: TS,
        },
        { name: "tour_step_viewed", props: { step_id: "url_bar", index: 1.5 } },
        { name: "tour_step_viewed", props: { step_id: 7, index: 2 } },
      ],
    });
    expect(result.events.map((e) => e.props)).toEqual([
      {},
      { step_id: "url_bar" },
      { index: 2 },
    ]);
  });

  it("accepts common props on any event and rejects bad ones", () => {
    const result = validateBatch({
      events: [
        {
          name: "relay_opened",
          props: { theme: "dark", viewport_class: "phone", locale: "en" },
          ts: TS,
        },
      ],
    });
    expect(result.events[0].props).toEqual({ theme: "dark", locale: "en" });
  });

  it("drops the whole event when a string prop is oversize", () => {
    const result = validateBatch({
      events: [
        { name: "whats_new_shown", props: { version: "v".repeat(65) }, ts: TS },
        { name: "whats_new_shown", props: { version: "v".repeat(64) }, ts: TS },
      ],
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].props).toEqual({ version: "v".repeat(64) });
  });

  it("falls back to the current time when ts is missing or not finite", () => {
    const result = validateBatch({
      events: [
        { name: "relay_opened" },
        { name: "relay_opened", props: {}, ts: Number.POSITIVE_INFINITY },
        { name: "relay_opened", props: {}, ts: "1" },
        { name: "relay_opened", props: {}, ts: TS + 0.5 },
      ],
    });
    expect(result.events.map((e) => e.ts)).toEqual([TS, TS, TS, TS]);
  });

  it("replaces stale timestamps older than 24h with the current time", () => {
    const result = validateBatch({
      events: [
        { name: "relay_opened", props: {}, ts: TS - 24 * HOUR_MS - 1 },
        { name: "relay_opened", props: {}, ts: 0 },
      ],
    });
    expect(result.events.map((e) => e.ts)).toEqual([TS, TS]);
  });

  it("replaces timestamps more than 5 minutes in the future", () => {
    const result = validateBatch({
      events: [
        { name: "relay_opened", props: {}, ts: TS + 5 * MINUTE_MS + 1 },
        { name: "relay_opened", props: {}, ts: TS + 365 * 24 * HOUR_MS },
      ],
    });
    expect(result.events.map((e) => e.ts)).toEqual([TS, TS]);
  });

  it("keeps timestamps exactly on the window boundaries", () => {
    const oldest = TS - 24 * HOUR_MS;
    const newest = TS + 5 * MINUTE_MS;
    const result = validateBatch({
      events: [
        { name: "relay_opened", props: {}, ts: oldest },
        { name: "relay_opened", props: {}, ts: newest },
      ],
    });
    expect(result.events.map((e) => e.ts)).toEqual([oldest, newest]);
  });

  it("treats non-record props as empty", () => {
    const result = validateBatch({
      events: [{ name: "relay_opened", props: ["a"], ts: TS }],
    });
    expect(result.events[0].props).toEqual({});
  });

  it("omits the id when missing, non-string or longer than 64 chars", () => {
    expect(validateBatch({ events: [] })).toEqual({ events: [] });
    expect(validateBatch({ id: 5, events: [] })).toEqual({ events: [] });
    expect(validateBatch({ id: "i".repeat(65), events: [] })).toEqual({
      events: [],
    });
    expect(validateBatch({ id: "i".repeat(64), events: [] }).id).toBe(
      "i".repeat(64),
    );
  });

  it("keeps the exception and survey shapes", () => {
    const result = validateBatch({
      events: [
        {
          name: "$exception",
          props: {
            message: "boom",
            type: "TypeError",
            frames: "a.js:1\nb.js:2",
            source: "window",
          },
          ts: TS,
        },
        {
          name: "survey_sent",
          props: { rating: 4, text: "nice", email: "a@b.co" },
          ts: TS,
        },
      ],
    });
    expect(result.events.map((e) => e.name)).toEqual([
      "$exception",
      "survey_sent",
    ]);
    expect(result.events[1].props).toEqual({
      rating: 4,
      text: "nice",
      email: "a@b.co",
    });
  });
});
