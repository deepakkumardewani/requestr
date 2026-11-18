/** @vitest-environment happy-dom */

import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ACCENT_COLORS } from "@/lib/constants";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { AppearanceSection } from "./AppearanceSection";

const FIRST_ACCENT = ACCENT_COLORS[0];

function renderSection(
  props: Partial<React.ComponentProps<typeof AppearanceSection>> = {},
) {
  const onThemeChange = vi.fn();
  const onAccentColorChange = vi.fn();
  render(
    <TooltipProvider>
      <AppearanceSection
        theme="dark"
        onThemeChange={onThemeChange}
        accentColor={undefined}
        onAccentColorChange={onAccentColorChange}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onThemeChange, onAccentColorChange };
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  useSettingsStore.setState({ reducedMotion: "system" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppearanceSection", () => {
  it("reports the clicked theme", () => {
    const { onThemeChange } = renderSection();

    fireEvent.click(screen.getByTestId("theme-light"));

    expect(onThemeChange).toHaveBeenCalledWith("light");
  });

  it("highlights only the active theme once mounted", () => {
    renderSection({ theme: "dark" });

    expect(screen.getByTestId("theme-dark").className).toContain(
      "ring-theme-accent/30",
    );
    expect(screen.getByTestId("theme-light").className).not.toContain(
      "ring-theme-accent/30",
    );
  });

  it("reports the chosen accent colour as an rgb triple", () => {
    const { onAccentColorChange } = renderSection();

    fireEvent.click(
      screen.getByTestId(`accent-${FIRST_ACCENT.label.toLowerCase()}`),
    );

    expect(onAccentColorChange).toHaveBeenCalledWith({
      r: FIRST_ACCENT.r,
      g: FIRST_ACCENT.g,
      b: FIRST_ACCENT.b,
    });
  });

  it("marks the matching accent as active with a check icon", () => {
    renderSection({
      accentColor: { r: FIRST_ACCENT.r, g: FIRST_ACCENT.g, b: FIRST_ACCENT.b },
    });
    const active = screen.getByTestId(
      `accent-${FIRST_ACCENT.label.toLowerCase()}`,
    );

    expect(active.querySelector("svg")).not.toBeNull();
    const other = screen.getByTestId(
      `accent-${ACCENT_COLORS[1].label.toLowerCase()}`,
    );
    expect(other.querySelector("svg")).toBeNull();
  });

  it("shows the current reduced-motion choice", () => {
    useSettingsStore.setState({ reducedMotion: "on" });
    renderSection();

    expect(screen.getByTestId("reduced-motion-select")).toHaveTextContent(
      "Always reduce",
    );
    expect(screen.getByText("Reduce motion")).toBeInTheDocument();
  });

  it("stores the reduced-motion option picked from the list", async () => {
    renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("reduced-motion-select"));
    await user.click(await screen.findByRole("option", { name: "Never reduce" }));

    expect(useSettingsStore.getState().reducedMotion).toBe("off");
  });
});
