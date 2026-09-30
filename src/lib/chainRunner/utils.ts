import { JSONPath } from "jsonpath-plus";
import type { RequestModel } from "@/types";
import type { ChainEdge, ChainInjection } from "@/types/chain";

/** Message used when an injection targets a non-JSON request body. */
export const INJECTION_ERROR_BODY_NOT_JSON = "Body is not JSON";

/**
 * Error thrown when injection fails (e.g., body is not JSON).
 */
export class InjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InjectionError";
  }
}

/**
 * True when an edge should be treated as carrying upstream response data
 * (rather than pure control-flow routing). API nodes' own "success"/"fail"
 * handles still gate which path runs, but the data on that path is real
 * response data and must remain available to downstream extraction —
 * only routing edges from condition-node branches (arbitrary branch ids)
 * are excluded.
 */
export function isExtractionEdge(edge: ChainEdge): boolean {
  return (
    !edge.branchId || edge.branchId === "success" || edge.branchId === "fail"
  );
}

/**
 * Extract a value from a JSON string using a JSONPath expression.
 * Returns null if extraction fails.
 */
export function extractJsonPath(
  responseBody: string,
  jsonPath: string,
): string | null {
  try {
    const parsed = JSON.parse(responseBody);
    const result = JSONPath({ path: jsonPath, json: parsed });
    if (Array.isArray(result) && result.length > 0) {
      return String(result[0]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Apply a single injection mapping to a request, returning a mutated copy.
 */
export function applyInjection(
  request: RequestModel,
  injection: ChainInjection,
  value: string,
  targetUrl?: string,
): RequestModel {
  const req = JSON.parse(JSON.stringify(request)) as RequestModel; // deep clone

  if (injection.targetField === "header") {
    const existing = req.headers.find((h) => h.key === injection.targetKey);
    if (existing) {
      existing.value = value;
    } else {
      req.headers.push({
        id: crypto.randomUUID(),
        key: injection.targetKey,
        value,
        enabled: true,
      });
    }
  } else if (injection.targetField === "url") {
    const separator = req.url.includes("?") ? "&" : "?";
    req.url = `${req.url}${separator}${encodeURIComponent(injection.targetKey)}=${encodeURIComponent(value)}`;
  } else if (injection.targetField === "path") {
    const baseUrl = targetUrl ?? req.url;
    const placeholder = `:${injection.targetKey}`;
    if (baseUrl.includes(placeholder)) {
      req.url = baseUrl.replace(placeholder, encodeURIComponent(value));
    } else {
      req.url = `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(value)}`;
    }
  } else if (injection.targetField === "body") {
    try {
      const bodyObj = JSON.parse(req.body.content ?? "{}");
      const key = injection.targetKey.replace(/^\$\./, "");
      const keys = key.split(".");
      let obj = bodyObj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (typeof obj[keys[i]] !== "object" || obj[keys[i]] === null) {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      req.body = { ...req.body, content: JSON.stringify(bodyObj, null, 2) };
    } catch {
      throw new InjectionError(INJECTION_ERROR_BODY_NOT_JSON);
    }
  }

  return req;
}
