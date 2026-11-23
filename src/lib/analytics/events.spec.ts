import { describe, expect, it } from "vitest";
import {
  BUCKETS,
  bucketCount,
  bucketDuration,
  COMMON_PROPS,
  EVENT_ALLOWLIST,
  EVENT_SCHEMA,
  EXCEPTION_EVENT,
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_SHORT_STRING_LENGTH,
  MAX_SURVEY_TEXT_LENGTH,
  SURVEY_EVENT,
} from "./events";

describe("bucketDuration", () => {
  it.each([
    [0, "<100ms"],
    [99, "<100ms"],
    [100, "<500ms"],
    [499, "<500ms"],
    [500, "<2s"],
    [1999, "<2s"],
    [2000, "2s+"],
    [60_000, "2s+"],
  ])("maps %i ms to %s", (ms, expected) => {
    expect(bucketDuration(ms)).toBe(expected);
  });

  it("treats a negative duration as the fastest bucket", () => {
    expect(bucketDuration(-5)).toBe("<100ms");
  });
});

describe("bucketCount", () => {
  it.each([
    [-1, "0"],
    [0, "0"],
    [1, "1-5"],
    [5, "1-5"],
    [6, "6-20"],
    [20, "6-20"],
    [21, "21-100"],
    [100, "21-100"],
    [101, "100+"],
    [5000, "100+"],
  ])("maps %i to %s", (count, expected) => {
    expect(bucketCount(count)).toBe(expected);
  });

  it("only ever returns a declared count bucket", () => {
    for (const n of [0, 3, 10, 50, 500]) {
      expect(BUCKETS.count).toContain(bucketCount(n));
    }
  });
});

describe("event schema", () => {
  it("exposes the allowlist as the same structure the client uses", () => {
    expect(EVENT_ALLOWLIST).toBe(EVENT_SCHEMA);
  });

  it("includes the exception and survey events under their wire names", () => {
    expect(EXCEPTION_EVENT).toBe("$exception");
    expect(SURVEY_EVENT).toBe("survey_sent");
    expect(Object.keys(EVENT_ALLOWLIST)).toEqual(
      expect.arrayContaining(["$exception", "survey_sent", "app_opened"]),
    );
  });

  it("gives every enum prop a non-empty, unique value list", () => {
    for (const props of Object.values(EVENT_ALLOWLIST)) {
      for (const def of Object.values(props)) {
        if (def.kind !== "enum") continue;
        expect(def.values.length).toBeGreaterThan(0);
        expect(new Set(def.values).size).toBe(def.values.length);
      }
    }
  });

  it("bounds every string prop with a positive max length", () => {
    for (const props of [...Object.values(EVENT_ALLOWLIST), COMMON_PROPS]) {
      for (const def of Object.values(props)) {
        if (def.kind === "string") {
          expect(def.maxLength).toBeGreaterThan(0);
        }
      }
    }
  });

  it("uses the documented length caps for errors and surveys", () => {
    const exception = EVENT_ALLOWLIST[EXCEPTION_EVENT];
    const survey = EVENT_ALLOWLIST[SURVEY_EVENT];
    expect(exception.message).toEqual({
      kind: "string",
      maxLength: MAX_ERROR_MESSAGE_LENGTH,
    });
    expect(MAX_ERROR_MESSAGE_LENGTH).toBe(300);
    expect(survey.text).toEqual({
      kind: "string",
      maxLength: MAX_SURVEY_TEXT_LENGTH,
    });
    expect(MAX_SURVEY_TEXT_LENGTH).toBe(2000);
    expect(MAX_SHORT_STRING_LENGTH).toBe(64);
  });

  it("allows no props for parameterless events", () => {
    expect(EVENT_ALLOWLIST.collection_created).toEqual({});
    expect(EVENT_ALLOWLIST.relay_opened).toEqual({});
  });

  it("restricts relay_error codes to the known relay error codes", () => {
    const def = EVENT_ALLOWLIST.relay_error.code;
    expect(def.kind === "enum" && def.values).toEqual([
      "relay_unavailable",
      "rate_limited",
      "offline",
      "context_too_long",
      "tool_failed",
      "aborted",
      "not_configured",
    ]);
  });

  it("never lets a prop carry free-form URL, id or path data", () => {
    const forbidden = ["url", "path_raw", "ip", "user_id", "email_address"];
    for (const props of Object.values(EVENT_ALLOWLIST)) {
      for (const name of Object.keys(props)) {
        expect(forbidden).not.toContain(name);
      }
    }
  });
});
