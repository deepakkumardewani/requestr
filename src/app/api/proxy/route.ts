import { NextResponse } from "next/server";
import { Agent } from "undici";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_PROXY_RESPONSE_BYTES,
} from "@/lib/constants";

type ProxyRequest = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  followRedirects?: boolean;
  sslVerify?: boolean;
  timeoutMs?: number;
};

export async function POST(req: Request): Promise<NextResponse> {
  let payload: ProxyRequest;

  try {
    payload = (await req.json()) as ProxyRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  const {
    url,
    method,
    headers = {},
    body,
    followRedirects = true,
    sslVerify = true,
  } = payload;
  const timeoutRaw =
    typeof payload.timeoutMs === "number"
      ? payload.timeoutMs
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const timeoutMs = Math.min(Math.max(timeoutRaw, 1_000), 600_000);

  if (!url) {
    return NextResponse.json(
      { error: "Missing required field: url", code: "MISSING_URL" },
      { status: 400 },
    );
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: `Invalid URL: "${url}"`, code: "INVALID_URL" },
      { status: 400 },
    );
  }

  try {
    const t0 = performance.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body: body ?? undefined,
        redirect: followRedirects ? "follow" : "manual",
        signal: controller.signal,
        // Node's fetch only accepts a TLS override through an undici dispatcher.
        ...(sslVerify
          ? {}
          : {
              dispatcher: new Agent({ connect: { rejectUnauthorized: false } }),
            }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const ttfb = performance.now() - t0;

    // Guard against huge responses
    const contentLength = upstream.headers.get("content-length");
    if (
      contentLength &&
      Number.parseInt(contentLength, 10) > MAX_PROXY_RESPONSE_BYTES
    ) {
      return NextResponse.json(
        {
          error: `Response too large (${contentLength} bytes). Maximum is ${MAX_PROXY_RESPONSE_BYTES} bytes.`,
          code: "RESPONSE_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    const responseBody = await upstream.text();
    const total = performance.now() - t0;
    const download = total - ttfb;

    // Double-check actual size after reading
    if (
      new TextEncoder().encode(responseBody).length > MAX_PROXY_RESPONSE_BYTES
    ) {
      return NextResponse.json(
        {
          error: "Response body exceeds 50MB limit",
          code: "RESPONSE_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    // Collect response headers
    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json(
      {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
        body: responseBody,
      },
      {
        headers: {
          "X-Timing-TTFB": String(Math.round(ttfb * 100) / 100),
          "X-Timing-Download": String(Math.round(download * 100) / 100),
          "X-Timing-Total": String(Math.round(total * 100) / 100),
        },
      },
    );
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      return NextResponse.json(
        {
          error: "Request timed out",
          code: "TIMEOUT",
        },
        { status: 504 },
      );
    }
    const message =
      cause instanceof Error ? cause.message : "Unknown network error";

    return NextResponse.json(
      {
        error: `Failed to fetch upstream: ${message}`,
        code: "UPSTREAM_ERROR",
      },
      { status: 502 },
    );
  }
}
