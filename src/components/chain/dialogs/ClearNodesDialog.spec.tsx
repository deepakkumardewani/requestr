/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en/chain.json";
import { ClearNodesDialog } from "./ClearNodesDialog";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) =>
    ns === "chain" ? (en as Record<string, string>)[key] : key,
}));

afterEach(cleanup);

function Harness({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>invoker</button>
      <ClearNodesDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={onConfirm}
      />
    </>
  );
}

describe("ClearNodesDialog", () => {
  it("calls onConfirm once when confirmed", () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("invoker"));
    expect(screen.getByTestId("clear-nodes-dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.clearNodesConfirm }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls nothing on Cancel and closes", () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("invoker"));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByTestId("clear-nodes-dialog")).toBeNull();
  });

  it("calls nothing on Escape and returns focus to the invoker", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const invoker = screen.getByText("invoker");
    invoker.focus();
    fireEvent.click(invoker);
    fireEvent.keyDown(screen.getByTestId("clear-nodes-dialog"), {
      key: "Escape",
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByTestId("clear-nodes-dialog")).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(invoker));
  });

  it("copy mentions undo and kept history, never 'can't be undone'", () => {
    for (const text of [en.clearNodesDescription, en.clearEdgesDescription]) {
      expect(text).not.toMatch(/can't be undone/i);
      expect(text).toMatch(/Cmd\+Z/);
    }
    expect(en.clearNodesDescription).toMatch(/history is kept/i);
  });
});
