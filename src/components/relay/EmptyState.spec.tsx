/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STARTER_KEYS } from "@/lib/relay/suggestions";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { EmptyState } from "./EmptyState";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
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
  useRelayStore.setState({ pendingPrompt: null, attachedItems: [] });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({ collections: [], requests: [], folders: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useResponseStore.setState({ responses: {} });
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

describe("EmptyState", () => {
  it("has real copy for every starter", () => {
    for (const key of STARTER_KEYS) {
      expect(en.emptyState.starters[key]).toEqual(expect.any(String));
    }
  });

  it("leads with the Relay logo", () => {
    render(<EmptyState />);
    expect(screen.getByTestId("relay-logo")).toBeInTheDocument();
  });

  it("shows the three starters and no Using text", () => {
    render(<EmptyState />);
    expect(shown()).toEqual(STARTER_KEYS.map((key) => en.emptyState.starters[key]));
    expect(screen.getByTestId("relay-empty")).not.toHaveTextContent("Using:");
  });

  it("shows identical starters whichever tab or response is open", () => {
    const { unmount } = render(<EmptyState />);
    const baseline = shown();
    unmount();

    useCollectionsStore.setState({
      requests: [{ id: "r1", collectionId: "c1", name: "R" }] as never,
    });
    useTabsStore.setState({ tabs: [httpTab("t1", "r1")], activeTabId: "t1" });
    useResponseStore.setState({ responses: { t1: { status: 500 } as never } });
    render(<EmptyState />);
    expect(shown()).toEqual(baseline);

    act(() => useTabsStore.setState({ tabs: [], activeTabId: null }));
    expect(shown()).toEqual(baseline);
  });

  it("sends a clicked starter through the store", () => {
    render(<EmptyState />);
    fireEvent.click(screen.getAllByTestId("relay-suggestion")[0]);
    expect(useRelayStore.getState().pendingPrompt).toBe(en.emptyState.starters.one);
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
    const sparklesSvgs = screen.getByTestId("relay-empty").querySelectorAll("svg.lucide-sparkles");
    expect(sparklesSvgs).toHaveLength(0);
  });
});
