import { describe, expect, it } from "vitest";
import { CAPABILITY_CATEGORY_BY_TOOL } from "@/lib/relay/capabilities";
import {
  countToolsByCategory,
  LANDING_CAPABILITIES,
  TOTAL_TOOL_COUNT,
} from "./capabilities";

describe("landing capabilities", () => {
  it("counts every Relay tool exactly once", () => {
    const counts = countToolsByCategory();
    const sum = Object.values(counts).reduce((total, n) => total + n, 0);

    expect(sum).toBe(TOTAL_TOOL_COUNT);
    expect(TOTAL_TOOL_COUNT).toBe(
      Object.keys(CAPABILITY_CATEGORY_BY_TOOL).length,
    );
  });

  it("shows a card for every category that has tools", () => {
    const shown = new Set(LANDING_CAPABILITIES.map((c) => c.id));
    const used = new Set(Object.values(CAPABILITY_CATEGORY_BY_TOOL));

    expect([...used].filter((id) => !shown.has(id))).toEqual([]);
  });

  it("never shows an area with no tools behind it", () => {
    const counts = countToolsByCategory();

    for (const capability of LANDING_CAPABILITIES) {
      expect(counts[capability.id]).toBeGreaterThan(0);
    }
  });

  it("lists each area once with copy and an example prompt", () => {
    const ids = LANDING_CAPABILITIES.map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const capability of LANDING_CAPABILITIES) {
      expect(capability.title).not.toBe("");
      expect(capability.description).not.toBe("");
      expect(capability.example).not.toBe("");
    }
  });
});
