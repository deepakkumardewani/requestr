import { describe, expect, it } from "vitest";
import {
  ROLL_STAGGER_MS,
  rollDigits,
  stripOffsetPercent,
  toDigits,
} from "./digits";

describe("toDigits", () => {
  it("splits a code into its three digits", () => {
    expect(toDigits(428)).toEqual([4, 2, 8]);
    expect(toDigits(101)).toEqual([1, 0, 1]);
  });

  it.each([42, 1000, 20.5, -100])("rejects %d", (code) => {
    expect(() => toDigits(code)).toThrow(RangeError);
  });
});

describe("rollDigits", () => {
  it("keeps unchanged columns still", () => {
    expect(rollDigits(200, 204)).toEqual([
      { digit: 2, changed: false, delayMs: 0 },
      { digit: 0, changed: false, delayMs: 0 },
      { digit: 4, changed: true, delayMs: 0 },
    ]);
  });

  it("staggers changed columns left to right, counting only changed ones", () => {
    const rolls = rollDigits(207, 401);
    expect(rolls.map((roll) => roll.changed)).toEqual([true, false, true]);
    expect(rolls.map((roll) => roll.delayMs)).toEqual([0, 0, ROLL_STAGGER_MS]);
  });

  it("does nothing when the code does not change", () => {
    expect(rollDigits(301, 301).every((roll) => !roll.changed)).toBe(true);
  });
});

describe("stripOffsetPercent", () => {
  it("moves the 0-9 strip one tenth per digit", () => {
    expect(stripOffsetPercent(0)).toBe(-0);
    expect(stripOffsetPercent(4)).toBe(-40);
    expect(stripOffsetPercent(9)).toBe(-90);
  });
});
