import { describe, expect, it } from "vitest";
import { DEMO_SIDEBAR, RELAY_SCENARIOS } from "./scenarios";

const sidebarIds = new Set(
  DEMO_SIDEBAR.flatMap((c) => c.requests.map((r) => r.id)),
);

describe("RELAY_SCENARIOS", () => {
  it("has at least 3 scenarios so the loop shows variety", () => {
    expect(RELAY_SCENARIOS.length).toBeGreaterThanOrEqual(3);
  });

  it("has unique scenario ids and unique card ids", () => {
    const scenarioIds = RELAY_SCENARIOS.map((s) => s.id);
    const cardIds = RELAY_SCENARIOS.flatMap((s) => s.cards.map((c) => c.id));
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);
    expect(new Set(cardIds).size).toBe(cardIds.length);
  });

  it("gives every scenario a prompt, reply and at least one card", () => {
    for (const s of RELAY_SCENARIOS) {
      expect(s.prompt).not.toBe("");
      expect(s.reply).not.toBe("");
      expect(s.cards.length).toBeGreaterThan(0);
    }
  });

  it("only targets requests that exist in the demo sidebar", () => {
    const targeted = RELAY_SCENARIOS.flatMap((s) =>
      s.cards.flatMap((c) => c.requestIds),
    );
    for (const id of targeted) expect(sidebarIds.has(id)).toBe(true);
  });
});

describe("DEMO_SIDEBAR", () => {
  it("has unique request ids across collections", () => {
    const all = DEMO_SIDEBAR.flatMap((c) => c.requests.map((r) => r.id));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(0);
  });
});
