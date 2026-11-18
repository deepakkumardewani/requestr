/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GROK_STT_MODEL,
  GROK_STT_URL,
  RELAY_REQUEST_RATE_MAX,
  STT_MAX_UPLOAD_BYTES,
} from "@/lib/relay/constants";
import { POST } from "./route";

const KEY = "xai-secret-key-123";
const fetchMock = vi.fn();
let errorSpy: ReturnType<typeof vi.spyOn>;

function wav(size = 4, type = "audio/wav"): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

/** A browser call with no Origin header must still vouch for itself. */
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };
/** Node's Request does not add Content-Length for FormData; browsers always do. */
const SMALL_UPLOAD = { "content-length": "1024" };

function request(
  fields: Record<string, string | Blob> | null,
  headers: Record<string, string> = {}
): Request {
  if (fields === null) {
    return new Request("http://app.test/api/relay/stt", {
      method: "POST",
      headers: { ...SAME_ORIGIN, ...SMALL_UPLOAD, "content-type": "text/plain", ...headers },
      body: "not a form",
    });
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string") form.append(k, v);
    else form.append(k, v, "a.wav");
  }
  return new Request("http://app.test/api/relay/stt", {
    method: "POST",
    headers: { ...SAME_ORIGIN, ...SMALL_UPLOAD, ...headers },
    body: form,
  });
}

beforeEach(() => {
  vi.stubEnv("XAI_API_KEY", KEY);
  vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "true");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/relay/stt guards", () => {
  it("rejects cross-origin first, before flag and key checks", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    vi.stubEnv("XAI_API_KEY", "");
    const res = await POST(
      request(
        { audio: wav() },
        { origin: "http://evil.test", host: "app.test" }
      )
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "relay_unavailable" });
  });

  it("returns 404 when the flag is off, before the key check", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    vi.stubEnv("XAI_API_KEY", "");
    const res = await POST(request({ audio: wav() }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });

  it("returns 503 when the key is missing", async () => {
    vi.stubEnv("XAI_API_KEY", "");
    const res = await POST(request({ audio: wav() }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable body", async () => {
    const res = await POST(request(null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_audio" });
  });

  it("returns 400 when the audio field is missing or not a file", async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ audio: "text" }))).status).toBe(400);
  });

  it("returns 415 for a non-WAV type", async () => {
    const res = await POST(request({ audio: wav(4, "audio/webm") }));
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "bad_audio" });
  });

  it("accepts a WAV type with parameters", async () => {
    fetchMock.mockResolvedValue(Response.json({ text: "ok" }));
    const res = await POST(request({ audio: wav(4, "audio/wav; codecs=1") }));
    expect(res.status).toBe(200);
  });

  it("returns 413 above the upload cap and accepts exactly the cap", async () => {
    const big = await POST(request({ audio: wav(STT_MAX_UPLOAD_BYTES + 1) }));
    expect(big.status).toBe(413);
    expect(await big.json()).toEqual({ error: "too_large" });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(Response.json({ text: "ok" }));
    const exact = await POST(request({ audio: wav(STT_MAX_UPLOAD_BYTES) }));
    expect(exact.status).toBe(200);
  });
});

describe("POST /api/relay/stt metering", () => {
  it("rejects an oversize Content-Length before buffering the form", async () => {
    const formData = vi.fn();
    const req = request(
      { audio: wav() },
      { "content-length": String(STT_MAX_UPLOAD_BYTES * 2) },
    );
    req.formData = formData;
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });

  it("rejects over-rate requests before buffering the form", async () => {
    const ip = { "x-real-ip": "203.0.113.50" };
    let last: Response | undefined;
    for (let i = 0; i <= RELAY_REQUEST_RATE_MAX; i += 1) {
      last = await POST(request(null, ip));
    }
    expect(last?.status).toBe(429);
    expect(await last?.json()).toEqual({ error: "rate_limited" });
  });

  it("does not need the LLM key", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("RELAY_API_KEY", "");
    fetchMock.mockResolvedValue(
      Response.json({ text: "hi", language: "en", duration: 1 }),
    );
    const res = await POST(request({ audio: wav() }, { "x-real-ip": "203.0.113.51" }));
    expect(res.status).toBe(200);
  });

  it("passes an abort signal upstream and maps an abort to unavailable", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    const res = await POST(request({ audio: wav() }, { "x-real-ip": "203.0.113.52" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps an upstream timeout to unavailable", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const res = await POST(request({ audio: wav() }, { "x-real-ip": "203.0.113.53" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("maps a non-Error rejection to unavailable", async () => {
    fetchMock.mockRejectedValue("boom");
    const res = await POST(request({ audio: wav() }, { "x-real-ip": "203.0.113.54" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it.each([
    ["missing", null],
    ["malformed", "abc"],
    ["negative", "-5"],
  ])("rejects a %s Content-Length before buffering the form", async (_label, value) => {
    const formData = vi.fn();
    const req = request(
      { audio: wav() },
      { "x-real-ip": "203.0.113.55", "content-length": value ?? "" },
    );
    if (value === null) req.headers.delete("content-length");
    req.formData = formData;
    const res = await POST(req);
    expect(res.status).toBe(411);
    expect(await res.json()).toEqual({ error: "bad_audio" });
    expect(formData).not.toHaveBeenCalled();
  });
});

describe("POST /api/relay/stt upstream", () => {
  it("forwards the form with the key header and returns only three fields", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ text: "hi", language: "en", duration: 1.5, words: ["x"] })
    );
    const res = await POST(request({ audio: wav(), language: " en " }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      text: "hi",
      language: "en",
      duration: 1.5,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GROK_STT_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${KEY}`
    );
    const body = init.body as FormData;
    expect([...body.keys()]).toEqual(["model", "language", "format", "file"]);
    expect(body.get("model")).toBe(GROK_STT_MODEL);
    expect(body.get("language")).toBe("en");
  });

  it("omits language when blank and skips format for unsupported languages", async () => {
    fetchMock.mockResolvedValue(Response.json({ text: "hi" }));
    await POST(request({ audio: wav(), language: "  " }));
    expect([...(fetchMock.mock.calls[0][1].body as FormData).keys()]).toEqual([
      "model",
      "file",
    ]);

    await POST(request({ audio: wav(), language: "hi" }));
    expect([...(fetchMock.mock.calls[1][1].body as FormData).keys()]).toEqual([
      "model",
      "language",
      "file",
    ]);
  });

  it.each([
    [400, 400, "bad_audio"],
    [401, 502, "upstream_auth"],
    [413, 413, "too_large"],
    [502, 503, "unavailable"],
    [503, 503, "unavailable"],
  ])("maps upstream %i to %i %s", async (upstream, status, code) => {
    fetchMock.mockResolvedValue(
      new Response("secret body", {
        status: upstream,
        headers: { "x-request-id": "r1" },
      })
    );
    const res = await POST(request({ audio: wav() }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
    expect(res.headers.get("retry-after")).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("[relay/stt] upstream failed", {
      status: upstream,
      requestId: "r1",
    });
  });

  it("passes Retry-After through on a 429", async () => {
    fetchMock.mockResolvedValue(
      new Response("", { status: 429, headers: { "retry-after": "12" } })
    );
    const res = await POST(request({ audio: wav() }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  it("omits Retry-After on a 429 without the header", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    const res = await POST(request({ audio: wav() }));
    expect(res.headers.get("retry-after")).toBeNull();
  });

  it("returns 503 when the upstream is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const res = await POST(request({ audio: wav() }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("returns 502 for an unusable success payload", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    expect((await POST(request({ audio: wav() }))).status).toBe(502);
    fetchMock.mockResolvedValue(Response.json({ nope: 1 }));
    const res = await POST(request({ audio: wav() }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("never leaks the key into logs or responses", async () => {
    fetchMock.mockResolvedValue(new Response(KEY, { status: 500 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(request({ audio: wav() }));
    const logged = JSON.stringify([errorSpy.mock.calls, warn.mock.calls]);
    expect(logged).not.toContain(KEY);
    expect(await res.text()).not.toContain(KEY);

    fetchMock.mockRejectedValue(new Error(KEY));
    await POST(request({ audio: wav() }));
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(KEY);
  });
});
