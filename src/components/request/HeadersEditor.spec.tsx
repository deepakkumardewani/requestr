/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});

describe("HeadersEditor header rows", () => {
  const header = (id: string, key: string, value: string, enabled = true) => ({
    id,
    key,
    value,
    enabled,
  });
  const headersOf = () => (useTabsStore.getState().tabs[0] as HttpTab).headers;

  beforeEach(() => resetTabs());

  it("adds a header from the draft row", async () => {
    const user = userEvent.setup();
    const tabId = seedTab();
    render(<HeadersEditor tabId={tabId} />);

    await user.type(screen.getByTestId("headers-draft-row-key"), "X-Trace");
    await user.type(screen.getByTestId("headers-draft-row-value"), "abc{Enter}");

    expect(headersOf()).toHaveLength(1);
    expect(headersOf()[0]).toMatchObject({ key: "X-Trace", value: "abc", enabled: true });
  });

  it("edits an existing header key and value", () => {
    const tabId = seedTab([header("h1", "Accept", "text/plain")]);
    render(<HeadersEditor tabId={tabId} />);

    fireEvent.change(screen.getByTestId("headers-row-key-h1"), {
      target: { value: "Accept-Language" },
    });
    fireEvent.change(screen.getByTestId("headers-row-value-h1"), {
      target: { value: "en" },
    });

    expect(headersOf()[0]).toMatchObject({ id: "h1", key: "Accept-Language", value: "en" });
  });

  it("disables a header without removing it", async () => {
    const user = userEvent.setup();
    const tabId = seedTab([header("h1", "Accept", "text/plain")]);
    render(<HeadersEditor tabId={tabId} />);

    await user.click(screen.getByTestId("headers-row-enable-h1"));

    expect(headersOf()).toHaveLength(1);
    expect(headersOf()[0].enabled).toBe(false);
  });

  it("deletes only the chosen header", async () => {
    const user = userEvent.setup();
    const tabId = seedTab([
      header("h1", "Accept", "text/plain"),
      header("h2", "X-Keep", "1"),
    ]);
    render(<HeadersEditor tabId={tabId} />);

    await user.click(screen.getByTestId("headers-row-delete-h1"));

    expect(headersOf().map((h) => h.id)).toEqual(["h2"]);
  });

  it("masks the value of a sensitive header until the eye toggle is clicked", async () => {
    const user = userEvent.setup();
    const tabId = seedTab([header("h1", "Authorization", "Bearer secret")]);
    render(<HeadersEditor tabId={tabId} />);

    expect(screen.getByTestId("headers-row-value-h1")).toHaveValue("••••••••");

    await user.click(screen.getByTestId("headers-row-mask-toggle-h1"));

    expect(screen.getByTestId("headers-row-value-h1")).toHaveValue("Bearer secret");
    expect(headersOf()[0].value).toBe("Bearer secret");
  });
});
