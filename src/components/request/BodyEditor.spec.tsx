/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab } from "@/types";
import { BodyEditor } from "./BodyEditor";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const mockAIRun = vi.fn();
vi.mock("@/hooks/useAI", () => ({
  useAI: vi.fn(() => ({
    run: mockAIRun,
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

describe("BodyEditor", () => {
  beforeEach(() => {
    resetTabs();
  });

  it("body type none shows empty state", () => {
    useTabsStore.getState().openTab({
      type: "http",
      body: { type: "none", content: "" },
    });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    render(<BodyEditor tabId={tabId} />);

    expect(screen.getByText(/no body for this request/i)).toBeInTheDocument();
  });

  it("switching to JSON shows code editor and updates content", async () => {
    useTabsStore.getState().openTab({
      type: "http",
      body: { type: "none", content: "" },
    });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    const user = userEvent.setup();
    render(<BodyEditor tabId={tabId} />);

    await user.click(screen.getByTestId("body-type-selector"));
    await user.click(await screen.findByRole("option", { name: /^JSON$/i }));

    await waitFor(
      () => {
        expect(screen.getByTestId("code-editor")).toBeInTheDocument();
      },
      { timeout: 12_000 },
    );

    const t = useTabsStore.getState().tabs[0] as HttpTab;
    expect(t.body.type).toBe("json");
  }, 15_000);

  describe("AI Body Generator", () => {
    it("shows Generate button only for raw types (json/xml/text/html)", () => {
      for (const type of ["json", "xml", "text", "html"]) {
        useTabsStore.getState().openTab({
          type: "http",
          body: { type: type as HttpTab["body"]["type"], content: "" },
        });
        const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;
        const { unmount } = render(<BodyEditor tabId={tabId} />);
        expect(screen.getByTestId("generate-body-btn")).toBeInTheDocument();
        unmount();
        resetTabs();
      }
    });

    it("hides Generate button for none, form-data, urlencoded", () => {
      for (const type of ["none", "form-data", "urlencoded"]) {
        useTabsStore.getState().openTab({
          type: "http",
          body: { type: type as HttpTab["body"]["type"], content: "" },
        });
        const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;
        const { unmount } = render(<BodyEditor tabId={tabId} />);
        expect(screen.queryByTestId("generate-body-btn")).not.toBeInTheDocument();
        unmount();
        resetTabs();
      }
    });

    it("opens AI prompt bar on Generate click", async () => {
      useTabsStore.getState().openTab({
        type: "http",
        body: { type: "json", content: "" },
      });
      const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;
      const user = userEvent.setup();
      render(<BodyEditor tabId={tabId} />);

      await user.click(screen.getByTestId("generate-body-btn"));
      expect(screen.getByTestId("ai-body-bar")).toBeInTheDocument();
    });

    it("closes bar without calling AI on ✕ click", async () => {
      useTabsStore.getState().openTab({
        type: "http",
        body: { type: "json", content: "" },
      });
      const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;
      const user = userEvent.setup();
      render(<BodyEditor tabId={tabId} />);

      await user.click(screen.getByTestId("generate-body-btn"));
      await user.click(screen.getByTestId("ai-body-close-btn"));

      expect(screen.queryByTestId("ai-body-bar")).not.toBeInTheDocument();
      expect(mockAIRun).not.toHaveBeenCalled();
    });

    it("calls AI and applies content to tab on success", async () => {
      mockAIRun.mockResolvedValueOnce({ content: '{"name":"Alice"}' });
      useTabsStore.getState().openTab({
        type: "http",
        body: { type: "json", content: "" },
      });
      const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;
      const user = userEvent.setup();
      render(<BodyEditor tabId={tabId} />);

      await user.click(screen.getByTestId("generate-body-btn"));
      await user.type(screen.getByTestId("ai-body-input"), "user object");
      await user.click(screen.getByTestId("ai-body-generate-btn"));

      await waitFor(() => {
        const t = useTabsStore.getState().tabs[0] as HttpTab;
        expect(t.body.content).toBe('{"name":"Alice"}');
      });
      expect(screen.queryByTestId("ai-body-bar")).not.toBeInTheDocument();
    });
  });

  it("form-data shows KV table and commits draft row", async () => {
    useTabsStore.getState().openTab({
      type: "http",
      body: { type: "json", content: "{}", formData: [] },
    });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    const user = userEvent.setup();
    render(<BodyEditor tabId={tabId} />);

    await user.click(screen.getByTestId("body-type-selector"));
    await user.click(await screen.findByRole("option", { name: /Form Data/i }));

    await waitFor(() =>
      expect(screen.getByTestId("body-draft-row-key")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId("body-draft-row-key"), {
      target: { value: "field" },
    });
    fireEvent.change(screen.getByTestId("body-draft-row-value"), {
      target: { value: "value" },
    });
    fireEvent.blur(screen.getByTestId("body-draft-row-value"));

    await waitFor(() => {
      const t = useTabsStore.getState().tabs[0] as HttpTab;
      expect(t.body.formData?.length).toBeGreaterThan(0);
      expect(t.body.formData?.some((r) => r.key === "field")).toBe(true);
    });
  });
}); // end describe("BodyEditor")
