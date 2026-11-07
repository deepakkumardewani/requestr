/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_RESPONSE,
  HERO_DEMO_URL,
} from "../fallbackResponse";
import { HERO_REQUEST_TIMEOUT_MS } from "../withTimeout";
import { useLiveRequest } from "./useLiveRequest";

function proxyResponse(
  payload: unknown,
  init: { ok?: boolean; status?: number; timing?: string | null } = {},
) {
  const { ok = true, status = 200, timing = "87.4" } = init;
  return {
    ok,
    status,
    json: async () => payload,
    headers: { get: () => timing },
  } as unknown as Response;
}

describe("useLiveRequest", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useLiveRequest());
    expect(result.current).toMatchObject({
      loading: false,
      response: null,
      source: null,
    });
  });

  it("returns the live response, pretty-printing JSON and rounding timing", async () => {
    fetchMock.mockResolvedValue(
      proxyResponse({ status: 201, statusText: "Created", body: '{"a":1}' }),
    );
    const { result } = renderHook(() => useLiveRequest());
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.source).toBe("live");
    expect(result.current.loading).toBe(false);
    expect(result.current.response).toEqual({
      status: 201,
      statusText: "Created",
      timingMs: 87,
      body: '{\n  "a": 1\n}',
    });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/proxy");
    expect(JSON.parse(init.body)).toEqual({
      url: HERO_DEMO_URL,
      method: "GET",
      timeoutMs: HERO_REQUEST_TIMEOUT_MS,
    });
  });

  it("uses a custom url and passes non-JSON bodies through with zero timing when header is absent", async () => {
    fetchMock.mockResolvedValue(
      proxyResponse(
        { status: 200, statusText: "OK", body: "plain text" },
        { timing: null },
      ),
    );
    const { result } = renderHook(() => useLiveRequest("https://x.test/a"));
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.response).toMatchObject({
      timingMs: 0,
      body: "plain text",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).url).toBe(
      "https://x.test/a",
    );
  });

  it("shows loading while the request is in flight", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const { result } = renderHook(() => useLiveRequest());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.send();
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolve(proxyResponse({ status: 200, statusText: "OK", body: "{}" }));
      await pending;
    });
    expect(result.current.loading).toBe(false);
  });

  it("falls back when the proxy responds with an error status", async () => {
    fetchMock.mockResolvedValue(proxyResponse({}, { ok: false, status: 502 }));
    const { result } = renderHook(() => useLiveRequest());
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.source).toBe("fallback");
    expect(result.current.response).toEqual(FALLBACK_RESPONSE);
  });

  it("falls back when offline (fetch rejects)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useLiveRequest());
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.source).toBe("fallback");
    expect(result.current.response).toEqual(FALLBACK_RESPONSE);
  });

  it("falls back after the timeout when the request stalls", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const { result } = renderHook(() => useLiveRequest());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.send();
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HERO_REQUEST_TIMEOUT_MS);
      await pending;
    });
    expect(result.current.source).toBe("fallback");
    expect(result.current.response).toEqual(FALLBACK_RESPONSE);
  });

  it("ignores a stale request that resolves after a newer one", async () => {
    const resolvers: Array<(r: Response) => void> = [];
    fetchMock.mockImplementation(
      () => new Promise<Response>((r) => resolvers.push(r)),
    );
    const { result } = renderHook(() => useLiveRequest());
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.send();
    });
    act(() => {
      second = result.current.send();
    });
    await act(async () => {
      resolvers[1](proxyResponse({ status: 200, statusText: "new", body: "{}" }));
      await second;
    });
    await act(async () => {
      resolvers[0](proxyResponse({ status: 500, statusText: "old", body: "{}" }));
      await first;
    });
    expect(result.current.response?.statusText).toBe("new");
  });

  it("drops results that arrive after unmount", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useLiveRequest());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.send();
    });
    unmount();
    resolve(proxyResponse({ status: 200, statusText: "OK", body: "{}" }));
    await expect(pending).resolves.toBeUndefined();
  });
});
