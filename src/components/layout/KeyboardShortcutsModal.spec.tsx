/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHORTCUT_GROUPS } from "@/app/settings/constants";
import { isMac } from "@/lib/platform";
import { useUIStore } from "@/stores/useUIStore";
import enShortcuts from "../../../messages/en/shortcuts.json";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";

vi.mock("@/lib/platform", () => ({ isMac: vi.fn(() => false) }));

afterEach(() => {
  cleanup();
});

describe("KeyboardShortcutsModal", () => {
  // Literal expectations (not derived from SHORTCUT_GROUPS) so a dropped or
  // mislabelled binding fails here instead of passing tautologically.
  it("renders the chain group with every real binding, aliases included", () => {
    vi.mocked(isMac).mockReturnValue(false);
    render(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);

    const groupCard = screen
      .getByText("Chain canvas")
      .closest("div.rounded-lg") as HTMLElement;
    const rows = Array.from(
      groupCard.querySelectorAll<HTMLElement>("div.divide-y > div"),
    ).map((row) => [
      within(row).getByText(/.+/, { selector: "span.text-sm" }).textContent,
      Array.from(row.querySelectorAll("kbd")).map((k) => k.textContent),
    ]);

    expect(rows).toEqual([
      ["Run chain", ["Ctrl", "Enter"]],
      ["Stop chain", ["Ctrl", "."]],
      ["Undo", ["Ctrl", "Z"]],
      ["Redo", ["Ctrl", "Shift", "Z"]],
      ["Delete selection", ["Delete", "Backspace"]],
      ["Duplicate selection", ["Ctrl", "D"]],
      ["Copy selection", ["Ctrl", "C"]],
      ["Paste", ["Ctrl", "V"]],
      ["Select all", ["Ctrl", "A"]],
      ["Open block menu", ["Ctrl", "Shift", "K", "/"]],
      ["Auto-layout", ["L"]],
      ["Fit view", ["F"]],
      ["Find node", ["Ctrl", "F"]],
      ["Keyboard shortcuts (canvas)", ["?"]],
    ]);
  });

  it("renders every registry group heading", () => {
    render(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);

    for (const group of SHORTCUT_GROUPS) {
      expect(screen.getByText(enShortcuts[group.labelKey as keyof typeof enShortcuts])).toBeInTheDocument();
    }
  });

  it("explains Success/Fail handle semantics under the Chain canvas group", () => {
    render(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);

    expect(
      screen.getByText(/Success handles connect to what runs next/i),
    ).toBeInTheDocument();
  });

  it("narrows the visible groups when searching", () => {
    render(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "run chain" },
    });

    expect(screen.getByText("Chain canvas")).toBeInTheDocument();
    expect(screen.queryByText("Tabs")).not.toBeInTheDocument();
  });

  it("shows a localized empty state when nothing matches", () => {
    render(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "zzz" },
    });

    expect(screen.getByText(/No shortcuts match/)).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(<KeyboardShortcutsModal open onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    expect(onOpenChange).toHaveBeenCalled();
  });

  it("offers Show tips only when tips are dismissed, and restores them", () => {
    useUIStore.setState({ hintsDismissed: false });
    const { rerender } = render(
      <KeyboardShortcutsModal open onOpenChange={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Show tips" }),
    ).not.toBeInTheDocument();

    useUIStore.setState({ hintsDismissed: true });
    rerender(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show tips" }));
    expect(useUIStore.getState().hintsDismissed).toBe(false);
  });
});
