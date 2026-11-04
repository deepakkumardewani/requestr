/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isMac } from "@/lib/platform";
import { EmptyStateShortcuts } from "./EmptyStateShortcuts";

vi.mock("@/lib/platform", () => ({ isMac: vi.fn(() => false) }));

afterEach(cleanup);

function renderedRows(): string[][] {
  const list = screen.getByTestId("empty-state-shortcuts");
  return within(list)
    .getAllByRole("listitem")
    .map((item) => [
      item.querySelector("span")?.textContent ?? "",
      item.querySelector("kbd")?.textContent ?? "",
    ]);
}

describe("EmptyStateShortcuts", () => {
  it("lists registry labels with Ctrl chords off Mac", () => {
    vi.mocked(isMac).mockReturnValue(false);
    render(<EmptyStateShortcuts />);

    expect(renderedRows()).toEqual([
      ["New tab", "Ctrl+T"],
      ["Close Tab", "Ctrl+W"],
      ["Send Request", "Ctrl+Enter"],
      ["Save Current", "Ctrl+S"],
      ["Command Palette", "Ctrl+K"],
      ["New Collection", "Ctrl+Shift+N"],
    ]);
  });

  it("uses the command symbol for mod chords on Mac but keeps Ctrl for ctrlOnly ones", () => {
    vi.mocked(isMac).mockReturnValue(true);
    render(<EmptyStateShortcuts />);

    expect(renderedRows()).toEqual([
      ["New tab", "Ctrl+T"],
      ["Close Tab", "Ctrl+W"],
      ["Send Request", "⌘+Enter"],
      ["Save Current", "⌘+S"],
      ["Command Palette", "⌘+K"],
      ["New Collection", "Ctrl+Shift+N"],
    ]);
  });
});
