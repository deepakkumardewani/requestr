/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
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

  it("keeps {{var}} tokens verbatim in the URL input even when the variable resolves", () => {
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e1",
          name: "E",
          variables: [
            {
              id: "v1",
              key: "host",
              initialValue: "api.example.com",
              currentValue: "",
              isSecret: false,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "e1",
    });
    const tabId = seedHttpTab({ url: "https://{{host}}/{{missing}}" });
    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={false}
      />
    );

    expect(screen.getByTestId("url-input")).toHaveValue(
      "https://{{host}}/{{missing}}"
    );
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

describe("UrlBar variable highlighting", () => {
  function seedEnv() {
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e1",
          name: "E",
          variables: [
            {
              id: "v1",
              key: "baseUrl",
              initialValue: "https://api.test",
              currentValue: "",
              isSecret: false,
            },
            {
              id: "v2",
              key: "empty",
              initialValue: "",
              currentValue: "",
              isSecret: false,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "e1",
    });
  }

  function renderBar(url: string) {
    const tabId = seedHttpTab({ url });
    return render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={false}
      />
    );
  }

  const markers = (state: string) =>
    Array.from(
      document.querySelectorAll(`[data-variable-state="${state}"]`)
    ).map((n) => n.textContent);

  it("marks resolved and unresolved variables distinctly", () => {
    seedEnv();
    renderBar("{{baseUrl}}/users/{{missingVar}}/{{empty}}");
    expect(markers("resolved")).toEqual(["{{baseUrl}}"]);
    expect(markers("unresolved")).toEqual(["{{missingVar}}", "{{empty}}"]);
  });

  it("adds no markers for plain text", () => {
    seedEnv();
    renderBar("https://plain.test/path");
    expect(document.querySelectorAll("[data-variable-state]")).toHaveLength(0);
  });

  it("hides the overlay from assistive tech and keeps the input accessible", () => {
    seedEnv();
    renderBar("{{baseUrl}}");
    const overlay = screen.getByTestId("variable-highlight-overlay");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).not.toContainElement(screen.getByTestId("url-input"));
  });

  it("updates highlighting as the user types", async () => {
    seedEnv();
    renderBar("");
    await userEvent.type(screen.getByTestId("url-input"), "x{{{{baseUrl}}");
    expect(screen.getByTestId("url-input")).toHaveValue("x{{baseUrl}}");
    expect(markers("resolved")).toEqual(["{{baseUrl}}"]);

    fireEvent.change(screen.getByTestId("url-input"), {
      target: { value: "{{nope}}" },
    });
    expect(markers("resolved")).toEqual([]);
    expect(markers("unresolved")).toEqual(["{{nope}}"]);
  });
});

describe("UrlBar cURL, method menu and keyboard behavior", () => {
  const writeText = vi.fn();

  function renderBar(overrides: Partial<HttpTab> = {}) {
    const tabId = seedHttpTab(overrides);
    render(
      <UrlBar
        tabId={tabId}
        send={urlBarMocks.send}
        cancel={urlBarMocks.cancel}
        isLoading={false}
      />
    );
    return tabId;
  }

  function currentTab() {
    return useTabsStore.getState().tabs[0] as HttpTab;
  }

  function pasteIntoUrl(text: string) {
    fireEvent.paste(screen.getByTestId("url-input"), {
      clipboardData: { getData: () => text },
    });
  }

  beforeEach(() => {
    resetStores();
    urlBarMocks.isLoading = false;
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  describe("pasting a cURL command into the URL input", () => {
    it("populates url, method, headers and body from the pasted command", () => {
      renderBar({ url: "" });

      pasteIntoUrl(
        `curl -X POST https://api.paste.test/items -H 'X-Trace: abc' -d '{"a":1}'`
      );

      const tab = currentTab();
      expect(tab.url).toBe("https://api.paste.test/items");
      expect(tab.method).toBe("POST");
      expect(tab.headers.some((h) => h.key === "X-Trace" && h.value === "abc")).toBe(true);
      expect(tab.body.content).toBe('{"a":1}');
      expect(toast.success).toHaveBeenCalledWith(
        "cURL imported",
        expect.objectContaining({ description: "POST https://api.paste.test/items" })
      );
    });

    it("recognises the curl prefix case-insensitively with leading whitespace", () => {
      renderBar({ url: "" });

      pasteIntoUrl("  CURL https://api.paste.test/upper");

      expect(currentTab().url).toBe("https://api.paste.test/upper");
    });

    it("shows an error toast and leaves the tab unchanged when the cURL has no URL", () => {
      renderBar({ url: "https://keep.test", method: "PUT" });

      pasteIntoUrl("curl -X POST");

      expect(toast.error).toHaveBeenCalledWith(
        "Failed to parse cURL",
        expect.objectContaining({ description: "No URL found in cURL command" })
      );
      expect(currentTab().url).toBe("https://keep.test");
      expect(currentTab().method).toBe("PUT");
    });

    it("lets ordinary pasted text through without importing", () => {
      renderBar({ url: "https://keep.test" });

      pasteIntoUrl("https://plain-paste.test");

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(currentTab().method).toBe("GET");
    });
  });

  describe("copy as cURL button", () => {
    it("copies a cURL command with environment variables resolved", async () => {
      useEnvironmentsStore.setState({
        environments: [
          {
            id: "e1",
            name: "E",
            variables: [
              {
                id: "v1",
                key: "host",
                initialValue: "resolved.test",
                currentValue: "",
                isSecret: false,
              },
            ],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        activeEnvId: "e1",
      });
      renderBar({ url: "https://{{host}}/users" });

      fireEvent.click(screen.getByTestId("copy-curl-btn"));

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText.mock.calls[0][0]).toContain("https://resolved.test/users");
      expect(writeText.mock.calls[0][0]).not.toContain("{{host}}");
      expect(toast.success).toHaveBeenCalledWith("cURL copied to clipboard");
    });

    it("shows an error toast and no success toast when the clipboard write fails", async () => {
      writeText.mockRejectedValueOnce(new Error("denied"));
      renderBar();

      fireEvent.click(screen.getByTestId("copy-curl-btn"));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Failed to copy to clipboard")
      );
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("method menu", () => {
    it("lists HEAD and OPTIONS among the methods", async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByTestId("method-selector"));

      expect(await screen.findByTestId("method-head")).toBeInTheDocument();
      expect(screen.getByTestId("method-options")).toBeInTheDocument();
    });

    it.each(["HEAD", "OPTIONS"] as const)(
      "selecting %s updates the tab method",
      async (method) => {
        const user = userEvent.setup();
        renderBar({ method: "GET" });

        await user.click(screen.getByTestId("method-selector"));
        await user.click(await screen.findByTestId(`method-${method.toLowerCase()}`));

        await waitFor(() => expect(currentTab().method).toBe(method));
      }
    );

    it("marks only the current method with a selected checkmark", async () => {
      const user = userEvent.setup();
      renderBar({ method: "OPTIONS" });

      await user.click(screen.getByTestId("method-selector"));
      const selected = await screen.findByTestId("method-options");
      const other = screen.getByTestId("method-head");

      expect(selected).toHaveAttribute("aria-selected", "true");
      expect(selected.querySelector("svg")).not.toBeNull();
      expect(other).not.toHaveAttribute("aria-selected", "true");
      expect(other.querySelector("svg")).toBeNull();
    });
  });

  describe("keyboard shortcut in the URL input", () => {
    it("sends the request on Cmd+Enter", () => {
      renderBar();

      fireEvent.keyDown(screen.getByTestId("url-input"), {
        key: "Enter",
        metaKey: true,
      });

      expect(urlBarMocks.send).toHaveBeenCalledTimes(1);
    });

    it("sends the request on Ctrl+Enter", () => {
      renderBar();

      fireEvent.keyDown(screen.getByTestId("url-input"), {
        key: "Enter",
        ctrlKey: true,
      });

      expect(urlBarMocks.send).toHaveBeenCalledTimes(1);
    });

    it("does not send on a plain Enter", () => {
      renderBar();

      fireEvent.keyDown(screen.getByTestId("url-input"), { key: "Enter" });

      expect(urlBarMocks.send).not.toHaveBeenCalled();
    });
  });
});
