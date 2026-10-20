import { describe, expect, it } from "vitest";
import { STARTER_KEYS } from "./suggestions";

describe("STARTER_KEYS", () => {
  it("is the same three tab-independent starters", () => {
    expect(STARTER_KEYS).toEqual(["one", "two", "three"]);
  });

  it("has unique keys", () => {
    expect(new Set(STARTER_KEYS).size).toBe(STARTER_KEYS.length);
  });
});
