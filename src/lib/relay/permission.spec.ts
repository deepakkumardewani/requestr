import { describe, expect, it } from "vitest";
import {
  RELAY_PERMISSION_MODES,
  RELAY_PERMISSION_OPTIONS,
  RELAY_DEFAULT_PERMISSION_MODE,
  isRelayPermissionMode,
  getPermissionOption,
  RADIO_NAV_KEYS,
  isRadioNavKey,
  nextRadioIndex,
} from "./permission";

describe("permission.ts", () => {
  describe("isRelayPermissionMode", () => {
    it("returns true for a valid permission mode string", () => {
      expect(isRelayPermissionMode("always-ask")).toBe(true);
      expect(isRelayPermissionMode("review")).toBe(true);
      expect(isRelayPermissionMode("skip")).toBe(true);
    });

    it("returns false for invalid strings", () => {
      expect(isRelayPermissionMode("invalid")).toBe(false);
      expect(isRelayPermissionMode("ALWAYS-ASK")).toBe(false);
      expect(isRelayPermissionMode("")).toBe(false);
    });

    it("returns false for non-string values", () => {
      expect(isRelayPermissionMode(123)).toBe(false);
      expect(isRelayPermissionMode(null)).toBe(false);
      expect(isRelayPermissionMode(undefined)).toBe(false);
      expect(isRelayPermissionMode({})).toBe(false);
      expect(isRelayPermissionMode([])).toBe(false);
      expect(isRelayPermissionMode(true)).toBe(false);
    });

    it("type-guards to the correct union type", () => {
      const value: unknown = "review";
      if (isRelayPermissionMode(value)) {
        // value is now typed as RelayPermissionMode
        const mode: typeof RELAY_PERMISSION_MODES[number] = value;
        expect(mode).toBe("review");
      }
    });
  });

  describe("getPermissionOption", () => {
    it("returns the option for 'always-ask'", () => {
      const option = getPermissionOption("always-ask");
      expect(option).toEqual({
        mode: "always-ask",
        labelKey: "permission.option.always-ask.label",
        descriptionKey: "permission.option.always-ask.description",
        icon: "shield-question",
        tone: "default",
      });
    });

    it("returns the option for 'review'", () => {
      const option = getPermissionOption("review");
      expect(option).toEqual({
        mode: "review",
        labelKey: "permission.option.review.label",
        descriptionKey: "permission.option.review.description",
        icon: "shield-check",
        tone: "recommended",
      });
    });

    it("returns the option for 'skip'", () => {
      const option = getPermissionOption("skip");
      expect(option).toEqual({
        mode: "skip",
        labelKey: "permission.option.skip.label",
        descriptionKey: "permission.option.skip.description",
        icon: "shield-alert",
        tone: "caution",
      });
    });

    it("throws for an invalid mode", () => {
      expect(() => getPermissionOption("invalid" as any)).toThrow(
        "Unknown relay permission mode: invalid"
      );
    });

    it("returns an object from the RELAY_PERMISSION_OPTIONS array", () => {
      const option = getPermissionOption("review");
      expect(
        RELAY_PERMISSION_OPTIONS.find((o) => o.mode === "review")
      ).toEqual(option);
    });
  });

  describe("RELAY_DEFAULT_PERMISSION_MODE", () => {
    it("is set to 'review'", () => {
      expect(RELAY_DEFAULT_PERMISSION_MODE).toBe("review");
    });

    it("is a valid permission mode", () => {
      expect(isRelayPermissionMode(RELAY_DEFAULT_PERMISSION_MODE)).toBe(true);
    });
  });

  describe("RELAY_PERMISSION_MODES and RELAY_PERMISSION_OPTIONS", () => {
    it("RELAY_PERMISSION_OPTIONS has exactly 3 entries", () => {
      expect(RELAY_PERMISSION_OPTIONS.length).toBe(3);
    });

    it("RELAY_PERMISSION_MODES matches the modes in RELAY_PERMISSION_OPTIONS", () => {
      const modes = RELAY_PERMISSION_OPTIONS.map((o) => o.mode);
      expect(modes).toEqual([...RELAY_PERMISSION_MODES]);
    });

    it("each option has required fields", () => {
      for (const option of RELAY_PERMISSION_OPTIONS) {
        expect(option).toHaveProperty("mode");
        expect(option).toHaveProperty("labelKey");
        expect(option).toHaveProperty("descriptionKey");
        expect(option).toHaveProperty("icon");
        expect(option).toHaveProperty("tone");
      }
    });

    it("icon values are valid", () => {
      const validIcons = ["shield-question", "shield-check", "shield-alert"];
      for (const option of RELAY_PERMISSION_OPTIONS) {
        expect(validIcons).toContain(option.icon);
      }
    });

    it("tone values are valid", () => {
      const validTones = ["default", "recommended", "caution"];
      for (const option of RELAY_PERMISSION_OPTIONS) {
        expect(validTones).toContain(option.tone);
      }
    });
  });

  describe("isRadioNavKey", () => {
    it("returns true for valid navigation keys", () => {
      expect(isRadioNavKey("ArrowDown")).toBe(true);
      expect(isRadioNavKey("ArrowRight")).toBe(true);
      expect(isRadioNavKey("ArrowUp")).toBe(true);
      expect(isRadioNavKey("ArrowLeft")).toBe(true);
      expect(isRadioNavKey("Home")).toBe(true);
      expect(isRadioNavKey("End")).toBe(true);
    });

    it("returns false for invalid keys", () => {
      expect(isRadioNavKey("Enter")).toBe(false);
      expect(isRadioNavKey("Space")).toBe(false);
      expect(isRadioNavKey("Tab")).toBe(false);
      expect(isRadioNavKey("")).toBe(false);
    });

    it("returns false for non-string values", () => {
      expect(isRadioNavKey(null as unknown as string)).toBe(false);
      expect(isRadioNavKey(undefined as unknown as string)).toBe(false);
      expect(isRadioNavKey(123 as unknown as string)).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(isRadioNavKey("arrowdown")).toBe(false);
      expect(isRadioNavKey("home")).toBe(false);
    });
  });

  describe("nextRadioIndex", () => {
    describe("ArrowDown", () => {
      it("moves forward to the next index", () => {
        expect(nextRadioIndex("ArrowDown", 0, 3)).toBe(1);
        expect(nextRadioIndex("ArrowDown", 1, 3)).toBe(2);
      });

      it("wraps to 0 when at the last index", () => {
        expect(nextRadioIndex("ArrowDown", 2, 3)).toBe(0);
      });

      it("works with count 1", () => {
        expect(nextRadioIndex("ArrowDown", 0, 1)).toBe(0);
      });
    });

    describe("ArrowRight", () => {
      it("moves forward to the next index", () => {
        expect(nextRadioIndex("ArrowRight", 0, 5)).toBe(1);
        expect(nextRadioIndex("ArrowRight", 4, 5)).toBe(0);
      });

      it("has same behavior as ArrowDown", () => {
        const count = 4;
        for (let i = 0; i < count; i++) {
          expect(nextRadioIndex("ArrowRight", i, count)).toBe(
            nextRadioIndex("ArrowDown", i, count)
          );
        }
      });
    });

    describe("ArrowUp", () => {
      it("moves backward to the previous index", () => {
        expect(nextRadioIndex("ArrowUp", 1, 3)).toBe(0);
        expect(nextRadioIndex("ArrowUp", 2, 3)).toBe(1);
      });

      it("wraps to the last index when at 0", () => {
        expect(nextRadioIndex("ArrowUp", 0, 3)).toBe(2);
      });

      it("works with count 1", () => {
        expect(nextRadioIndex("ArrowUp", 0, 1)).toBe(0);
      });
    });

    describe("ArrowLeft", () => {
      it("moves backward to the previous index", () => {
        expect(nextRadioIndex("ArrowLeft", 2, 4)).toBe(1);
        expect(nextRadioIndex("ArrowLeft", 0, 4)).toBe(3);
      });

      it("has same behavior as ArrowUp", () => {
        const count = 5;
        for (let i = 0; i < count; i++) {
          expect(nextRadioIndex("ArrowLeft", i, count)).toBe(
            nextRadioIndex("ArrowUp", i, count)
          );
        }
      });
    });

    describe("Home", () => {
      it("always moves to index 0", () => {
        expect(nextRadioIndex("Home", 0, 3)).toBe(0);
        expect(nextRadioIndex("Home", 1, 3)).toBe(0);
        expect(nextRadioIndex("Home", 2, 3)).toBe(0);
      });

      it("works with count 1", () => {
        expect(nextRadioIndex("Home", 0, 1)).toBe(0);
      });
    });

    describe("End", () => {
      it("always moves to the last index", () => {
        expect(nextRadioIndex("End", 0, 3)).toBe(2);
        expect(nextRadioIndex("End", 1, 3)).toBe(2);
        expect(nextRadioIndex("End", 2, 3)).toBe(2);
      });

      it("works with count 1", () => {
        expect(nextRadioIndex("End", 0, 1)).toBe(0);
      });

      it("returns count - 1", () => {
        expect(nextRadioIndex("End", 0, 5)).toBe(4);
        expect(nextRadioIndex("End", 0, 10)).toBe(9);
      });
    });

    describe("boundary cases", () => {
      it("handles large counts", () => {
        const largeCount = 1000;
        expect(nextRadioIndex("Home", 999, largeCount)).toBe(0);
        expect(nextRadioIndex("End", 0, largeCount)).toBe(999);
        expect(nextRadioIndex("ArrowDown", 998, largeCount)).toBe(999);
        expect(nextRadioIndex("ArrowDown", 999, largeCount)).toBe(0);
      });

      it("handles index at boundary", () => {
        expect(nextRadioIndex("ArrowUp", 0, 10)).toBe(9);
        expect(nextRadioIndex("ArrowDown", 9, 10)).toBe(0);
      });
    });

    describe("wrapping math", () => {
      it("correctly uses modulo for forward navigation", () => {
        const count = 6;
        // (index + 1) % count
        for (let i = 0; i < count; i++) {
          const expected = (i + 1) % count;
          expect(nextRadioIndex("ArrowDown", i, count)).toBe(expected);
        }
      });

      it("correctly uses modulo for backward navigation", () => {
        const count = 6;
        // (index - 1 + count) % count
        for (let i = 0; i < count; i++) {
          const expected = (i - 1 + count) % count;
          expect(nextRadioIndex("ArrowUp", i, count)).toBe(expected);
        }
      });
    });
  });

  describe("RADIO_NAV_KEYS constant", () => {
    it("contains all arrow keys", () => {
      expect(RADIO_NAV_KEYS).toContain("ArrowDown");
      expect(RADIO_NAV_KEYS).toContain("ArrowRight");
      expect(RADIO_NAV_KEYS).toContain("ArrowUp");
      expect(RADIO_NAV_KEYS).toContain("ArrowLeft");
    });

    it("contains Home and End keys", () => {
      expect(RADIO_NAV_KEYS).toContain("Home");
      expect(RADIO_NAV_KEYS).toContain("End");
    });

    it("is a readonly tuple at the type level", () => {
      expect(RADIO_NAV_KEYS).toHaveLength(6);
      expect(Object.isFrozen(RADIO_NAV_KEYS) || Array.isArray(RADIO_NAV_KEYS)).toBe(
        true,
      );
    });
  });
});
