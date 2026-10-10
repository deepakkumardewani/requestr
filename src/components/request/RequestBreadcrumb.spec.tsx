/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestBreadcrumb } from "@/components/layout/RequestBreadcrumb";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { CollectionModel, HttpTab, RequestModel } from "@/types";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));

const collection: CollectionModel = {
  id: "col-1",
  name: "Payments API",
  createdAt: 1,
  updatedAt: 1,
};

const savedRequest: RequestModel = {
  id: "req-1",
  collectionId: "col-1",
  name: "Create charge",
  method: "POST",
  url: "https://api.test/charges",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
};

function reset() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useCollectionsStore.setState({ collections: [], requests: [] });
}

function openTab(initial: Partial<HttpTab>) {
  useTabsStore.getState().openTab({ type: "http", ...initial });
  return (useTabsStore.getState().tabs[0] as HttpTab).tabId;
}

describe("RequestBreadcrumb", () => {
  beforeEach(reset);
  afterEach(() => {
    cleanup();
    reset();
  });

  it("shows the tab name followed by an unsaved marker for a tab without a saved request", () => {
    const tabId = openTab({ name: "Scratch call" });
    render(<RequestBreadcrumb tabId={tabId} />);

    expect(screen.getByText("Scratch call")).toBeInTheDocument();
    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });

  it("shows collection name and request name for a saved request", () => {
    useCollectionsStore.setState({ collections: [collection], requests: [savedRequest] });
    const tabId = openTab({ name: "stale tab name", requestId: "req-1" });
    render(<RequestBreadcrumb tabId={tabId} />);

    expect(screen.getByText("Payments API")).toBeInTheDocument();
    expect(screen.getByText("Create charge")).toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    expect(screen.queryByText("stale tab name")).not.toBeInTheDocument();
  });

  it("renders no names when the saved request's collection is missing", () => {
    useCollectionsStore.setState({ collections: [], requests: [savedRequest] });
    const tabId = openTab({ name: "Orphan tab", requestId: "req-1" });
    render(<RequestBreadcrumb tabId={tabId} />);

    expect(screen.queryByText("Create charge")).not.toBeInTheDocument();
    expect(screen.queryByText("Orphan tab")).not.toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });

  it("renders no names when the request id is not in the collections store", () => {
    useCollectionsStore.setState({ collections: [collection], requests: [] });
    const tabId = openTab({ name: "Deleted req tab", requestId: "gone" });
    render(<RequestBreadcrumb tabId={tabId} />);

    expect(screen.queryByText("Payments API")).not.toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });

  it("renders no names when there is no active tab", () => {
    useCollectionsStore.setState({ collections: [collection], requests: [savedRequest] });
    render(<RequestBreadcrumb tabId={null} />);

    expect(screen.queryByText("Payments API")).not.toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });
});
