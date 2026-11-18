import { describe, expect, it } from "vitest";
import { sectionHref } from "./NavLinkItem";

describe("sectionHref", () => {
  it("uses a bare anchor on the homepage", () => {
    expect(sectionHref("relay", "/")).toBe("#relay");
  });

  it("points back to the homepage section from any other page", () => {
    expect(sectionHref("relay", "/features/json-compare")).toBe("/#relay");
    expect(sectionHref("relay", null)).toBe("/#relay");
  });
});
