import { describe, expect, it } from "vitest";
import {
  COMPARISON_ROWS,
  countEmphasis,
} from "./comparison";

describe("comparison data", () => {
  it("defines three columns and sources per row", () => {
    for (const row of COMPARISON_ROWS) {
      expect(row.requestr).toBeTruthy();
      expect(row.postman).toBeTruthy();
      expect(row.insomnia).toBeTruthy();
      expect(row.sources.length).toBeGreaterThan(0);
    }
  });

  it("includes a supported protocols row with Socket.IO for all three", () => {
    const protocols = COMPARISON_ROWS.find((r) =>
      r.feature.toLowerCase().includes("protocol"),
    );
    expect(protocols).toBeDefined();
    expect(protocols!.requestr).toMatch(/Socket\.IO/i);
    expect(protocols!.postman).toMatch(/Socket\.IO/i);
    expect(protocols!.insomnia).toMatch(/Socket\.IO/i);
  });

  it("is not an all-wins strawman for Requestr", () => {
    const requestrWins = countEmphasis("requestr");
    const neutralRows = COMPARISON_ROWS.filter((r) => r.emphasis === null).length;
    expect(neutralRows).toBeGreaterThanOrEqual(3);
    expect(requestrWins).toBeLessThan(COMPARISON_ROWS.length);
  });

  it("covers required comparison axes", () => {
    const features = COMPARISON_ROWS.map((r) => r.feature.toLowerCase());
    expect(features.some((f) => f.includes("install"))).toBe(true);
    expect(features.some((f) => f.includes("account"))).toBe(true);
    expect(features.some((f) => f.includes("data location"))).toBe(true);
    expect(features.some((f) => f.includes("time to first"))).toBe(true);
    expect(features.some((f) => f.includes("cors"))).toBe(true);
    expect(features.some((f) => f.includes("protocol"))).toBe(true);
    expect(features.some((f) => f.includes("pricing"))).toBe(true);
    expect(features.some((f) => f.includes("real-time"))).toBe(true);
  });
});
