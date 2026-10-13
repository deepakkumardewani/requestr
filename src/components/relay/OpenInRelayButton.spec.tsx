/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { OpenInRelayButton } from "./OpenInRelayButton";

const chip = { kind: "request", id: "r1", label: "Get users" } as const;

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    open: false,
    draftChips: [],
    removedChipKeys: [],
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
    expect(state.draftChips).toEqual([chip]);
  });

  it("is labelled and meets the mobile touch target", () => {
    render(<OpenInRelayButton prompt="Explain this" />);

    const button = screen.getByTestId("open-in-relay-btn");
    expect(button).toHaveAttribute("aria-label", "openInRelay");
    expect(button.className).toContain("max-md:min-h-11");
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

    expect(useRelayStore.getState().draftChips).toEqual([chip]);
  });

  it("seeds no chip for an unsaved tab", () => {
    useTabsStore.setState({
      activeTabId: "t1",
      tabs: [{ tabId: "t1", type: "http", name: "New Request" }] as never,
    });
    render(<OpenInRelayButton prompt="Explain this" />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    expect(useRelayStore.getState().draftChips).toEqual([]);
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
