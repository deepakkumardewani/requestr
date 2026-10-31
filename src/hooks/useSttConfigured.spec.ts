/** @vitest-environment happy-dom */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSttConfigured,
  resetSttConfiguredCache,
  useSttConfigured,
} from "./useSttConfigured";

const fetchMock = vi.fn();

const reply = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as Response;

beforeEach(() => {
  resetSttConfiguredCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchSttConfigured", () => {
  it("[success] asks the status route once per session", async () => {
    fetchMock.mockResolvedValue(reply({ configured: true }));
    expect(await fetchSttConfigured()).toBe(true);
    expect(await fetchSttConfigured()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/relay/stt/status", { cache: "no-store" });
  });

  it("[success] shares one in-flight request between concurrent callers", async () => {
    fetchMock.mockResolvedValue(reply({ configured: true }));
    const results = await Promise.all([fetchSttConfigured(), fetchSttConfigured()]);
    expect(results).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("[success] reads false from the body", async () => {
    fetchMock.mockResolvedValue(reply({ configured: false }));
    expect(await fetchSttConfigured()).toBe(false);
  });

  it("[invalid] counts a non-boolean flag as not configured", async () => {
    fetchMock.mockResolvedValue(reply({ configured: "yes" }));
    expect(await fetchSttConfigured()).toBe(false);
  });

  it("[error] counts a non-ok response as not configured", async () => {
    fetchMock.mockResolvedValue(reply({ configured: true }, false));
    expect(await fetchSttConfigured()).toBe(false);
  });

  it("[error] counts a network failure as not configured and logs it", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await fetchSttConfigured()).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it("[success] forgets the answer after a reset", async () => {
    fetchMock.mockResolvedValue(reply({ configured: false }));
    await fetchSttConfigured();
    resetSttConfiguredCache();
    fetchMock.mockResolvedValue(reply({ configured: true }));
    expect(await fetchSttConfigured()).toBe(true);
  });
});

describe("useSttConfigured", () => {
  it("[success] is null while loading, then the answer", async () => {
    fetchMock.mockResolvedValue(reply({ configured: true }));
    const { result } = renderHook(() => useSttConfigured());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("[error] settles on false when the fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useSttConfigured());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("[success] does not update state after unmount", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useSttConfigured());
    unmount();
    await act(async () => {
      resolve(reply({ configured: true }));
    });
    expect(result.current).toBeNull();
  });
});
