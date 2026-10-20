/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { OpenInRelayButton } from "./OpenInRelayButton";

const chip = { kind: "request", id: "r1", label: "Get users" } as const;

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    open: false,
    attachedItems: [],
    composerPrefill: null,
    focusRequest: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("OpenInRelayButton", () => {
  it("opens Relay with the supplied prompt and context on click", () => {
    render(<OpenInRelayButton prompt="Explain this" context={[chip]} />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    const state = useRelayStore.getState();
    expect(state.open).toBe(true);
    expect(state.composerPrefill).toBe("Explain this");
    expect(state.attachedItems).toEqual([chip]);
  });

  it("is labelled and meets the mobile touch target", () => {
    render(<OpenInRelayButton prompt="Explain this" />);

    const button = screen.getByTestId("open-in-relay-btn");
    expect(button).toHaveAttribute("aria-label", "openInRelay");
    expect(button.className).toContain("max-md:min-h-11");
  });

  it("shows the Relay logo inside the button", () => {
    render(<OpenInRelayButton prompt="Explain this" />);

    expect(
      within(screen.getByTestId("open-in-relay-btn")).getByTestId("relay-logo"),
    ).toBeInTheDocument();
  });

  it("renders nothing when the flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    render(<OpenInRelayButton prompt="Explain this" />);

    expect(screen.queryByTestId("open-in-relay-btn")).toBeNull();
  });
});

describe("OpenInRelayButton default context", () => {
  it("seeds the saved request chip of the given tab", () => {
    useTabsStore.setState({
      activeTabId: "t1",
      tabs: [
        { tabId: "t1", type: "http", requestId: "r1", name: "Get users" },
      ] as never,
    });
    render(<OpenInRelayButton prompt="Explain this" tabId="t1" />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    expect(useRelayStore.getState().attachedItems).toEqual([chip]);
  });

  it("seeds no chip for an unsaved tab", () => {
    useTabsStore.setState({
      activeTabId: "t1",
      tabs: [{ tabId: "t1", type: "http", name: "New Request" }] as never,
    });
    render(<OpenInRelayButton prompt="Explain this" />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    expect(useRelayStore.getState().attachedItems).toEqual([]);
  });
});

describe("OpenInRelayButton user setting", () => {
  it("renders nothing when the user disabled Relay in settings", () => {
    useRelayStore.setState({ enabled: false });
    render(<OpenInRelayButton prompt="Explain this" />);

    expect(screen.queryByTestId("open-in-relay-btn")).toBeNull();
    useRelayStore.setState({ enabled: true });
  });
});

describe("OpenInRelayButton rendering details", () => {
  it("renders the RelayLogo with correct size inside the button", () => {
    render(<OpenInRelayButton prompt="Test prompt" />);
    const button = screen.getByTestId("open-in-relay-btn");
    const logo = within(button).getByTestId("relay-logo");
    expect(logo).toHaveClass("size-3");
  });

  it("does not render the legacy sparkle icon", () => {
    render(<OpenInRelayButton prompt="Test prompt" />);
    const button = screen.getByTestId("open-in-relay-btn");
    // Verify RelayLogo is present
    expect(within(button).getByTestId("relay-logo")).toBeInTheDocument();
    // Ensure no lucide-sparkles icon exists
    const sparklesSvgs = button.querySelectorAll("svg.lucide-sparkles");
    expect(sparklesSvgs).toHaveLength(0);
  });

  it("renders text label after the logo", () => {
    render(<OpenInRelayButton prompt="Test prompt" />);
    const button = screen.getByTestId("open-in-relay-btn");
    expect(button.textContent).toContain("openInRelay");
    const logo = within(button).getByTestId("relay-logo");
    // The label is a bare text node, so locate it among the button's children
    const label = Array.from(button.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent === "openInRelay",
    );
    expect(label).toBeDefined();
    expect(logo.compareDocumentPosition(label as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("applies the relay entry touch class for mobile accessibility", () => {
    render(<OpenInRelayButton prompt="Test prompt" />);
    const button = screen.getByTestId("open-in-relay-btn");
    expect(button.className).toContain("max-md:min-h-11");
  });
});
