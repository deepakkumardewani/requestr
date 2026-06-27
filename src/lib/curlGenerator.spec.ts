import { describe, expect, it } from "vitest";
import { generateCurl } from "./curlGenerator";
import type { HttpTab } from "@/types";

const baseTab: HttpTab = {
  tabId: "t1",
  requestId: "r1",
  name: "Test Request",
  isDirty: false,
  type: "http",
  url: "https://api.example.com/users",
  method: "GET",
  headers: [],
  params: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
};

describe("generateCurl", () => {
  it("generates basic GET curl command", () => {
    const result = generateCurl(baseTab);
    expect(result).toContain("curl -X GET");
    expect(result).toContain("https://api.example.com/users");
  });

  it("uses resolvedUrl when provided", () => {
    const result = generateCurl(baseTab, "https://proxy.example.com/api");
    expect(result).toContain("https://proxy.example.com/api");
  });

  it("adds bearer auth header", () => {
    const tab: HttpTab = {
      ...baseTab,
      auth: { type: "bearer", token: "abc123" },
    };
    const result = generateCurl(tab);
    expect(result).toContain("-H 'Authorization: Bearer abc123'");
  });

  it("adds basic auth header", () => {
    const tab: HttpTab = {
      ...baseTab,
      auth: { type: "basic", username: "user", password: "pass" },
    };
    const result = generateCurl(tab);
    expect(result).toContain("-H 'Authorization: Basic");
  });

  it("adds api-key header when addTo is header", () => {
    const tab: HttpTab = {
      ...baseTab,
      auth: { type: "api-key", key: "X-API-Key", value: "secret", addTo: "header" },
    };
    const result = generateCurl(tab);
    expect(result).toContain("-H 'X-API-Key: secret'");
  });

  it("does not add api-key header when addTo is query", () => {
    const tab: HttpTab = {
      ...baseTab,
      auth: { type: "api-key", key: "x", value: "v", addTo: "query" },
    };
    const result = generateCurl(tab);
    expect(result).not.toContain("-H 'x: v'");
  });

  it("includes enabled headers", () => {
    const tab: HttpTab = {
      ...baseTab,
      headers: [
        { id: "h1", key: "Content-Type", value: "application/json", enabled: true },
        { id: "h2", key: "X-Disabled", value: "should-not-appear", enabled: false },
        { id: "h3", key: "", value: "empty-key", enabled: true },
      ],
    };
    const result = generateCurl(tab);
    expect(result).toContain("-H 'Content-Type: application/json'");
    expect(result).not.toContain("X-Disabled");
    expect(result).not.toContain("empty-key");
  });

  it("includes body for json type", () => {
    const tab: HttpTab = {
      ...baseTab,
      method: "POST",
      body: { type: "json", content: '{"name":"test"}' },
    };
    const result = generateCurl(tab);
    expect(result).toContain("-d '{\"name\":\"test\"}'");
  });

  it("escapes single quotes in body content", () => {
    const tab: HttpTab = {
      ...baseTab,
      method: "POST",
      body: { type: "text", content: "it's a test" },
    };
    const result = generateCurl(tab);
    expect(result).toContain("-d 'it'\\''s a test'");
  });

  it("does not add body when type is none", () => {
    const result = generateCurl({ ...baseTab, body: { type: "none", content: "" } });
    expect(result).not.toContain("-d ");
  });

  it("includes form-data fields", () => {
    const tab: HttpTab = {
      ...baseTab,
      method: "POST",
      body: {
        type: "form-data",
        content: "",
        formData: [
          { id: "f1", key: "field1", value: "val1", enabled: true },
          { id: "f2", key: "field2", value: "val2", enabled: false },
        ],
      },
    };
    const result = generateCurl(tab);
    expect(result).toContain("-F 'field1=val1'");
    expect(result).not.toContain("field2");
  });

  it("includes urlencoded data", () => {
    const tab: HttpTab = {
      ...baseTab,
      method: "POST",
      body: {
        type: "urlencoded",
        content: "",
        formData: [
          { id: "f1", key: "foo", value: "bar", enabled: true },
          { id: "f2", key: "baz", value: "qux", enabled: true },
        ],
      },
    };
    const result = generateCurl(tab);
    expect(result).toContain("--data-urlencode");
    expect(result).toContain("foo=bar");
    expect(result).toContain("baz=qux");
  });

  it("does not include urlencoded when no enabled fields", () => {
    const tab: HttpTab = {
      ...baseTab,
      method: "POST",
      body: {
        type: "urlencoded",
        content: "",
        formData: [
          { id: "f1", key: "foo", value: "bar", enabled: false },
        ],
      },
    };
    const result = generateCurl(tab);
    expect(result).not.toContain("--data-urlencode");
  });

  it("joins lines with continuation backslash", () => {
    const tab: HttpTab = {
      ...baseTab,
      headers: [
        { id: "h1", key: "Accept", value: "application/json", enabled: true },
      ],
    };
    const result = generateCurl(tab);
    expect(result).toContain(" \\\n");
  });

  it("handles POST with no body gracefully", () => {
    const result = generateCurl({ ...baseTab, method: "POST" });
    expect(result).toContain("curl -X POST");
    expect(result).not.toContain("-d ");
    expect(result).not.toContain("-F ");
  });
});
