import { describe, expect, it } from "vitest";
import {
  bandProgress,
  blockAngles,
  FLIP_END_DEG,
  FLIP_START_DEG,
  flipAmount,
  pointerOffset,
} from "./flip";
import { railProgress, tickPosition } from "./railProgress";

describe("railProgress", () => {
  const order = ["a", "b", "c", "d"];
  const tops = [
    { id: "a", top: -100 },
    { id: "b", top: 300 },
    { id: "c", top: 700 },
    { id: "d", top: 1100 },
  ];

  it("gives each section an equal slice of the rail", () => {
    expect(railProgress(order, tops, { line: 100, end: 1500 })).toBeCloseTo(
      0.5 / 4,
    );
    expect(railProgress(order, tops, { line: 500, end: 1500 })).toBeCloseTo(
      1.5 / 4,
    );
  });

  it("uses the page end for the last section and stops at 1", () => {
    expect(railProgress(order, tops, { line: 1300, end: 1500 })).toBeCloseTo(
      3.5 / 4,
    );
    expect(railProgress(order, tops, { line: 9000, end: 1500 })).toBe(1);
  });

  it("is 0 above the first section", () => {
    expect(railProgress(order, tops, { line: -200, end: 1500 })).toBe(0);
  });

  it("keeps slots by id when a lazy section has not mounted yet", () => {
    const withoutB = tops.filter((section) => section.id !== "b");
    expect(railProgress(order, withoutB, { line: 700, end: 1500 })).toBe(
      2 / 4,
    );
  });
});

describe("tickPosition", () => {
  it("spaces ticks evenly from the top", () => {
    expect([0, 1, 2, 3].map((i) => tickPosition(i, 4))).toEqual([
      0, 0.25, 0.5, 0.75,
    ]);
    expect(tickPosition(0, 0)).toBe(0);
  });
});

describe("bandProgress", () => {
  it("runs from 0 as the band enters to 1 as it leaves", () => {
    expect(bandProgress({ top: 800, height: 400 }, 800)).toBe(0);
    expect(bandProgress({ top: 200, height: 400 }, 800)).toBe(0.5);
    expect(bandProgress({ top: -400, height: 400 }, 800)).toBe(1);
    expect(bandProgress({ top: -2000, height: 400 }, 800)).toBe(1);
  });
});

describe("flipAmount and blockAngles", () => {
  it("holds the first face, flips through the middle, then holds the second", () => {
    expect(flipAmount(0.2)).toBe(0);
    expect(flipAmount(0.5)).toBeCloseTo(0.5);
    expect(flipAmount(0.9)).toBe(1);
  });

  it("is edge-on halfway through the flip", () => {
    expect(blockAngles(0).rotateY).toBe(FLIP_START_DEG);
    expect(blockAngles(0.5).rotateY).toBeCloseTo(90);
    expect(blockAngles(1).rotateY).toBe(FLIP_END_DEG);
  });
});

describe("pointerOffset", () => {
  const rect = { left: 100, top: 100, width: 200, height: 100 };

  it("maps the element to -1..1 with 0 at the centre", () => {
    expect(pointerOffset({ x: 200, y: 150 }, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerOffset({ x: 100, y: 100 }, rect)).toEqual({ x: -1, y: -1 });
    expect(pointerOffset({ x: 900, y: 900 }, rect)).toEqual({ x: 1, y: 1 });
  });

  it("is centred for an element with no size", () => {
    expect(
      pointerOffset({ x: 5, y: 5 }, { left: 0, top: 0, width: 0, height: 0 }),
    ).toEqual({ x: 0, y: 0 });
  });
});
