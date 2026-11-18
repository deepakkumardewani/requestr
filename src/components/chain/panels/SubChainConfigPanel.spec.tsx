/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChainEdge, ChainInput, SubChainBlock } from "@/types/chain";
import { SubChainConfigPanel } from "./SubChainConfigPanel";

describe("SubChainConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("returns null when node is missing even if open", () => {
    const { container } = render(
      <SubChainConfigPanel
        open
        node={null}
        referencedChainInputs={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("shows the no-inputs empty state when the referenced chain has none", async () => {
    const node: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "chain-b",
      inputBindings: {},
    };

    render(
      <SubChainConfigPanel
        open
        node={node}
        referencedChainInputs={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("The referenced chain has no inputs defined."),
      ).toBeInTheDocument();
    });
  });

  it("renders one row per referenced-chain input, pre-filled with existing bindings", () => {
    const node: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "chain-b",
      inputBindings: { token: "{{authToken}}" },
    };
    const inputs: ChainInput[] = [
      { key: "token", defaultValue: "", source: "literal" },
      { key: "userId", defaultValue: "42", source: "literal" },
    ];

    render(
      <SubChainConfigPanel
        open
        node={node}
        referencedChainInputs={inputs}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("{{authToken}}")).toBeInTheDocument();
    expect(screen.getByTestId("subchain-config-binding-userId")).toHaveValue("");
  });

  it("flags a required input with no binding and no fallback default", () => {
    const node: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "chain-b",
      inputBindings: {},
    };
    const inputs: ChainInput[] = [
      { key: "token", defaultValue: "", source: "literal" },
    ];

    render(
      <SubChainConfigPanel
        open
        node={node}
        referencedChainInputs={inputs}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Required input is not bound")).toBeInTheDocument();
  });

  it("does not flag an input that already has a default value", () => {
    const node: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "chain-b",
      inputBindings: {},
    };
    const inputs: ChainInput[] = [
      { key: "token", defaultValue: "fallback", source: "literal" },
    ];

    render(
      <SubChainConfigPanel
        open
        node={node}
        referencedChainInputs={inputs}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("Required input is not bound"),
    ).not.toBeInTheDocument();
  });

  it("saves updated bindings and closes", () => {
    const node: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "chain-b",
      inputBindings: {},
    };
    const inputs: ChainInput[] = [
      { key: "token", defaultValue: "", source: "literal" },
    ];
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <SubChainConfigPanel
        open
        node={node}
        referencedChainInputs={inputs}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("subchain-config-binding-token"), {
      target: { value: "{{upstreamToken}}" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith({
      ...node,
      inputBindings: { token: "{{upstreamToken}}" },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onDelete with the node id and closes", () => {
    const node: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "chain-b",
      inputBindings: {},
    };
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(
      <SubChainConfigPanel
        open
        node={node}
        referencedChainInputs={[]}
        onClose={onClose}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText("Delete node"));

    expect(onDelete).toHaveBeenCalledWith("sub-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("lists aliases from non-adjacent upstream edges", async () => {
    const node: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "chain-b",
      inputBindings: {},
    };
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [{ targetKey: "farToken" } as never],
      },
      { id: "e2", sourceRequestId: "b", targetRequestId: "sub-1", injections: [] },
    ];

    render(
      <SubChainConfigPanel
        open
        node={node}
        referencedChainInputs={[]}
        chainEdges={edges}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(await screen.findByText("{{farToken}}")).toBeInTheDocument();
  });
});
