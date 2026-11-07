import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPARISON_CHECKED_ON,
  COMPARISON_GROUPS,
  COMPARISON_ROWS,
  COMPETITOR_SOURCE_HOSTS,
  GITHUB_SOURCE_PATH_PREFIX,
  countEmphasis,
  formatCheckedMonth,
  type ComparisonRow,
} from "./comparison";
import { SPEED_PROOF } from "./speedProof";

const REPO_ROOT = resolve(__dirname, "../../../..");
const RESEARCH_DIR = resolve(REPO_ROOT, "agent_docs/polish-and-landing/research");
const MAX_CELL_CHARS = 90;
const BANNED_VENDOR = /openai|anthropic|claude|gpt|gemini|mistral|llama/i;
const BANNED_REQUESTR = /grpc|mqtt|soap|\bsse\b|server-sent|oauth/i;

function row(feature: string): ComparisonRow {
  const found = COMPARISON_ROWS.find((r) => r.feature === feature);
  if (!found) throw new Error(`missing row: ${feature}`);
  return found;
}

function competitorUrls(): string[] {
  return COMPARISON_ROWS.flatMap((r) => [
    r.postman.source,
    ...(r.postman.extraSources ?? []),
    r.insomnia.source,
    ...(r.insomnia.extraSources ?? []),
  ]);
}

function allCellTexts(): string[] {
  return COMPARISON_ROWS.flatMap((r) => [
    r.requestr.text,
    r.postman.text,
    r.insomnia.text,
  ]);
}

function requestrRefs(): string[] {
  return COMPARISON_ROWS.flatMap((r) => [
    r.requestr.codeRef,
    ...(r.requestr.codeRefs ?? []),
  ]);
}

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
    const refs = requestrRefs();
    expect(refs.length).toBeGreaterThanOrEqual(COMPARISON_ROWS.length);
    for (const ref of refs) {
      expect(existsSync(resolve(REPO_ROOT, ref)), ref).toBe(true);
    }
  });

  it("drops claims the research could not verify", () => {
    const features = COMPARISON_ROWS.map((r) => r.feature.toLowerCase());
    expect(features.some((f) => f.includes("cors"))).toBe(false);
  });

  it("reflects the corrected protocol lists", () => {
    const protocols = COMPARISON_ROWS.find((r) => r.feature === "Protocols & real-time");
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

describe("comparison data: shape after P5b", () => {
  it("has 11 rows (no removals logged)", () => {
    expect(COMPARISON_ROWS).toHaveLength(11);
  });

  it("maps rows to groups per FR-51", () => {
    const byGroup = Object.fromEntries(
      COMPARISON_GROUPS.map((g) => [
        g.id,
        COMPARISON_ROWS.filter((r) => r.group === g.id).map((r) => r.feature),
      ]),
    );
    expect(COMPARISON_GROUPS.map((g) => g.title)).toEqual([
      "Getting started",
      "Capabilities",
      "Cost & data",
    ]);
    expect(byGroup).toEqual({
      "getting-started": [
        "Install required",
        "Account required",
        "Time to first request",
      ],
      capabilities: [
        "Protocols & real-time",
        "Request chains / workflows",
        "AI assistant",
        "Import / export & code generation",
      ],
      "cost-data": [
        "Pricing model",
        "Data location",
        "Collaboration & teams",
        "Offline use / open source",
      ],
    });
  });

  it("has no Real-time support row and a full protocols row (AC-49)", () => {
    expect(COMPARISON_ROWS.some((r) => r.feature === "Real-time support")).toBe(false);
    const p = row("Protocols & real-time");
    for (const cell of [p.requestr, p.postman, p.insomnia]) {
      expect(cell.text).toMatch(/WebSocket/);
      expect(cell.text).toMatch(/Socket\.IO/);
    }
    expect(p.insomnia.text).toMatch(/\bSSE\b/);
  });

  it("gives tiers to competitor cells in chains, AI and collaboration rows (AC-51)", () => {
    for (const feature of [
      "Request chains / workflows",
      "AI assistant",
      "Collaboration & teams",
    ]) {
      expect(row(feature).postman.tier, `${feature} postman`).toBeTruthy();
      expect(row(feature).insomnia.tier, `${feature} insomnia`).toBeTruthy();
    }
  });

  it("never emphasizes Requestr where a competitor is ahead (AC-54)", () => {
    const honesty = readFileSync(resolve(RESEARCH_DIR, "p5b-honesty.md"), "utf8");
    const competitorAhead = ["Request chains / workflows", "AI assistant", "Collaboration & teams"];
    for (const feature of competitorAhead) {
      expect(honesty).toContain(`| ${feature} | Yes`);
      expect(row(feature).emphasis).not.toBe("requestr");
    }
    expect(row("Offline use / open source").emphasis).not.toBe("requestr");
  });
});

describe("comparison data: cell hygiene and sources", () => {
  it("keeps every cell at most 90 chars with no newline (AC-50)", () => {
    const texts = allCellTexts();
    expect(texts).toHaveLength(COMPARISON_ROWS.length * 3);
    for (const text of texts) {
      expect(text.length, text).toBeLessThanOrEqual(MAX_CELL_CHARS);
      expect(text).not.toMatch(/\n|<br/i);
    }
  });

  it("only cites allowlisted https hostnames, GitHub only under /Kong/", () => {
    const urls = competitorUrls();
    expect(urls.length).toBeGreaterThan(COMPARISON_ROWS.length * 2);
    for (const raw of urls) {
      const url = new URL(raw);
      expect(url.protocol, raw).toBe("https:");
      expect(COMPETITOR_SOURCE_HOSTS as readonly string[], raw).toContain(url.hostname);
      if (url.hostname === "github.com") {
        expect(url.pathname.startsWith(GITHUB_SOURCE_PATH_PREFIX), raw).toBe(true);
      }
    }
  });

  it("rejects non-Kong GitHub paths per the allowlist rule", () => {
    expect(new URL("https://github.com/other/repo").pathname.startsWith(GITHUB_SOURCE_PATH_PREFIX)).toBe(false);
  });

  it("names no AI model vendors in any cell", () => {
    for (const text of allCellTexts()) {
      expect(text).not.toMatch(BANNED_VENDOR);
    }
  });

  it("makes no gRPC/MQTT/SOAP/SSE/OAuth claim in Requestr cells", () => {
    for (const r of COMPARISON_ROWS) {
      expect(r.requestr.text, r.feature).not.toMatch(BANNED_REQUESTR);
    }
  });

  it("matches the banned-term regexes on known bad text (guard is live)", () => {
    expect(BANNED_REQUESTR.test("Supports gRPC")).toBe(true);
    expect(BANNED_VENDOR.test("Powered by Claude")).toBe(true);
  });

  it("states the TTFR from speedProof.ts in the Requestr cell", () => {
    const text = row("Time to first request").requestr.text;
    const { value, unit } = SPEED_PROOF.stats.ttfr;
    expect(text).toContain(`About ${value} ${unit}`);
    expect(text).toContain("0.2 s");
  });

  it("lists every competitor URL in url-check.md (AC-52)", () => {
    const log = readFileSync(resolve(RESEARCH_DIR, "url-check.md"), "utf8");
    const missing = [...new Set(competitorUrls())].filter((u) => !log.includes(u));
    expect(missing).toEqual([]);
  });
});

describe("formatCheckedMonth", () => {
  it("formats an ISO date as short month and year", () => {
    expect(formatCheckedMonth("2026-12-01")).toBe("Dec 2026");
  });

  it("changes with the ISO input", () => {
    expect(formatCheckedMonth("2027-03-15")).toBe("Mar 2027");
    expect(formatCheckedMonth("2027-03-15")).not.toBe(formatCheckedMonth("2026-12-01"));
  });

  it("formats the shipped check date", () => {
    expect(formatCheckedMonth(COMPARISON_CHECKED_ON)).toBe("Nov 2026");
  });
});

