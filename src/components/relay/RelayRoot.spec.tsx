/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_DEFAULT_WIDTH_PX,
  RELAY_MOBILE_BREAKPOINT_PX,
} from "@/lib/relay/constants";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayRoot } from "./RelayRoot";

const OFFSET_VAR = "--relay-dock-offset";

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
  useRelayStore.setState({
    open: false,
    width: RELAY_DEFAULT_WIDTH_PX,
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
    expect(document.body.style.getPropertyValue(OFFSET_VAR)).toContain(
      `${RELAY_DEFAULT_WIDTH_PX}px`,
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
