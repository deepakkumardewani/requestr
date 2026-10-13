/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab } from "@/types";
import { HeadersEditor } from "./HeadersEditor";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const mockRun = vi.fn();
vi.mock("@/hooks/useAI", () => ({
  useAI: vi.fn(() => ({
    run: mockRun,
    loading: false,
    error: null,
    reset: vi.fn(),
  })),
}));

function resetTabs() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
}

afterEach(() => {
  cleanup();
  resetTabs();
  vi.clearAllMocks();
});

function seedTab(headers: HttpTab["headers"] = []) {
  useTabsStore.getState().openTab({
    type: "http",
    headers,
  } as Partial<HttpTab>);
  return (useTabsStore.getState().tabs[0] as HttpTab).tabId;
}

describe("HeadersEditor", () => {
  beforeEach(() => resetTabs());

  it("always shows Suggest headers button", () => {
    const tabId = seedTab();
    render(<HeadersEditor tabId={tabId} />);
    expect(screen.getByTestId("suggest-headers-btn")).toBeInTheDocument();
  });

  it("calls useAI run with url, method, bodyType and existingKeys on click", async () => {
    mockRun.mockResolvedValueOnce([]);
    const tabId = seedTab();
    const user = userEvent.setup();
    render(<HeadersEditor tabId={tabId} />);

    await user.click(screen.getByTestId("suggest-headers-btn"));

    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.any(String), method: expect.any(String), existingKeys: [] }),
    );
  });

  it("merges suggested headers into tab state", async () => {
    mockRun.mockResolvedValueOnce([
      { key: "Content-Type", value: "application/json" },
      { key: "Accept", value: "application/json" },
    ]);
    const tabId = seedTab();
    const user = userEvent.setup();
    render(<HeadersEditor tabId={tabId} />);

    await user.click(screen.getByTestId("suggest-headers-btn"));

    await waitFor(() => {
      const tab = useTabsStore.getState().tabs[0] as HttpTab;
      expect(tab.headers.length).toBe(2);
      expect(tab.headers.some((h) => h.key === "Content-Type")).toBe(true);
    });
  });

  it("filters out duplicate keys case-insensitively", async () => {
    const { generateId } = await import("@/lib/utils");
    mockRun.mockResolvedValueOnce([
      { key: "content-type", value: "application/json" },
      { key: "Accept", value: "application/json" },
    ]);
    const existingHeader = { id: generateId(), key: "Content-Type", value: "text/plain", enabled: true };
    const tabId = seedTab([existingHeader]);
    const user = userEvent.setup();
    render(<HeadersEditor tabId={tabId} />);

    await user.click(screen.getByTestId("suggest-headers-btn"));

    await waitFor(() => {
      const tab = useTabsStore.getState().tabs[0] as HttpTab;
      // Only Accept should be added; content-type is a duplicate
      expect(tab.headers.length).toBe(2);
      expect(tab.headers.filter((h) => h.key.toLowerCase() === "content-type").length).toBe(1);
    });
  });

  it("shows info toast when all suggestions are already present", async () => {
    const { toast } = await import("sonner");
    const { generateId } = await import("@/lib/utils");
    mockRun.mockResolvedValueOnce([{ key: "Authorization", value: "Bearer token" }]);
    const existingHeader = { id: generateId(), key: "authorization", value: "Bearer old", enabled: true };
    const tabId = seedTab([existingHeader]);
    const user = userEvent.setup();
    render(<HeadersEditor tabId={tabId} />);

    await user.click(screen.getByTestId("suggest-headers-btn"));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("already present"),
      );
    });
  });

  it("offers Open in Relay without header values and keeps Suggest headers", async () => {
    const user = userEvent.setup();
    useRelayStore.setState({ open: false, composerPrefill: null });
    const tabId = seedTab([
      { id: "h1", key: "Authorization", value: "Bearer secret-token", enabled: true },
    ]);
    render(<HeadersEditor tabId={tabId} />);

    await user.click(screen.getByTestId("open-in-relay-btn"));

    const { open, composerPrefill } = useRelayStore.getState();
    expect(open).toBe(true);
    expect(composerPrefill).toContain("authorization");
    expect(composerPrefill).not.toContain("secret-token");
    expect(screen.getByTestId("suggest-headers-btn")).toBeInTheDocument();
  });
});
