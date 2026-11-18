/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HttpTab, RequestModel } from "@/types";
import { useSaveRequest } from "./useSaveRequest";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function httpTab(overrides: Partial<HttpTab>): HttpTab {
  return {
    tabId: "tab1",
    requestId: "req-1",
    name: "API",
    isDirty: true,
    type: "http",
    url: "https://api.test/v1",
    method: "POST",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "json", content: "{}" },
    preScript: "",
    postScript: "",
    ...overrides,
  };
}

function sampleRequest(id: string): RequestModel {
  return {
    id,
    collectionId: "col1",
    name: "Old",
    method: "GET",
    url: "https://old.test",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
  };
}

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useUIStore.setState({ saveModalOpen: false });
}

describe("useSaveRequest", () => {
  beforeEach(() => {
    resetStores();
    vi.mocked(getDB).mockReturnValue(null);
    vi.clearAllMocks();
  });

  it("does nothing when there is no active tab", () => {
    const { result } = renderHook(() => useSaveRequest());
    result.current.save();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(useUIStore.getState().saveModalOpen).toBe(false);
  });

  it("shows info toast for non-http tab types", () => {
    useTabsStore.setState({
      tabs: [
        {
          tabId: "gql",
          requestId: null,
          name: "G",
          isDirty: false,
          type: "graphql",
          url: "",
          headers: [],
          query: "{}",
          variables: "{}",
          operationName: "",
          auth: { type: "none" },
        },
      ],
      activeTabId: "gql",
    });
    const { result } = renderHook(() => useSaveRequest());
    result.current.save();
    expect(toast.info).toHaveBeenCalledWith(
      "Saving is only available for HTTP requests",
    );
  });

  it("opens save modal when HTTP tab has no request id", () => {
    const tab = httpTab({ requestId: null });
    useTabsStore.setState({ tabs: [tab], activeTabId: tab.tabId });
    const { result } = renderHook(() => useSaveRequest());

    result.current.save();

    expect(useUIStore.getState().saveModalOpen).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("returns early when request id points to missing request", () => {
    const tab = httpTab({ requestId: "missing" });
    useTabsStore.setState({ tabs: [tab], activeTabId: tab.tabId });
    useCollectionsStore.setState({ requests: [], collections: [] });
    const { result } = renderHook(() => useSaveRequest());

    result.current.save();

    expect(toast.success).not.toHaveBeenCalled();
    expect(useUIStore.getState().saveModalOpen).toBe(false);
  });

  it("updates collection request, clears dirty flag, and toasts on success", () => {
    const req = sampleRequest("req-1");
    useCollectionsStore.setState({
      collections: [],
      requests: [req],
    });
    const tab = httpTab({
      requestId: "req-1",
      name: "Saved name",
      method: "PUT",
      url: "https://new.test",
      isDirty: true,
    });
    useTabsStore.setState({ tabs: [tab], activeTabId: tab.tabId });
    const { result } = renderHook(() => useSaveRequest());

    result.current.save();

    const updated = useCollectionsStore.getState().requests[0];
    expect(updated?.name).toBe("Saved name");
    expect(updated?.method).toBe("PUT");
    expect(updated?.url).toBe("https://new.test");
    expect(useTabsStore.getState().tabs[0]?.isDirty).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Request saved");
  });

  it("persists tab assertions onto the saved request", () => {
    useCollectionsStore.setState({
      collections: [],
      requests: [sampleRequest("req-1")],
    });
    const assertions = [
      {
        id: "a1",
        type: "status",
        operator: "equals",
        expected: "200",
      },
    ] as unknown as HttpTab["assertions"];
    const tab = httpTab({ requestId: "req-1", assertions });
    useTabsStore.setState({ tabs: [tab], activeTabId: tab.tabId });
    const { result } = renderHook(() => useSaveRequest());

    result.current.save();

    expect(useCollectionsStore.getState().requests[0]?.assertions).toEqual(
      assertions,
    );
  });

  it("exposes active tab matching store active id", () => {
    const tab = httpTab({ tabId: "active" });
    useTabsStore.setState({ tabs: [tab], activeTabId: "active" });
    const { result } = renderHook(() => useSaveRequest());
    expect(result.current.activeTab?.tabId).toBe("active");
  });
});
