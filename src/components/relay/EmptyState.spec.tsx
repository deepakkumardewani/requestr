/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { EmptyState, SUGGESTION_KEYS } from "./EmptyState";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    return path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string;
  },
}));

beforeEach(() => {
  pathname.value = "/";
  useRelayStore.setState({ pendingPrompt: null });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({ collections: [], requests: [], folders: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useResponseStore.setState({ responses: {} });
  useChainStore.setState({ chains: {} });
});

const context = () => screen.getByTestId("relay-suggestions").dataset.context;

describe("EmptyState", () => {
  it("keeps every suggestion set between 4 and 6 entries with real copy", () => {
    for (const keys of Object.values(SUGGESTION_KEYS)) {
      expect(keys.length).toBeGreaterThanOrEqual(4);
      expect(keys.length).toBeLessThanOrEqual(6);
      for (const key of keys) {
        expect(en.suggestions).toHaveProperty(key);
      }
    }
  });

  it("leads with the Relay logo", () => {
    render(<EmptyState />);
    expect(screen.getByTestId("relay-logo")).toBeInTheDocument();
  });

  it("offers onboarding suggestions in an empty workspace", () => {
    render(<EmptyState />);
    expect(context()).toBe("empty");
    expect(screen.getAllByTestId("relay-suggestion")).toHaveLength(SUGGESTION_KEYS.empty.length);
  });

  it("offers workspace suggestions once there is content", () => {
    useCollectionsStore.setState({
      collections: [{ id: "c1", name: "C", createdAt: 0, updatedAt: 0 }],
    });
    render(<EmptyState />);
    expect(context()).toBe("workspace");
  });

  it("offers chain suggestions on a chain page", () => {
    pathname.value = "/chain/ch1";
    useChainStore.setState({ chains: { ch1: { id: "ch1", name: "Checkout" } } as never });
    render(<EmptyState />);
    expect(context()).toBe("chain");
  });

  it("offers request suggestions when a saved request is open", () => {
    useCollectionsStore.setState({
      requests: [{ id: "r1", collectionId: "c1", name: "R" }] as never,
    });
    useTabsStore.setState({
      tabs: [{
          tabId: "t1",
          requestId: "r1",
          type: "http",
          name: "R",
          url: "https://a.test",
          method: "GET",
          headers: [],
          params: [],
          auth: { type: "none" },
          body: { type: "none", content: "" },
        }] as never,
      activeTabId: "t1",
    });
    render(<EmptyState />);
    expect(context()).toBe("request");
  });

  it("sends a clicked suggestion through the store", () => {
    render(<EmptyState />);
    fireEvent.click(screen.getAllByTestId("relay-suggestion")[0]);
    expect(useRelayStore.getState().pendingPrompt).toBe(en.suggestions.createRequest);
  });

  const shown = () => screen.getAllByTestId("relay-suggestion").map((el) => el.textContent);

  const httpTab = (tabId: string, requestId: string) =>
    ({
      tabId,
      requestId,
      type: "http",
      name: tabId,
      url: "https://a.test",
      method: "GET",
      headers: [],
      params: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
    }) as never;

  const response = (status: number) =>
    ({ status, statusText: "", headers: {}, body: "", duration: 1, size: 0, url: "", method: "GET", timestamp: 0 }) as never;

  it("suggests creating a request when no tab is open", () => {
    render(<EmptyState />);
    expect(shown()).toContain(en.suggestions.createRequest);
  });

  it("suggests why a 500 response failed and replaces it after a tab switch", () => {
    useTabsStore.setState({
      tabs: [httpTab("t1", "r1"), { tabId: "t2", requestId: null, type: "graphql", name: "G", url: "", headers: [], query: "", variables: "", operationName: "", auth: { type: "none" } }] as never,
      activeTabId: "t1",
    });
    useResponseStore.setState({ responses: { t1: response(500) } });
    render(<EmptyState />);
    expect(shown()).toContain(en.suggestions.whyDidThisFail);

    act(() => useTabsStore.setState({ activeTabId: "t2" }));
    expect(shown()).not.toContain(en.suggestions.whyDidThisFail);
    expect(shown()).toContain(en.suggestions.graphqlExplainQuery);
  });

  it("suggests assertions for a request with a successful response", () => {
    useTabsStore.setState({ tabs: [httpTab("t1", "r1")], activeTabId: "t1" });
    useResponseStore.setState({ responses: { t1: response(200) } });
    render(<EmptyState />);
    expect(shown()[0]).toBe(en.suggestions.addAssertions);
  });

  it("re-derives suggestions when responses are cleared (new conversation)", () => {
    useTabsStore.setState({
      tabs: [httpTab("t1", "r1")],
      activeTabId: "t1",
    });
    useResponseStore.setState({ responses: { t1: response(500) } });
    render(<EmptyState />);
    expect(shown()).toContain(en.suggestions.whyDidThisFail);

    act(() => useResponseStore.setState({ responses: {} }));
    expect(shown()).not.toContain(en.suggestions.whyDidThisFail);
    expect(shown()).toContain(en.suggestions.addAssertions);
  });

  it("toggles the what-Relay-can-see disclosure", () => {
    render(<EmptyState />);
    expect(screen.queryByTestId("relay-see-what-body")).toBeNull();
    fireEvent.click(screen.getByTestId("relay-see-what"));
    expect(screen.getByTestId("relay-see-what-body")).toHaveTextContent(en.context.seeWhatBody);
    fireEvent.click(screen.getByTestId("relay-see-what"));
    expect(screen.queryByTestId("relay-see-what-body")).toBeNull();
  });

  it("renders the large decorative logo in the foreground colour", () => {
    render(<EmptyState />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveClass("size-12");
    expect(logo).toHaveClass("text-foreground");
    expect(logo).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render the legacy sparkle icon", () => {
    render(<EmptyState />);
    // The RelayLogo replaces the sparkle glyph in the empty state
    expect(screen.getByTestId("relay-logo")).toBeInTheDocument();
    // Ensure no lucide-sparkles icon exists
    const sparklesSvgs = screen
      .getByTestId("relay-empty")
      .querySelectorAll("svg.lucide-sparkles");
    expect(sparklesSvgs).toHaveLength(0);
  });
});
