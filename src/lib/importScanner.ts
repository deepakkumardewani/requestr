import { load as loadYaml } from "js-yaml";
import { CurlParseError, parseCurl } from "@/lib/curlParser";
import {
  InsomniaParseError,
  isInsomniaDocument,
  parseInsomnia,
} from "@/lib/insomniaParser";
import {
  isProbablyOpenApiDoc,
  OpenApiParseError,
  parseOpenApi,
} from "@/lib/openapiParser";
import {
  isPostmanCollection,
  type ParsedPostmanCollection,
  PostmanParseError,
  parsePostmanCollection,
} from "@/lib/postmanParser";
import type { HttpTab } from "@/types";

export type ImportFormat = "postman" | "insomnia" | "openapi" | "curl";

export type ImportScanSummary = {
  requestCount: number;
  collectionCount: number;
  folderCount: number;
  primaryName: string;
  additionalNames: string[];
};

type HttpTabDraft = Omit<HttpTab, "tabId" | "requestId" | "isDirty">;

export type ImportScanPayload =
  | { format: "postman"; data: ParsedPostmanCollection }
  | { format: "insomnia"; data: ParsedPostmanCollection }
  | { format: "openapi"; collectionName: string; requests: HttpTabDraft[] }
  | { format: "curl"; parsed: ReturnType<typeof parseCurl> };

export type ImportScanSuccess = {
  ok: true;
  format: ImportFormat;
  sourceLabel: string;
  summary: ImportScanSummary;
  payload: ImportScanPayload;
};

export type ImportScanResult = ImportScanSuccess | { ok: false; error: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseJsonOrYaml(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return loadYaml(text);
  }
}

function success(
  format: ImportFormat,
  sourceLabel: string,
  summary: ImportScanSummary,
  payload: ImportScanPayload,
): ImportScanSuccess {
  return { ok: true, format, sourceLabel, summary, payload };
}

function scanError(err: unknown, fallback: string): ImportScanResult {
  if (
    err instanceof PostmanParseError ||
    err instanceof InsomniaParseError ||
    err instanceof OpenApiParseError ||
    err instanceof CurlParseError
  ) {
    return { ok: false, error: err.message };
  }
  if (err instanceof Error) {
    return { ok: false, error: err.message };
  }
  return { ok: false, error: fallback };
}

export function scanFileContent(
  text: string,
  fileName: string,
): ImportScanResult {
  try {
    const parsed = parseJsonOrYaml(text);

    if (isRecord(parsed) && isInsomniaDocument(parsed)) {
      const data = parseInsomnia(text);
      return success(
        "insomnia",
        fileName,
        {
          requestCount: data.requests.length,
          collectionCount: 1,
          folderCount: data.folders.length,
          primaryName: data.name,
          additionalNames: [],
        },
        { format: "insomnia", data },
      );
    }

    if (isRecord(parsed) && isProbablyOpenApiDoc(parsed)) {
      const { collectionName, requests } = parseOpenApi(text);
      return success(
        "openapi",
        fileName,
        {
          requestCount: requests.length,
          collectionCount: 1,
          folderCount: 0,
          primaryName: collectionName,
          additionalNames: [],
        },
        { format: "openapi", collectionName, requests },
      );
    }

    if (isRecord(parsed) && isPostmanCollection(parsed)) {
      const data = parsePostmanCollection(parsed);
      return success(
        "postman",
        fileName,
        {
          requestCount: data.requests.length,
          collectionCount: 1,
          folderCount: data.folders.length,
          primaryName: data.name,
          additionalNames: [],
        },
        { format: "postman", data },
      );
    }

    return {
      ok: false,
      error:
        "Unrecognized format. Supported: OpenAPI 3 / Swagger 2, Postman v2.1, Insomnia v4/v5.",
    };
  } catch (err) {
    return scanError(err, "Failed to scan file");
  }
}

export function scanOpenApiText(text: string): ImportScanResult {
  try {
    const { collectionName, requests } = parseOpenApi(text.trim());
    return success(
      "openapi",
      "OpenAPI specification",
      {
        requestCount: requests.length,
        collectionCount: 1,
        folderCount: 0,
        primaryName: collectionName,
        additionalNames: [],
      },
      { format: "openapi", collectionName, requests },
    );
  } catch (err) {
    return scanError(err, "Failed to parse OpenAPI document");
  }
}

export function scanCurlText(text: string): ImportScanResult {
  try {
    const parsed = parseCurl(text.trim());
    return success(
      "curl",
      "cURL command",
      {
        requestCount: 1,
        collectionCount: 0,
        folderCount: 0,
        primaryName: `${parsed.method} ${parsed.url || "request"}`,
        additionalNames: [],
      },
      { format: "curl", parsed },
    );
  } catch (err) {
    return scanError(err, "Failed to parse cURL command");
  }
}

export const SUPPORTED_IMPORT_FORMATS = [
  {
    id: "postman",
    label: "Postman",
    hint: "Collection v2.1 JSON",
  },
  {
    id: "insomnia",
    label: "Insomnia",
    hint: "v4 JSON or v5 YAML",
  },
  {
    id: "openapi",
    label: "OpenAPI",
    hint: "3.x YAML or JSON",
  },
  {
    id: "swagger",
    label: "Swagger",
    hint: "2.0 YAML or JSON",
  },
  {
    id: "curl",
    label: "cURL",
    hint: "Single request",
  },
] as const;

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
  postman: "Postman",
  insomnia: "Insomnia",
  openapi: "OpenAPI / Swagger",
  curl: "cURL",
};
