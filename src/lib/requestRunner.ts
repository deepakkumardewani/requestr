import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { parseTimingHeaders } from "@/lib/timingParser";
import type {
  AuthConfig,
  BodyConfig,
  HttpMethod,
  KVPair,
  RequestError,
  ResponseData,
} from "@/types";

type ResolvedRequest = {
  method: HttpMethod;
  url: string;
  headers: KVPair[];
  body: BodyConfig;
  auth: AuthConfig;
  sslVerify?: boolean;
  followRedirects?: boolean;
  timeoutMs?: number;
};

type ProxyResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
  code?: string;
};

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function buildHeaders(request: ResolvedRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const h of request.headers) {
    if (h.enabled && h.key) {
      headers[h.key] = h.value;
    }
  }

  // Auth headers
  if (request.auth.type === "bearer") {
    headers.Authorization = `Bearer ${request.auth.token}`;
  } else if (request.auth.type === "basic") {
    const encoded = btoa(`${request.auth.username}:${request.auth.password}`);
    headers.Authorization = `Basic ${encoded}`;
  } else if (
    request.auth.type === "api-key" &&
    request.auth.addTo === "header"
  ) {
    headers[request.auth.key] = request.auth.value;
  }

  // Content-Type defaults for body (header names are case-insensitive)
  if (!hasHeader(headers, "Content-Type")) {
    if (request.body.type === "json") {
      headers["Content-Type"] = "application/json";
    } else if (request.body.type === "xml") {
      headers["Content-Type"] = "application/xml";
    } else if (request.body.type === "urlencoded") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }

  return headers;
}

function buildBody(request: ResolvedRequest): string | null {
  const { body } = request;

  if (body.type === "none") return null;

  if (["json", "xml", "text", "html"].includes(body.type)) {
    return body.content || null;
  }

  if (body.type === "urlencoded" && body.formData) {
    const enabled = body.formData.filter((f) => f.enabled && f.key);
    if (enabled.length === 0) return null;
    return enabled
      .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join("&");
  }

  // form-data — not supported via proxy text body (would need multipart)
  return body.content || null;
}

type ProxyRequestPayload = {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
  sslVerify: boolean;
  followRedirects: boolean;
  timeoutMs: number;
};

async function executeProxy(
  proxyPayload: ProxyRequestPayload,
  responseMeta: { url: string; method: HttpMethod },
  signal?: AbortSignal,
): Promise<ResponseData> {
  const start = performance.now();

  let proxyResponse: Response;
  try {
    proxyResponse = await fetch("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proxyPayload),
      signal,
    });
  } catch (cause) {
    const error: RequestError = {
      type: "network",
      message: "Failed to reach the proxy server",
      cause: cause instanceof Error ? cause.message : String(cause),
    };
    throw error;
  }

  let data: ProxyResponse;
  try {
    data = (await proxyResponse.json()) as ProxyResponse;
  } catch (cause) {
    const error: RequestError = {
      type: "parse",
      message: "Failed to parse proxy response",
      cause: cause instanceof Error ? cause.message : String(cause),
    };
    throw error;
  }

  if (!proxyResponse.ok || data.error) {
    if (data.code === "TIMEOUT") {
      const error: RequestError = {
        type: "timeout",
        message: data.error ?? "Request timed out",
        cause: data.code,
      };
      throw error;
    }
    const error: RequestError = {
      type: "proxy",
      message: data.error ?? `Proxy returned ${proxyResponse.status}`,
      cause: data.code,
    };
    throw error;
  }

  const duration = performance.now() - start;
  const size = new TextEncoder().encode(data.body).length;

  const proxyHeaders: Record<string, string> = {};
  proxyResponse.headers.forEach((value, key) => {
    proxyHeaders[key] = value;
  });
  const timing = parseTimingHeaders(proxyHeaders, duration);

  return {
    status: data.status,
    statusText: data.statusText,
    headers: data.headers,
    body: data.body,
    duration,
    size,
    url: responseMeta.url,
    method: responseMeta.method,
    timestamp: Date.now(),
    timing,
  };
}

export async function runRequest(
  request: ResolvedRequest,
  signal?: AbortSignal,
): Promise<ResponseData> {
  const headers = buildHeaders(request);
  const body = buildBody(request);

  let url = request.url;
  if (request.auth.type === "api-key" && request.auth.addTo === "query") {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}${encodeURIComponent(
      request.auth.key,
    )}=${encodeURIComponent(request.auth.value)}`;
  }

  return executeProxy(
    {
      url,
      method: request.method,
      headers,
      body: body ?? undefined,
      sslVerify: request.sslVerify ?? true,
      followRedirects: request.followRedirects ?? true,
      timeoutMs: request.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    },
    { url: request.url, method: request.method },
    signal,
  );
}

export type GraphQLResolvedRequest = {
  url: string;
  headers: KVPair[];
  auth: AuthConfig;
  query: string;
  variablesJson: string;
  operationName: string;
  sslVerify?: boolean;
  followRedirects?: boolean;
  timeoutMs?: number;
};

function parseGraphQLVariables(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (trimmed === "") return {};
  const parsed: unknown = JSON.parse(trimmed);
  if (parsed === null) return null;
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Variables must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

/**
 * GraphQL over HTTP: POST with JSON body { query, variables, operationName? }.
 */
export async function runGraphQLRequest(
  request: GraphQLResolvedRequest,
  signal?: AbortSignal,
): Promise<ResponseData> {
  let variables: Record<string, unknown> | null;
  try {
    variables = parseGraphQLVariables(request.variablesJson);
  } catch (e) {
    const error: RequestError = {
      type: "parse",
      message: e instanceof Error ? e.message : "Invalid variables JSON",
      cause: e instanceof Error ? undefined : String(e),
    };
    throw error;
  }

  const bodyPayload: Record<string, unknown> = {
    query: request.query,
    variables: variables ?? null,
  };
  const op = request.operationName.trim();
  if (op) bodyPayload.operationName = op;

  const bodyString = JSON.stringify(bodyPayload);

  // buildHeaders adds application/json for the json body unless the user already set Content-Type (any case).
  const headerRecord = buildHeaders({
    method: "POST",
    url: request.url,
    headers: request.headers,
    body: { type: "json", content: bodyString },
    auth: request.auth,
  });

  let url = request.url;
  if (request.auth.type === "api-key" && request.auth.addTo === "query") {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}${encodeURIComponent(
      request.auth.key,
    )}=${encodeURIComponent(request.auth.value)}`;
  }

  return executeProxy(
    {
      url,
      method: "POST",
      headers: headerRecord,
      body: bodyString,
      sslVerify: request.sslVerify ?? true,
      followRedirects: request.followRedirects ?? true,
      timeoutMs: request.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    },
    { url: request.url, method: "POST" },
    signal,
  );
}
