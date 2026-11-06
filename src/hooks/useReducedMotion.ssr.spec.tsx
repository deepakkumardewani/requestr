/** @vitest-environment node */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useReducedMotion } from "./useReducedMotion";

function Probe() {
  return createElement("span", null, String(useReducedMotion()));
}

describe("useReducedMotion on the server", () => {
  it("renders without motion reduction when there is no window", () => {
    expect(typeof window).toBe("undefined");
    expect(renderToString(createElement(Probe))).toContain("false");
  });
});
