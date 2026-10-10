import { describe, expect, it } from "vitest";
import {
  IMPORT_FORMAT_LABELS,
  type ImportScanResult,
  type ImportScanSuccess,
  SUPPORTED_IMPORT_FORMATS,
  scanCurlText,
  scanFileContent,
  scanOpenApiText,
} from "./importScanner";

const POSTMAN_SCHEMA =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function postmanDoc(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    info: { name: "Pets API", schema: POSTMAN_SCHEMA },
    item: [
      {
        name: "Admin",
        item: [
          {
            name: "List users",
            request: { method: "GET", url: "https://api.test/users" },
          },
        ],
      },
      {
        name: "Ping",
        request: { method: "GET", url: "https://api.test/ping" },
      },
    ],
    ...extra,
  });
}

function insomniaV4Doc(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    _type: "export",
    __export_format: 4,
    resources: [
      { _id: "wrk_1", _type: "workspace", name: "Insomnia WS" },
      {
        _id: "req_1",
        _type: "request",
        parentId: "wrk_1",
        name: "Get thing",
        method: "GET",
        url: "https://ins.test/thing",
        headers: [],
      },
    ],
    ...extra,
  });
}

const OPENAPI_JSON = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Store API", version: "1" },
  servers: [{ url: "https://store.test" }],
  paths: {
    "/items": { get: { summary: "List items" }, post: { summary: "Add" } },
  },
});

const OPENAPI_YAML = `openapi: 3.0.0
info:
  title: Yaml API
  version: "1"
paths:
  /a:
    get:
      summary: A
`;

const SWAGGER_JSON = JSON.stringify({
  swagger: "2.0",
  info: { title: "Legacy API", version: "1" },
  host: "legacy.test",
  schemes: ["https"],
  paths: { "/old": { get: {} } },
});

function expectSuccess(result: ImportScanResult): ImportScanSuccess {
  if (!result.ok) {
    throw new Error(`Expected scan success, got error: ${result.error}`);
  }
  return result;
}

function expectError(result: ImportScanResult): string {
  if (result.ok) {
    throw new Error(`Expected scan failure, got format ${result.format}`);
  }
  return result.error;
}

describe("scanFileContent", () => {
  it("detects a Postman collection and summarizes requests and folders", () => {
    const result = expectSuccess(scanFileContent(postmanDoc(), "pets.json"));

    expect(result.format).toBe("postman");
    expect(result.sourceLabel).toBe("pets.json");
    expect(result.summary).toEqual({
      requestCount: 2,
      collectionCount: 1,
      folderCount: 1,
      primaryName: "Pets API",
      additionalNames: [],
    });
  });

  it("detects an Insomnia v4 JSON export", () => {
    const result = expectSuccess(scanFileContent(insomniaV4Doc(), "ins.json"));

    expect(result.format).toBe("insomnia");
    expect(result.summary.requestCount).toBe(1);
    expect(result.summary.collectionCount).toBe(1);
    expect(result.payload.format).toBe("insomnia");
  });

  it("detects an Insomnia v5 YAML export", () => {
    const yamlText = `type: collection.insomnia.rest/5.0
name: V5 Collection
collection:
  - name: Hello
    method: GET
    url: https://v5.test/hello
`;

    const result = expectSuccess(scanFileContent(yamlText, "v5.yaml"));

    expect(result.format).toBe("insomnia");
    expect(result.summary.requestCount).toBe(1);
  });

  it("detects an OpenAPI 3 JSON document and counts one request per operation", () => {
    const result = expectSuccess(scanFileContent(OPENAPI_JSON, "api.json"));

    expect(result.format).toBe("openapi");
    expect(result.summary).toEqual({
      requestCount: 2,
      collectionCount: 1,
      folderCount: 0,
      primaryName: "Store API",
      additionalNames: [],
    });
  });

  it("detects an OpenAPI 3 YAML document", () => {
    const result = expectSuccess(scanFileContent(OPENAPI_YAML, "api.yaml"));

    expect(result.format).toBe("openapi");
    expect(result.summary.primaryName).toBe("Yaml API");
  });

  it("detects a Swagger 2.0 document as openapi", () => {
    const result = expectSuccess(scanFileContent(SWAGGER_JSON, "sw.json"));

    expect(result.format).toBe("openapi");
    expect(result.summary.primaryName).toBe("Legacy API");
  });

  it("prefers Insomnia over Postman when a document matches both shapes", () => {
    const both = JSON.stringify({
      ...JSON.parse(insomniaV4Doc()),
      ...JSON.parse(postmanDoc()),
    });

    const result = expectSuccess(scanFileContent(both, "both.json"));

    expect(result.format).toBe("insomnia");
  });

  it("prefers OpenAPI over Postman when a document matches both shapes", () => {
    const both = JSON.stringify({
      ...JSON.parse(OPENAPI_JSON),
      ...JSON.parse(postmanDoc()),
      info: { title: "Dual", version: "1", schema: POSTMAN_SCHEMA },
    });

    const result = expectSuccess(scanFileContent(both, "dual.json"));

    expect(result.format).toBe("openapi");
  });

  it("prefers Insomnia over OpenAPI when a document matches both shapes", () => {
    const both = JSON.stringify({
      ...JSON.parse(OPENAPI_JSON),
      ...JSON.parse(insomniaV4Doc()),
    });

    const result = expectSuccess(scanFileContent(both, "both.json"));

    expect(result.format).toBe("insomnia");
  });

  it("rejects valid JSON of an unknown shape with the supported-formats message", () => {
    const error = expectError(scanFileContent('{"hello":"world"}', "x.json"));

    expect(error).toBe(
      "Unrecognized format. Supported: OpenAPI 3 / Swagger 2, Postman v2.1, Insomnia v4/v5.",
    );
  });

  it("rejects a JSON array as unrecognized", () => {
    const error = expectError(scanFileContent("[1,2,3]", "x.json"));

    expect(error).toMatch(/^Unrecognized format/);
  });

  it("rejects a plain scalar document as unrecognized", () => {
    const error = expectError(scanFileContent("just some text", "x.txt"));

    expect(error).toMatch(/^Unrecognized format/);
  });

  it("surfaces the Postman parser error when the collection has no requests", () => {
    const empty = JSON.stringify({
      info: { name: "Empty", schema: POSTMAN_SCHEMA },
      item: [],
    });

    const error = expectError(scanFileContent(empty, "empty.json"));

    expect(error).toBe("No requests found in the Postman collection");
  });

  it("surfaces the OpenAPI parser error when the spec has no operations", () => {
    const noOps = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "T", version: "1" },
      paths: {},
    });

    const error = expectError(scanFileContent(noOps, "noops.json"));

    expect(error).toBe("No operations found in specification");
  });

  it("surfaces the Insomnia parser error when the export has no requests", () => {
    const empty = JSON.stringify({
      _type: "export",
      resources: [{ _id: "wrk_1", _type: "workspace", name: "W" }],
    });

    const error = expectError(scanFileContent(empty, "empty.json"));

    expect(error).toMatch(/^No requests found in Insomnia/);
  });

  it("reports malformed YAML as a failed scan instead of throwing", () => {
    const error = expectError(scanFileContent("a: [unclosed", "bad.yaml"));

    expect(error.length).toBeGreaterThan(0);
  });
});

describe("scanOpenApiText", () => {
  it("scans pasted OpenAPI JSON with surrounding whitespace", () => {
    const result = expectSuccess(scanOpenApiText(`\n  ${OPENAPI_JSON}\n `));

    expect(result.format).toBe("openapi");
    expect(result.sourceLabel).toBe("OpenAPI specification");
    expect(result.summary.requestCount).toBe(2);
    expect(result.summary.primaryName).toBe("Store API");
  });

  it("scans pasted OpenAPI YAML", () => {
    const result = expectSuccess(scanOpenApiText(OPENAPI_YAML));

    expect(result.summary.primaryName).toBe("Yaml API");
  });

  it("exposes collection name and drafts in the openapi payload", () => {
    const result = expectSuccess(scanOpenApiText(OPENAPI_JSON));

    if (result.payload.format !== "openapi") {
      throw new Error("expected openapi payload");
    }
    expect(result.payload.collectionName).toBe("Store API");
    expect(result.payload.requests).toHaveLength(2);
  });

  it("rejects empty text with the Empty document message", () => {
    expect(expectError(scanOpenApiText("   "))).toBe("Empty document");
  });

  it("rejects a document that is neither OpenAPI 3 nor Swagger 2", () => {
    expect(expectError(scanOpenApiText('{"foo":1}'))).toBe(
      "Not a valid OpenAPI 3.x or Swagger 2.0 document",
    );
  });

  it("rejects a spec without a paths object", () => {
    const noPaths = JSON.stringify({ openapi: "3.0.0", info: { title: "T" } });

    expect(expectError(scanOpenApiText(noPaths))).toBe(
      "Missing or invalid `paths` object",
    );
  });
});

describe("scanCurlText", () => {
  it("scans a simple GET and names the summary after method and url", () => {
    const result = expectSuccess(scanCurlText("curl https://api.test/users"));

    expect(result.format).toBe("curl");
    expect(result.sourceLabel).toBe("cURL command");
    expect(result.summary).toEqual({
      requestCount: 1,
      collectionCount: 0,
      folderCount: 0,
      primaryName: "GET https://api.test/users",
      additionalNames: [],
    });
  });

  it("uses the explicit method in the summary name", () => {
    const result = expectSuccess(
      scanCurlText("  curl -X DELETE https://api.test/users/1  "),
    );

    expect(result.summary.primaryName).toBe("DELETE https://api.test/users/1");
  });

  it("carries the parsed request in the curl payload", () => {
    const result = expectSuccess(
      scanCurlText(`curl -X POST https://api.test/x -H "A: b" -d '{"k":1}'`),
    );

    if (result.payload.format !== "curl") {
      throw new Error("expected curl payload");
    }
    expect(result.payload.parsed.method).toBe("POST");
    expect(result.payload.parsed.url).toBe("https://api.test/x");
  });

  it("rejects input that does not start with curl", () => {
    expect(expectError(scanCurlText("wget https://x.test"))).toBe(
      'Input must start with "curl"',
    );
  });

  it("rejects a curl command with no URL", () => {
    expect(expectError(scanCurlText("curl -X GET"))).toBe(
      "No URL found in cURL command",
    );
  });

  it("rejects an unknown HTTP method", () => {
    expect(expectError(scanCurlText("curl -X FETCH https://x.test"))).toBe(
      'Unknown HTTP method: "FETCH"',
    );
  });
});

describe("import format metadata", () => {
  it("lists every supported import format id once", () => {
    const ids = SUPPORTED_IMPORT_FORMATS.map((f) => f.id);

    expect(ids).toEqual(["postman", "insomnia", "openapi", "swagger", "curl"]);
  });

  it("labels each scan format for display", () => {
    expect(IMPORT_FORMAT_LABELS).toEqual({
      postman: "Postman",
      insomnia: "Insomnia",
      openapi: "OpenAPI / Swagger",
      curl: "cURL",
    });
  });
});
