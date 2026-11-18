import { describe, expect, it } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { matchesSearch } from "./stepSearch";

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "s1",
    nodeId: "n1",
    nodeType: "request",
    label: "Fetch Orders",
    state: "success",
    startedAt: 0,
    durationMs: 1,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  } as RunStep;
}

describe("matchesSearch", () => {
  it("matches everything for a blank query", () => {
    expect(matchesSearch(makeStep(), "  ")).toBe(true);
  });

  it("matches the label case-insensitively", () => {
    expect(matchesSearch(makeStep(), "orders")).toBe(true);
    expect(matchesSearch(makeStep(), "zzz")).toBe(false);
  });

  it("matches the error code ignoring separators and case", () => {
    const step = makeStep({ errorCode: "httpStatus" as RunStep["errorCode"] });
    expect(matchesSearch(step, "HTTP_STATUS")).toBe(true);
    expect(matchesSearch(makeStep(), "HTTP_STATUS")).toBe(false);
  });

  it("matches the English error fallback", () => {
    expect(
      matchesSearch(makeStep({ error: "Request timed out" }), "timed")
    ).toBe(true);
  });

  it("matches the HTTP status", () => {
    const step = makeStep({
      response: { status: 500 } as RunStep["response"],
    });
    expect(matchesSearch(step, "500")).toBe(true);
    expect(matchesSearch(step, "404")).toBe(false);
  });
});
