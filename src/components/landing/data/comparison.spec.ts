import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPARISON_CHECKED_ON,
  COMPARISON_ROWS,
  countEmphasis,
} from "./comparison";

const REPO_ROOT = resolve(__dirname, "../../../..");

describe("comparison data", () => {
  it("defines three non-empty columns per row", () => {
    for (const row of COMPARISON_ROWS) {
      expect(row.requestr.text).toBeTruthy();
      expect(row.postman.text).toBeTruthy();
      expect(row.insomnia.text).toBeTruthy();
    }
  });

  it("gives every competitor cell an https source (AC-28)", () => {
    for (const row of COMPARISON_ROWS) {
      expect(row.postman.source).toMatch(/^https:\/\//);
      expect(row.insomnia.source).toMatch(/^https:\/\//);
    }
  });

  it("points every Requestr cell at a codeRef that exists (AC-29)", () => {
    for (const row of COMPARISON_ROWS) {
      expect(existsSync(resolve(REPO_ROOT, row.requestr.codeRef))).toBe(true);
    }
  });

  it("drops claims the research could not verify", () => {
    const features = COMPARISON_ROWS.map((r) => r.feature.toLowerCase());
    expect(features.some((f) => f.includes("cors"))).toBe(false);
    expect(features.some((f) => f.includes("time to first"))).toBe(false);
  });

  it("reflects the corrected protocol lists", () => {
    const protocols = COMPARISON_ROWS.find((r) => r.feature === "Supported protocols");
    expect(protocols!.insomnia.text).toMatch(/SOAP/);
    expect(protocols!.postman.text).toMatch(/MCP/);
  });

  it("includes a supported protocols row with Socket.IO for all three", () => {
    const protocols = COMPARISON_ROWS.find((r) =>
      r.feature.toLowerCase().includes("protocol"),
    );
    expect(protocols).toBeDefined();
    expect(protocols!.requestr.text).toMatch(/Socket\.IO/i);
    expect(protocols!.postman.text).toMatch(/Socket\.IO/i);
    expect(protocols!.insomnia.text).toMatch(/Socket\.IO/i);
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
    expect(features.some((f) => f.includes("protocol"))).toBe(true);
    expect(features.some((f) => f.includes("pricing"))).toBe(true);
    expect(features.some((f) => f.includes("real-time"))).toBe(true);
  });

  it("counts emphasis per column from the rows", () => {
    for (const column of ["requestr", "postman", "insomnia"] as const) {
      const expected = COMPARISON_ROWS.filter((r) => r.emphasis === column).length;
      expect(countEmphasis(column)).toBe(expected);
    }
    expect(countEmphasis("requestr")).toBeGreaterThan(0);
  });

  it("stamps the check date as an ISO date", () => {
    expect(COMPARISON_CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses unique feature names so row keys do not collide", () => {
    const features = COMPARISON_ROWS.map((r) => r.feature);
    expect(new Set(features).size).toBe(features.length);
  });
});
