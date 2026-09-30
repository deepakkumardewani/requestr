/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHORTCUT_GROUPS } from "@/app/settings/constants";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";

afterEach(() => {
  cleanup();
});

describe("KeyboardShortcutsModal", () => {
  it("renders a Chain canvas group with exactly the registered bindings", () => {
    render(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);

    const chainGroup = SHORTCUT_GROUPS.find(
      (g) => g.label === "Chain canvas",
    );
    expect(chainGroup).toBeDefined();

    const heading = screen.getByText("Chain canvas");
    const groupCard = heading.closest("div.rounded-lg");
    expect(groupCard).not.toBeNull();

    const rows = within(groupCard as HTMLElement).getAllByText(
      /.+/,
      { selector: "span.text-sm" },
    );
    expect(rows).toHaveLength(chainGroup?.shortcuts.length ?? 0);
  });

  it("renders every group with exactly the registered bindings (full registry parity)", () => {
    render(<KeyboardShortcutsModal open onOpenChange={vi.fn()} />);

    for (const group of SHORTCUT_GROUPS) {
      const heading = screen.getByText(group.label);
      const groupCard = heading.closest("div.rounded-lg");
      expect(groupCard).not.toBeNull();

      const rows = within(groupCard as HTMLElement).getAllByText(/.+/, {
        selector: "span.text-sm",
      });
      expect(rows).toHaveLength(group.shortcuts.length);
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

  it("closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(<KeyboardShortcutsModal open onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    expect(onOpenChange).toHaveBeenCalled();
  });
});
