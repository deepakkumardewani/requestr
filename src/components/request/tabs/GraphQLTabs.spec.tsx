/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import type { GraphQLTab } from "@/types";
import { GraphQLTabs } from "./GraphQLTabs";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("../GraphQLSchemaExplorer", () => ({
  GraphQLSchemaExplorer: ({
    onFieldSnippet,
  }: {
    onFieldSnippet: (snippet: string) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-inject-snippet"
      onClick={() => onFieldSnippet("users {\n  id\n}")}
    >
      Inject field
    </button>
  ),
}));

vi.mock("@/components/request/CodeEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (v: string) => void;
  }) => (
    <textarea
      data-testid="mock-gql-code"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

function resetTabs() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
}

afterEach(() => {
  cleanup();
  resetTabs();
});

describe("GraphQLTabs", () => {
  beforeEach(() => {
    resetTabs();
  });

  it("query tab shows editor and updates store", async () => {
    useTabsStore.getState().openTab({ type: "graphql" });
    const tabId = (useTabsStore.getState().tabs[0] as GraphQLTab).tabId;

    render(<GraphQLTabs tabId={tabId} />);

    const wrap = await screen.findByTestId("graphql-query-editor");
    const ta = wrap.querySelector("textarea");
    expect(ta).toBeTruthy();
    fireEvent.change(ta!, { target: { value: "{ items { id } }" } });

    const t = useTabsStore.getState().tabs[0] as GraphQLTab;
    expect(t.query).toBe("{ items { id } }");
  });

  it("switching to variables tab edits variables JSON", async () => {
    useTabsStore.getState().openTab({ type: "graphql", variables: "{}" });
    const tabId = (useTabsStore.getState().tabs[0] as GraphQLTab).tabId;

    render(<GraphQLTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("request-tab-graphql-variables"));
    await waitFor(() =>
      expect(
        screen.getByTestId("graphql-variables-editor"),
      ).toBeInTheDocument(),
    );

    const wrap = screen.getByTestId("graphql-variables-editor");
    const ta = wrap.querySelector("textarea");
    expect(ta).toBeTruthy();
    fireEvent.change(ta!, { target: { value: '{"id":"1"}' } });

    const t = useTabsStore.getState().tabs[0] as GraphQLTab;
    expect(t.variables).toBe('{"id":"1"}');
  });

  it("handleFieldSnippet builds a new query when the editor is empty", async () => {
    useTabsStore.getState().openTab({ type: "graphql", query: "" });
    const tabId = (useTabsStore.getState().tabs[0] as GraphQLTab).tabId;

    render(<GraphQLTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("mock-inject-snippet"));

    const t = useTabsStore.getState().tabs[0] as GraphQLTab;
    expect(t.query).toContain("users");
    expect(t.query).toMatch(/^\{\s*users/);
  });

  it("handleFieldSnippet skips duplicate root fields", async () => {
    useTabsStore.getState().openTab({
      type: "graphql",
      query: "{\n  users { id }\n}",
    });
    const tabId = (useTabsStore.getState().tabs[0] as GraphQLTab).tabId;

    render(<GraphQLTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("mock-inject-snippet"));

    const t = useTabsStore.getState().tabs[0] as GraphQLTab;
    expect(t.query).toBe("{\n  users { id }\n}");
  });

  it("headers badge when headers present", () => {
    useTabsStore.getState().openTab({
      type: "graphql",
      headers: [{ id: "h1", key: "Auth", value: "x", enabled: true }],
    });
    const tabId = (useTabsStore.getState().tabs[0] as GraphQLTab).tabId;

    render(<GraphQLTabs tabId={tabId} />);

    expect(screen.getByTestId("request-tab-headers")).toHaveTextContent("1");
  });
});
