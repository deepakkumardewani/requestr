/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_ENTRY_PROMPTS } from "@/lib/relay/openInRelay";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { OpenInRelayButton } from "./OpenInRelayButton";

const chip = { kind: "request", id: "r1", label: "Get users" } as const;

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    open: false,
    attachedItems: [],
    composerDraft: null,
    focusRequest: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("OpenInRelayButton", () => {
  it("opens Relay with the supplied prompt and context on click", () => {
    render(<OpenInRelayButton entry="explainError" context={[chip]} />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    const state = useRelayStore.getState();
    expect(state.open).toBe(true);
    expect(state.composerDraft).toEqual([
      { type: "attachment", chip },
      { type: "text", text: ` ${RELAY_ENTRY_PROMPTS.explainError}` },
    ]);
  });

  it("is labelled and meets the mobile touch target", () => {
    render(<OpenInRelayButton entry="explainError" />);

    const button = screen.getByTestId("open-in-relay-btn");
    expect(button).toHaveAttribute("aria-label", "openInRelay");
    expect(button.className).toContain("max-md:min-h-11");
  });

  it("renders nothing when the flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    render(<OpenInRelayButton entry="explainError" />);

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
    render(<OpenInRelayButton entry="explainError" tabId="t1" />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    expect(useRelayStore.getState().composerDraft).toEqual([
      { type: "attachment", chip },
      { type: "text", text: ` ${RELAY_ENTRY_PROMPTS.explainError}` },
    ]);
  });

  it("seeds a tab chip for an unsaved tab", () => {
    useTabsStore.setState({
      activeTabId: "t1",
      tabs: [{ tabId: "t1", type: "http", name: "New Request" }] as never,
    });
    render(<OpenInRelayButton entry="explainError" />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    expect(useRelayStore.getState().composerDraft).toEqual([
      { type: "attachment", chip: { kind: "tab", id: "t1", label: "New Request" } },
      { type: "text", text: ` ${RELAY_ENTRY_PROMPTS.explainError}` },
    ]);
  });
});

describe("OpenInRelayButton user setting", () => {
  it("renders nothing when the user disabled Relay in settings", () => {
    useRelayStore.setState({ enabled: false });
    render(<OpenInRelayButton entry="explainError" />);

    expect(screen.queryByTestId("open-in-relay-btn")).toBeNull();
    useRelayStore.setState({ enabled: true });
  });
});

describe("OpenInRelayButton rendering details", () => {
  it("is an icon-only button: Relay logo, no visible text", () => {
    render(<OpenInRelayButton entry="explainError" />);
    const button = screen.getByRole("button", { name: "openInRelay" });
    expect(within(button).getByTestId("relay-logo")).toBeInTheDocument();
    expect(button.textContent).toBe("");
  });

  it("shows the label as a tooltip on hover", async () => {
    const user = userEvent.setup();
    render(<OpenInRelayButton entry="explainError" />);
    await user.hover(screen.getByTestId("open-in-relay-btn"));
    expect(await screen.findByText("openInRelay")).toBeInTheDocument();
  });

  it("keeps a hit area of at least 32px", () => {
    render(<OpenInRelayButton entry="explainError" />);
    expect(screen.getByTestId("open-in-relay-btn").className).toContain(
      "size-8",
    );
  });

  it("pre-fills only the short prompt from the entry map", () => {
    useTabsStore.setState({ activeTabId: null, tabs: [] as never });
    render(<OpenInRelayButton entry="generateBody" />);
    fireEvent.click(screen.getByTestId("open-in-relay-btn"));
    expect(useRelayStore.getState().composerDraft).toEqual([
      { type: "text", text: RELAY_ENTRY_PROMPTS.generateBody },
    ]);
  });
});

describe("OpenInRelayButton with an empty context", () => {
  it("attaches no chip even when an http tab is active (Transform page)", () => {
    useTabsStore.setState({
      activeTabId: "t1",
      tabs: [
        { tabId: "t1", type: "http", requestId: "r1", name: "Get users" },
      ] as never,
    });
    render(<OpenInRelayButton entry="transformJsonpath" context={[]} />);

    fireEvent.click(screen.getByTestId("open-in-relay-btn"));

    expect(useRelayStore.getState().composerDraft).toEqual([
      { type: "text", text: RELAY_ENTRY_PROMPTS.transformJsonpath },
    ]);
  });
});
