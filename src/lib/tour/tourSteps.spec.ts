import { describe, expect, it } from "vitest";
import { TOUR_ANCHORS, tourAnchorSelector } from "./tourAnchors";
import { TOUR_STEPS } from "./tourSteps";

describe("TOUR_STEPS", () => {
  it("lists the steps in the documented order", () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      "urlBar",
      "sampleRequests",
      "save",
      "environments",
      "chains",
      "relay",
      "palette",
    ]);
  });

  it("has unique ids", () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("anchors every step to a known anchor except the centred palette step", () => {
    const known = Object.values(TOUR_ANCHORS);
    for (const step of TOUR_STEPS) {
      if (step.id === "palette") {
        expect(step.anchor).toBeNull();
      } else {
        expect(known).toContain(step.anchor);
      }
    }
  });

  it("uses each anchor at most once", () => {
    const anchors = TOUR_STEPS.flatMap((step) => step.anchor ?? []);
    expect(new Set(anchors).size).toBe(anchors.length);
  });
});

describe("tourAnchorSelector", () => {
  it("builds a data-tour attribute selector", () => {
    expect(tourAnchorSelector(TOUR_ANCHORS.chains)).toBe(
      '[data-tour="chains"]'
    );
  });
});
