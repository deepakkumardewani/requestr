/** @vitest-environment happy-dom */

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

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
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
  useRelayStore.setState({ attachedItems: [] });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({ collections: [], requests: [], folders: [] });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useChainStore.setState({ chains: {} });
});

const tabChip = { kind: "tab", id: "t1", label: "Get orders" } as const;
const collectionChip = { kind: "collection", id: "c1", label: "Payments" } as const;
const envChip = { kind: "environment", id: "e1", label: "Prod" } as const;

describe("ContextChips", () => {
  it("renders nothing and no Using text when nothing is attached", () => {
    seed();
    const { container } = render(<ContextChips />);
    expect(screen.queryByTestId("relay-context-chips")).toBeNull();
    expect(container).toBeEmptyDOMElement();
    expect(document.body).not.toHaveTextContent("Using:");
  });

  it("shows only attached items with their kind and name", () => {
    seed();
    useRelayStore.setState({ attachedItems: [tabChip, collectionChip, envChip] });
    render(<ContextChips />);
    const chips = screen.getAllByTestId("relay-context-chip");
    expect(chips.map((chip) => chip.dataset.kind)).toEqual(["tab", "collection", "environment"]);
    expect(chips[0]).toHaveTextContent("TabGet orders");
    expect(chips[1]).toHaveTextContent("Payments");
    expect(chips[2]).toHaveTextContent("Prod");
  });

  it("keeps a tab chip labelled when its tab is not the active one", () => {
    useRelayStore.setState({ attachedItems: [tabChip] });
    render(<ContextChips />);
    expect(screen.getByTestId("relay-context-chip")).toHaveTextContent("Get orders");
  });

  it("removing a chip detaches it", () => {
    seed();
    useRelayStore.setState({ attachedItems: [tabChip, collectionChip] });
    render(<ContextChips />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Payments from context" }));
    expect(screen.getAllByTestId("relay-context-chip")).toHaveLength(1);
    expect(useRelayStore.getState().attachedItems).toEqual([tabChip]);
  });

  it("hides an attached item once it is deleted from the workspace", () => {
    seed();
    useRelayStore.setState({ attachedItems: [collectionChip] });
    render(<ContextChips />);
    expect(screen.getAllByTestId("relay-context-chip")).toHaveLength(1);
    act(() => useCollectionsStore.setState({ collections: [] }));
    expect(screen.queryByTestId("relay-context-chip")).toBeNull();
  });

  it("never shows a secret in a chip label", () => {
    useRelayStore.setState({
      attachedItems: [{ kind: "tab", id: "t1", label: `Token ${JWT_SECRET}` }],
    });
    render(<ContextChips />);
    expect(screen.getByTestId("relay-context-chips")).not.toHaveTextContent(JWT_SECRET);
  });
});
