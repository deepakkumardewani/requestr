import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime";

describe("formatRelativeTime", () => {
  // ============================================================================
  // Seven example mappings (one per output unit)
  // ============================================================================

  it("returns 'now' for timestamps within the last minute", () => {
    const now = 1_000_000;
    const timestamp = now - 30_000; // 30 seconds ago
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "now",
      value: 0,
    });
  });

  it("returns 'minutes' with correct count", () => {
    const now = 1_000_000;
    const timestamp = now - 2 * 60 * 1_000; // 2 minutes ago
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "minutes",
      value: 2,
    });
  });

  it("returns 'hours' with correct count", () => {
    const now = 1_000_000;
    const timestamp = now - 3 * 60 * 60 * 1_000; // 3 hours ago
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "hours",
      value: 3,
    });
  });

  it("returns 'days' with correct count", () => {
    const now = 1_000_000;
    const timestamp = now - 3 * 24 * 60 * 60 * 1_000; // 3 days ago
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "days",
      value: 3,
    });
  });

  it("returns 'weeks' with correct count", () => {
    const now = 1_000_000;
    const timestamp = now - 15 * 24 * 60 * 60 * 1_000; // 15 days ago = 2 weeks
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "weeks",
      value: 2,
    });
  });

  it("returns 'months' with correct count", () => {
    const now = 1_000_000;
    const timestamp = now - 60 * 24 * 60 * 60 * 1_000; // 60 days ago = 2 months
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "months",
      value: 2,
    });
  });

  it("returns 'years' with correct count", () => {
    const now = 1_000_000;
    const timestamp = now - 400 * 24 * 60 * 60 * 1_000; // 400 days ago = 1 year
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "years",
      value: 1,
    });
  });

  // ============================================================================
  // Boundary pairs: exact threshold transitions
  // ============================================================================

  it("boundary: 59s is 'now', 60s is 1 minute", () => {
    const now = 1_000_000;

    // 59 seconds: should be "now"
    expect(formatRelativeTime(now - 59_000, now)).toEqual({
      unit: "now",
      value: 0,
    });

    // 60 seconds: should be 1 minute
    expect(formatRelativeTime(now - 60_000, now)).toEqual({
      unit: "minutes",
      value: 1,
    });
  });

  it("boundary: 59m 59s is minutes, 60m is hours", () => {
    const now = 1_000_000;

    // 59 minutes 59 seconds
    const fiftyNineMinFiftyNineSec = 59 * 60 * 1_000 + 59 * 1_000;
    expect(formatRelativeTime(now - fiftyNineMinFiftyNineSec, now)).toEqual({
      unit: "minutes",
      value: 59,
    });

    // 60 minutes (1 hour)
    expect(formatRelativeTime(now - 60 * 60 * 1_000, now)).toEqual({
      unit: "hours",
      value: 1,
    });
  });

  it("boundary: 23h 59m is hours, 24h is days", () => {
    const now = 1_000_000;

    // 23 hours 59 minutes
    const twentyThreeHoursFiftyNineMin = 23 * 60 * 60 * 1_000 + 59 * 60 * 1_000;
    expect(formatRelativeTime(now - twentyThreeHoursFiftyNineMin, now)).toEqual({
      unit: "hours",
      value: 23,
    });

    // 24 hours (1 day)
    expect(formatRelativeTime(now - 24 * 60 * 60 * 1_000, now)).toEqual({
      unit: "days",
      value: 1,
    });
  });

  it("boundary: 6 days is days, 7 days is weeks", () => {
    const now = 1_000_000;

    // 6 days
    expect(formatRelativeTime(now - 6 * 24 * 60 * 60 * 1_000, now)).toEqual({
      unit: "days",
      value: 6,
    });

    // 7 days (1 week)
    expect(formatRelativeTime(now - 7 * 24 * 60 * 60 * 1_000, now)).toEqual({
      unit: "weeks",
      value: 1,
    });
  });

  it("boundary: 29 days is weeks, 30 days is months", () => {
    const now = 1_000_000;

    // 29 days = 4 weeks (29 / 7 = 4.14, floored)
    expect(formatRelativeTime(now - 29 * 24 * 60 * 60 * 1_000, now)).toEqual({
      unit: "weeks",
      value: 4,
    });

    // 30 days = 1 month
    expect(formatRelativeTime(now - 30 * 24 * 60 * 60 * 1_000, now)).toEqual({
      unit: "months",
      value: 1,
    });
  });

  it("boundary: 364 days is months, 365 days is years", () => {
    const now = 1_000_000;

    // 364 days = 12 months (364 / 30 = 12.13, floored)
    expect(formatRelativeTime(now - 364 * 24 * 60 * 60 * 1_000, now)).toEqual({
      unit: "months",
      value: 12,
    });

    // 365 days (1 year)
    expect(formatRelativeTime(now - 365 * 24 * 60 * 60 * 1_000, now)).toEqual({
      unit: "years",
      value: 1,
    });
  });

  // ============================================================================
  // Negative skew (clock skew: future timestamps)
  // ============================================================================

  it("clamps future timestamps (negative elapsed) to 'now'", () => {
    const now = 1_000_000;
    const futureTimestamp = now + 5_000; // 5 seconds in the future
    expect(formatRelativeTime(futureTimestamp, now)).toEqual({
      unit: "now",
      value: 0,
    });
  });

  it("clamps large future timestamps to 'now'", () => {
    const now = 1_000_000;
    const farFutureTimestamp = now + 100_000; // 100 seconds in the future
    expect(formatRelativeTime(farFutureTimestamp, now)).toEqual({
      unit: "now",
      value: 0,
    });
  });

  // ============================================================================
  // Zero elapsed (same timestamp)
  // ============================================================================

  it("returns 'now' when timestamp equals now", () => {
    const now = 1_000_000;
    expect(formatRelativeTime(now, now)).toEqual({
      unit: "now",
      value: 0,
    });
  });

  // ============================================================================
  // Very large values (edge cases for extreme ages)
  // ============================================================================

  it("handles very large elapsed time (1000 years old)", () => {
    const now = 1_000_000;
    const timestamp = now - 1000 * 365 * 24 * 60 * 60 * 1_000;
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "years",
      value: 1000,
    });
  });

  it("handles realistic historical timestamp (year 2000)", () => {
    const now = new Date(2020, 0, 1).getTime(); // Jan 1, 2020
    const timestamp = new Date(2000, 0, 1).getTime(); // Jan 1, 2000
    const result = formatRelativeTime(timestamp, now);
    expect(result.unit).toBe("years");
    expect(result.value).toBe(20);
  });

  // ============================================================================
  // Default now parameter
  // ============================================================================

  it("uses Date.now() when now parameter is omitted", () => {
    const timestamp = Date.now() - 2 * 60 * 1_000; // 2 minutes ago
    const result = formatRelativeTime(timestamp);
    expect(result.unit).toBe("minutes");
    expect(result.value).toBe(2);
  });

  // ============================================================================
  // Floor behavior (no rounding up)
  // ============================================================================

  it("floors fractional minutes (1m 59s → 1 minute)", () => {
    const now = 1_000_000;
    const timestamp = now - (60 * 1_000 + 59 * 1_000); // 1m 59s
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "minutes",
      value: 1,
    });
  });

  it("floors fractional hours (1h 59m → 1 hour)", () => {
    const now = 1_000_000;
    const timestamp = now - (60 * 60 * 1_000 + 59 * 60 * 1_000);
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "hours",
      value: 1,
    });
  });

  it("floors fractional weeks (1.9 weeks → 1 week)", () => {
    const now = 1_000_000;
    const days = 7 + 6; // 13 days = 1.857 weeks
    const timestamp = now - days * 24 * 60 * 60 * 1_000;
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "weeks",
      value: 1,
    });
  });

  it("floors fractional months (2.9 months → 2 months)", () => {
    const now = 1_000_000;
    const days = 30 + 27; // 57 days = 1.9 months
    const timestamp = now - days * 24 * 60 * 60 * 1_000;
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "months",
      value: 1,
    });
  });

  it("floors fractional years (1.9 years → 1 year)", () => {
    const now = 1_000_000;
    const days = 365 + 328; // 693 days = 1.899 years
    const timestamp = now - days * 24 * 60 * 60 * 1_000;
    expect(formatRelativeTime(timestamp, now)).toEqual({
      unit: "years",
      value: 1,
    });
  });

  // ============================================================================
  // Additional edge cases
  // ============================================================================

  it("returns value 0 for 'now' unit (never 1)", () => {
    const now = 1_000_000;
    const timestamp = now - 45_000; // 45 seconds ago
    const result = formatRelativeTime(timestamp, now);
    expect(result.unit).toBe("now");
    expect(result.value).toBe(0);
  });

  it("handles zero timestamp (Unix epoch relative to a far future now)", () => {
    const now = 50 * 365 * 24 * 60 * 60 * 1_000; // 50 years in milliseconds
    const result = formatRelativeTime(0, now);
    expect(result.unit).toBe("years");
    expect(result.value).toBe(50);
  });
});
