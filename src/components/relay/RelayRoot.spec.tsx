/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_MAX_WIDTH_CSS,
  RELAY_MIN_WIDTH_CSS,
  RELAY_MOBILE_BREAKPOINT_PX,
} from "@/lib/relay/constants";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayRoot } from "./RelayRoot";

const OFFSET_VAR = "--relay-dock-offset";
const VIEWPORT_PX = 1440;
const MIN_AT_VIEWPORT_PX = 432;
const MAX_AT_VIEWPORT_PX = 576;
const DEFAULT_WIDTH_PX = MIN_AT_VIEWPORT_PX;
const originalSetWidth = useRelayStore.getState().setWidth;

const pathnameMock = vi.hoisted(() => ({ current: "/app" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.current,
}));

// next/dynamic needs the Next runtime; model it with React.lazy.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<React.ComponentType<object>>) => {
    const Lazy = lazy(async () => ({ default: await loader() }));
    return (props: object) => (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  },
}));

vi.mock("./RelayDockWithMessages", () => ({
  RelayDockWithMessages: ({ variant }: { variant: string }) => (
    <div data-testid="relay-dock" data-variant={variant} />
  ),
}));

function stubViewport({ mobile }: { mobile: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: mobile && query.includes(`${RELAY_MOBILE_BREAKPOINT_PX - 1}px`),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function setOpen(open: boolean) {
  act(() => useRelayStore.getState().setOpen(open));
}

beforeEach(() => {
  localStorage.clear();
  document.body.removeAttribute("style");
  pathnameMock.current = "/app";
  stubViewport({ mobile: false });
  vi.stubGlobal("innerWidth", VIEWPORT_PX);
  useRelayStore.setState({
    open: false,
    width: DEFAULT_WIDTH_PX,
    setWidth: originalSetWidth,
    focusRequest: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("RelayRoot", () => {
  it("renders nothing until Relay is first opened (lazy dock)", () => {
    render(<RelayRoot />);
    expect(screen.queryByTestId("relay-dock")).not.toBeInTheDocument();
  });

  it("mounts the aside dock on desktop once opened", async () => {
    render(<RelayRoot />);

    setOpen(true);

    const dock = await screen.findByTestId("relay-dock");
    expect(dock).toHaveAttribute("data-variant", "aside");
  });

  it("mounts the sheet below the mobile breakpoint", async () => {
    stubViewport({ mobile: true });
    render(<RelayRoot />);

    setOpen(true);

    const dock = await screen.findByTestId("relay-dock");
    expect(dock).toHaveAttribute("data-variant", "sheet");
  });

  it("keeps the dock mounted after closing so it can animate out", async () => {
    render(<RelayRoot />);
    setOpen(true);
    await screen.findByTestId("relay-dock");

    setOpen(false);

    expect(screen.getByTestId("relay-dock")).toBeInTheDocument();
  });

  it("mounts straight away for an open state restored from storage", async () => {
    useRelayStore.setState({ open: true });
    render(<RelayRoot />);

    expect(await screen.findByTestId("relay-dock")).toBeInTheDocument();
  });

  it("stays mounted across route changes", async () => {
    const { rerender } = render(<RelayRoot />);
    setOpen(true);
    await screen.findByTestId("relay-dock");

    pathnameMock.current = "/settings";
    rerender(<RelayRoot />);

    expect(screen.getByTestId("relay-dock")).toBeInTheDocument();
  });

  it("renders no dock on the landing page even when open", () => {
    pathnameMock.current = "/";
    useRelayStore.setState({ open: true });

    render(<RelayRoot />);

    expect(screen.queryByTestId("relay-dock")).not.toBeInTheDocument();
  });

  it("renders no dock when the feature flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    useRelayStore.setState({ open: true });

    render(<RelayRoot />);

    expect(screen.queryByTestId("relay-dock")).not.toBeInTheDocument();
  });
});

describe("RelayRoot content offset", () => {
  it("reserves room beside the open desktop dock and releases it on close", () => {
    render(<RelayRoot />);

    setOpen(true);
    expect(document.body.style.paddingRight).toBe(`var(${OFFSET_VAR})`);
    expect(document.body.style.getPropertyValue(OFFSET_VAR)).toBe(
      `clamp(${RELAY_MIN_WIDTH_CSS}, ${DEFAULT_WIDTH_PX}px, ${RELAY_MAX_WIDTH_CSS})`,
    );

    setOpen(false);
    expect(document.body.style.paddingRight).toBe("");
    expect(document.body.style.getPropertyValue(OFFSET_VAR)).toBe("");
  });

  it("does not push content for the mobile sheet", () => {
    stubViewport({ mobile: true });
    render(<RelayRoot />);

    setOpen(true);

    expect(document.body.style.paddingRight).toBe("");
  });

  it("does not push content on the landing page", () => {
    pathnameMock.current = "/";
    useRelayStore.setState({ open: true });

    render(<RelayRoot />);

    expect(document.body.style.paddingRight).toBe("");
  });
});

describe("RelayRoot shortcut", () => {
  const CHORD = { key: "l", ctrlKey: true, shiftKey: true };

  function press() {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { ...CHORD }));
    });
  }

  beforeEach(() => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
  });

  it("toggles the dock from the keyboard on any workspace route", () => {
    render(<RelayRoot />);

    press();
    expect(useRelayStore.getState().open).toBe(true);
  });

  it("is absent on the landing page", () => {
    pathnameMock.current = "/";
    render(<RelayRoot />);

    press();
    expect(useRelayStore.getState().open).toBe(false);
  });

  it("is absent when the feature flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    render(<RelayRoot />);

    press();
    expect(useRelayStore.getState().open).toBe(false);
  });
});

describe("RelayRoot width re-clamp on resize", () => {
  function resizeTo(innerWidth: number) {
    vi.stubGlobal("innerWidth", innerWidth);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }

  it("re-clamps a stored width that falls outside the new range, once", () => {
    useRelayStore.setState({ open: true, width: MAX_AT_VIEWPORT_PX });
    const setWidth = vi.fn(originalSetWidth);
    useRelayStore.setState({ setWidth });
    render(<RelayRoot />);

    resizeTo(900);

    expect(setWidth).toHaveBeenCalledTimes(1);
    expect(useRelayStore.getState().width).toBe(360);
  });

  it("does not write when the width is still inside the range", () => {
    useRelayStore.setState({ open: true, width: DEFAULT_WIDTH_PX });
    const setWidth = vi.fn(originalSetWidth);
    useRelayStore.setState({ setWidth });
    render(<RelayRoot />);

    resizeTo(1100);

    expect(setWidth).not.toHaveBeenCalled();
  });

  it("listens to resize even when the dock is closed but active (feature allows later open)", () => {
    // The resize listener runs whenever the dock is active, regardless of open state.
    // This allows the width to be re-clamped before the dock opens.
    useRelayStore.setState({ open: false, width: MAX_AT_VIEWPORT_PX });
    const setWidth = vi.fn(originalSetWidth);
    useRelayStore.setState({ setWidth });
    render(<RelayRoot />);

    resizeTo(900);

    expect(setWidth).toHaveBeenCalledTimes(1);
    expect(useRelayStore.getState().width).toBe(360);
  });

  it("does not listen to resize on landing page", () => {
    // The resize listener should not run when the dock is inactive (landing page).
    pathnameMock.current = "/";
    useRelayStore.setState({ open: true, width: MAX_AT_VIEWPORT_PX });
    const setWidth = vi.fn(originalSetWidth);
    useRelayStore.setState({ setWidth });
    render(<RelayRoot />);

    resizeTo(900);

    expect(setWidth).not.toHaveBeenCalled();
  });

  it("does not listen to resize when the feature is disabled", () => {
    // The resize listener should not run when the feature flag is off.
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    useRelayStore.setState({ open: true, width: MAX_AT_VIEWPORT_PX });
    const setWidth = vi.fn(originalSetWidth);
    useRelayStore.setState({ setWidth });
    render(<RelayRoot />);

    resizeTo(900);

    expect(setWidth).not.toHaveBeenCalled();
  });

  it("removes the resize listener on unmount", () => {
    useRelayStore.setState({ open: true, width: DEFAULT_WIDTH_PX });
    const setWidth = vi.fn(originalSetWidth);
    useRelayStore.setState({ setWidth });
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<RelayRoot />);
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
  });
});
