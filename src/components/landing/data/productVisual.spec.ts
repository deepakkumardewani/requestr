import { describe, expect, it } from "vitest";
import {
  getMaxResponseLineCount,
  MAX_RESPONSE_LINE_COUNT,
  PRODUCT_METHODS,
  PRODUCT_REQUESTS,
  statusBadgeClass,
} from "./productVisual";

describe("productVisual data", () => {
  it("defines GET, POST, and DELETE requests", () => {
    expect(PRODUCT_METHODS).toEqual(["GET", "POST", "DELETE"]);
    for (const method of PRODUCT_METHODS) {
      expect(PRODUCT_REQUESTS[method].method).toBe(method);
    }
  });

  it("provides at least three cyclable responses per method", () => {
    for (const method of PRODUCT_METHODS) {
      expect(PRODUCT_REQUESTS[method].responses.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses varied status codes across responses", () => {
    const getStatuses = PRODUCT_REQUESTS.GET.responses.map((r) => r.status);
    expect(new Set(getStatuses).size).toBeGreaterThan(1);
  });

  it("tracks the tallest mock response for fixed panel height", () => {
    expect(getMaxResponseLineCount()).toBe(MAX_RESPONSE_LINE_COUNT);
    expect(MAX_RESPONSE_LINE_COUNT).toBeGreaterThanOrEqual(3);
  });
});

describe("statusBadgeClass", () => {
  it("returns success styling for 2xx", () => {
    expect(statusBadgeClass(200)).toContain("emerald");
    expect(statusBadgeClass(201)).toContain("emerald");
  });

  it("returns error styling for 4xx", () => {
    expect(statusBadgeClass(404)).toContain("red");
    expect(statusBadgeClass(401)).toContain("red");
  });

  it("returns warning styling for server errors", () => {
    expect(statusBadgeClass(500)).toContain("amber");
  });

  it("returns success styling for 204 No Content", () => {
    expect(statusBadgeClass(204)).toContain("emerald");
  });
});
