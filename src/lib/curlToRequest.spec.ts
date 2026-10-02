import { describe, expect, it } from "vitest";
import {
  CURL_ERROR_REASONS,
  CurlToRequestError,
  curlToRequest,
  deriveRequestName,
} from "@/lib/curlToRequest";

function reasonOf(input: string) {
  try {
    curlToRequest(input);
  } catch (error) {
    expect(error).toBeInstanceOf(CurlToRequestError);
    return (error as CurlToRequestError).reason;
  }
  throw new Error("expected curlToRequest to throw");
}

describe("curlToRequest", () => {
  it("converts a valid cURL with method, headers, body and auth", () => {
    const draft = curlToRequest(
      `curl -X POST https://api.test.dev/orders -H 'Content-Type: application/json' -H 'Authorization: Bearer abc' -d '{"a":1}'`,
    );
    expect(draft).toMatchObject({
      type: "http",
      tabId: "",
      requestId: null,
      method: "POST",
      url: "https://api.test.dev/orders",
      name: "POST /orders",
      body: { type: "json", content: '{"a":1}' },
      auth: { type: "bearer", token: "abc" },
      params: [],
    });
    expect(draft.headers.map((h) => h.key)).toEqual([
      "Content-Type",
      "Authorization",
    ]);
  });

  it("treats a https URL as GET", () => {
    expect(curlToRequest("https://example.com/users")).toMatchObject({
      method: "GET",
      url: "https://example.com/users",
      name: "GET /users",
    });
  });

  it("treats a bare host as GET over https", () => {
    expect(curlToRequest("api.example.com")).toMatchObject({
      method: "GET",
      url: "https://api.example.com",
      name: "GET /",
    });
  });

  it("parses multi-line backslash input as one command", () => {
    const draft = curlToRequest(
      "curl -X PUT \\\n  https://x.dev/items/1 \\\n  -H 'Accept: */*'",
    );
    expect(draft.method).toBe("PUT");
    expect(draft.url).toBe("https://x.dev/items/1");
    expect(draft.headers).toHaveLength(1);
  });

  it("tolerates leading and trailing whitespace", () => {
    expect(curlToRequest("  \n  curl https://x.dev/a  \n").name).toBe(
      "GET /a",
    );
  });

  it("is a valid curl case-insensitively and infers POST from body", () => {
    expect(curlToRequest("CURL https://x.dev -d hi").method).toBe("POST");
  });

  it.each([
    ["", "empty"],
    ["   \n ", "empty"],
    ["curl -X POST", "missingUrl"],
    ["curl", "missingUrl"],
    ["hello world", "notCurl"],
    ["curl -X FOO https://x.dev", "unknownMethod"],
    ["curl https://x.dev -H", "invalidHeader"],
    ["curl https://x.dev -H nocolon", "invalidHeader"],
  ])("rejects %j with reason %s", (input, reason) => {
    expect(reasonOf(input)).toBe(reason);
    expect(CURL_ERROR_REASONS).toContain(reason);
  });
});

describe("deriveRequestName", () => {
  it("uses the pathname without the query", () => {
    expect(deriveRequestName("GET", "https://x.dev/a/b?q=1")).toBe("GET /a/b");
  });

  it("falls back to the raw url when unparseable", () => {
    expect(deriveRequestName("GET", "{{base}}/x")).toBe("GET {{base}}/x");
  });
});
