/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { ChainList } from "./ChainList";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("ChainList", () => {
  beforeEach(() => {
    useChainStore.setState({ chains: {}, hydrated: true });
    push.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when there are no chains", () => {
    render(<ChainList isCreating={false} onCreatingDone={vi.fn()} />);

    expect(screen.getByText("No chains")).toBeInTheDocument();
  });

  it("lists chain names when chains exist", () => {
    useChainStore.getState().createChain("Flow A");

    render(<ChainList isCreating={false} onCreatingDone={vi.fn()} />);

    expect(screen.getByText("Flow A")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting a chain and does nothing on cancel", () => {
    const id = useChainStore.getState().createChain("Flow A");

    render(<ChainList isCreating={false} onCreatingDone={vi.fn()} />);

    fireEvent.click(screen.getByTestId(`chain-list-more-btn-${id}`));
    fireEvent.click(screen.getByTestId("chain-delete-btn"));

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(useChainStore.getState().chains[id]).toBeDefined();
  });

  it("deletes the chain only after confirming the dialog", () => {
    const id = useChainStore.getState().createChain("Flow A");

    render(<ChainList isCreating={false} onCreatingDone={vi.fn()} />);

    fireEvent.click(screen.getByTestId(`chain-list-more-btn-${id}`));
    fireEvent.click(screen.getByTestId("chain-delete-btn"));

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /yes, delete chain/i }),
    );

    expect(useChainStore.getState().chains[id]).toBeUndefined();
  });
});
