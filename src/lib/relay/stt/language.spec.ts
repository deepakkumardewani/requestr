import { describe, expect, it } from "vitest";
import { toSttLanguage } from "./language";

describe("toSttLanguage", () => {
  it.each([
    ["en", "en"],
    ["fr", "fr"],
    ["ja", "ja"],
  ])("maps locale %s to %s", (locale, expected) => {
    expect(toSttLanguage(locale)).toBe(expected);
  });

  it("returns undefined for an unmapped locale so Grok auto-detects", () => {
    expect(toSttLanguage("de")).toBeUndefined();
    expect(toSttLanguage("")).toBeUndefined();
  });
});
