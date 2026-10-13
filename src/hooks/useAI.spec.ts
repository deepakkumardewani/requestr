/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAI } from "./useAI";

describe("useAI", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(status: number, data: unknown) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    } as Response);
  }

  it("starts with loading=false and error=null", () => {
    const { result } = renderHook(() => useAI("summarize-response"));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("sets loading=true during fetch, false after", async () => {
    let resolveJson!: (v: unknown) => void;
    const jsonPromise = new Promise((res) => {
      resolveJson = res;
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => jsonPromise,
    } as unknown as Response);

    const { result } = renderHook(() => useAI<{ summary: string }>("summarize-response"));

    let runPromise!: Promise<unknown>;
    act(() => {
      runPromise = result.current.run({ status: 200, bodySnippet: "" });
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveJson({ summary: "all good" });
      await runPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("resolves with parsed JSON on a 200 response", async () => {
    mockFetch(200, { summary: "10 users returned" });

    const { result } = renderHook(() => useAI<{ summary: string }>("summarize-response"));

    let value: { summary: string } | null = null;
    await act(async () => {
      value = await result.current.run({ status: 200 });
    });

    expect(value).toEqual({ summary: "10 users returned" });
    expect(result.current.error).toBe(null);
  });

  it("sets error on non-2xx response", async () => {
    mockFetch(400, { error: "unknown action" });

    const { result } = renderHook(() => useAI("bad-action"));

    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.error).toBe("unknown action");
    expect(result.current.loading).toBe(false);
  });

  it("shows friendly copy for a mapped Relay code, never the raw code", async () => {
    mockFetch(500, { error: "not_configured" });

    const { result } = renderHook(() => useAI("summarize-response"));

    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.error).toBe("AI isn't set up on this server.");
  });

  it("falls back to the status when the error body has no message", async () => {
    mockFetch(502, {});

    const { result } = renderHook(() => useAI("summarize-response"));

    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.error).toBe("Request failed with status 502");
  });

  it("sets error when fetch throws (network failure)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAI("summarize-response"));

    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.loading).toBe(false);
  });

  it("reset() clears error back to null", async () => {
    mockFetch(500, { error: "server error" });

    const { result } = renderHook(() => useAI("summarize-response"));

    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.error).not.toBe(null);

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
  });
});
