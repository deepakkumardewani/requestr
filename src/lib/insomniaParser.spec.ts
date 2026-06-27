import { describe, expect, it } from "vitest";
import {
  InsomniaParseError,
  isInsomniaDocument,
  parseInsomnia,
} from "./insomniaParser";

function minimalRequest(
  id: string,
  parentId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    _id: id,
    _type: "request",
    parentId,
    name: "R1",
    method: "GET",
    url: "https://example.com",
    headers: [],
    ...overrides,
  };
}

describe("isInsomniaDocument", () => {
  it("returns true only for export shape", () => {
    expect(isInsomniaDocument({ _type: "export", resources: [] })).toBe(true);
    expect(
      isInsomniaDocument({
        _type: "export",
        resources: "bad" as unknown as unknown[],
      }),
    ).toBe(false);
    expect(isInsomniaDocument({ _type: "other" })).toBe(false);
  });
});

describe("parseInsomnia", () => {
  it("throws when not an export", () => {
    expect(() => parseInsomnia(JSON.stringify({ _type: "workspace", resources: [] }))).toThrow(
      InsomniaParseError,
    );
  });

  it("throws when no requests", () => {
    expect(() =>
      parseInsomnia(JSON.stringify({
        _type: "export",
        resources: [{ _type: "workspace", _id: "w1", name: "W" }],
      })),
    ).toThrow(/No requests found/);
  });

  it("groups requests by parent and parses bodies and auth", () => {
    const data = {
      _type: "export",
      resources: [
        { _type: "workspace", _id: "w1", name: "API" },
        { _type: "request_group", _id: "g1", name: "Folder A", parentId: "w1" },
        minimalRequest("r1", "g1", {
          method: "post",
          url: "https://x.test",
          headers: [{ name: "H", value: "v", disabled: false }],
          body: { mimeType: "application/json", text: '{"x":1}' },
          authentication: { type: "bearer", token: "t" },
        }),
      ],
    };
    const col = parseInsomnia(JSON.stringify(data));
    expect(col.folders).toHaveLength(1);
    expect(col.folders[0].name).toBe("Folder A");
    expect(col.requests[0].method).toBe("POST");
    expect(col.requests[0].auth).toEqual({ type: "bearer", token: "t" });
    expect(col.requests[0].body.type).toBe("json");
  });

  it("parses urlencoded body params", () => {
    const data = {
      _type: "export",
      resources: [
        { _type: "workspace", _id: "w1", name: "W" },
        minimalRequest("r1", "w1", {
          body: {
            mimeType: "application/x-www-form-urlencoded",
            params: [
              { name: "a", value: "1", disabled: false },
              { name: "b", value: "2", disabled: true },
            ],
          },
        }),
      ],
    };
    const col = parseInsomnia(JSON.stringify(data));
    expect(col.requests[0].body.type).toBe("urlencoded");
    if (col.requests[0].body.type === "urlencoded") {
      expect(col.requests[0].body.formData).toEqual([
        expect.objectContaining({ key: "a", value: "1", enabled: true }),
        expect.objectContaining({ key: "b", value: "2", enabled: false }),
      ]);
    }
  });

  it("filters disabled headers", () => {
    const data = {
      _type: "export",
      resources: [
        { _type: "workspace", _id: "w1", name: "W" },
        minimalRequest("r1", "w1", {
          headers: [
            { name: "A", value: "1", disabled: true },
            { name: "B", value: "2" },
          ],
        }),
      ],
    };
    const col = parseInsomnia(JSON.stringify(data));
    expect(col.requests[0].headers.map((h) => h.key)).toEqual(["A", "B"]);
    expect(col.requests[0].headers.map((h) => h.enabled)).toEqual([false, true]);
  });
});
