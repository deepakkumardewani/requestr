import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [1, "1s"],
    [59, "59s"],
    [60, "1m 0s"],
    [61, "1m 1s"],
    [3599, "59m 59s"],
    [3600, "1h 0m"],
    [3660, "1h 1m"],
    [7384, "2h 3m"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("floors fractional seconds", () => {
    expect(formatDuration(59.9)).toBe("59s");
  });

  it("clamps negative input to zero", () => {
    expect(formatDuration(-5)).toBe("0s");
  });
});
