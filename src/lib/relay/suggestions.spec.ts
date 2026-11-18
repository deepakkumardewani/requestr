import { describe, expect, it } from "vitest";
import type { ContextChip } from "./chips";
import {
  GENERIC_SUGGESTIONS,
  MAX_SUGGESTIONS,
  pickSuggestions,
  type SuggestionContext,
  type TargetSuggestion,
} from "./suggestions";

const chip = (kind: "request" | "chain" | "environment"): ContextChip => ({
  kind,
  id: `${kind}-1`,
  label: `My ${kind}`,
});

const withTarget = (kind: "request" | "chain" | "environment") =>
  ({ kind, target: chip(kind) }) satisfies SuggestionContext;

describe("pickSuggestions", () => {
  it("returns the generic starters when nothing is open", () => {
    const picked = pickSuggestions({ kind: "none" });

    expect(picked.map((s) => s.id)).toEqual([
      "createRequest",
      "importCurl",
      "exploreWorkspace",
      "explainRequest",
    ]);
    expect(picked.every((s) => s.type === "starter")).toBe(true);
  });

  it("marks only the explain starter as needing a request target", () => {
    const picked = pickSuggestions({ kind: "none" });
    const needing = picked.filter(
      (s) => s.type === "starter" && s.requiresTarget,
    );

    expect(needing.map((s) => s.id)).toEqual(["explainRequest"]);
    expect(needing[0]).toMatchObject({ requiresTarget: "request" });
  });

  it.each([
    ["request", ["explain", "run", "assert"]],
    ["chain", ["explain", "run", "chain"]],
    ["environment", ["explain", "summarize", "env"]],
  ] as const)("suggests %s-oriented commands", (kind, commands) => {
    const picked = pickSuggestions(withTarget(kind)) as TargetSuggestion[];

    expect(picked.map((s) => s.command)).toEqual(commands);
    expect(picked.every((s) => s.id.startsWith(`${kind}-`))).toBe(true);
    expect(picked.every((s) => s.labelKey.startsWith(`suggestions.${kind}.`))).toBe(
      true,
    );
  });

  it("attaches the open item as the target of every target suggestion", () => {
    const context = withTarget("request");
    const picked = pickSuggestions(context) as TargetSuggestion[];

    expect(picked.length).toBeGreaterThan(0);
    for (const suggestion of picked) {
      expect(suggestion).toMatchObject({
        type: "target",
        target: { kind: "request", id: "request-1", label: "My request" },
      });
    }
  });

  it.each(["none", "request", "chain", "environment"] as const)(
    "never returns more than the maximum for %s",
    (kind) => {
      const context: SuggestionContext =
        kind === "none" ? { kind } : withTarget(kind);
      const count = pickSuggestions(context).length;

      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    },
  );

  it("keeps the maximum at four and the generic list within it", () => {
    expect(MAX_SUGGESTIONS).toBe(4);
    expect(GENERIC_SUGGESTIONS.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
  });

  it("returns a fresh array so callers cannot mutate the shared starters", () => {
    const first = pickSuggestions({ kind: "none" });
    first.pop();

    expect(pickSuggestions({ kind: "none" })).toHaveLength(4);
  });
});
