import { describe, expect, it } from "vitest";
import {
  clampDetailRatio,
  clampListWidth,
  DEFAULT_RUN_LOG_DETAIL_RATIO,
  DEFAULT_RUN_LOG_LIST_WIDTH,
} from "./runLogLayout";

describe("clampListWidth", () => {
  it("passes in-range values through", () => {
    expect(clampListWidth(300)).toBe(300);
  });
  it("clamps to 200..420", () => {
    expect(clampListWidth(50)).toBe(200);
    expect(clampListWidth(900)).toBe(420);
  });
  it("caps at 50% of the dock when known", () => {
    expect(clampListWidth(400, 600)).toBe(300);
  });
  it("never goes below the minimum even in a tiny dock", () => {
    expect(clampListWidth(300, 200)).toBe(200);
  });
  it("ignores a non-finite dock width", () => {
    expect(clampListWidth(300, NaN)).toBe(300);
  });
  it("falls back to default for NaN/Infinity", () => {
    expect(clampListWidth(NaN)).toBe(DEFAULT_RUN_LOG_LIST_WIDTH);
    expect(clampListWidth(Infinity)).toBe(DEFAULT_RUN_LOG_LIST_WIDTH);
  });
});

describe("clampDetailRatio", () => {
  it("passes in-range values through", () => {
    expect(clampDetailRatio(0.4)).toBe(0.4);
  });
  it("clamps to 0.25..0.75", () => {
    expect(clampDetailRatio(0.1)).toBe(0.25);
    expect(clampDetailRatio(0.9)).toBe(0.75);
  });
  it("falls back to default for NaN", () => {
    expect(clampDetailRatio(NaN)).toBe(DEFAULT_RUN_LOG_DETAIL_RATIO);
  });
});
