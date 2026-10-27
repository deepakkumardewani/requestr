/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HistoryEntry, HttpTab } from "@/types";
import { CommandPalette } from "./CommandPalette";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function httpTab(partial: Partial<HttpTab> = {}): HttpTab {
  return {
    tabId: "t0",
    requestId: null,
    name: "r",
    isDirty: false,
    type: "http",
    url: "https://api.example.com",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    ...partial,
  };
}

function hist(id: string, url: string): HistoryEntry {
  const t = httpTab({ url });
  return {
    id,
    method: "GET",
    url,
    status: 200,
    duration: 1,
    size: 1,
    timestamp: 1,
    request: t,
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      duration: 1,
      size: 1,
      url,
      method: "GET",
      timestamp: 1,
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useHistoryStore.setState({ entries: [] });
  useUIStore.setState({ commandPaletteOpen: false });
  useRelayStore.setState({ open: false, focusRequest: 0, enabled: true });
  vi.unstubAllEnvs();
});

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("CommandPalette", () => {
  it("selecting New Request opens a tab and closes palette", async () => {
    const user = userEvent.setup();
    useUIStore.setState({ commandPaletteOpen: true });

    render(<CommandPalette />);

    const newReq = await screen.findByText("New Request");
    await user.click(newReq);

    expect(useTabsStore.getState().tabs.length).toBeGreaterThanOrEqual(1);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("navigates to settings when that action is chosen", async () => {
    const user = userEvent.setup();
    useUIStore.setState({ commandPaletteOpen: true });

    render(<CommandPalette />);

    await user.click(await screen.findByText("Open Settings"));
    expect(push).toHaveBeenCalledWith("/settings");
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("shows recent history entries as selectable items", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({
      entries: [hist("h1", "https://history-only.test/z")],
    });
    useUIStore.setState({ commandPaletteOpen: true });

    render(<CommandPalette />);

    const item = await screen.findByText(/history-only\.test/i);
    await user.click(item);

    expect(useTabsStore.getState().tabs[0]?.url).toBe(
      "https://history-only.test/z",
    );
  });
});

describe("CommandPalette Relay entries", () => {
  const RELAY_ENTRIES = [
    "Open Relay",
    "New Relay thread",
    "Relay: ask about this request",
  ];

  it("lists the three Relay entries", async () => {
    useUIStore.setState({ commandPaletteOpen: true });
    render(<CommandPalette />);

    for (const label of RELAY_ENTRIES) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });

  it("Open Relay toggles the dock and closes the palette", async () => {
    const user = userEvent.setup();
    useUIStore.setState({ commandPaletteOpen: true });
    render(<CommandPalette />);

    await user.click(await screen.findByText("Open Relay"));

    expect(useRelayStore.getState().open).toBe(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it.each(["New Relay thread", "Relay: ask about this request"])(
    "%s opens the dock",
    async (label) => {
      const user = userEvent.setup();
      useUIStore.setState({ commandPaletteOpen: true });
      render(<CommandPalette />);

      await user.click(await screen.findByText(label));

      expect(useRelayStore.getState().open).toBe(true);
    },
  );

  it("hides every Relay entry when the feature flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    useUIStore.setState({ commandPaletteOpen: true });
    render(<CommandPalette />);

    await screen.findByText("New Request");
    for (const label of RELAY_ENTRIES) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("hides every Relay entry when Enable is off in Settings", async () => {
    useRelayStore.setState({ enabled: false });
    useUIStore.setState({ commandPaletteOpen: true });
    render(<CommandPalette />);

    await screen.findByText("New Request");
    for (const label of RELAY_ENTRIES) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("brings the entries back live when Enable is switched on again", async () => {
    useRelayStore.setState({ enabled: false });
    useUIStore.setState({ commandPaletteOpen: true });
    render(<CommandPalette />);
    await screen.findByText("New Request");
    expect(screen.queryByText("Open Relay")).not.toBeInTheDocument();

    act(() => useRelayStore.getState().setEnabled(true));

    expect(await screen.findByText("Open Relay")).toBeInTheDocument();
  });
});
