/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isMac } from "@/lib/platform";
import { ShortcutsSection } from "./ShortcutsSection";

vi.mock("@/lib/platform", () => ({ isMac: vi.fn(() => true) }));

afterEach(() => {
  cleanup();
});

function rowFor(action: string): HTMLElement {
  return screen.getByText(action).closest("div.flex") as HTMLElement;
}

function capsIn(row: HTMLElement): (string | null)[] {
  return Array.from(row.querySelectorAll("kbd")).map((k) => k.textContent);
}

describe("ShortcutsSection", () => {
  it("renders every group with its id-keyed heading", () => {
    render(<ShortcutsSection />);
    const labels = screen
      .getAllByTestId("shortcut-group-label")
      .map((el) => el.textContent);
    expect(labels).toEqual([
      "General",
      "Request",
      "Workspace",
      "Tabs",
      "Chain canvas",
    ]);
  });

  it("uses ⌘ for mod bindings and Ctrl for ctrlOnly bindings on Mac", () => {
    render(<ShortcutsSection />);
    expect(capsIn(rowFor("Send Request"))).toEqual(["⌘", "Enter"]);
    expect(capsIn(rowFor("New Collection"))).toEqual(["Ctrl", "Shift", "N"]);
  });

  it("shows aliases after the primary binding", () => {
    render(<ShortcutsSection />);
    expect(capsIn(rowFor("Delete selection"))).toEqual(["Delete", "Backspace"]);
    expect(within(rowFor("Open block menu")).getAllByText("/")).not.toHaveLength(0);
    expect(capsIn(rowFor("Open block menu"))).toEqual(["⌘", "Shift", "K", "/"]);
  });

  it("lists the Relay shortcut with the Mac chord", () => {
    render(<ShortcutsSection />);
    expect(capsIn(rowFor("Toggle Relay"))).toEqual(["⌘", "I"]);
  });

  it("lists the Relay shortcut with Ctrl+Shift+L off Mac", () => {
    vi.mocked(isMac).mockReturnValueOnce(false);
    render(<ShortcutsSection />);
    expect(capsIn(rowFor("Toggle Relay"))).toEqual(["Ctrl", "Shift", "L"]);
  });

  it("lists New Relay chat with platform keycaps and the Firefox note", () => {
    render(<ShortcutsSection />);
    expect(capsIn(rowFor("New Relay chat"))).toEqual(["⌘", "Shift", "O"]);
    expect(screen.getByTestId("shortcut-note")).toHaveTextContent("Firefox");

    cleanup();
    vi.mocked(isMac).mockReturnValueOnce(false);
    render(<ShortcutsSection />);
    expect(capsIn(rowFor("New Relay chat"))).toEqual(["Ctrl", "Shift", "O"]);
  });

  it("omits the Relay shortcut when the feature flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    render(<ShortcutsSection />);
    expect(screen.queryByText("Toggle Relay")).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
