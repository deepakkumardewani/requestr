import { STATUS_CODES } from "node:http";
import { describe, expect, it } from "vitest";
import { SECTION_ORDER } from "../data/links";
import {
  SECTION_STATUSES,
  STATUS_CLASS_COLOR,
  STATUS_PHRASES,
  type StatusCode,
  statusClassOf,
  statusForSection,
} from "./statusCodes";

describe("SECTION_STATUSES", () => {
  it("gives every landing section exactly one status, in page order", () => {
    expect(SECTION_STATUSES.map((entry) => entry.sectionId)).toEqual([
      ...SECTION_ORDER,
    ]);
  });

  it("uses only codes whose phrase it knows", () => {
    for (const entry of SECTION_STATUSES) {
      expect(STATUS_PHRASES[entry.code], String(entry.code)).toBeTruthy();
    }
  });

  it("keeps every aside to one short line", () => {
    for (const entry of SECTION_STATUSES) {
      expect((entry.aside ?? "").length, entry.sectionId).toBeLessThan(48);
    }
  });

  it("only lets the band with its own big code hide the rail", () => {
    const yielding = SECTION_STATUSES.filter((entry) => entry.yieldsRail);
    expect(yielding.map((entry) => entry.sectionId)).toEqual(["auth-flip"]);
  });
});

describe("STATUS_PHRASES", () => {
  it("spells every reason phrase the way Node's HTTP table does", () => {
    for (const [code, phrase] of Object.entries(STATUS_PHRASES)) {
      expect(phrase, code).toBe(STATUS_CODES[code]);
    }
  });
});

describe("statusClassOf", () => {
  it.each([
    [101, "informational"],
    [200, "success"],
    [299, "success"],
    [301, "redirection"],
    [428, "client-error"],
    [503, "server-error"],
  ] as const)("puts %i in %s", (code, expected) => {
    expect(statusClassOf(code)).toBe(expected);
  });

  it.each([99, 600, 0, -200, 200.5])("rejects %d", (code) => {
    expect(() => statusClassOf(code)).toThrow(RangeError);
  });

  it("has a colour for every family a section uses", () => {
    for (const entry of SECTION_STATUSES) {
      expect(STATUS_CLASS_COLOR[statusClassOf(entry.code)]).toMatch(/^var\(/);
    }
  });
});

describe("statusForSection", () => {
  it("finds a section's own status", () => {
    expect(statusForSection("control").code).toBe(428 satisfies StatusCode);
  });

  it("falls back to the hero above the page or for an unknown id", () => {
    expect(statusForSection(null).sectionId).toBe("hero");
    expect(statusForSection("nowhere").sectionId).toBe("hero");
  });
});
