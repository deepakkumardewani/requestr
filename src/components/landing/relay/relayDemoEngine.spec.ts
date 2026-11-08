import { describe, expect, it } from "vitest";
import {
  advancePlayback,
  CARD_STAGGER_MS,
  getAppliedBadges,
  getFinalFrame,
  getFrame,
  getScenarioDuration,
  HOLD_MS,
  PROMPT_CHAR_MS,
  REPLY_CHAR_MS,
  THINK_MS,
} from "./relayDemoEngine";
import type { RelayScenario } from "./scenarios";

const scenario: RelayScenario = {
  id: "s",
  prompt: "abcd",
  reply: "wxyz",
  cards: [
    { id: "c1", title: "t1", detail: "d", requestIds: ["r1", "r2"], badge: "A" },
    { id: "c2", title: "t2", detail: "d", requestIds: ["r2", "r3"], badge: "B" },
  ],
};
const other: RelayScenario = { ...scenario, id: "o" };

// Literal timeline for the fixture: prompt 4*35=140, reply starts 590,
// reply ends 590+64=654, cards end 654+1000=1654.
const PROMPT_END = 140;
const REPLY_START = 590;
const REPLY_END = 654;

describe("timing constants", () => {
  it("match the documented pacing", () => {
    expect([PROMPT_CHAR_MS, THINK_MS, REPLY_CHAR_MS, CARD_STAGGER_MS, HOLD_MS])
      .toEqual([35, 450, 16, 500, 3200]);
  });
});

describe("getScenarioDuration", () => {
  it("is typing + think + stream + card stagger + hold", () => {
    expect(getScenarioDuration(scenario)).toBe(1654 + 3200);
  });
});

describe("getFrame", () => {
  it("is empty at time zero", () => {
    expect(getFrame(scenario, 0)).toEqual({
      promptText: "",
      replyText: "",
      visibleCards: 0,
    });
  });

  it("clamps negative elapsed time to empty", () => {
    expect(getFrame(scenario, -500).promptText).toBe("");
  });

  it("types the prompt one character per tick", () => {
    expect(getFrame(scenario, 35).promptText).toBe("a");
    expect(getFrame(scenario, 34).promptText).toBe("");
    expect(getFrame(scenario, 100).promptText).toBe("ab");
  });

  it("completes the prompt and waits during the think pause", () => {
    const frame = getFrame(scenario, PROMPT_END + 100);
    expect(frame.promptText).toBe("abcd");
    expect(frame.replyText).toBe("");
    expect(frame.visibleCards).toBe(0);
  });

  it("streams the reply after the think pause", () => {
    expect(getFrame(scenario, REPLY_START).replyText).toBe("");
    expect(getFrame(scenario, REPLY_START + 32).replyText).toBe("wx");
  });

  it("reveals no cards until the reply has finished", () => {
    expect(getFrame(scenario, REPLY_END - 1).visibleCards).toBe(0);
  });

  it("staggers cards after the reply", () => {
    expect(getFrame(scenario, REPLY_END).visibleCards).toBe(1);
    expect(getFrame(scenario, REPLY_END + 499).visibleCards).toBe(1);
    expect(getFrame(scenario, REPLY_END + 500).visibleCards).toBe(2);
  });

  it("caps everything at the full content late in the scenario", () => {
    expect(getFrame(scenario, 100_000)).toEqual(getFinalFrame(scenario));
  });
});

describe("getFinalFrame", () => {
  it("returns the complete prompt, reply and all cards", () => {
    expect(getFinalFrame(scenario)).toEqual({
      promptText: "abcd",
      replyText: "wxyz",
      visibleCards: 2,
    });
  });
});

describe("getAppliedBadges", () => {
  it("returns nothing when no cards are visible", () => {
    expect(getAppliedBadges(scenario.cards, 0, new Set()).size).toBe(0);
  });

  it("maps each request of visible cards to the card badge", () => {
    const badges = getAppliedBadges(scenario.cards, 1, new Set());
    expect(Object.fromEntries(badges)).toEqual({ r1: "A", r2: "A" });
  });

  it("lets later cards override earlier badges on shared requests", () => {
    const badges = getAppliedBadges(scenario.cards, 2, new Set());
    expect(Object.fromEntries(badges)).toEqual({ r1: "A", r2: "B", r3: "B" });
  });

  it("skips undone cards", () => {
    const badges = getAppliedBadges(scenario.cards, 2, new Set(["c2"]));
    expect(Object.fromEntries(badges)).toEqual({ r1: "A", r2: "A" });
  });
});

describe("advancePlayback", () => {
  const duration = getScenarioDuration(scenario);

  it("adds delta within the current scenario", () => {
    expect(
      advancePlayback({ scenarioIndex: 0, elapsedMs: 100 }, 50, [scenario, other]),
    ).toEqual({ scenarioIndex: 0, elapsedMs: 150 });
  });

  it("rolls over to the next scenario at the exact duration", () => {
    expect(
      advancePlayback({ scenarioIndex: 0, elapsedMs: duration - 50 }, 50, [
        scenario,
        other,
      ]),
    ).toEqual({ scenarioIndex: 1, elapsedMs: 0 });
  });

  it("loops back to the first scenario after the last", () => {
    expect(
      advancePlayback({ scenarioIndex: 1, elapsedMs: duration }, 1, [
        scenario,
        other,
      ]),
    ).toEqual({ scenarioIndex: 0, elapsedMs: 0 });
  });

  it("moves on when the current index has no scenario", () => {
    expect(
      advancePlayback({ scenarioIndex: 5, elapsedMs: 0 }, 50, [scenario, other]),
    ).toEqual({ scenarioIndex: 0, elapsedMs: 0 });
  });
});
