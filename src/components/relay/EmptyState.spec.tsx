/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY_CATEGORIES } from "@/lib/relay/capabilities";
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
  useRelayStore.setState({ pendingPrompt: null, composerPrefill: null, mentionRequest: null, attachedItems: [] });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({ collections: [], requests: [], folders: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useResponseStore.setState({ responses: {} });
});

const shown = () => screen.getAllByTestId("relay-capability-starter").map((el) => el.textContent);

const allExamples = CAPABILITY_CATEGORIES.flatMap((category) => category.examples);

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
    for (const example of allExamples) {
      const [, category, , n] = example.promptKey.split(".");
      const examples = en.capabilities[category as keyof typeof en.capabilities] as {
        examples: Record<string, string>;
      };
      expect(examples.examples[n]).toEqual(expect.any(String));
    }
  });

  it("leads with the Relay logo", () => {
    render(<EmptyState />);
    expect(screen.getByTestId("relay-logo")).toBeInTheDocument();
  });

  it("shows every capability starter, the title and no Using text", () => {
    render(<EmptyState />);
    expect(shown()).toHaveLength(allExamples.length);
    const empty = screen.getByTestId("relay-empty");
    expect(empty).toHaveTextContent(en.capabilities.empty.title);
    expect(empty).toHaveTextContent(en.capabilities.empty.description);
    expect(empty).not.toHaveTextContent("Using:");
    expect(screen.getByTestId("relay-capabilities-panel")).toHaveAttribute("data-variant", "empty");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByTestId("relay-capability-see-list")).toBeNull();
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

  it("sends a clicked target-free starter through the store", () => {
    render(<EmptyState />);
    fireEvent.click(screen.getAllByTestId("relay-capability-starter").find((el) => el.getAttribute("data-example") === "read-2") as HTMLElement);
    expect(useRelayStore.getState().pendingPrompt).toBe(en.capabilities.read.examples["2"]);
  });

  it("prefills the draft and asks for a target when the starter needs one", () => {
    render(<EmptyState />);
    fireEvent.click(screen.getAllByTestId("relay-capability-starter").find((el) => el.getAttribute("data-example") === "read-1") as HTMLElement);
    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBeNull();
    expect(state.composerPrefill).toBe(en.capabilities.read.examples["1"]);
    expect(state.mentionRequest).toEqual({ kind: "request", hintKey: "slash.hint.request" });
  });

  it("renders the large decorative logo in the foreground colour", () => {
    render(<EmptyState />);
    const logo = screen.getByTestId("relay-logo");
    expect(logo).toHaveClass("size-16");
    expect(logo).toHaveClass("text-foreground");
    expect(logo).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render the legacy sparkle icon", () => {
    render(<EmptyState />);
    const sparklesSvgs = screen.getByTestId("relay-empty").querySelectorAll("svg.lucide-sparkles");
    expect(sparklesSvgs).toHaveLength(0);
  });
});
