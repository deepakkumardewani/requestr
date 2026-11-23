/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/app" as string | null,
  firstSession: false,
}));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/lib/prompts/sessionTracker", () => ({
  isFirstSession: () => mocks.firstSession,
}));

import { isAutoPromptRoute, useAutoPromptGate } from "./useAutoPromptGate";

beforeEach(() => {
  mocks.pathname = "/app";
  mocks.firstSession = false;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isAutoPromptRoute", () => {
  it.each(["/app", "/app/collections", "/chain", "/chain/abc"])(
    "accepts %s",
    (path) => {
      expect(isAutoPromptRoute(path)).toBe(true);
    },
  );

  it.each(["/", "/privacy", "/application", "/chains", "/blog/app"])(
    "rejects %s",
    (path) => {
      expect(isAutoPromptRoute(path)).toBe(false);
    },
  );

  it("rejects a null pathname", () => {
    expect(isAutoPromptRoute(null)).toBe(false);
  });
});

describe("useAutoPromptGate", () => {
  it("opens on an app route after the first session", () => {
    const { result } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(true);
  });

  it("stays closed on a marketing route", () => {
    mocks.pathname = "/privacy";
    const { result } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(false);
  });

  it("stays closed when the pathname is unknown", () => {
    mocks.pathname = null;
    const { result } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(false);
  });

  it("stays closed during the first session", () => {
    mocks.firstSession = true;
    const { result } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(false);
  });

  it("opens during the first session when allowFirstSession is set", () => {
    mocks.firstSession = true;
    const { result } = renderHook(() =>
      useAutoPromptGate({ allowFirstSession: true }),
    );
    expect(result.current).toBe(true);
  });

  it("stays closed when allowFirstSession is explicitly false in session one", () => {
    mocks.firstSession = true;
    const { result } = renderHook(() =>
      useAutoPromptGate({ allowFirstSession: false }),
    );
    expect(result.current).toBe(false);
  });

  it("stays closed while a dialog is already open", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    const { result } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(false);
  });

  it("treats an alertdialog as open", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "alertdialog");
    document.body.appendChild(dialog);
    const { result } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(false);
  });

  it("closes when a dialog mounts and reopens when it unmounts", async () => {
    const { result } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(true);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    await act(async () => {
      document.body.appendChild(dialog);
    });
    expect(result.current).toBe(false);

    await act(async () => {
      dialog.remove();
    });
    expect(result.current).toBe(true);
  });

  it("stops observing the document after unmount", () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const { unmount } = renderHook(() => useAutoPromptGate());
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    disconnect.mockRestore();
  });

  it("re-reads the first-session flag when the route changes", () => {
    mocks.firstSession = true;
    const { result, rerender } = renderHook(() => useAutoPromptGate());
    expect(result.current).toBe(false);
    mocks.firstSession = false;
    mocks.pathname = "/app/next";
    rerender();
    expect(result.current).toBe(true);
  });
});
