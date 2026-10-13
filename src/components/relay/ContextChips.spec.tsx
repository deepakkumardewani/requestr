/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/relay.json";
import { JWT_SECRET } from "@/lib/relay/redact.corpus";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { ContextChips } from "./ContextChips";

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
  useRelayStore.setState({ removedChipKeys: [] });
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

  it("never shows a secret in a chip label", () => {
    seed(`Token ${JWT_SECRET}`);
    render(<ContextChips />);
    expect(screen.getByTestId("relay-context-chips")).not.toHaveTextContent(JWT_SECRET);
  });
});
