import { describe, it, expect } from "vitest";
import {
  isDetailedExtractionKey,
  parseDetailedExtractionKey,
} from "./chainUtils";

describe("chainUtils extraction key helpers", () => {
  describe("isDetailedExtractionKey", () => {
    it("returns true for detailed keys with sourceJsonPath", () => {
      expect(isDetailedExtractionKey("edge1:$.token")).toBe(true);
      expect(isDetailedExtractionKey("edge1:$.data.id")).toBe(true);
      expect(isDetailedExtractionKey("edge-123:$.deeply.nested.value")).toBe(
        true,
      );
    });

    it("returns false for bare edge ID keys", () => {
      expect(isDetailedExtractionKey("edge1")).toBe(false);
      expect(isDetailedExtractionKey("edge-123")).toBe(false);
      expect(isDetailedExtractionKey("some-uuid-like-key")).toBe(false);
    });

    it("returns false for keys without $", () => {
      expect(isDetailedExtractionKey("edge1:token")).toBe(false);
      expect(isDetailedExtractionKey("edge1:data.id")).toBe(false);
    });
  });

  describe("parseDetailedExtractionKey", () => {
    it("parses detailed keys correctly", () => {
      const result = parseDetailedExtractionKey("edge1:$.token");
      expect(result).toEqual({
        edgeId: "edge1",
        sourceJsonPath: "$.token",
      });
    });

    it("handles deeply nested paths", () => {
      const result = parseDetailedExtractionKey("edge-123:$.data.user.id");
      expect(result).toEqual({
        edgeId: "edge-123",
        sourceJsonPath: "$.data.user.id",
      });
    });

    it("returns null for bare keys", () => {
      expect(parseDetailedExtractionKey("edge1")).toBeNull();
      expect(parseDetailedExtractionKey("edge-123")).toBeNull();
    });

    it("returns null for malformed keys", () => {
      expect(parseDetailedExtractionKey("edge1:token")).toBeNull();
      expect(parseDetailedExtractionKey("edge1:data.id")).toBeNull();
    });
  });

  describe("extraction key filtering for UI display", () => {
    it("shows only detailed keys, filters bare keys", () => {
      // Simulate extractedValues from apiExecutor on failure
      const extractedValues: Record<string, string | null> = {
        "edge1:$.token": null, // Detailed key (shown)
        "edge1": null, // Bare key (filtered out in UI)
        "edge2:$.data.id": "user123", // Detailed key (shown)
        "edge2": "user123", // Bare key (filtered out in UI)
      };

      // Simulate the panel's filtering logic
      const displayed = Object.entries(extractedValues).filter(([key]) =>
        isDetailedExtractionKey(key),
      );

      expect(displayed).toHaveLength(2);
      expect(displayed.map(([k]) => k)).toEqual([
        "edge1:$.token",
        "edge2:$.data.id",
      ]);

      // Verify all entries are still in extractedValues (for bare-key fallback lookups)
      expect(Object.entries(extractedValues)).toHaveLength(4);
    });
  });
});
