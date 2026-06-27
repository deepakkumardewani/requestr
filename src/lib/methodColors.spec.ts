import { describe, expect, it } from "vitest";
import { METHOD_CSS_VAR, methodRgb } from "./methodColors";
import { METHOD_PALETTE } from "./constants";

describe("methodRgb", () => {
  it("returns correct rgb string for GET", () => {
    const { r, g, b } = METHOD_PALETTE.GET;
    expect(methodRgb("GET")).toBe(`rgb(${r} ${g} ${b})`);
  });

  it("returns correct rgb string for all methods", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      const { r, g, b } = METHOD_PALETTE[method];
      expect(methodRgb(method)).toBe(`rgb(${r} ${g} ${b})`);
    }
  });
});

describe("METHOD_CSS_VAR", () => {
  it("has an entry for every method in METHOD_PALETTE", () => {
    for (const method of Object.keys(METHOD_PALETTE)) {
      expect(METHOD_CSS_VAR).toHaveProperty(method);
    }
  });

  it("uses kebab-case css var format", () => {
    for (const value of Object.values(METHOD_CSS_VAR)) {
      expect(value).toMatch(/^--method-[a-z]+$/);
    }
  });
});
