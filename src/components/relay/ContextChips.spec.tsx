/** @vitest-environment happy-dom */

import { Profiler } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JWT_SECRET } from "@/lib/relay/redact.corpus";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { ContextChips } from "./ContextChips";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

const derivation = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/relay/contextBuilder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/relay/contextBuilder")>();
  return {
    ...actual,
    computeContextChips: (...args: Parameters<typeof actual.computeContextChips>) => {
      derivation.calls += 1;
      return actual.computeContextChips(...args);
    },
  };
});
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    const template = path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => values?.[name] ?? "");
  },
}));

const request = {
  id: "r1",
  collectionId: "c1",
  name: "Get orders",
  method: "GET" as const,
  url: "https://api.test/orders",
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 0,
  updatedAt: 0,
};

function seed(requestName = request.name) {
  useCollectionsStore.setState({
    collections: [{ id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 }],
    requests: [{ ...request, name: requestName }],
    folders: [],
  });
  useEnvironmentsStore.setState({
    environments: [{ id: "e1", name: "Prod", variables: [], createdAt: 0, updatedAt: 0 }],
    activeEnvId: "e1",
  });
  useTabsStore.setState({
    tabs: [{ ...request, tabId: "t1", requestId: "r1", isDirty: false, type: "http" }] as never,
    activeTabId: "t1",
  });
}

beforeEach(() => {
  pathname.value = "/";
  useRelayStore.setState({ removedChipKeys: [], dismissedAutoChipTabId: null, attachedItems: [] });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({ collections: [], requests: [], folders: [] });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useChainStore.setState({ chains: {} });
});

describe("ContextChips", () => {
  it("renders nothing for an empty workspace", () => {
    render(<ContextChips />);
    expect(screen.queryByTestId("relay-context-chips")).toBeNull();
  });

  it("shows request, collection and environment names", () => {
    seed();
    render(<ContextChips />);
    const chips = screen.getAllByTestId("relay-context-chip");
    expect(chips.map((chip) => chip.dataset.kind)).toEqual(["request", "collection", "environment"]);
    expect(chips[0]).toHaveTextContent("Get orders");
    expect(chips[1]).toHaveTextContent("Payments");
    expect(chips[2]).toHaveTextContent("Prod");
  });

  it("removing a chip hides it and records the key for the next payload", () => {
    seed();
    render(<ContextChips />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Payments from context" }));
    expect(screen.getAllByTestId("relay-context-chip")).toHaveLength(2);
    expect(useRelayStore.getState().removedChipKeys).toEqual(["collection:c1"]);
  });

  it("labels the request chip as the current tab and follows a tab switch", () => {
    seed();
    useCollectionsStore.setState({
      requests: [request, { ...request, id: "r2", name: "Get users" }],
    });
    useTabsStore.setState({
      tabs: [
        { ...request, tabId: "t1", requestId: "r1", isDirty: false, type: "http" },
        { ...request, id: "r2", name: "Get users", tabId: "t2", requestId: "r2", isDirty: false, type: "http" },
      ] as never,
    });
    render(<ContextChips />);
    expect(screen.getByTestId("relay-context-chip-label")).toHaveTextContent("Using: Get orders · current tab");

    act(() => useTabsStore.setState({ activeTabId: "t2" }));
    expect(screen.getByTestId("relay-context-chip-label")).toHaveTextContent("Using: Get users · current tab");
  });

  it("keeps the auto chip label keyboard reachable", () => {
    seed();
    render(<ContextChips />);
    expect(screen.getByTestId("relay-context-chip-label")).toHaveAttribute("tabindex", "0");
  });

  it("removing the auto chip dismisses it for the current tab and turn", () => {
    seed();
    render(<ContextChips />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Get orders from context" }));
    expect(useRelayStore.getState().dismissedAutoChipTabId).toBe("t1");
    expect(useRelayStore.getState().removedChipKeys).toEqual(["request:r1"]);
    expect(screen.queryByTestId("relay-context-chip-label")).toBeNull();
  });

  it("never shows a secret in a chip label", () => {
    seed(`Token ${JWT_SECRET}`);
    render(<ContextChips />);
    expect(screen.getByTestId("relay-context-chips")).not.toHaveTextContent(JWT_SECRET);
  });

  it("shows an attached item as a removable chip that does not touch the removed keys", () => {
    seed();
    useCollectionsStore.setState({
      requests: [request, { ...request, id: "r2", name: "Get users" }],
    });
    useRelayStore.getState().addAttachedItem({ kind: "request", id: "r2", label: "Get users" });
    render(<ContextChips />);
    const chip = screen.getAllByTestId("relay-context-chip").find((c) => c.textContent?.includes("Get users"));
    expect(chip).toHaveTextContent("RequestGet users");
    fireEvent.click(screen.getByRole("button", { name: "Remove Get users from context" }));
    expect(useRelayStore.getState().attachedItems).toEqual([]);
    expect(useRelayStore.getState().removedChipKeys).toEqual([]);
    expect(screen.queryByText("Get users")).toBeNull();
  });

  describe("memoization (NFR-7)", () => {
    function renderProfiled() {
      let commits = 0;
      render(
        <Profiler id="chips" onRender={() => (commits += 1)}>
          <ContextChips />
        </Profiler>,
      );
      return () => commits;
    }

    it("re-derives chips once per tab switch and not for unrelated store changes", () => {
      seed();
      useCollectionsStore.setState({
        requests: [request, { ...request, id: "r2", name: "Get users" }],
      });
      useTabsStore.setState({
        tabs: [
          { ...request, tabId: "t1", requestId: "r1", isDirty: false, type: "http" },
          { ...request, id: "r2", name: "Get users", tabId: "t2", requestId: "r2", isDirty: false, type: "http" },
        ] as never,
      });
      const commits = renderProfiled();
      const callsAfterMount = derivation.calls;
      const commitsAfterMount = commits();

      act(() => useTabsStore.setState({ activeTabId: "t2" }));
      expect(screen.getByTestId("relay-context-chip-label")).toHaveTextContent("Get users");
      expect(derivation.calls).toBe(callsAfterMount + 1);
      expect(commits()).toBeGreaterThan(commitsAfterMount);

      const callsAfterSwitch = derivation.calls;
      const commitsAfterSwitch = commits();
      act(() => useChainStore.setState({ chains: useChainStore.getState().chains }));
      act(() => useRelayStore.setState({ dismissedAutoChipTabId: null }));
      expect(derivation.calls).toBe(callsAfterSwitch);
      expect(commits()).toBe(commitsAfterSwitch);
    });
  });
});
