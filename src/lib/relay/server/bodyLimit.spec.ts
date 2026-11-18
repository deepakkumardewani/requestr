import { describe, expect, it, vi } from "vitest";
import { readBodyWithLimit } from "./bodyLimit";

const LIMIT = 100;

function post(body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/relay/chat", {
    method: "POST",
    body,
    headers,
    // @ts-expect-error Node fetch needs duplex for stream bodies
    duplex: "half",
  });
}

function chunked(
  chunks: string[],
  onCancel?: () => void,
  headers: Record<string, string> = {},
): Request {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(encoder.encode(chunks[i++]));
      else controller.close();
    },
    cancel: onCancel,
  });
  return post(stream, headers);
}

describe("readBodyWithLimit", () => {
  it("returns the text of a body under the limit", async () => {
    expect(await readBodyWithLimit(post('{"a":1}'), LIMIT)).toEqual({
      ok: true,
      text: '{"a":1}',
    });
  });

  it("accepts a body of exactly the limit", async () => {
    const body = "x".repeat(LIMIT);
    expect(await readBodyWithLimit(post(body), LIMIT)).toEqual({ ok: true, text: body });
  });

  it("returns empty text when the request has no body", async () => {
    const req = new Request("http://localhost/x", { method: "POST" });
    expect(await readBodyWithLimit(req, LIMIT)).toEqual({ ok: true, text: "" });
  });

  it("rejects on a declared Content-Length over the limit without reading", async () => {
    const onCancel = vi.fn();
    const req = chunked(["a"], onCancel, { "content-length": "101" });
    expect(await readBodyWithLimit(req, LIMIT)).toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it("cuts off a chunked upload mid-stream and cancels the rest", async () => {
    const onCancel = vi.fn();
    const req = chunked(["x".repeat(60), "y".repeat(60), "z".repeat(60)], onCancel);
    expect(await readBodyWithLimit(req, LIMIT)).toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("still cuts off when Content-Length lies about a small body", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      body: "q".repeat(500),
      headers: { "content-length": "5" },
    });
    expect(await readBodyWithLimit(req, LIMIT)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("ignores an invalid or negative Content-Length and counts real bytes", async () => {
    for (const bad of ["abc", "-5", "Infinity"]) {
      const req = new Request("http://localhost/x", {
        method: "POST",
        body: "hello",
        headers: { "content-length": bad },
      });
      expect(await readBodyWithLimit(req, LIMIT)).toEqual({ ok: true, text: "hello" });
    }
  });

  it("counts bytes not characters and decodes multibyte text split across chunks", async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode("héllo✓");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      },
    });
    expect(await readBodyWithLimit(post(stream), LIMIT)).toEqual({
      ok: true,
      text: "héllo✓",
    });
    const wide = "é".repeat(60);
    expect(await readBodyWithLimit(post(wide), LIMIT)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});
