import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_PROXY_RESPONSE_BYTES,
} from "@/lib/constants";
import { POST } from "./route";

const agentInstances: Array<{ options: unknown }> = [];

vi.mock("undici", () => ({
  Agent: class {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
      agentInstances.push(this);
    }
  },
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/proxy", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    agentInstances.length = 0;
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/proxy", {
      method: "POST",
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { code: string };
    expect(data.code).toBe("INVALID_PAYLOAD");
  });

  it("returns 400 when url is missing", async () => {
    const res = await POST(jsonRequest({ method: "GET" }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { code: string };
    expect(data.code).toBe("MISSING_URL");
  });

  it("returns 400 when url is invalid", async () => {
    const res = await POST(jsonRequest({ url: "not a url", method: "GET" }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { code: string };
    expect(data.code).toBe("INVALID_URL");
  });

  it("proxies a valid request and returns status, headers, body, and timing headers", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("hello", {
        status: 201,
        statusText: "Created",
        headers: {
          "Content-Type": "text/plain",
          "X-Upstream": "1",
        },
      }),
    );

    const res = await POST(
      jsonRequest({
        url: "https://example.com/path",
        method: "get",
        headers: { Authorization: "Bearer x" },
      }),
    );

    expect(res.status).toBe(200);
    const ttfb = Number(res.headers.get("X-Timing-TTFB"));
    const download = Number(res.headers.get("X-Timing-Download"));
    const total = Number(res.headers.get("X-Timing-Total"));
    expect([ttfb, download, total].every(Number.isFinite)).toBe(true);
    expect(ttfb).toBeGreaterThanOrEqual(0);
    expect(download).toBeGreaterThanOrEqual(0);
    expect(total).toBeGreaterThanOrEqual(ttfb);

    const data = (await res.json()) as {
      status: number;
      statusText: string;
      body: string;
      headers: Record<string, string>;
    };

    expect(data.status).toBe(201);
    expect(data.statusText).toBe("Created");
    expect(data.body).toBe("hello");
    expect(data.headers["content-type"]).toContain("text/plain");
    expect(data.headers["x-upstream"]).toBe("1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/path",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer x" },
        body: undefined,
        redirect: "follow",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("forwards the request body and headers verbatim and uppercases the method", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("ok"));

    await POST(
      jsonRequest({
        url: "https://example.com/items",
        method: "patch",
        headers: { "Content-Type": "application/json", "X-Trace": "abc" },
        body: '{"a":1}',
      }),
    );

    const init = vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Trace": "abc",
    });
    expect(init.body).toBe('{"a":1}');
  });

  it("returns 504 TIMEOUT when the upstream fetch aborts", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(abortError);

    const res = await POST(
      jsonRequest({ url: "https://example.com/slow", method: "GET" }),
    );

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: "Request timed out",
      code: "TIMEOUT",
    });
  });

  describe("timeoutMs", () => {
    async function scheduledTimeout(timeoutMs?: unknown): Promise<unknown> {
      const spy = vi.spyOn(globalThis, "setTimeout");
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("ok"));
      await POST(
        jsonRequest({
          url: "https://example.com/",
          method: "GET",
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
        }),
      );
      const abortTimer = spy.mock.calls.find(
        ([, delay]) => typeof delay === "number" && delay >= 1_000,
      );
      return abortTimer?.[1];
    }

    it.each([
      ["below the minimum", 5, 1_000],
      ["zero", 0, 1_000],
      ["negative", -50, 1_000],
      ["above the maximum", 9_999_999, 600_000],
      ["inside the range", 45_000, 45_000],
      ["at the minimum", 1_000, 1_000],
      ["at the maximum", 600_000, 600_000],
    ])("clamps a timeout %s", async (_label, input, expected) => {
      expect(await scheduledTimeout(input)).toBe(expected);
    });

    it.each([
      ["a string", "5000"],
      ["null", null],
      ["omitted", undefined],
    ])("uses the default timeout when timeoutMs is %s", async (_label, input) => {
      expect(await scheduledTimeout(input)).toBe(
        Math.min(Math.max(DEFAULT_REQUEST_TIMEOUT_MS, 1_000), 600_000),
      );
    });
  });

  it("characterizes duplicate Set-Cookie upstream headers as collapsed to one value (D8, no fix)", async () => {
    const upstreamHeaders = new Headers();
    upstreamHeaders.append("Set-Cookie", "a=1; Path=/");
    upstreamHeaders.append("Set-Cookie", "b=2; Path=/");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("ok", { headers: upstreamHeaders }),
    );

    const res = await POST(
      jsonRequest({ url: "https://example.com/", method: "GET" }),
    );
    const data = (await res.json()) as { headers: Record<string, string> };

    expect(typeof data.headers["set-cookie"]).toBe("string");
    expect(data.headers["set-cookie"]).toMatch(/^(a=1|b=2)/);
    expect(
      ["a=1; Path=/", "b=2; Path=/"].filter((c) =>
        data.headers["set-cookie"].includes(c),
      ),
    ).toHaveLength(1);
  });

  it("sends redirect manual when followRedirects is false", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(""));

    await POST(
      jsonRequest({
        url: "https://example.com/",
        method: "POST",
        followRedirects: false,
      }),
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        redirect: "manual",
      }),
    );
  });

  it("returns 413 when Content-Length exceeds limit", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: {
          "content-length": String(MAX_PROXY_RESPONSE_BYTES + 1),
        },
      }),
    );

    const res = await POST(
      jsonRequest({ url: "https://example.com/big", method: "GET" }),
    );

    expect(res.status).toBe(413);
    const data = (await res.json()) as { code: string };
    expect(data.code).toBe("RESPONSE_TOO_LARGE");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns 413 when actual body exceeds limit after read", async () => {
    const huge = "z".repeat(MAX_PROXY_RESPONSE_BYTES + 1);
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(huge, {
        status: 200,
        headers: {},
      }),
    );

    const res = await POST(
      jsonRequest({ url: "https://example.com/stream", method: "GET" }),
    );

    expect(res.status).toBe(413);
    const data = (await res.json()) as { code: string };
    expect(data.code).toBe("RESPONSE_TOO_LARGE");
  });

  it("returns 502 when fetch throws", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error("ECONNREFUSED"),
    );

    const res = await POST(
      jsonRequest({ url: "https://example.com/offline", method: "GET" }),
    );

    expect(res.status).toBe(502);
    const data = (await res.json()) as { code: string; error: string };
    expect(data.code).toBe("UPSTREAM_ERROR");
    expect(data.error).toContain("ECONNREFUSED");
  });

  it("returns 502 when fetch throws a non-Error value", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce("boom");

    const res = await POST(
      jsonRequest({ url: "https://example.com/", method: "GET" }),
    );

    expect(res.status).toBe(502);
    const data = (await res.json()) as { code: string };
    expect(data.code).toBe("UPSTREAM_ERROR");
  });

  describe("sslVerify", () => {
    function upstreamInit() {
      return vi.mocked(globalThis.fetch).mock.calls[0][1] as {
        dispatcher?: unknown;
      };
    }

    beforeEach(() => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("ok"));
    });

    it("disables upstream TLS verification when sslVerify is false", async () => {
      await POST(
        jsonRequest({
          url: "https://self-signed.test/",
          method: "GET",
          sslVerify: false,
        }),
      );

      expect(agentInstances).toHaveLength(1);
      expect(agentInstances[0].options).toEqual({
        connect: { rejectUnauthorized: false },
      });
      expect(upstreamInit().dispatcher).toBe(agentInstances[0]);
    });

    it.each([
      ["true", { sslVerify: true }],
      ["omitted", {}],
    ])("keeps TLS verification on when sslVerify is %s", async (_, extra) => {
      await POST(
        jsonRequest({ url: "https://example.test/", method: "GET", ...extra }),
      );

      expect(agentInstances).toHaveLength(0);
      expect(upstreamInit().dispatcher).toBeUndefined();
    });
  });
});
