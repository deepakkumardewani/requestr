/** @vitest-environment happy-dom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { extractJsonPath } from "@/lib/chainRunner/utils";
import {
  buildPath,
  JSON_PATH_DRAG_MIME_TYPE,
  JsonPathExplorer,
} from "./JsonPathExplorer";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("buildPath", () => {
  it("uses dot notation for plain keys and bracket notation for indexes", () => {
    expect(buildPath("$", "user")).toBe("$.user");
    expect(buildPath("$.user", "name")).toBe("$.user.name");
    expect(buildPath("$.items", 0)).toBe("$.items[0]");
  });

  it("uses bracket notation for keys containing a dot", () => {
    expect(buildPath("$", "a.b")).toBe("$['a.b']");
    expect(buildPath("$.x", "a.b")).toBe("$.x['a.b']");
  });

  it("round-trips through the runner extractor", () => {
    const body = JSON.stringify({
      "a.b": 2,
      a: { b: 9 },
      "c d": 5,
      "e-f": 6,
      "1a": 7,
      "a@b": 8,
      nested: { "x.y": 4 },
    });
    const cases: Array<[string, string]> = [
      [buildPath("$", "a.b"), "2"],
      [buildPath("$", "c d"), "5"],
      [buildPath("$", "e-f"), "6"],
      [buildPath("$", "1a"), "7"],
      [buildPath("$", "a@b"), "8"],
      [buildPath(buildPath("$", "nested"), "x.y"), "4"],
    ];
    for (const [path, expected] of cases) {
      expect(extractJsonPath(body, path)).toBe(expected);
    }
  });
});

describe("JsonPathExplorer drag", () => {
  it("writes the custom MIME type on drag start", () => {
    expect(JSON_PATH_DRAG_MIME_TYPE).toBe("application/x-requestly-jsonpath");
    render(
      <JsonPathExplorer data={{ "a.b": 2 }} onSelect={vi.fn()} />,
    );
    const setData = vi.fn();
    const leaf = screen.getByText("a.b:").closest("button") as HTMLElement;
    fireEvent.dragStart(leaf, {
      dataTransfer: { setData, effectAllowed: "" },
    });
    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith(
      JSON_PATH_DRAG_MIME_TYPE,
      JSON.stringify({ jsonPath: "$['a.b']" }),
    );
  });
});
