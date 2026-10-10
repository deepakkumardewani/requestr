/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab, KVPair } from "@/types";
import { ParamsEditor } from "./ParamsEditor";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));

function resetTabs() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
}

function seedTab(url: string, params: KVPair[]) {
  useTabsStore.getState().openTab({ type: "http", url, params });
  return (useTabsStore.getState().tabs[0] as HttpTab).tabId;
}

function currentTab() {
  return useTabsStore.getState().tabs[0] as HttpTab;
}

const query = (id: string, key: string, value: string, enabled = true): KVPair => ({
  id,
  key,
  value,
  enabled,
  type: "query",
});

const path = (id: string, key: string, value: string): KVPair => ({
  id,
  key,
  value,
  enabled: true,
  type: "path",
});

describe("ParamsEditor", () => {
  beforeEach(resetTabs);
  afterEach(() => {
    cleanup();
    resetTabs();
  });

  it("renders nothing for an unknown tab id", () => {
    const { container } = render(<ParamsEditor tabId="missing" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("updates the URL query string when a query param value is edited", () => {
    const tabId = seedTab("https://api.test/users?page=1", [query("q1", "page", "1")]);
    render(<ParamsEditor tabId={tabId} />);

    fireEvent.change(screen.getByTestId("params-row-value-q1"), {
      target: { value: "2" },
    });

    expect(currentTab().url).toBe("https://api.test/users?page=2");
    expect(currentTab().params.find((p) => p.id === "q1")?.value).toBe("2");
  });

  it("appends a new query param to the URL when a draft row is committed", async () => {
    const user = userEvent.setup();
    const tabId = seedTab("https://api.test/users", []);
    render(<ParamsEditor tabId={tabId} />);

    await user.type(screen.getByTestId("params-draft-row-key"), "limit");
    await user.type(screen.getByTestId("params-draft-row-value"), "10{Enter}");

    expect(currentTab().url).toBe("https://api.test/users?limit=10");
  });

  it("removes the param from the URL when its row is deleted", async () => {
    const user = userEvent.setup();
    const tabId = seedTab("https://api.test/users?a=1&b=2", [
      query("qa", "a", "1"),
      query("qb", "b", "2"),
    ]);
    render(<ParamsEditor tabId={tabId} />);

    await user.click(screen.getByTestId("params-row-delete-qa"));

    expect(currentTab().url).toBe("https://api.test/users?b=2");
  });

  it("drops a disabled row from the URL but keeps it in the params list", async () => {
    const user = userEvent.setup();
    const tabId = seedTab("https://api.test/users?a=1&b=2", [
      query("qa", "a", "1"),
      query("qb", "b", "2"),
    ]);
    render(<ParamsEditor tabId={tabId} />);

    await user.click(screen.getByTestId("params-row-enable-qb"));

    expect(currentTab().url).toBe("https://api.test/users?a=1");
    expect(currentTab().params.find((p) => p.id === "qb")).toMatchObject({
      enabled: false,
      key: "b",
    });
  });

  it("keeps an already disabled row out of the URL when another row is edited", () => {
    const tabId = seedTab("https://api.test/users?a=1", [
      query("qa", "a", "1"),
      query("qd", "debug", "true", false),
    ]);
    render(<ParamsEditor tabId={tabId} />);

    fireEvent.change(screen.getByTestId("params-row-value-qa"), {
      target: { value: "9" },
    });

    expect(currentTab().url).toBe("https://api.test/users?a=9");
    expect(currentTab().params.some((p) => p.id === "qd")).toBe(true);
  });

  it("does not show a path params table when the request has no path params", () => {
    const tabId = seedTab("https://api.test/users", []);
    render(<ParamsEditor tabId={tabId} />);

    expect(screen.queryByTestId("path-params-draft-row-key")).not.toBeInTheDocument();
    expect(screen.getByTestId("params-draft-row-key")).toBeInTheDocument();
  });

  it("makes path param keys read-only and non-deletable", () => {
    const tabId = seedTab("https://api.test/users/:id", [path("p1", "id", "42")]);
    render(<ParamsEditor tabId={tabId} />);

    expect(screen.getByTestId("path-params-row-key-p1")).toHaveAttribute("readonly");
    expect(screen.queryByTestId("path-params-row-delete-p1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("path-params-draft-row-key")).not.toBeInTheDocument();
    expect(screen.queryByTestId("path-params-row-enable-p1")).not.toBeInTheDocument();
  });

  it("stores an edited path param value without changing the URL", () => {
    const tabId = seedTab("https://api.test/users/:id?page=1", [
      path("p1", "id", "42"),
      query("q1", "page", "1"),
    ]);
    render(<ParamsEditor tabId={tabId} />);

    fireEvent.change(screen.getByTestId("path-params-row-value-p1"), {
      target: { value: "99" },
    });

    expect(currentTab().url).toBe("https://api.test/users/:id?page=1");
    expect(currentTab().params.find((p) => p.id === "p1")?.value).toBe("99");
    expect(currentTab().params.find((p) => p.id === "q1")?.value).toBe("1");
  });

  it("preserves path params when a query param changes", () => {
    const tabId = seedTab("https://api.test/users/:id?page=1", [
      path("p1", "id", "42"),
      query("q1", "page", "1"),
    ]);
    render(<ParamsEditor tabId={tabId} />);

    fireEvent.change(screen.getByTestId("params-row-value-q1"), {
      target: { value: "3" },
    });

    const params = currentTab().params;
    expect(params.find((p) => p.id === "p1")).toMatchObject({ type: "path", value: "42" });
    expect(currentTab().url).toBe("https://api.test/users/:id?page=3");
  });
});
