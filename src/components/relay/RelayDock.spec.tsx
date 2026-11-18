/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_MAX_WIDTH_CSS,
  RELAY_MIN_TOUCH_TARGET_PX,
  RELAY_MIN_WIDTH_CSS,
  RELAY_MIN_WIDTH_PX,
} from "@/lib/relay/constants";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayDock } from "./RelayDock";

vi.mock("next/navigation", () => ({ usePathname: () => "/app", useRouter: () => ({ push: vi.fn() }) }));

const VIEWPORT_PX = 1000;

function resetStore(open: boolean) {
  useRelayStore.setState({
    open,
    width: RELAY_MIN_WIDTH_PX,
    activeThreadId: null,
    attachedItems: [],
    focusRequest: 0,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("innerWidth", VIEWPORT_PX);
  resetStore(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RelayDock (aside)", () => {
  it("renders the shell with its stable test ids", () => {
    render(<RelayDock variant="aside" />);

    expect(screen.getByTestId("relay-dock")).toBeInTheDocument();
    expect(screen.getByTestId("relay-resize-handle")).toBeInTheDocument();
    expect(screen.getByTestId("relay-close")).toBeInTheDocument();
    expect(screen.getByTestId("relay-composer")).toBeInTheDocument();
  });

  it("exposes a polite live log region for messages", () => {
    render(<RelayDock variant="aside" />);

    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("data-testid", "relay-messages");
  });

  it("takes its width from the store within the allowed bounds", () => {
    useRelayStore.setState({ width: 480 });
    render(<RelayDock variant="aside" />);

    const dock = screen.getByTestId("relay-dock");
    expect(dock.style.width).toBe("480px");
    expect(dock.style.minWidth).toBe(RELAY_MIN_WIDTH_CSS);
    expect(dock.style.maxWidth).toBe(RELAY_MAX_WIDTH_CSS);
  });

  it("resizes by one step through the handle", () => {
    render(<RelayDock variant="aside" />);

    fireEvent.keyDown(screen.getByTestId("relay-resize-handle"), {
      key: "ArrowLeft",
    });

    expect(useRelayStore.getState().width).toBe(RELAY_MIN_WIDTH_PX + 16);
  });

  it("closes from the header button", () => {
    render(<RelayDock variant="aside" />);

    fireEvent.click(screen.getByTestId("relay-close"));

    expect(useRelayStore.getState().open).toBe(false);
  });

  it("is interactive while open and inert while closed", () => {
    const { rerender } = render(<RelayDock variant="aside" />);
    const dock = screen.getByTestId("relay-dock");
    expect(dock).not.toHaveAttribute("inert");
    expect(dock).toHaveAttribute("data-state", "open");

    act(() => useRelayStore.setState({ open: false }));
    rerender(<RelayDock variant="aside" />);

    expect(dock).toHaveAttribute("inert");
    expect(dock).toHaveAttribute("data-state", "closed");
    expect(dock).toHaveClass("invisible", "translate-x-full");
  });

  it("labels the composer and region for assistive tech", () => {
    render(<RelayDock variant="aside" />);

    expect(screen.getByTestId("relay-composer")).toHaveAttribute(
      "aria-label",
      "composerLabel",
    );
    expect(screen.getByTestId("relay-dock")).toHaveAttribute(
      "aria-label",
      "title",
    );
  });

  it("focuses the composer when opened by the user", () => {
    resetStore(false);
    render(<RelayDock variant="aside" />);

    act(() => useRelayStore.getState().setOpen(true));

    expect(screen.getByTestId("relay-composer")).toHaveFocus();
  });

  it("returns focus to the opener and keeps the dock open on the first Esc", async () => {
    resetStore(false);
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    render(<RelayDock variant="aside" />);
    act(() => useRelayStore.getState().setOpen(true));
    // The editor takes focus a frame after opening; wait so it cannot steal it back.
    await waitFor(() =>
      expect(screen.getByTestId("relay-composer")).toHaveFocus(),
    );

    fireEvent.keyDown(screen.getByTestId("relay-composer"), { key: "Escape" });
    expect(opener).toHaveFocus();
    expect(useRelayStore.getState().open).toBe(true);

    fireEvent.keyDown(opener, { key: "Escape" });
    expect(useRelayStore.getState().open).toBe(false);
    opener.remove();
  });

  it("keeps the header controls at the default size", () => {
    render(<RelayDock variant="aside" />);

    expect(screen.getByTestId("relay-close")).not.toHaveStyle({
      minWidth: `${RELAY_MIN_TOUCH_TARGET_PX}px`,
    });
  });
});

describe("RelayDock (sheet)", () => {
  it("renders full width with the same test ids and no resize handle", () => {
    render(<RelayDock variant="sheet" />);

    const dock = screen.getByTestId("relay-dock");
    expect(dock.className).toContain("data-[side=right]:w-full");
    expect(screen.getByTestId("relay-close")).toBeInTheDocument();
    expect(screen.getByTestId("relay-composer")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-resize-handle")).not.toBeInTheDocument();
  });

  it("applies safe-area padding and 44px touch targets", () => {
    render(<RelayDock variant="sheet" />);

    expect(screen.getByTestId("relay-dock")).toHaveStyle({
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    });
    expect(screen.getByTestId("relay-close")).toHaveStyle({
      minWidth: `${RELAY_MIN_TOUCH_TARGET_PX}px`,
      minHeight: `${RELAY_MIN_TOUCH_TARGET_PX}px`,
    });
  });

  it("closes from the header button", () => {
    render(<RelayDock variant="sheet" />);

    fireEvent.click(screen.getByTestId("relay-close"));

    expect(useRelayStore.getState().open).toBe(false);
  });

  it("renders nothing while closed", () => {
    resetStore(false);
    render(<RelayDock variant="sheet" />);

    expect(screen.queryByTestId("relay-dock")).not.toBeInTheDocument();
  });
});

describe("RelayDock (entry-point prefill)", () => {
  it("moves the store prefill into the composer and clears it", async () => {
    render(<RelayDock variant="aside" />);

    await act(async () => {
      useRelayStore
        .getState()
        .openWithDraft({
          segments: [{ type: "text", text: "Explain this response" }],
        });
    });

    expect(screen.getByTestId("relay-composer")).toHaveTextContent(
      "Explain this response",
    );
    expect(useRelayStore.getState().composerDraft).toBeNull();
  });
});
