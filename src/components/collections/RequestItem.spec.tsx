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
import { toast } from "sonner";
import { downloadPostmanRequest } from "@/lib/postmanExporter";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab, RequestModel } from "@/types";
import { RequestItem } from "./RequestItem";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/postmanExporter", () => ({
  downloadPostmanRequest: vi.fn(),
}));

function resetStores() {
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useSettingsStore.setState({ showHealthMonitor: false });
  useHistoryStore.setState({ entries: [] });
}

function minimalRequest(overrides: Partial<RequestModel> = {}): RequestModel {
  return {
    id: "req-1",
    collectionId: "col-1",
    name: "Get User",
    method: "GET",
    url: "https://api.example.com/users",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("RequestItem", () => {
  it("renders method and request name", () => {
    const req = minimalRequest({ name: "List Posts" });
    useCollectionsStore.setState({
      collections: [
        {
          id: "col-1",
          name: "API",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    expect(screen.getByText("List Posts")).toBeInTheDocument();
    expect(screen.getByTestId("request-item")).toBeInTheDocument();
  });

  it("opens a new tab when clicked and no tab exists for the request", async () => {
    const user = userEvent.setup();
    const req = minimalRequest();
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item"));

    await waitFor(() => {
      const tabs = useTabsStore.getState().tabs;
      expect(tabs).toHaveLength(1);
      const t = tabs[0] as HttpTab;
      expect(t.requestId).toBe(req.id);
      expect(t.name).toBe(req.name);
    });
  });

  it("activates existing tab instead of opening duplicate", async () => {
    const user = userEvent.setup();
    const req = minimalRequest();
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    useTabsStore.getState().openTab({
      type: "http",
      requestId: req.id,
      name: req.name,
      method: req.method,
      url: req.url,
      params: req.params,
      headers: req.headers,
      auth: req.auth,
      body: req.body,
      preScript: req.preScript,
      postScript: req.postScript,
      isDirty: false,
    });
    const existingTabId = useTabsStore.getState().tabs[0].tabId;
    useTabsStore.setState({ activeTabId: null });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item"));

    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeTabId).toBe(existingTabId);
  });

  it("re-activates the same tab on repeated clicks and never opens a second one", async () => {
    const user = userEvent.setup();
    const req = minimalRequest();
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });
    useTabsStore.getState().openTab({
      type: "http",
      requestId: req.id,
      name: req.name,
      isDirty: false,
    });
    useTabsStore.getState().openTab({ type: "http", name: "Other" });
    const existingTabId = useTabsStore.getState().tabs[0].tabId;
    expect(useTabsStore.getState().activeTabId).not.toBe(existingTabId);

    render(<RequestItem request={req} isActive={false} />);
    await user.click(screen.getByTestId("request-item"));
    await user.click(screen.getByTestId("request-item"));

    expect(useTabsStore.getState().tabs).toHaveLength(2);
    expect(useTabsStore.getState().activeTabId).toBe(existingTabId);
  });

  it("starts inline rename from dropdown and commits on blur", async () => {
    const user = userEvent.setup();
    const req = minimalRequest({ name: "Old" });
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(screen.getByTestId("request-rename-btn"));

    const input = screen.getByDisplayValue("Old");
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        useCollectionsStore.getState().requests.find((r) => r.id === req.id)
          ?.name,
      ).toBe("New Title");
    });
    expect(screen.queryByDisplayValue("New Title")).not.toBeInTheDocument();
  });

  it("duplicate adds a copied request to the same collection", async () => {
    const user = userEvent.setup();
    const req = minimalRequest({ name: "Original" });
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

    await waitFor(() => {
      const requests = useCollectionsStore.getState().requests;
      expect(requests).toHaveLength(2);
      expect(requests.some((r) => r.name === "Original (copy)")).toBe(true);
    });
  });

  it("delete confirmation removes request", async () => {
    const user = userEvent.setup();
    const req = minimalRequest();
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(screen.getByTestId("request-delete-btn"));

    fireEvent.click(screen.getByRole("button", { name: /^yes, delete$/i }));

    await waitFor(() => {
      expect(useCollectionsStore.getState().requests).toHaveLength(0);
    });
  });

  it("duplicate keeps the original folderId", async () => {
    const user = userEvent.setup();
    const req = minimalRequest({ name: "Nested", folderId: "folder-9" });
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

    await waitFor(() => {
      const copy = useCollectionsStore
        .getState()
        .requests.find((r) => r.name === "Nested (copy)");
      expect(copy?.folderId).toBe("folder-9");
      expect(copy?.collectionId).toBe("col-1");
    });
  });

  describe("Copy as cURL", () => {
    it("copies the generated cURL command and shows a success toast", async () => {
      const user = userEvent.setup();
      const writeText = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue(undefined);
      const req = minimalRequest({ url: "https://api.example.com/users" });

      render(<RequestItem request={req} isActive={false} />);
      await user.click(screen.getByTestId("request-item-more-btn"));
      await user.click(screen.getByRole("menuitem", { name: /copy as curl/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("cURL copied to clipboard");
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toContain(
        "https://api.example.com/users",
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("shows an error toast when the clipboard write fails", async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
        new Error("denied"),
      );
      const req = minimalRequest();

      render(<RequestItem request={req} isActive={false} />);
      await user.click(screen.getByTestId("request-item-more-btn"));
      await user.click(screen.getByRole("menuitem", { name: /copy as curl/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to copy to clipboard",
        );
      });
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  it("exports the request as a Postman collection", async () => {
    const user = userEvent.setup();
    const req = minimalRequest({ name: "Export Me" });

    render(<RequestItem request={req} isActive={false} />);
    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(
      screen.getByRole("menuitem", { name: /export as postman/i }),
    );

    expect(downloadPostmanRequest).toHaveBeenCalledTimes(1);
    expect(downloadPostmanRequest).toHaveBeenCalledWith(req);
  });

  describe("health dot", () => {
    const HEALTH_URL = "https://health.example.com/ping";

    function seedHistory(url: string) {
      useHistoryStore.setState({
        entries: Array.from({ length: 5 }, (_, i) => ({
          id: `h-${i}`,
          method: "GET",
          url,
          status: 200,
          duration: 10 + i,
          size: 1,
          timestamp: Date.now(),
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            body: "",
            duration: 10 + i,
            size: 1,
            url,
            method: "GET",
            timestamp: Date.now(),
          },
          request: minimalRequestTab(url),
        })) as never,
      });
    }

    function minimalRequestTab(url: string): HttpTab {
      return {
        tabId: "t0",
        requestId: null,
        name: "r",
        isDirty: false,
        type: "http",
        url,
        method: "GET",
        headers: [],
        params: [],
        auth: { type: "none" },
        body: { type: "none", content: "" },
        preScript: "",
        postScript: "",
      };
    }

    it("shows the health indicator when the monitor is enabled and the url is set", () => {
      seedHistory(HEALTH_URL);
      useSettingsStore.setState({ showHealthMonitor: true });

      render(
        <RequestItem
          request={minimalRequest({ url: HEALTH_URL })}
          isActive={false}
        />,
      );

      expect(screen.getByLabelText(/success/i)).toBeInTheDocument();
    });

    it("hides the health indicator when the monitor is disabled", () => {
      seedHistory(HEALTH_URL);
      useSettingsStore.setState({ showHealthMonitor: false });

      render(
        <RequestItem
          request={minimalRequest({ url: HEALTH_URL })}
          isActive={false}
        />,
      );

      expect(screen.queryByLabelText(/success/i)).not.toBeInTheDocument();
    });

    it("hides the health indicator when the request url is empty", () => {
      seedHistory("");
      useSettingsStore.setState({ showHealthMonitor: true });

      render(
        <RequestItem request={minimalRequest({ url: "" })} isActive={false} />,
      );

      expect(screen.queryByLabelText(/success/i)).not.toBeInTheDocument();
    });
  });
});
