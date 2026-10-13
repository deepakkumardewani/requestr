/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettingsSections } from "@/app/settings/constants";
import { RELAY_WORKSPACE_ID } from "@/lib/relay/constants";
import { clearAll, createThread, listThreads } from "@/lib/relay/threadDb";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelaySection } from "./RelaySection";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    enabled: true,
    position: "right",
    shareValues: false,
    activeThreadId: null,
  });
});

afterEach(async () => {
  cleanup();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.restoreAllMocks();
});

describe("RelaySection", () => {
  it("offers exactly the Relay controls and no model, vendor or key field", () => {
    render(<RelaySection />);

    expect(screen.getByTestId("relay-enabled-switch")).toBeInTheDocument();
    expect(screen.getByTestId("relay-position-select")).toBeInTheDocument();
    expect(screen.getByTestId("relay-share-values-switch")).toBeInTheDocument();
    expect(screen.getByTestId("relay-clear-history-btn")).toBeInTheDocument();
    expect(screen.getByTestId("relay-explainer")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("starts with sharing off and only flips the shareValues field", () => {
    render(<RelaySection />);
    const toggle = screen.getByTestId("relay-share-values-switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    expect(useRelayStore.getState().shareValues).toBe(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("flips the enabled preference", () => {
    render(<RelaySection />);

    fireEvent.click(screen.getByTestId("relay-enabled-switch"));

    expect(useRelayStore.getState().enabled).toBe(false);
  });

  it("clears every thread and the active thread after confirm", async () => {
    const { thread } = await createThread({ workspaceId: RELAY_WORKSPACE_ID });
    useRelayStore.setState({ activeThreadId: thread.id });
    render(<RelaySection />);

    fireEvent.click(screen.getByTestId("relay-clear-history-btn"));
    expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(1);
    fireEvent.click(await screen.findByTestId("relay-clear-history-confirm"));

    await waitFor(async () =>
      expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(0),
    );
    expect(useRelayStore.getState().activeThreadId).toBeNull();
  });

  it("keeps history when the confirmation is cancelled", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID });
    render(<RelaySection />);

    fireEvent.click(screen.getByTestId("relay-clear-history-btn"));
    fireEvent.click(await screen.findByText("clearHistory.cancel"));

    expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(1);
  });
});

describe("settings navigation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lists the Relay section last when the flag is on", () => {
    const ids = getSettingsSections().map(([id]) => id);
    expect(ids.at(-1)).toBe("relay");
  });

  it("omits the Relay section when the flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    expect(getSettingsSections().map(([id]) => id)).not.toContain("relay");
  });
});
