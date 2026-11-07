/**
 * Measured speed stats for the comparison strip. Every value is copied from
 * the committed raw output at `rawKey` (rounded: LCP 0.1 s, JS whole KB with
 * 1 KB = 1000 bytes, TTFR 0.1 s, downloads exact). Regenerate both with
 * `bun agent_docs/polish-and-landing/research/speed-measure.mjs`.
 */

const SOURCE_SCRIPT =
  "agent_docs/polish-and-landing/research/speed-measure.mjs";
const RAW_OUTPUT =
  "agent_docs/polish-and-landing/research/speed-measure.raw.json";
const MEASURED_ON = "2026-11-07";

export interface SpeedStat {
  label: string;
  value: number;
  unit: string;
  measuredOn: string;
  method: string;
  sourceScript: string;
  rawOutput: string;
  rawKey: string;
}

export const SPEED_PROOF = {
  measuredOn: MEASURED_ON,
  environment: {
    buildCommit: "a41f9b147ad2d6b2c4c521f6773eb7b4d363eb41",
    page: "/app",
    profile:
      "Lighthouse mobile emulation, default simulated throttling (4x CPU slowdown, 150 ms RTT, 1.6 Mbps); TTFR on desktop 1440x900, unthrottled",
    ttfrTarget:
      "same-machine local HTTP server returning 200 JSON (no internet variance)",
  },
  stats: {
    lcp: {
      label: "Largest contentful paint",
      value: 6.6,
      unit: "s",
      measuredOn: MEASURED_ON,
      method: "Lighthouse mobile, production build, median of 3 runs",
      sourceScript: SOURCE_SCRIPT,
      rawOutput: RAW_OUTPUT,
      rawKey: "metrics.lcp.median",
    },
    firstLoadJs: {
      label: "First-load JavaScript",
      value: 759,
      unit: "KB",
      measuredOn: MEASURED_ON,
      method:
        "Lighthouse resource-summary Script transfer size, production build, median of 3 runs",
      sourceScript: SOURCE_SCRIPT,
      rawOutput: RAW_OUTPUT,
      rawKey: "metrics.firstLoadJs.median",
    },
    ttfr: {
      label: "Time to first request",
      value: 0.2,
      unit: "s",
      measuredOn: MEASURED_ON,
      method:
        "Fresh Playwright context: navigation to /app, new tab, URL, Send, status visible; median of 3 runs",
      sourceScript: SOURCE_SCRIPT,
      rawOutput: RAW_OUTPUT,
      rawKey: "metrics.ttfr.median",
    },
    downloads: {
      label: "Downloads",
      value: 0,
      unit: "downloads",
      measuredOn: MEASURED_ON,
      method: "Playwright download events counted during the TTFR runs",
      sourceScript: SOURCE_SCRIPT,
      rawOutput: RAW_OUTPUT,
      rawKey: "metrics.downloads.median",
    },
  },
} satisfies {
  measuredOn: string;
  environment: Record<string, string>;
  stats: Record<string, SpeedStat>;
};
