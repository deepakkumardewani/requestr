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
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab } from "@/types";
import { UrlBar } from "./UrlBar";

const mockFetch = vi.fn();

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const urlBarMocks = vi.hoisted(() => ({
  send: vi.fn(),
  cancel: vi.fn(),
  save: vi.fn(),
  isLoading: false,
}));

vi.mock("@/hooks/useSendRequest", () => ({
  useSendRequest: () => ({
    send: urlBarMocks.send,
    cancel: urlBarMocks.cancel,
    isLoading: urlBarMocks.isLoading,
  }),
}));

vi.mock("@/hooks/useSaveRequest", () => ({
  useSaveRequest: () => ({ save: urlBarMocks.save }),
}));

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
}

function seedHttpTab(overrides: Partial<HttpTab> = {}) {
  useTabsStore.getState().openTab({ type: "http", ...overrides });
  const tab = useTabsStore.getState().tabs[0] as HttpTab;
  return tab.tabId;
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  resetStores();
  urlBarMocks.isLoading = false;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("UrlBar", () => {
  beforeEach(() => {
    resetStores();
    urlBarMocks.isLoading = false;
  });

  it("renders URL input and send triggers send when idle", () => {
    const tabId = seedHttpTab({ url: "https://api.example.com" });
    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={urlBarMocks.isLoading}
      />
    );

    const input = screen.getByTestId("url-input");
    expect(input).toHaveValue("https://api.example.com");

    fireEvent.change(input, { target: { value: "https://new.test" } });
    const t = useTabsStore.getState().tabs[0] as HttpTab;
    expect(t.url).toBe("https://new.test");

    fireEvent.click(screen.getByTestId("send-request-btn"));
    expect(urlBarMocks.send).toHaveBeenCalled();
  });

  it("send button shows Cancel and invokes cancel while loading", () => {
    urlBarMocks.isLoading = true;
    const tabId = seedHttpTab();
    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={urlBarMocks.isLoading}
      />
    );

    expect(screen.getByTestId("send-request-btn")).toHaveTextContent("Cancel");
    fireEvent.click(screen.getByTestId("send-request-btn"));
    expect(urlBarMocks.cancel).toHaveBeenCalled();
  });

  it("method selector updates tab method", async () => {
    const tabId = seedHttpTab({ method: "GET" });
    const user = userEvent.setup();
    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={urlBarMocks.isLoading}
      />
    );

    await user.click(screen.getByTestId("method-selector"));
    await user.click(await screen.findByTestId("method-post"));

    await waitFor(() => {
      const t = useTabsStore.getState().tabs[0] as HttpTab;
      expect(t.method).toBe("POST");
    });
  });

  it("method menu matches the trigger width and insets its rows", async () => {
    const tabId = seedHttpTab({ method: "GET" });
    const user = userEvent.setup();
    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={urlBarMocks.isLoading}
      />
    );

    await user.click(screen.getByTestId("method-selector"));
    await screen.findByTestId("method-options");
    const menu = document.querySelector('[data-slot="select-content"]');
    expect(menu?.className).toContain("w-(--anchor-width)");
    expect(menu?.className).toContain("min-w-0");
    expect(menu?.className).toContain("p-1");
    expect(menu?.className).not.toContain("w-auto");
  });

  it("save button invokes save hook", () => {
    const tabId = seedHttpTab();
    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={urlBarMocks.isLoading}
      />
    );

    fireEvent.click(screen.getByTestId("save-request-btn"));
    expect(urlBarMocks.save).toHaveBeenCalled();
  });

  it("GraphQL tab renders URL input and send", () => {
    useTabsStore
      .getState()
      .openTab({ type: "graphql", url: "https://gql.test" });
    const tabId = (useTabsStore.getState().tabs[0] as { tabId: string }).tabId;

    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={urlBarMocks.isLoading}
      />
    );

    fireEvent.change(screen.getByTestId("url-input"), {
      target: { value: "https://gql.updated" },
    });
    expect((useTabsStore.getState().tabs[0] as { url: string }).url).toBe(
      "https://gql.updated",
    );

    fireEvent.click(screen.getByTestId("send-request-btn"));
    expect(urlBarMocks.send).toHaveBeenCalled();
  });

  it("returns null when tabId is missing from store", () => {
    render(
      <UrlBar
        tabId="missing"
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={urlBarMocks.isLoading}
      />
    );
    expect(screen.queryByTestId("url-input")).toBeNull();
  });

  describe("AI Request Builder", () => {
    it("wand button renders for HTTP tabs", () => {
      const tabId = seedHttpTab({ url: "https://api.example.com" });
      render(
        <UrlBar
          tabId={tabId}
          send={urlBarMocks.send}
          cancel={urlBarMocks.cancel}
          isLoading={false}
        />
      );
      expect(screen.getByTestId("ai-builder-wand-btn")).toBeTruthy();
    });

    it("wand button absent for GraphQL tabs", () => {
      useTabsStore.getState().openTab({ type: "graphql", url: "https://gql.test" });
      const tabId = (useTabsStore.getState().tabs[0] as { tabId: string }).tabId;
      render(
        <UrlBar
          tabId={tabId}
          send={urlBarMocks.send}
          cancel={urlBarMocks.cancel}
          isLoading={false}
        />
      );
      expect(screen.queryByTestId("ai-builder-wand-btn")).toBeNull();
    });

    it("clicking wand button opens Sheet with textarea", async () => {
      const user = userEvent.setup();
      const tabId = seedHttpTab();
      render(
        <UrlBar
          tabId={tabId}
          send={urlBarMocks.send}
          cancel={urlBarMocks.cancel}
          isLoading={false}
        />
      );

      await user.click(screen.getByTestId("ai-builder-wand-btn"));
      expect(screen.getByTestId("ai-builder-input")).toBeTruthy();
    });

    it("submitting description calls /api/ai with build-request action", async () => {
      const user = userEvent.setup();
      const tabId = seedHttpTab({ url: "https://api.example.com" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          method: "POST",
          url: "https://jsonplaceholder.typicode.com/users",
          headers: [{ key: "Content-Type", value: "application/json" }],
          params: [],
          bodyType: "json",
          bodyContent: '{"name":"Alice"}',
        }),
      });

      render(
        <UrlBar
          tabId={tabId}
          send={urlBarMocks.send}
          cancel={urlBarMocks.cancel}
          isLoading={false}
        />
      );

      await user.click(screen.getByTestId("ai-builder-wand-btn"));
      await user.type(screen.getByTestId("ai-builder-input"), "POST a new user");
      await user.click(screen.getByTestId("ai-builder-generate-btn"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/ai",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"action":"build-request"'),
          }),
        );
      });
    });

    it("Sheet renders structured preview after generate", async () => {
      const user = userEvent.setup();
      const tabId = seedHttpTab();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          method: "POST",
          url: "https://jsonplaceholder.typicode.com/users",
          headers: [{ key: "Content-Type", value: "application/json" }],
          params: [],
          bodyType: "json",
          bodyContent: '{"name":"Alice"}',
        }),
      });

      render(
        <UrlBar
          tabId={tabId}
          send={urlBarMocks.send}
          cancel={urlBarMocks.cancel}
          isLoading={false}
        />
      );

      await user.click(screen.getByTestId("ai-builder-wand-btn"));
      await user.type(screen.getByTestId("ai-builder-input"), "POST a new user");
      await user.click(screen.getByTestId("ai-builder-generate-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("ai-builder-preview")).toBeTruthy();
        expect(screen.getByTestId("preview-url")).toHaveTextContent(
          "https://jsonplaceholder.typicode.com/users",
        );
      });
    });

    it("Apply calls updateTabState with correct fields", async () => {
      const user = userEvent.setup();
      const tabId = seedHttpTab({ url: "https://api.example.com" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          method: "POST",
          url: "https://jsonplaceholder.typicode.com/users",
          headers: [{ key: "Content-Type", value: "application/json" }],
          params: [],
          bodyType: "json",
          bodyContent: '{"name":"Alice"}',
        }),
      });

      render(
        <UrlBar
          tabId={tabId}
          send={urlBarMocks.send}
          cancel={urlBarMocks.cancel}
          isLoading={false}
        />
      );

      await user.click(screen.getByTestId("ai-builder-wand-btn"));
      await user.type(screen.getByTestId("ai-builder-input"), "POST a user");
      await user.click(screen.getByTestId("ai-builder-generate-btn"));

      await waitFor(() =>
        expect(screen.getByTestId("ai-builder-preview")).toBeTruthy(),
      );

      // Find and click the Apply button (rendered inside the AIRequestBuilder)
      const applyBtn = screen.getByText("Apply");
      await user.click(applyBtn);

      await waitFor(() => {
        const t = useTabsStore.getState().tabs[0] as HttpTab;
        expect(t.method).toBe("POST");
        expect(t.url).toBe("https://jsonplaceholder.typicode.com/users");
      });
    });

    it("Discard closes Sheet without calling updateTabState", async () => {
      const user = userEvent.setup();
      const tabId = seedHttpTab({ url: "https://original.com", method: "GET" });

      render(
        <UrlBar
          tabId={tabId}
          send={urlBarMocks.send}
          cancel={urlBarMocks.cancel}
          isLoading={false}
        />
      );

      await user.click(screen.getByTestId("ai-builder-wand-btn"));
      expect(screen.getByTestId("ai-builder-input")).toBeTruthy();

      await user.click(screen.getByTestId("ai-builder-discard-btn"));

      await waitFor(() => {
        expect(screen.queryByTestId("ai-builder-input")).toBeNull();
      });

      const t = useTabsStore.getState().tabs[0] as HttpTab;
      expect(t.url).toBe("https://original.com");
      expect(t.method).toBe("GET");
    });
  });
});
