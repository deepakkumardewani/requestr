import { describe, expect, it } from "vitest";
import type { PromptSegment } from "@/components/relay/editorTypes";
import {
  readSegmentMetadata,
  segmentMetadata,
  withoutSegments,
} from "./segments";

const chip = { kind: "request", id: "r1", label: "Login" } as const;

describe("readSegmentMetadata", () => {
  it("returns null for non-object or segment-less metadata", () => {
    expect(readSegmentMetadata(undefined)).toBeNull();
    expect(readSegmentMetadata(null)).toBeNull();
    expect(readSegmentMetadata("x")).toBeNull();
    expect(readSegmentMetadata({})).toBeNull();
    expect(readSegmentMetadata({ segments: "nope" })).toBeNull();
    expect(readSegmentMetadata({ segments: [] })).toBeNull();
  });

  it("reads text, command and attachment segments in order", () => {
    expect(
      readSegmentMetadata({
        segments: [
          { type: "text", text: "hi " },
          { type: "command", id: "explain", label: "Explain" },
          { type: "attachment", chip, deleted: true },
        ],
      }),
    ).toEqual([
      { type: "text", text: "hi " },
      { type: "command", id: "explain", label: "Explain" },
      { type: "attachment", chip },
    ]);
  });

  it("accepts every pill kind", () => {
    const kinds = ["tab", "request", "chain", "collection", "environment"];
    const result = readSegmentMetadata({
      segments: kinds.map((kind) => ({
        type: "attachment",
        chip: { kind, id: kind, label: kind },
      })),
    });
    expect(result).toHaveLength(kinds.length);
  });

  it("drops malformed segments and keeps the valid ones", () => {
    expect(
      readSegmentMetadata({
        segments: [
          null,
          "str",
          { type: "text", text: 3 },
          { type: "command", id: "nope", label: "X" },
          { type: "command", id: "explain", label: 4 },
          { type: "attachment" },
          { type: "attachment", chip: { kind: "bogus", id: "a", label: "b" } },
          { type: "attachment", chip: { kind: "tab", id: 1, label: "b" } },
          { type: "attachment", chip: { kind: "tab", id: "a", label: 2 } },
          { type: "unknown" },
          { type: "text", text: "keep" },
        ],
      }),
    ).toEqual([{ type: "text", text: "keep" }]);
  });

  it("returns null when every segment is malformed", () => {
    expect(readSegmentMetadata({ segments: [{ type: "x" }, 1] })).toBeNull();
  });
});

describe("segmentMetadata", () => {
  it("returns null for text-only or empty segments", () => {
    expect(segmentMetadata([])).toBeNull();
    expect(segmentMetadata([{ type: "text", text: "plain" }])).toBeNull();
  });

  it("stores pill segments and strips the deleted flag", () => {
    const segments: PromptSegment[] = [
      { type: "text", text: "a" },
      { type: "attachment", chip, deleted: true },
      { type: "command", id: "docs", label: "Docs" },
    ];
    expect(segmentMetadata(segments)).toEqual({
      segments: [
        { type: "text", text: "a" },
        { type: "attachment", chip },
        { type: "command", id: "docs", label: "Docs" },
      ],
    });
  });

  it("round-trips through readSegmentMetadata", () => {
    const segments: PromptSegment[] = [
      { type: "attachment", chip },
      { type: "text", text: " ok" },
    ];
    expect(readSegmentMetadata(segmentMetadata(segments))).toEqual(segments);
  });
});

describe("withoutSegments", () => {
  it("returns an empty object for non-objects", () => {
    expect(withoutSegments(undefined)).toEqual({});
    expect(withoutSegments(7)).toEqual({});
  });

  it("removes segments and keeps the rest", () => {
    const metadata = { segments: [1], attachments: ["a"], other: true };
    expect(withoutSegments(metadata)).toEqual({
      attachments: ["a"],
      other: true,
    });
    expect(metadata.segments).toEqual([1]);
  });
});
