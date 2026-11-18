/** @vitest-environment happy-dom */

import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { GeneralSection } from "./GeneralSection";

afterEach(cleanup);

describe("GeneralSection chain execution", () => {
  it("renders the localized concurrency copy", () => {
    render(
      <GeneralSection
        showHealthMonitor
        showCodeGen
        setSetting={vi.fn()}
        onRestartTour={vi.fn()}
        chainConcurrency={4}
        onChainConcurrencyChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Chain execution")).toBeInTheDocument();
    expect(screen.getByLabelText("Concurrency")).toHaveValue(4);
  });
});

function renderSection(overrides: Partial<React.ComponentProps<typeof GeneralSection>> = {}) {
  const props = {
    showHealthMonitor: true,
    showCodeGen: false,
    setSetting: vi.fn(),
    onRestartTour: vi.fn(),
    chainConcurrency: 4,
    onChainConcurrencyChange: vi.fn(),
    ...overrides,
  };
  render(<GeneralSection {...props} />);
  return props;
}

describe("GeneralSection controls", () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: "en", confirmCloseUnsavedTabs: true });
  });

  it("shows the current language in the language row", () => {
    useSettingsStore.setState({ locale: "fr" });
    renderSection();

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByTestId("language-select")).toHaveTextContent("Français");
  });

  it("saves the language chosen from the list", async () => {
    const { setSetting } = renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("language-select"));
    await user.click(await screen.findByRole("option", { name: "日本語" }));

    expect(setSetting).toHaveBeenCalledWith("locale", "ja");
  });

  it("toggles the feature switches through setSetting", () => {
    const { setSetting } = renderSection();
    const [health, codeGen] = screen.getAllByRole("switch");

    fireEvent.click(health);
    fireEvent.click(codeGen);

    expect(setSetting).toHaveBeenCalledWith("showHealthMonitor", false);
    expect(setSetting).toHaveBeenCalledWith("showCodeGen", true);
  });

  it("toggles the ask-before-closing-unsaved-tabs setting", () => {
    const { setSetting } = renderSection();
    const row = screen.getByText("Ask before closing unsaved tabs");
    const toggle = row.closest("div.flex")?.querySelector('[role="switch"]');

    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle as Element);

    expect(setSetting).toHaveBeenCalledWith("confirmCloseUnsavedTabs", false);
  });

  it("reports a changed concurrency as a number", () => {
    const { onChainConcurrencyChange } = renderSection();

    fireEvent.change(screen.getByTestId("chain-concurrency-input"), {
      target: { value: "6" },
    });

    expect(onChainConcurrencyChange).toHaveBeenCalledWith(6);
  });

  it("ignores a value that does not parse as a number", () => {
    const { onChainConcurrencyChange } = renderSection();
    const input = screen.getByTestId("chain-concurrency-input");
    // Number inputs sanitise letters away in the DOM; a text-typed input
    // delivers the raw string the guard defends against.
    input.setAttribute("type", "text");

    fireEvent.change(input, { target: { value: "abc" } });

    expect(onChainConcurrencyChange).not.toHaveBeenCalled();
  });

  it("restarts the tour from the help button", () => {
    const { onRestartTour } = renderSection();

    fireEvent.click(screen.getByTestId("restart-tour-btn"));

    expect(onRestartTour).toHaveBeenCalledTimes(1);
  });
});
