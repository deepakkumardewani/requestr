import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SPEED_PROOF, type SpeedStat } from "./speedProof";

const REPO_ROOT = resolve(__dirname, "../../../..");

type RawMetrics = Record<string, { median: number }>;

/** Applies the rounding stated in speedProof.ts to a raw median */
function roundRaw(statKey: string, raw: number): number {
  if (statKey === "lcp") return Math.round(raw / 100) / 10; // ms -> s, 0.1
  if (statKey === "firstLoadJs") return Math.round(raw / 1000); // bytes -> KB
  if (statKey === "ttfr") return Math.round(raw / 100) / 10; // ms -> s, 0.1
  return raw; // downloads: exact
}

function readByKey(rawJson: unknown, rawKey: string): number | undefined {
  let node: unknown = rawJson;
  for (const part of rawKey.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "number" ? node : undefined;
}

/** Honesty guard (FR-57): returns every reason a stat cannot be trusted */
function guardStat(
  statKey: string,
  stat: SpeedStat,
  rawJson: unknown,
): string[] {
  const problems: string[] = [];
  if (!stat.measuredOn.trim()) problems.push("missing measuredOn");
  if (!stat.sourceScript.trim()) problems.push("missing sourceScript");
  if (!stat.rawOutput.trim()) problems.push("missing rawOutput");
  if (!existsSync(resolve(REPO_ROOT, stat.sourceScript)))
    problems.push("sourceScript not on disk");
  if (!existsSync(resolve(REPO_ROOT, stat.rawOutput)))
    problems.push("rawOutput not on disk");
  const raw = readByKey(rawJson, stat.rawKey);
  if (raw === undefined) problems.push("rawKey not found");
  else if (roundRaw(statKey, raw) !== stat.value)
    problems.push("value differs from raw");
  return problems;
}

const rawJson: { metrics: RawMetrics } = JSON.parse(
  readFileSync(resolve(REPO_ROOT, SPEED_PROOF.stats.lcp.rawOutput), "utf8"),
);
const statEntries = Object.entries(SPEED_PROOF.stats);

describe("speed proof honesty guard", () => {
  it("covers exactly LCP, first-load JS, TTFR and downloads", () => {
    expect(statEntries.map(([key]) => key)).toEqual([
      "lcp",
      "firstLoadJs",
      "ttfr",
      "downloads",
    ]);
  });

  it("records measuredOn, sourceScript and rawOutput for every stat", () => {
    expect(statEntries.length).toBe(4);
    for (const [, stat] of statEntries) {
      expect(stat.measuredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(stat.sourceScript).not.toBe("");
      expect(stat.rawOutput).not.toBe("");
      expect(stat.label).not.toBe("");
      expect(stat.method).not.toBe("");
    }
  });

  it("points at a script and raw file that exist", () => {
    expect(existsSync(resolve(REPO_ROOT, SPEED_PROOF.stats.lcp.sourceScript))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, SPEED_PROOF.stats.lcp.rawOutput))).toBe(true);
  });

  it("passes the guard for every shipped stat", () => {
    for (const [key, stat] of statEntries) {
      expect(guardStat(key, stat, rawJson)).toEqual([]);
    }
  });

  it("pins each displayed value to its rounded raw median", () => {
    expect(SPEED_PROOF.stats.lcp.value).toBe(6.6);
    expect(rawJson.metrics.lcp.median).toBeCloseTo(6617.37, 1);
    expect(SPEED_PROOF.stats.firstLoadJs.value).toBe(759);
    expect(rawJson.metrics.firstLoadJs.median).toBe(758834);
    expect(SPEED_PROOF.stats.ttfr.value).toBe(0.2);
    expect(rawJson.metrics.ttfr.median).toBeCloseTo(237.98, 1);
    expect(SPEED_PROOF.stats.downloads.value).toBe(0);
    expect(rawJson.metrics.downloads.median).toBe(0);
  });

  it("uses the same measuredOn at top level and per stat", () => {
    for (const [, stat] of statEntries) {
      expect(stat.measuredOn).toBe(SPEED_PROOF.measuredOn);
    }
  });

  it("describes the environment of the measurement", () => {
    expect(SPEED_PROOF.environment.buildCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(SPEED_PROOF.environment.buildCommit).toBe(
      (rawJson as unknown as { buildCommit: string }).buildCommit,
    );
    expect(SPEED_PROOF.environment.page).toBe("/app");
    expect(SPEED_PROOF.environment.profile).not.toBe("");
    expect(SPEED_PROOF.environment.ttfrTarget).not.toBe("");
  });

  describe("negative cases", () => {
    const lcp = SPEED_PROOF.stats.lcp;

    it("fails when a stat lacks measuredOn", () => {
      const mutated: SpeedStat = { ...lcp, measuredOn: "" };
      expect(guardStat("lcp", mutated, rawJson)).toContain("missing measuredOn");
    });

    it("fails when a stat lacks sourceScript or rawOutput", () => {
      expect(guardStat("lcp", { ...lcp, sourceScript: "" }, rawJson)).toContain(
        "missing sourceScript",
      );
      expect(guardStat("lcp", { ...lcp, rawOutput: " " }, rawJson)).toContain(
        "missing rawOutput",
      );
    });

    it("fails when a referenced file is not on disk", () => {
      const problems = guardStat(
        "lcp",
        { ...lcp, sourceScript: "nope/missing.mjs", rawOutput: "nope/raw.json" },
        rawJson,
      );
      expect(problems).toContain("sourceScript not on disk");
      expect(problems).toContain("rawOutput not on disk");
    });

    it("fails when the raw value is changed", () => {
      const mutatedRaw = {
        metrics: {
          ...rawJson.metrics,
          lcp: { ...rawJson.metrics.lcp, median: 9000 },
        },
      };
      expect(guardStat("lcp", lcp, mutatedRaw)).toEqual(["value differs from raw"]);
    });

    it("fails when the displayed value is changed", () => {
      expect(guardStat("lcp", { ...lcp, value: 1.2 }, rawJson)).toEqual([
        "value differs from raw",
      ]);
    });

    it("fails when the rawKey does not resolve", () => {
      expect(
        guardStat("lcp", { ...lcp, rawKey: "metrics.lcp.nothing" }, rawJson),
      ).toContain("rawKey not found");
      expect(
        guardStat("lcp", { ...lcp, rawKey: "metrics.lcp.median.deeper" }, rawJson),
      ).toContain("rawKey not found");
    });

    it("rejects any downloads count above zero", () => {
      const mutatedRaw = { metrics: { downloads: { median: 2 } } };
      expect(
        guardStat("downloads", SPEED_PROOF.stats.downloads, mutatedRaw),
      ).toContain("value differs from raw");
    });
  });
});
