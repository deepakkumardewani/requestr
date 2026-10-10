/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceSection } from "./AppearanceSection";

afterEach(cleanup);

function renderSection(
  overrides: Partial<Parameters<typeof AppearanceSection>[0]> = {},
) {
  const props = {
    theme: "dark",
    onThemeChange: vi.fn(),
    accentColor: { r: 52, g: 211, b: 153 },
    onAccentColorChange: vi.fn(),
    ...overrides,
  };
  render(<AppearanceSection {...props} />);
  return props;
}

describe("AppearanceSection", () => {
  it("calls onThemeChange when a theme card is clicked", () => {
    const { onThemeChange } = renderSection({ theme: "light" });

    fireEvent.click(screen.getByTestId("theme-dark"));

    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("calls onAccentColorChange with rgb when an accent swatch is clicked", () => {
    const { onAccentColorChange } = renderSection();

    fireEvent.click(screen.getByTestId("accent-emerald"));

    expect(onAccentColorChange).toHaveBeenCalledWith({ r: 52, g: 211, b: 153 });
  });

  it("highlights the active theme and accent after mount", async () => {
    renderSection({ theme: "dark", accentColor: { r: 34, g: 197, b: 94 } });

    await vi.waitFor(() => {
      expect(screen.getByTestId("theme-dark").className).toMatch(/ring-theme-accent/);
    });
    expect(screen.getByTestId("accent-emerald").className).toMatch(
      /ring-theme-accent/,
    );
  });
});
