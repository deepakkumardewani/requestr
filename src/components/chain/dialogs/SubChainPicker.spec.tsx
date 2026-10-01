/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useChainStore } from "@/stores/useChainStore";
import type { Chain } from "@/types/chain";
import { SubChainPicker } from "./SubChainPicker";

function makeChain(overrides: Partial<Chain> & { id: string }): Chain {
  return {
    scope: "standalone",
    schemaVersion: 5,
    name: overrides.id,
    createdAt: 0,
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
    ...overrides,
  };
}

describe("SubChainPicker", () => {
  beforeEach(() => {
    useChainStore.setState({ chains: {}, hydrated: true, history: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it("lists chains other than the current one", () => {
    useChainStore.setState({
      chains: {
        "chain-a": makeChain({ id: "chain-a", name: "Chain A" }),
        "chain-b": makeChain({ id: "chain-b", name: "Chain B" }),
      },
    });

    render(
      <SubChainPicker
        open
        onClose={vi.fn()}
        currentChainId="chain-a"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Chain B")).toBeInTheDocument();
    expect(screen.queryByText("Chain A")).not.toBeInTheDocument();
  });

  it("labels a collection chain with the current collection name", () => {
    useCollectionsStore.setState({
      collections: [
        { id: "col-1", name: "Renamed", createdAt: 0, updatedAt: 0 },
      ],
    });
    useChainStore.setState({
      chains: {
        "chain-a": makeChain({ id: "chain-a", name: "Chain A" }),
        "col-1": makeChain({ id: "col-1", scope: "collection", name: "Stale" }),
      },
    });

    render(
      <SubChainPicker
        open
        onClose={vi.fn()}
        currentChainId="chain-a"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Renamed")).toBeInTheDocument();
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
  });

  it("narrows the list via search", () => {
    useChainStore.setState({
      chains: {
        "chain-a": makeChain({ id: "chain-a", name: "Chain A" }),
        "chain-b": makeChain({ id: "chain-b", name: "Auth flow" }),
        "chain-c": makeChain({ id: "chain-c", name: "Payments flow" }),
      },
    });

    render(
      <SubChainPicker
        open
        onClose={vi.fn()}
        currentChainId="chain-a"
        onSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("subchain-picker-search"), {
      target: { value: "auth" },
    });

    expect(screen.getByText("Auth flow")).toBeInTheDocument();
    expect(screen.queryByText("Payments flow")).not.toBeInTheDocument();
  });

  it("calls onSelect and onClose when a valid chain is picked", () => {
    useChainStore.setState({
      chains: {
        "chain-a": makeChain({ id: "chain-a", name: "Chain A" }),
        "chain-b": makeChain({ id: "chain-b", name: "Chain B" }),
      },
    });
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SubChainPicker
        open
        onClose={onClose}
        currentChainId="chain-a"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("subchain-picker-item-chain-b"));

    expect(onSelect).toHaveBeenCalledWith("chain-b");
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses a direct cyclic pick (a chain that already references the current chain)", () => {
    useChainStore.setState({
      chains: {
        "chain-a": makeChain({ id: "chain-a", name: "Chain A" }),
        "chain-b": makeChain({
          id: "chain-b",
          name: "Chain B",
          blocks: [
            {
              id: "sub-1",
              type: "subchain",
              chainId: "chain-a",
              inputBindings: {},
            },
          ],
        }),
      },
    });
    const onSelect = vi.fn();

    render(
      <SubChainPicker
        open
        onClose={vi.fn()}
        currentChainId="chain-a"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText(/would create a cycle/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("subchain-picker-item-chain-b"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("refuses a transitive cyclic pick (A -> B -> C -> A)", () => {
    useChainStore.setState({
      chains: {
        "chain-a": makeChain({ id: "chain-a", name: "Chain A" }),
        "chain-b": makeChain({ id: "chain-b", name: "Chain B" }),
        "chain-c": makeChain({
          id: "chain-c",
          name: "Chain C",
          blocks: [
            {
              id: "sub-1",
              type: "subchain",
              chainId: "chain-a",
              inputBindings: {},
            },
          ],
        }),
      },
    });

    // Chain B already references Chain C, which references back to Chain A.
    useChainStore.setState((state) => ({
      chains: {
        ...state.chains,
        "chain-b": {
          ...state.chains["chain-b"],
          blocks: [
            {
              id: "sub-1",
              type: "subchain",
              chainId: "chain-c",
              inputBindings: {},
            },
          ],
        },
      },
    }));
    const onSelect = vi.fn();

    render(
      <SubChainPicker
        open
        onClose={vi.fn()}
        currentChainId="chain-a"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("subchain-picker-item-chain-b"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows the no-results state when the search matches nothing", () => {
    useChainStore.setState({
      chains: {
        "chain-a": makeChain({ id: "chain-a", name: "Chain A" }),
        "chain-b": makeChain({ id: "chain-b", name: "Chain B" }),
      },
    });

    render(
      <SubChainPicker
        open
        onClose={vi.fn()}
        currentChainId="chain-a"
        onSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("subchain-picker-search"), {
      target: { value: "nonexistent" },
    });

    expect(screen.getByText("No chains found")).toBeInTheDocument();
  });
});
