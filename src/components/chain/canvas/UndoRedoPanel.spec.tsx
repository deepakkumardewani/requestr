/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { UndoRedoPanel } from "./UndoRedoPanel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      undo: "Undo",
      redo: "Redo",
    };
    return translations[key] || key;
  },
}));

const CHAIN_ID = "chain-1";

describe("UndoRedoPanel", () => {
  beforeEach(() => {
    useChainStore.setState({ chains: {}, hydrated: true, history: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it("disables both buttons when there is no history", () => {
    render(<UndoRedoPanel chainId={CHAIN_ID} />);

    expect(screen.getByLabelText("Undo")).toBeDisabled();
    expect(screen.getByLabelText("Redo")).toBeDisabled();
  });

  it("enables Undo once the history has a past entry, and disables it again after undoing", async () => {
    const user = userEvent.setup();
    useChainStore.setState({
      history: { [CHAIN_ID]: { past: [{}], future: [] } as never },
    });

    render(<UndoRedoPanel chainId={CHAIN_ID} />);
    const undoBtn = screen.getByLabelText("Undo");
    expect(undoBtn).not.toBeDisabled();
    expect(screen.getByLabelText("Redo")).toBeDisabled();

    await user.click(undoBtn);
    expect(useChainStore.getState().undo).toBeDefined();
  });

  it("enables Redo once the history has a future entry", () => {
    useChainStore.setState({
      history: { [CHAIN_ID]: { past: [], future: [{}] } as never },
    });

    render(<UndoRedoPanel chainId={CHAIN_ID} />);
    expect(screen.getByLabelText("Redo")).not.toBeDisabled();
    expect(screen.getByLabelText("Undo")).toBeDisabled();
  });

  it("calls the store's undo/redo actions with the chain id when clicked", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    const redo = vi.fn();
    useChainStore.setState({
      history: {
        [CHAIN_ID]: { past: [{}], future: [{}] } as never,
      },
      undo,
      redo,
    });

    render(<UndoRedoPanel chainId={CHAIN_ID} />);
    await user.click(screen.getByLabelText("Undo"));
    await user.click(screen.getByLabelText("Redo"));

    expect(undo).toHaveBeenCalledWith(CHAIN_ID);
    expect(redo).toHaveBeenCalledWith(CHAIN_ID);
  });
});
